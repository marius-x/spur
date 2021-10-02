use anchor_lang::prelude::*;
use anchor_spl::token::{self, SetAuthority, Token, TokenAccount, Transfer};
use spl_token::instruction::AuthorityType;

declare_id!("6ojRC5neU8YLjfiR3igYvxPyuJLfjYYASfoioPsCamAV");

#[program]
pub mod spur {
    use super::*;

    const VEST_PDA_SEED: &[u8] = b"vest";
    //const TREASURY_SEED: &str = "treasury";

    pub fn init_treasury(
        ctx: Context<InitTreasury>,
        mint_address: Pubkey,
        bump: u8
    ) -> ProgramResult {
        let treasury_account = &mut ctx.accounts.treasury_account;
        if treasury_account.initialized {
            return Err(ProgramError::AccountAlreadyInitialized);
        }
        // let owner_address: Pubkey = ctx.accounts.authority.key();
        // let owner_treasury_address: Pubkey = Pubkey::create_with_seed(
        //     &owner_address, TREASURY_SEED, ctx.program_id)?;
        // if owner_treasury_address != treasury_account.key() {
        //     return Err(ProgramError::IllegalOwner);
        // }
        treasury_account.initialized = true;
        treasury_account.owner_address = ctx.accounts.authority.key();
        treasury_account.mint_address = mint_address;
        treasury_account.bump = bump;
        treasury_account.vesting_addresses = Vec::new();
        Ok(())
    }

    pub fn init_vesting(
        ctx: Context<InitVesting>,
        mint_address: Pubkey,
        vesting_token_address: Pubkey,
        dest_token_address: Pubkey,
        amount: u64,
        release_time: u64,
    ) -> ProgramResult {
        let vesting_account = &mut ctx.accounts.vesting_account;
        vesting_account.mint_address = mint_address;
        vesting_account.dest_token_address = dest_token_address;
        vesting_account.amount = amount;
        vesting_account.release_time = release_time;
        vesting_account.vesting_token_address = vesting_token_address;

        let treasury_account = &mut ctx.accounts.treasury_account;
        treasury_account.vesting_addresses.push(vesting_account.key());

        let (pda, _bump_seed) = Pubkey::find_program_address(&[VEST_PDA_SEED], ctx.program_id);
        vesting_account.pda = pda;

        token::set_authority(ctx.accounts.into(), AuthorityType::AccountOwner, Some(pda))?;
        // token::transfer(
        //     ctx.accounts.into_vesting_token_account_context(),
        //     amount,
        // )?;

        Ok(())
    }

    pub fn unlock(
        ctx: Context<Unlock>,
    ) -> ProgramResult {
        let (_pda, bump_seed) = Pubkey::find_program_address(&[VEST_PDA_SEED], ctx.program_id);
        let seeds = &[&VEST_PDA_SEED[..], &[bump_seed]];

        token::transfer(
            ctx.accounts
                .into_transfer_context()
                .with_signer(&[&seeds[..]]),
                ctx.accounts.vesting_account.amount,
        )?;

        // token::set_authority(
        //     ctx.accounts
        //         .into_set_authority_context()
        //         .with_signer(&[&seeds[..]]),
        //     AuthorityType::AccountOwner,
        //     Some(ctx.accounts.escrow_account.initializer_key),
        // )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(mint: Pubkey, bump: u8)]
pub struct InitTreasury<'info> {
    #[account(
        init,
        seeds = [authority.key().as_ref()],
        bump = bump,
        payer = authority,
        space = 320,
    )]
    pub treasury_account: Account<'info, TreasuryAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct InitVesting<'info> {
    #[account(init, payer = user, space = 8 + 32 + 32 + 32 + 32 + 8 + 8)]
    pub vesting_account: Account<'info, VestingAccount>,
    #[account(
        mut,
        //constraint = escrow_account.taker_amount <= taker_deposit_token_account.amount,
    )]
    pub vesting_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = treasury_account.owner_address == user.key())]
    pub treasury_account: Account<'info, TreasuryAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

impl<'info> From<&mut InitVesting<'info>>
    for CpiContext<'_, '_, '_, 'info, SetAuthority<'info>>
{
    fn from(accounts: &mut InitVesting<'info>) -> Self {
        let cpi_accounts = SetAuthority {
            account_or_mint: accounts
                .vesting_token_account
                .to_account_info()
                .clone(),
            current_authority: accounts.user.to_account_info().clone(),
        };
        let cpi_program = accounts.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct Unlock<'info> {
    pub vesting_account: Account<'info, VestingAccount>,
    #[account(mut)]
    pub vesting_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub dest_token_account: Account<'info, TokenAccount>,
    pub pda_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

impl<'info> Unlock<'info> {
    fn into_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.vesting_token_account.to_account_info().clone(),
            to: self.dest_token_account.to_account_info().clone(),
            authority: self.pda_account.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[account]
pub struct TreasuryAccount {
    pub initialized: bool,
    pub owner_address: Pubkey,
    pub mint_address: Pubkey,
    pub bump: u8,
    pub vesting_addresses: Vec<Pubkey>
}

#[account]
pub struct VestingAccount {
    pub mint_address: Pubkey,
    pub vesting_token_address: Pubkey,
    pub dest_token_address: Pubkey,
    pub pda: Pubkey,
    pub amount: u64,
    pub release_time: u64,
}
