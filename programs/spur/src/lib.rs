use anchor_lang::prelude::*;
use anchor_spl::token::{self, SetAuthority, Token, TokenAccount, Transfer};
use spl_token::instruction::AuthorityType;
use std::mem::size_of;

declare_id!("6ojRC5neU8YLjfiR3igYvxPyuJLfjYYASfoioPsCamAV");

#[program]
pub mod spur {
    use super::*;

    //const TREASURY_PDA_SEED: &[u8] = b"treasury";
    const GRANT_PDA_SEED: &[u8] = b"grant";

    pub fn init_treasury(
        ctx: Context<InitTreasury>,
        bump: u8
    ) -> ProgramResult {
        let treasury_account = &mut ctx.accounts.treasury_account;

        if treasury_account.initialized {
            return Err(ProgramError::AccountAlreadyInitialized);
        }
        let authority_wallet: Pubkey = ctx.accounts.authority_wallet.key();
        
        // let treasury_account_address = Pubkey::create_program_address(
        //     &[authority_wallet.as_ref(), &TREASURY_PDA_SEED[..], &[bump]], ctx.program_id).
        //     map_err(|_| ProgramError::InvalidSeeds)?;
        // if treasury_account_address != treasury_account.key() {
        //     return Err(ProgramError::IllegalOwner);
        // }
        treasury_account.initialized = true;
        treasury_account.authority_wallet = authority_wallet;
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
        grant_account.grant_token_account = grant_token_account;

        let treasury_account = &mut ctx.accounts.treasury_account;
        treasury_account.grant_accounts.push(grant_account.key());

        let (pda, _bump_seed) = Pubkey::find_program_address(&[GRANT_PDA_SEED], ctx.program_id);
        grant_account.pda = pda;

        token::set_authority(ctx.accounts.into(), AuthorityType::AccountOwner, Some(pda))?;
        Ok(())
    }

    pub fn remove_grant_from_treasury(
        ctx: Context<RemoveGrantFromTreasury>,
        grant_account: Pubkey,
    ) -> ProgramResult {
        let treasury_account = &mut ctx.accounts.treasury_account;
        let index = treasury_account.grant_accounts.iter().position(|&r| r == grant_account).unwrap();
        treasury_account.grant_accounts.remove(index);
        Ok(())
    }

    // pub fn unlock(
    //     ctx: Context<UnlockGrant>,
    // ) -> ProgramResult {
    //     let (_pda, bump_seed) = Pubkey::find_program_address(&[GRANT_PDA_SEED], ctx.program_id);
    //     let seeds = &[&GRANT_PDA_SEED[..], &[bump_seed]];

    //     token::transfer(
    //         ctx.accounts
    //             .into_transfer_context()
    //             .with_signer(&[&seeds[..]]),
    //             ctx.accounts.grant_account.amount_total,
    //     )?;

    //     // token::set_authority(
    //     //     ctx.accounts
    //     //         .into_set_authority_context()
    //     //         .with_signer(&[&seeds[..]]),
    //     //     AuthorityType::AccountOwner,
    //     //     Some(ctx.accounts.escrow_account.initializer_key),
    //     // )?;

    //     Ok(())
    // }
}

#[derive(Accounts)]
#[instruction(mint: Pubkey, bump: u8)]
pub struct InitTreasury<'info> {
    #[account(
        init,
        seeds = [authority_wallet.key().as_ref()],
        bump = bump,
        payer = authority_wallet,
        space = 320 //8 + size_of::<TreasuryAccount>() + 10 * size_of::<Pubkey>(),
    )]
    pub treasury_account: Account<'info, TreasuryAccount>,
    #[account(mut)]
    pub authority_wallet: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct AddGrantToTreasury<'info> {
    #[account(mut)]
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
        constraint = grant_token_account.amount >= amount_total
    )]
    pub grant_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = treasury_account.authority_wallet == authority_wallet.key())]
    pub treasury_account: Account<'info, TreasuryAccount>,
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

// #[derive(Accounts)]
// pub struct UnlockGrant<'info> {
//     #[account(mut)]
//     pub grant_account: Account<'info, GrantAccount>,
//     #[account(mut)]
//     pub grant_token_account: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub dest_token_account: Account<'info, TokenAccount>,
//     pub pda_account: AccountInfo<'info>,
//     pub system_program: Program<'info, System>,
//     pub token_program: Program<'info, Token>,
// }

// impl<'info> UnlockGrant<'info> {
//     fn into_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
//         let cpi_accounts = Transfer {
//             from: self.grant_token_account.to_account_info().clone(),
//             to: self.dest_token_account.to_account_info().clone(),
//             authority: self.pda_account.clone(),
//         };
//         let cpi_program = self.token_program.to_account_info();
//         CpiContext::new(cpi_program, cpi_accounts)
//     }
// }

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
    pub grant_token_account: Pubkey,
    pub last_unlock_ts: i64,
    pub amount_unlocked: u64,
    pub revoked: bool,
    pub pda: Pubkey,
}
