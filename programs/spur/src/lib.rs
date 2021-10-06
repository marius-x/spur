use anchor_lang::prelude::*;
use anchor_spl::token::{self, SetAuthority, Token, TokenAccount, Transfer};
//use spl_associated_token_account::{get_associated_token_address};
use spl_token::instruction::AuthorityType;
use std::mem::size_of;

declare_id!("6ojRC5neU8YLjfiR3igYvxPyuJLfjYYASfoioPsCamAV");

const TREASURY_PDA_SEED: &[u8] = b"treasury";
const GRANT_PDA_SEED: &[u8] = b"grant";

#[program]
pub mod spur {
    use super::*;

    pub fn init_treasury(
        ctx: Context<InitTreasury>,
        bump: u8,
    ) -> ProgramResult {
        let treasury_account = &mut ctx.accounts.treasury_account;
        if treasury_account.initialized {
            return Err(ProgramError::AccountAlreadyInitialized);
        }
        treasury_account.initialized = true;
        treasury_account.authority_wallet = ctx.accounts.authority_wallet.key();
        treasury_account.bump = bump;
        treasury_account.grant_accounts = Vec::new();
        Ok(())
    }

    pub fn init_grant(
        ctx: Context<InitGrant>,
        mint_address: Pubkey,
        option_market_key: Option<Pubkey>,
        amount_total: u64,
        issue_ts: i64,
        duration_sec: u64,
        initial_cliff_sec: u64,
        vest_interval_sec: u64,
        sender_wallet: Pubkey,
        recipient_wallet: Pubkey,
        recipient_token_account: Pubkey,
        grant_token_account: Pubkey,
    ) -> ProgramResult {
        let grant_account = &mut ctx.accounts.grant_account;
        grant_account.mint_address = mint_address;
        grant_account.option_market_key = option_market_key;
        grant_account.amount_total = amount_total;
        grant_account.issue_ts = issue_ts;
        grant_account.duration_sec = duration_sec;
        grant_account.initial_cliff_sec = initial_cliff_sec;
        grant_account.vest_interval_sec = vest_interval_sec;
        grant_account.sender_wallet = sender_wallet;
        grant_account.recipient_wallet = recipient_wallet;
        grant_account.recipient_token_account = recipient_token_account;
        grant_account.grant_token_account = grant_token_account;

        // let dest_token_account = get_associated_token_address(
        //     &grant_account.recipient_wallet, &grant_account.mint_address);
        // if dest_token_account != recipient_token_account {
        //     msg!("Invalid recipient token account!");
        //     return Err(ProgramError::InvalidArgument);
        // }

        let (pda, _bump_seed) = Pubkey::find_program_address(&[GRANT_PDA_SEED], ctx.program_id);
        grant_account.pda = pda;

        token::set_authority(ctx.accounts.into(), AuthorityType::AccountOwner, Some(pda))?;
        Ok(())
    }

    pub fn add_grant_to_treasury(
        ctx: Context<AddGrantToTreasury>,
        grant_account: Pubkey,
    ) -> ProgramResult {
        let treasury_account = &mut ctx.accounts.treasury_account;
        treasury_account.grant_accounts.push(grant_account.key());
        Ok(())
    }

    pub fn remove_grant_from_treasury(
        ctx: Context<RemoveGrantFromTreasury>,
        grant_account: Pubkey,
    ) -> ProgramResult {
        let treasury_account = &mut ctx.accounts.treasury_account;
        let index = treasury_account.grant_accounts.iter().position(|&r| r == grant_account);
        if index.is_none() {
            msg!("Grant account not found in treasury!");
            return Err(ProgramError::InvalidArgument);
        }
        treasury_account.grant_accounts.remove(index.unwrap());
        Ok(())
    }

    pub fn unlock_grant(
        ctx: Context<UnlockGrant>,
    ) -> ProgramResult {
        let grant_account = &ctx.accounts.grant_account;
        let grant_start_ts = grant_account.issue_ts;
        let grant_end_ts = grant_account.issue_ts + grant_account.duration_sec as i64;

        let unlock_end_ts = ctx.accounts.clock.unix_timestamp as i64;

        if grant_account.initial_cliff_sec > 0 {
            let initial_cliff_ts = grant_account.issue_ts + 
                grant_account.initial_cliff_sec as i64;
            if unlock_end_ts < initial_cliff_ts {
                msg!("Grant has not reached initial cliff");
                return Err(ProgramError::InvalidArgument);
            }
        }

        let mut unlock_amount = grant_account.amount_total - 
            grant_account.amount_unlocked;

        if unlock_end_ts < grant_end_ts {
            let mut unlock_start_ts = grant_account.issue_ts;
            if grant_account.last_unlock_ts > 0 {
                unlock_start_ts = grant_account.last_unlock_ts;
            }
            let unlock_num_periods = (unlock_end_ts - unlock_start_ts) as u64 
                / grant_account.vest_interval_sec;
            let grant_num_periods = (grant_end_ts - grant_start_ts) as u64 
                / grant_account.vest_interval_sec;
            let amount_per_period = grant_account.amount_total / grant_num_periods;
            unlock_amount = amount_per_period * unlock_num_periods;
        }

        let (_pda, bump_seed) = Pubkey::find_program_address(&[GRANT_PDA_SEED], ctx.program_id);
        let seeds = &[&GRANT_PDA_SEED[..], &[bump_seed]];

        token::transfer(
            ctx.accounts
                .into_transfer_context()
                .with_signer(&[&seeds[..]]),
                unlock_amount,
        )?;
        Ok(())
    }
}

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
#[instruction(amount_total: u64)]
pub struct InitGrant<'info> {
    #[account(init, payer = authority_wallet, space = 8 + size_of::<GrantAccount>())]
    pub grant_account: Account<'info, GrantAccount>,
    #[account(
        mut,
        //constraint = grant_token_account.amount >= amount_total
    )]
    pub grant_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority_wallet: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

impl<'info> From<&mut InitGrant<'info>>
    for CpiContext<'_, '_, '_, 'info, SetAuthority<'info>>
{
    fn from(accounts: &mut InitGrant<'info>) -> Self {
        let cpi_accounts = SetAuthority {
            account_or_mint: accounts
                .grant_token_account
                .to_account_info()
                .clone(),
            current_authority: accounts.authority_wallet.to_account_info().clone(),
        };
        let cpi_program = accounts.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct UnlockGrant<'info> {
    #[account(mut)]
    pub grant_account: Account<'info, GrantAccount>,
    #[account(mut)]
    pub grant_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,
    pub pda_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

impl<'info> UnlockGrant<'info> {
    fn into_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.grant_token_account.to_account_info().clone(),
            to: self.recipient_token_account.to_account_info().clone(),
            authority: self.pda_account.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[account]
pub struct TreasuryAccount {
    pub initialized: bool,
    pub authority_wallet: Pubkey,
    pub bump: u8,
    pub grant_accounts: Vec<Pubkey>
}

#[account]
pub struct GrantAccount {
    pub mint_address: Pubkey,
    pub option_market_key: Option<Pubkey>,
    pub amount_total: u64,
    pub issue_ts: i64,
    pub duration_sec: u64,
    pub initial_cliff_sec: u64,
    pub vest_interval_sec: u64,
    pub sender_wallet: Pubkey,
    pub recipient_wallet: Pubkey,
    pub recipient_token_account: Pubkey,
    pub grant_token_account: Pubkey,
    pub last_unlock_ts: i64,
    pub amount_unlocked: u64,
    pub revoked: bool,
    pub pda: Pubkey,
}
