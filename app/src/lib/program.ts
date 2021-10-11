import { useEffect, useState } from 'react';
import { AccountMeta, Connection, PublicKey, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl, ConfirmOptions, TransactionInstruction } from '@solana/web3.js';
import { Idl, Program, Provider, web3 } from '@project-serum/anchor';
import { useWallet, WalletContextState } from '@solana/wallet-adapter-react';
import { Token, TOKEN_PROGRAM_ID, AccountLayout, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import useProgram from "../hooks/spurProgram";
import { Client } from './client';
import { deriveOptionKeyFromParams, feeAmountPerContract, getOptionByKey, getOrAddAssociatedTokenAccountTx, instructions, OptionMarketWithKey, ProgramVersions, PsyAmericanIdl, PSY_AMERICAN_PROGRAM_IDS } from "@mithraic-labs/psy-american"
import * as anchor from '@project-serum/anchor';

const { SystemProgram, Keypair, SYSVAR_RENT_PUBKEY } = web3;


const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

const TREASURY_PDA_SEED = "treasury";

export interface TreasuryAccount {
  initialized: boolean,
  grantAccounts: BN[]
}

export interface GrantAccount {
  mintAddress: BN,
  optionMarketKey: BN,
  amountTotal: BN,
  issueTs: BN,
  durationSec: BN,
  initialCliffSec: BN,
  vestIntervalSec: BN,
  senderWallet: BN,
  recipientWallet: BN,
  grantTokenAccount: BN,
  lastUnlockTs: BN,
  amountUnlocked: BN,
  revoked: boolean,
  pda: BN
}

export interface Accounts {
  treasury?: TreasuryAccount
}

export function useTreasuryAccountPk() {
  const [treasuryAccountPk, setTreasuryAccountPk] = useState<Nullable<PublicKey>>(null);
  const wallet = useWallet();
  const program = useProgram();

  useEffect(() => {
    const setAsync = async () => {
      if (!wallet || !wallet.publicKey || !program) {
        return;
      }
      const [pk] = await PublicKey.findProgramAddress(
        [wallet.publicKey.toBuffer(), Buffer.from(TREASURY_PDA_SEED)],
        program.programId
      );
      setTreasuryAccountPk(pk);
    }
    setAsync();
  }, [wallet, program])

  return treasuryAccountPk;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Nullable<Accounts>>(null);
  const program = useProgram();
  const wallet = useWallet();
  const treasuryPk = useTreasuryAccountPk();

  useEffect(() => {
    const setAsync = async () => {
      if (!program || !wallet.connected || !wallet.publicKey || !treasuryPk) {
        setAccounts(null);
        return;
      }
      try {
        const treasury = await program.account.treasuryAccount.fetch(treasuryPk) as TreasuryAccount;
        setAccounts({ treasury });
        console.log(`treasury: ${JSON.stringify(treasury)}`);
      } catch (err) {
        if (!isErrAccountNotExist(err as Error)) {
          console.log(`Error initializing accounts: ${err}`); 
        }
        setAccounts(null);
      }
    }
    setAsync();
  }, [wallet, program, treasuryPk]);

  return accounts;
}

function isErrAccountNotExist(err: Error): boolean {
  return err && err.message.includes("Account does not exist");
}

export async function initTreasury(
  program: Program, 
  wallet: WalletContextState,
) {
  if (!wallet.publicKey) {
    throw new Error("Empty wallet publicKey");
  }
  const [treasuryPk, bump] = await PublicKey.findProgramAddress(
    [wallet.publicKey.toBuffer(), Buffer.from(TREASURY_PDA_SEED)],
    program.programId
  );
  await program.rpc.initTreasury(bump, {
    accounts: {
      treasuryAccount: treasuryPk,
      authorityWallet: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    }
  });
}

export async function initGrant(
  psyProgram: Program,
  provider: Provider, 
  client: Client, 
  wallet: WalletContextState, 
  mintAddress: PublicKey,
  issueOptions: boolean,
  amountTotal: number,
  issueMoment: moment.Moment,
  durationSec: number,
  initialCliffSec: number,
  vestIntervalSec: number,
  recipientWalletAddress: PublicKey,
): Promise<void> {
  let effectiveMintAddress = mintAddress;
  let optIxs: TransactionInstruction[] = [];
  let optSigners: anchor.web3.Signer[] = [];
  let optMarketKey: Nullable<PublicKey> = null;

  if (issueOptions) {
    const optResp = await mintOptions(
      psyProgram, wallet, mintAddress, amountTotal, issueMoment);
    effectiveMintAddress = optResp.mintAddress;
    optIxs = optResp.ixs;
    optMarketKey = optResp.marketKey;
    optSigners = optResp.signers;
  }

  const srcTokenAccountPk = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    effectiveMintAddress,
    wallet.publicKey!
  );

  console.log("optIxs", optIxs);
  console.log("optSigners", optSigners);
  
  await client.createGrant(
    effectiveMintAddress,
    optMarketKey,
    amountTotal,
    issueMoment.unix(),
    durationSec,
    initialCliffSec,
    vestIntervalSec,
    wallet.publicKey!,
    srcTokenAccountPk,
    recipientWalletAddress,
    optIxs,
    optSigners
  );
}

interface mintOptionsResponse {
  ixs: TransactionInstruction[],
  signers: anchor.web3.Signer[],
  mintAddress: PublicKey,
  marketKey: PublicKey
}

const WrappedSol = new PublicKey("So11111111111111111111111111111111111111112");

const quoteAmountPerContract = new anchor.BN(1);
const underlyingAmountPerContract = new anchor.BN(1);

interface optMarketInfo {
  optionMarketKey: PublicKey;
  optionMintKey: PublicKey;
  writerMintKey: PublicKey;
}

async function initOptionsMarket(
  psyProgram: Program,
  expirationTs: number,
  quoteMint: PublicKey,
  underlyingMint: PublicKey,
): Promise<Nullable<OptionMarketWithKey>> {
  console.log("deriveOptionKeyFromParams..", 
    "programId", psyProgram.programId.toString(), "expTs", expirationTs, "quoteMint", quoteMint.toString(), "underMint", underlyingMint.toString(),
    "quoteAmountPerContract", quoteAmountPerContract.toString(), "underlyingAmountPerContract", underlyingAmountPerContract.toString());
  const [optionMarketKey, someNumber] = await deriveOptionKeyFromParams({
    expirationUnixTimestamp: new anchor.BN(expirationTs),
    programId: psyProgram.programId,
    quoteAmountPerContract,
    quoteMint,
    underlyingAmountPerContract,
    underlyingMint
  });
  console.log("deriveOptionKeyFromParams", optionMarketKey.toString(), someNumber);
  let market = await getOptionByKey(psyProgram, optionMarketKey);
  if (!market) {
    console.log("initializeMarket..")
    const resp = await instructions.initializeMarket(psyProgram, {
      expirationUnixTimestamp: new anchor.BN(expirationTs),
      quoteAmountPerContract: new anchor.BN(1),
      quoteMint,
      underlyingAmountPerContract: new anchor.BN(1),
      underlyingMint,
    });
    console.log("initializeMarket", resp);
    market = await getOptionByKey(psyProgram, optionMarketKey);
  }
  return market;
}

async function mintOptions(
  psyProgram: Program, 
  wallet: WalletContextState, 
  mintAddress: PublicKey,
  amountTotal: number,
  issueMoment: moment.Moment,
): Promise<mintOptionsResponse> {
  console.log("issueMoment", issueMoment.toLocaleString());
  const expirationTs = issueMoment.clone().startOf("month").add(10, "years").unix();
  console.log("expirationTs", expirationTs);
  const ixs: TransactionInstruction[] = [];

  const market = await initOptionsMarket(psyProgram, expirationTs, WrappedSol, mintAddress);
  if (!market) {
    throw new Error("cannot initialize options market!");
  }
  console.log("market", 
    "optionMint", market.optionMint.toString(), 
    "writerMint", market.writerTokenMint.toString(), 
    "underlyingMint", market.underlyingAssetMint.toString());

  const m = market;
  console.log("m", 
  "optionMint", m.optionMint.toString(),
  "writerTokenMint", m.writerTokenMint.toString(),
  "underlyingAssetMint", m.underlyingAssetMint.toString(),
  "quoteAssetMint", m.quoteAssetMint.toString(),
  "underlyingAssetPool", m.underlyingAssetPool.toString(),
  "quoteAssetPool", m.quoteAssetPool.toString(),
  "mintFeeAccount", m.mintFeeAccount.toString(),
  "exerciseFeeAccount", m.exerciseFeeAccount.toString(),
  "underlyingAmountPerContract", m.underlyingAmountPerContract.toString(),
  "quoteAmountPerContract", m.quoteAmountPerContract.toString(),
  "expirationUnixTimestamp", m.expirationUnixTimestamp.toString(),
  "expired", m.expired,
  "bumpSeed", m.bumpSeed,
  );

  console.log("feeAmount", feeAmountPerContract(market.underlyingAmountPerContract).toNumber());

  const optionTokenAccountPk = await Token.getAssociatedTokenAddress(
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    market.optionMint,
    wallet.publicKey!
  );

  // const ixs1 = await getOrAddAssociatedTokenAccountTx(
  //   optionTokenAccountPk, market.optionMint, psyProgram.provider, wallet.publicKey!);

  // if (ixs1) {
  //   ixs.push(ixs1);
  // }

  const writerTokenAccountPk = await Token.getAssociatedTokenAddress(
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    market.writerTokenMint,
    wallet.publicKey!
  );

  // const ixs2 = await getOrAddAssociatedTokenAccountTx(
  //   writerTokenAccountPk, market.writerTokenMint, psyProgram.provider, wallet.publicKey!);
  
  // if (ixs2) {
  //   ixs.push(ixs2);
  // }

  const underlyingTokenAccountPk = await Token.getAssociatedTokenAddress(
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mintAddress,
    wallet.publicKey!
  );

  console.log("optionTokenAccountPk", optionTokenAccountPk.toString());
  console.log("writerTokenAccountPk", writerTokenAccountPk.toString());
  console.log("underlyingTokenAccountPk", underlyingTokenAccountPk.toString());

  // const ix = null;
  // const signers: anchor.web3.Signer[] = [];

  // const {tx} = await instructions.mintOptionsTx(
  //   psyProgram,
  //   optionTokenAccountPk,
  //   writerTokenAccountPk,
  //   underlyingTokenAccountPk,
  //   new anchor.BN(10),
  //   market
  // );

  // console.log("tx", tx);

  const {ix, signers} = await instructions.mintOptionInstruction(
    psyProgram,
    optionTokenAccountPk,
    writerTokenAccountPk,
    underlyingTokenAccountPk,
    new anchor.BN(1),
    market
  );

  // remainingAccounts.push({
  //   pubkey: optionTokenAccountPk,
  //   isWritable: true,
  //   isSigner: false,
  // });
  // remainingAccounts.push({
  //   pubkey: writerTokenAccountPk,
  //   isWritable: true,
  //   isSigner: false,
  // });

  console.log("ix", ix, "signers", signers);

  if (ix) {
    ixs.push(ix);
  }

  return {
    ixs,
    signers,
    mintAddress: market.optionMint,
    marketKey: market.key
  };
}

export async function removeGrantFromTreasury(
  provider: Provider, 
  program: Program, 
  wallet: WalletContextState,
  treasuryAccount: PublicKey,
  grantAccount: PublicKey 
) {
  await program.rpc.removeGrantFromTreasury(
    grantAccount, 
    {
      accounts: {
        treasuryAccount
      }
    }
  );
}

export async function revokeGrant(
  provider: Provider, 
  program: Program, 
  wallet: WalletContextState,
  treasuryAccount: PublicKey,
  grantAccount: PublicKey 
) {
  console.log("revoke not impl!");
  // await program.rpc.removeGrantFromTreasury(
  //   grantAccount, 
  //   {
  //     accounts: {
  //       treasuryAccount
  //     }
  //   }
  // );
}

export async function unlockGrant(
  provider: Provider, 
  program: Program, 
  wallet: WalletContextState,
  treasuryAccount: PublicKey,
  grantPk: PublicKey,
  grant: GrantAccount
) {
  const destTokenAccountPk = await Token.getAssociatedTokenAddress(
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    new PublicKey(grant.recipientWallet.toString()),
    wallet.publicKey!
  );
  const accounts = {
    grantAccount: grantPk,
    grantTokenAccount: new PublicKey(grant.grantTokenAccount.toString()),
    destTokenAccount: destTokenAccountPk,
    pdaAccount: new PublicKey(grant.pda.toString()),
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    clock: SYSVAR_CLOCK_PUBKEY,
  };
  console.log("accounts", accounts);
  await program.rpc.unlockGrant(
    {
      accounts: {
        grantAccount: grantPk,
        grantTokenAccount: new PublicKey(grant.grantTokenAccount.toString()),
        destTokenAccount: destTokenAccountPk,
        pdaAccount: new PublicKey(grant.pda.toString()),
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      }
    }
  );
}
