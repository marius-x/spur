import { deriveOptionKeyFromParams, feeAmountPerContract, getOptionByKey, getOrAddAssociatedTokenAccountTx, instructions, OptionMarketWithKey } from "@mithraic-labs/psy-american";
import * as anchor from '@project-serum/anchor';
import { Program, Provider } from '@project-serum/anchor';
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { WalletContextState } from '@solana/wallet-adapter-react';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Client, GrantAccount } from './client';


const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

export async function initGrant(
  psyProgram: Program,
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
    const decimals = await getDecimals(psyProgram.provider.connection, mintAddress);
    const optResp = await mintOptions(
      psyProgram, wallet, mintAddress, decimals, amountTotal, issueMoment);
    effectiveMintAddress = optResp.mintAddress;
    optIxs = optResp.ixs;
    optMarketKey = optResp.marketKey;
    optSigners = optResp.signers;
    amountTotal = decimals ? Math.trunc(amountTotal / decimals) : amountTotal;
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
//const underlyingAmountPerContract = new anchor.BN(1);

async function getDecimals(connection: Connection, mint: PublicKey) {
  const mintToken = new Token(connection, mint, TOKEN_PROGRAM_ID, new Keypair());
  const mintInfo = await mintToken.getMintInfo();
  return mintInfo.decimals;
}

// Fixed strike price 1Lamport per 1 token.
async function initOptionsMarket(
  psyProgram: Program,
  expirationTs: number,
  quoteMint: PublicKey,
  underlyingMint: PublicKey,
  underlyingAmount: number,
): Promise<Nullable<OptionMarketWithKey>> {
  const underlyingAmountPerContract = new anchor.BN(underlyingAmount);
  console.log("deriveOptionKeyFromParams..", 
    "programId", psyProgram.programId.toString(), 
    "expTs", expirationTs, 
    "quoteMint", quoteMint.toString(), 
    "underMint", underlyingMint.toString(),
    "quoteAmountPerContract", quoteAmountPerContract.toString(), 
    "underlyingAmountPerContract", underlyingAmountPerContract.toString());
  
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
      quoteAmountPerContract,
      quoteMint,
      underlyingAmountPerContract,
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
  decimals: number,
  amountTotal: number,
  issueMoment: moment.Moment,
): Promise<mintOptionsResponse> {
  const expirationTs = issueMoment.clone().startOf("month").add(10, "years").unix();
  const ixs: TransactionInstruction[] = [];

  const contractAmount = Math.pow(10, decimals); 
  const market = await initOptionsMarket(
    psyProgram, expirationTs, WrappedSol, mintAddress, contractAmount);
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

  const ix1 = await getOrAddAssociatedTokenAccountTx(
    optionTokenAccountPk, market.optionMint, psyProgram.provider, wallet.publicKey!);
  if (ix1) {
    ixs.push(ix1);
  }

  const writerTokenAccountPk = await Token.getAssociatedTokenAddress(
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    market.writerTokenMint,
    wallet.publicKey!
  );

  const ix2 = await getOrAddAssociatedTokenAccountTx(
    writerTokenAccountPk, market.writerTokenMint, psyProgram.provider, wallet.publicKey!);
  if (ix2) {
    ixs.push(ix2);
  }

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

  const optAmountTotal = decimals ? Math.trunc(amountTotal / decimals) : amountTotal;
  const {ix, signers} = await instructions.mintOptionInstruction(
    psyProgram,
    optionTokenAccountPk,
    writerTokenAccountPk,
    underlyingTokenAccountPk,
    new anchor.BN(optAmountTotal),
    market
  );
  if (ix) {
    ixs.push(ix);
  }

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

  return {
    ixs,
    signers,
    mintAddress: market.optionMint,
    marketKey: market.key
  };
}

export async function revokeGrant(
  client: Client, 
  grant: GrantAccount, 
  wallet: WalletContextState
) {
  const senderTokenAccountPk = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    grant.account.mintAddress,
    wallet.publicKey!
  );
  await client.revokeGrant(
    grant.publicKey,
    grant.account.grantTokenAccount,
    senderTokenAccountPk,
    wallet.publicKey!,
    []);
}

export async function unlockGrant(
  psyProgram: Program,
  client: Client,
  provider: Provider,
  wallet: WalletContextState,
  grant: GrantAccount
) {
  const ixs: TransactionInstruction[] = [];
  const destTokenAccountPk = await Token.getAssociatedTokenAddress(
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    grant.account.mintAddress,
    wallet.publicKey!
  );
  const ix = await getOrAddAssociatedTokenAccountTx(
    destTokenAccountPk, grant.account.mintAddress, provider, wallet.publicKey!);
  if (ix) {
    ixs.push(ix);
  }
  await client.unlockGrant(
    grant.publicKey,
    grant.account.grantTokenAccount,
    destTokenAccountPk,
    wallet.publicKey!,
    ixs,
    []
  );
  if (!grant.account.optionMarketKey) {
    return;
  }
  // const destTokenAccountPk = await Token.getAssociatedTokenAddress(
  //   SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  //   TOKEN_PROGRAM_ID,
  //   new PublicKey(grant.recipientWallet.toString()),
  //   wallet.publicKey!
  // );
  // const accounts = {
  //   grantAccount: grantPk,
  //   grantTokenAccount: new PublicKey(grant.grantTokenAccount.toString()),
  //   destTokenAccount: destTokenAccountPk,
  //   pdaAccount: new PublicKey(grant.pda.toString()),
  //   systemProgram: SystemProgram.programId,
  //   tokenProgram: TOKEN_PROGRAM_ID,
  //   clock: SYSVAR_CLOCK_PUBKEY,
  // };
  // console.log("accounts", accounts);
  // await program.rpc.unlockGrant(
  //   {
  //     accounts: {
  //       grantAccount: grantPk,
  //       grantTokenAccount: new PublicKey(grant.grantTokenAccount.toString()),
  //       destTokenAccount: destTokenAccountPk,
  //       pdaAccount: new PublicKey(grant.pda.toString()),
  //       systemProgram: SystemProgram.programId,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       clock: SYSVAR_CLOCK_PUBKEY,
  //     }
  //   }
  // );
}

export async function exercise(
  psyProgram: Program,
  provider: Provider,
  wallet: WalletContextState,
  grant: GrantAccount) {

  if (!grant.account.optionMarketKey) {
    console.log("not an options account");
    return;
  }
  
  const srcTokenAccountPk = await Token.getAssociatedTokenAddress(
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    grant.account.mintAddress,
    wallet.publicKey!
  );
  console.log("srcTokenAccount", srcTokenAccountPk.toString());

  const mint = new Token(
    psyProgram.provider.connection, grant.account.mintAddress, TOKEN_PROGRAM_ID, new Keypair());
  const accInfo = await mint.getAccountInfo(srcTokenAccountPk);
  console.log("amount", accInfo.amount.toString());
  const amount = accInfo.amount.toNumber();
  if (amount === 0) {
    throw new Error("Empty account!");
  }
  let market = await getOptionByKey(psyProgram, grant.account.optionMarketKey);
  if (!market) {
    return;
  }
  const destTokenAccountPk = await Token.getAssociatedTokenAddress(
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    market.underlyingAssetMint,
    wallet.publicKey!
  );
  console.log("destTokenAccountPk", destTokenAccountPk.toString());
  const quoteTokenAccountPk = await Token.getAssociatedTokenAddress(
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    market.quoteAssetMint,
    wallet.publicKey!
  );
  console.log("quoteTokenAccountPk", quoteTokenAccountPk.toString());
  //const ixs: TransactionInstruction[] = [];
  const ix1 = await getOrAddAssociatedTokenAccountTx(
    destTokenAccountPk, market.underlyingAssetMint, psyProgram.provider, wallet.publicKey!);
  const tx = new Transaction()
  if (ix1) {
    tx.add(ix1);
  }
  // const mint = new Token(provider.connection, market.optionMint, TOKEN_PROGRAM_ID, )
  const ix2 = await instructions.exerciseOptionsInstruction(
    psyProgram,
    new anchor.BN(amount),
    market,
    srcTokenAccountPk,
    destTokenAccountPk,
    quoteTokenAccountPk
  );
  if (ix2) {
    tx.add(ix2);
  }
  const res = await provider.send(tx);
  console.log("tx result: ", res);
}
