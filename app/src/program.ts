import { useEffect, useState } from 'react';
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./spur.json";
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl, ConfirmOptions, TransactionInstruction } from '@solana/web3.js';
import { Idl, Program, Provider, web3 } from '@project-serum/anchor';
import { useWallet, WalletContextState } from '@solana/wallet-adapter-react';
import { Token, TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";
import BN from "bn.js";

const { SystemProgram, Keypair } = web3;

export const programId = new PublicKey(idl.metadata.address);

const IS_LOCAL_NETWORK = true;
const CLUSTER_NETWORK: WalletAdapterNetwork = WalletAdapterNetwork.Devnet;

const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

const enc = new TextEncoder();
const TREASURY_PDA_SEED = "treasury";
const TREASURY_PDA_SEED_BUFFER = enc.encode(TREASURY_PDA_SEED);

const getEndpoint = () => {
  if (IS_LOCAL_NETWORK) {
    return "http://127.0.0.1:8899";
  }
  return clusterApiUrl(CLUSTER_NETWORK);
}

function getAnchorWallet(wallet: WalletContextState) {
  if (!wallet.connected) {
    return null;
  }
  if (
    !wallet.publicKey ||
    !wallet.signMessage || 
    !wallet.signTransaction || 
    !wallet.signAllTransactions) {
    return null;
  }
  return Object.assign({}, {
    publicKey: wallet.publicKey,
    signMessage: wallet.signMessage,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions
  });
}

export function useProvider() {
  const [provider, setProvider] = useState<Nullable<Provider>>(null);
  const wallet = useWallet();

  useEffect(() => {
    const anchorWallet = getAnchorWallet(wallet);
    if (!anchorWallet) {
      setProvider(null);
      return;
    }
    const opts: ConfirmOptions = {
      preflightCommitment: "processed"
    };
    const connection = new Connection(getEndpoint(), opts.preflightCommitment);
    setProvider(new Provider(connection, anchorWallet, opts));
  }, [wallet]);

  return provider;
}

export function useProgram() {
  const [program, setProgram] = useState<Nullable<Program>>(null);
  const provider = useProvider();

  useEffect(() => {
    if (!provider) {
      setProgram(null);
      return;
    }
    setProgram(new Program(idl as Idl, programId, provider));
  }, [provider]);

  return program;
}

export interface TreasuryAccount {
  initialized: boolean,
  grantAccounts: BN[]
}

export interface GrantAccount {
  mintAddress: BN,
  optionMarketKey: BN,
  amountTotal: BN,
  issueTime: BN,
  durationSec: BN,
  initialCliffSec: BN,
  vestIntervalSec: BN,
  senderWallet: BN,
  recipientWallet: BN,
  grantTokenAcount: BN,
  lastUnlockTime: BN,
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
        [wallet.publicKey.toBuffer()],
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

export function useGrantAccount(pk: PublicKey) {
  const [account, setAccount] = useState<Nullable<GrantAccount>>(null);
  const program = useProgram();

  useEffect(() => {
    const setAsync = async () => {
      if (!program) {
        setAccount(null);
        return;
      }
      try {
        console.log("loading " + pk);
        const grant = await program.account.grantAccount.fetch(pk) as GrantAccount;
        setAccount(grant);
      } catch (err) {
        console.log(`Error loading grant account: ${err}`);
      }
    };
    setAsync();
  }, [program, pk]);

  return account;
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
    [wallet.publicKey.toBuffer()],
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
  provider: Provider, 
  program: Program, 
  wallet: WalletContextState, 
  mintAddress: PublicKey,
  issueOptions: boolean,
  amountTotal: number,
  issueDate: Date,
  durationSec: number,
  initialCliffSec: number,
  vestIntervalSec: number,
  recipientWalletAddress: PublicKey,
  treasuryAccount: PublicKey,
): Promise<void> {
  const grantAccount = Keypair.generate();
  const grantTokenAccount = Keypair.generate();

  console.log(`grantAccount: ${grantAccount.publicKey}`);
  console.log(`grantTokenAccount: ${grantTokenAccount.publicKey}`);

  const createGrantTokenAccountIx = SystemProgram.createAccount({
    programId: TOKEN_PROGRAM_ID,
    space: AccountLayout.span,
    lamports: await provider.connection.getMinimumBalanceForRentExemption(AccountLayout.span, 'singleGossip'),
    fromPubkey: wallet.publicKey!,
    newAccountPubkey: grantTokenAccount.publicKey
  });

  const initGrantTokenAccountIx = Token.createInitAccountInstruction(
    TOKEN_PROGRAM_ID, 
    mintAddress,
    grantTokenAccount.publicKey, 
    wallet.publicKey!
  );

  const srcTokenAccountPk = await Token.getAssociatedTokenAddress(
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mintAddress,
    wallet.publicKey!
  );

  // const destTokenAccountPk = await Token.getAssociatedTokenAddress(
  //   SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  //   TOKEN_PROGRAM_ID,
  //   MangoMint,
  //   recipientWalletAddress
  // );

  const transferToVestingAccountIx = Token.createTransferInstruction(
    TOKEN_PROGRAM_ID,
    srcTokenAccountPk,
    grantTokenAccount.publicKey,
    wallet.publicKey!,
    [],
    amountTotal
  );

  let effectiveMintAddress = mintAddress;
  let optionsIxs: TransactionInstruction[] = [];
  let optMarketKey: Nullable<PublicKey> = null;

  if (issueOptions) {
    const mintOptResp = await mintOptions(
      provider, program, wallet, mintAddress, amountTotal, issueDate, durationSec);
    effectiveMintAddress = mintOptResp.mintAddress;
    optionsIxs = mintOptResp.ixs;
    optMarketKey = mintOptResp.marketKey;
  }

  // console.log("init params", 
  //   "mint", effectiveMintAddress.toString(),
  //   //"opt", optMarketKey,
  //   "amount", (new BN(amountTotal)).toString(),
  //   "issue", issueDate.getTime(),
  //   "duration", (new BN(durationSec)).toString(),
  //   "cliff", (new BN(initialCliffSec)).toString(),
  //   "interval", (new BN(vestIntervalSec)).toString(),
  //   "sender", wallet.publicKey?.toString(),
  //   "recipient", recipientWalletAddress.toString(),
  //   "grantToken", grantTokenAccount.publicKey.toString());

  await program.rpc.initGrant(
    effectiveMintAddress,
    optMarketKey,
    new BN(amountTotal),
    new BN(issueDate.getTime() / 1000),
    new BN(durationSec),
    new BN(initialCliffSec),
    new BN(vestIntervalSec),
    wallet.publicKey,
    recipientWalletAddress,
    grantTokenAccount.publicKey,
    {
      instructions: [
        ...optionsIxs,
        createGrantTokenAccountIx,
        initGrantTokenAccountIx,
        transferToVestingAccountIx
      ],
      accounts: {
        grantAccount: grantAccount.publicKey,
        grantTokenAccount: grantTokenAccount.publicKey,
        treasuryAccount: treasuryAccount,
        authorityWallet: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [grantTokenAccount, grantAccount]
    }
  );
}

interface mintOptionsResponse {
  ixs: TransactionInstruction[],
  mintAddress: PublicKey,
  marketKey: PublicKey
}

async function mintOptions(
  provider: Provider, 
  program: Program, 
  wallet: WalletContextState, 
  mintAddress: PublicKey,
  amountTotal: number,
  issueDate: Date,
  durationSec: number
): Promise<mintOptionsResponse> {
  return {
    ixs: [],
    mintAddress: Keypair.generate().publicKey,
    marketKey: Keypair.generate().publicKey
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
