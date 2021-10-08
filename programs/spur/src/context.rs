use crate::account::*;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use std::mem::size_of;

const TREASURY_PDA_SEED: &[u8] = b"treasury";
pub const GRANT_PDA_SEED: &[u8] = b"grant";

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct InitTreasury<'info> {
  #[account(
    init,
    seeds = [authority_wallet.key().as_ref(), &TREASURY_PDA_SEED[..]],
    bump = bump,
    payer = authority_wallet,
    space = 8 + size_of::<TreasuryAccount>() + 10 * size_of::<Pubkey>(),
  )]
  pub treasury_account: Account<'info, TreasuryAccount>,
  #[account(mut)]
  pub authority_wallet: Signer<'info>,
  pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct AddGrantToTreasury<'info> {
  #[account(mut)]
  //#[account(mut, constraint = treasury_account.authority_wallet == authority_wallet.key())]
  pub treasury_account: Account<'info, TreasuryAccount>,
  pub grant_account: Account<'info, GrantAccount>
}

#[derive(Accounts)]
pub struct RemoveGrantFromTreasury<'info> {
  #[account(mut)]
  pub treasury_account: Account<'info, TreasuryAccount>
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct InitGrant<'info> {
  #[account(
    mut,
    seeds = [b"grant".as_ref()],
    bump = bump
  )]
  pub pda: AccountInfo<'info>,
  #[account(
    init, 
    payer = sender_wallet, 
    space = 8 + size_of::<GrantAccount>()
  )]
  pub grant_account: Account<'info, GrantAccount>,
  #[account(
    init, 
    payer = sender_wallet, 
    token::mint = mint, 
    token::authority = pda
  )]
  pub grant_token_account: Account<'info, TokenAccount>,
  #[account(mut)]
  pub sender_wallet: Signer<'info>,
  #[account(mut)]
  pub sender_token_account: Account<'info, TokenAccount>,
  pub mint: Account<'info, Mint>,
  pub system_program: Program<'info, System>,
  pub token_program: Program<'info, Token>,
  pub rent: Sysvar<'info, Rent>,
}

impl<'info> From<&mut InitGrant<'info>>
for CpiContext<'_, '_, '_, 'info, Transfer<'info>>
{
  fn from(accounts: &mut InitGrant<'info>) -> Self {
    let cpi_accounts = Transfer {
      from: accounts.sender_token_account.to_account_info().clone(),
      to: accounts.grant_token_account.to_account_info().clone(),
      authority: accounts.sender_wallet.to_account_info().clone(),
    };
    let cpi_program = accounts.token_program.to_account_info();
    CpiContext::new(cpi_program, cpi_accounts)
  }
}

#[derive(Accounts)]
pub struct RevokeGrant<'info> {
  pub sender_wallet: Signer<'info>,
  #[account(mut)]
  pub pda: AccountInfo<'info>,
  #[account(
    mut,
    constraint = grant_account.sender_wallet == *sender_wallet.key
  )]
  pub grant_account: Account<'info, GrantAccount>,
  #[account(mut)] // close = sender_wallet
  pub grant_token_account: Account<'info, TokenAccount>,
  #[account(mut)]
  pub sender_token_account: Account<'info, TokenAccount>,
  pub token_program: Program<'info, Token>,
}

impl<'info> RevokeGrant<'info> {
  pub fn into_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
    let cpi_accounts = Transfer {
      from: self.grant_token_account.to_account_info().clone(),
      to: self.sender_token_account.to_account_info().clone(),
      authority: self.pda.clone(),
    };
    let cpi_program = self.token_program.to_account_info();
    CpiContext::new(cpi_program, cpi_accounts)
  }
}

#[derive(Accounts)]
pub struct UnlockGrant<'info> {
  #[account(mut)]
  pub grant_account: Account<'info, GrantAccount>,
  #[account(mut)]
  pub grant_token_account: Account<'info, TokenAccount>,
  pub recipient_wallet: Signer<'info>,
  #[account(mut)]
  pub recipient_token_account: Account<'info, TokenAccount>,
  pub pda: AccountInfo<'info>,
  pub system_program: Program<'info, System>,
  pub token_program: Program<'info, Token>,
  pub clock: Sysvar<'info, Clock>,
}

impl<'info> UnlockGrant<'info> {
  pub fn into_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
    let cpi_accounts = Transfer {
      from: self.grant_token_account.to_account_info().clone(),
      to: self.recipient_token_account.to_account_info().clone(),
      authority: self.pda.clone(),
    };
    let cpi_program = self.token_program.to_account_info();
    CpiContext::new(cpi_program, cpi_accounts)
  }
}
