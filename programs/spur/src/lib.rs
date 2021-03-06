use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};
use spl_associated_token_account::{get_associated_token_address};
// //use spl_token::instruction::AuthorityType;
// use anchor_spl::associated_token;

use context::*;

mod account;
mod context;

declare_id!("BuyzX13Nh4XnV2U3M7krdKF8m39agkeedUD6veMMJim7");

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

    pub fn init_grant(
        ctx: Context<InitGrant>,
        bump: u8,
        option_market_key: Option<Pubkey>,
        amount_total: u64,
        issue_ts: i64,
        duration_sec: u64,
        initial_cliff_sec: u64,
        vest_interval_sec: u64,
        recipient_wallet: Pubkey,
    ) -> ProgramResult {
        let grant_account = &mut ctx.accounts.grant_account;
        grant_account.pda = ctx.accounts.pda.key();
        grant_account.bump = bump;
        grant_account.mint_address = ctx.accounts.mint.key();
        grant_account.option_market_key = option_market_key;
        grant_account.amount_total = amount_total;
        grant_account.issue_ts = issue_ts;
        grant_account.duration_sec = duration_sec;
        grant_account.initial_cliff_sec = initial_cliff_sec;
        grant_account.vest_interval_sec = vest_interval_sec;
        grant_account.sender_wallet = ctx.accounts.sender_wallet.key();
        grant_account.recipient_wallet = recipient_wallet;
        grant_account.grant_token_account = ctx.accounts.grant_token_account.key();
        grant_account.last_unlock_ts = 0;
        grant_account.amount_unlocked = 0;
        grant_account.revoked = false;
        token::transfer(ctx.accounts.into(), amount_total)?;
        Ok(())
    }

    pub fn revoke_grant(
        ctx: Context<RevokeGrant>,
    ) -> ProgramResult {
        let grant_account = &mut ctx.accounts.grant_account;
        grant_account.revoked = true;
        let seeds = &[&GRANT_PDA_SEED[..], &[grant_account.bump]];
        token::transfer(
            ctx.accounts
                .into_transfer_context()
                .with_signer(&[&seeds[..]]), 
            ctx.accounts.grant_token_account.amount)?;
        Ok(())
    }

    pub fn unlock_grant(
        ctx: Context<UnlockGrant>,
    ) -> ProgramResult {
        let grant_account = &mut ctx.accounts.grant_account;
        let expected_token_account = get_associated_token_address(
            &grant_account.recipient_wallet.clone(),
            &grant_account.mint_address.clone()
        );
        if expected_token_account !=
            *ctx.accounts.recipient_token_account.to_account_info().key {
            msg!("Invalid recipient associated token account!");
            return Err(ProgramError::InvalidArgument);
        }
        let grant_start_ts = grant_account.issue_ts;
        let grant_end_ts = grant_account.issue_ts + grant_account.duration_sec as i64;
        let unlock_end_ts = ctx.accounts.clock.unix_timestamp as i64;

        if unlock_end_ts <= grant_start_ts {
            msg!("Grant issue time is in the future!");
            return Err(ProgramError::InvalidArgument);
        }
        if grant_account.initial_cliff_sec > 0 {
            let initial_cliff_ts = grant_account.issue_ts + 
                grant_account.initial_cliff_sec as i64;
            if unlock_end_ts < initial_cliff_ts {
                msg!("Grant has not reached initial cliff");
                return Err(ProgramError::InvalidArgument);
            }
        }

        let mut unlock_amount_available = grant_account.amount_total;
        if unlock_end_ts < grant_end_ts {
            // Grant is not yet fully vested
            let grant_num_periods = (grant_account.duration_sec + grant_account.vest_interval_sec - 1)
                / grant_account.vest_interval_sec;
            let amount_per_period = grant_account.amount_total / grant_num_periods;
            let duration_since_issue_sec = (unlock_end_ts - grant_start_ts) as u64;
            let unlock_num_periods = duration_since_issue_sec / grant_account.vest_interval_sec;
            unlock_amount_available = amount_per_period * unlock_num_periods;
        }
        let unlock_amount = unlock_amount_available - grant_account.amount_unlocked;
        if unlock_amount <= 0 {
            msg!("No amount left to unlock!");
            return Err(ProgramError::InvalidArgument);
        }
        let seeds = &[&GRANT_PDA_SEED[..], &[grant_account.bump]];
        let cpi_accounts = Transfer {
            from: ctx.accounts.grant_token_account.to_account_info().clone(),
            to: ctx.accounts.recipient_token_account.to_account_info().clone(),
            authority: ctx.accounts.pda.clone(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(
            CpiContext::new(cpi_program, cpi_accounts).with_signer(&[&seeds[..]]),
            unlock_amount,
        )?;
        grant_account.amount_unlocked += unlock_amount;
        grant_account.last_unlock_ts = unlock_end_ts;
        Ok(())
    }
}
