use anchor_lang::prelude::*;

#[account]
pub struct TreasuryAccount {
    pub initialized: bool,
    pub authority_wallet: Pubkey,
    pub bump: u8,
    pub grant_accounts: Vec<Pubkey>
}

#[account]
pub struct GrantAccount {
    pub sender_wallet: Pubkey,
    pub recipient_wallet: Pubkey,
    pub pda: Pubkey,
    pub bump: u8,
    pub mint_address: Pubkey,
    pub option_market_key: Option<Pubkey>,
    pub amount_total: u64,
    pub issue_ts: i64,
    pub duration_sec: u64,
    pub initial_cliff_sec: u64,
    pub vest_interval_sec: u64,
    pub grant_token_account: Pubkey,
    pub last_unlock_ts: i64,
    pub amount_unlocked: u64,
    pub revoked: bool,
}
