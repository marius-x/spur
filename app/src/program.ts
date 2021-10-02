import { useEffect, useState } from 'react';
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./spur.json";
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl, ConfirmOptions } from '@solana/web3.js';
import { Idl, Program, Provider, web3 } from '@project-serum/anchor';
import { useWallet, WalletContextState } from '@solana/wallet-adapter-react';
import { Token, TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";
import BN from "bn.js";

const { SystemProgram, Keypair } = web3;

export const programId = new PublicKey(idl.metadata.address);

const IS_LOCAL_NETWORK = true;
const CLUSTER_NETWORK: WalletAdapterNetwork = WalletAdapterNetwork.Devnet;

const MangoMint = new PublicKey("7dXaobJ79k4GY6xNnfpXSeXiHcxE3tvVtE3GTwJ7BgTv");

const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

const SEED_TREASURY_ACCOUNT = "treasury";

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
  vestingAddresses: BN[]
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

function isErrAccountNotExist(err: Error): boolean {
  return err && err.message.includes("Account does not exist");
}

export async function initTreasury(program: Program, wallet: WalletContextState) {
  if (!wallet.publicKey) {
    throw new Error("Empty wallet publicKey");
  }
  const [treasuryPk, bump] = await PublicKey.findProgramAddress(
    [wallet.publicKey.toBuffer()],
    program.programId
  );
  await program.rpc.initTreasury(MangoMint, bump, {
    accounts: {
      treasuryAccount: treasuryPk,
      authority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    }
  });
}

export async function initVesting(
  provider: Provider, 
  program: Program, 
  wallet: WalletContextState, 
  amount: number,
  destWalletAddress: PublicKey,
  treasuryAccount: PublicKey) {
  
  try {
    const vestingAccount = Keypair.generate();
    const vestingTokenAccount = Keypair.generate();

    console.log(`vestingAccount: ${vestingAccount.publicKey}`);
    console.log(`vestingTokenAccount: ${vestingTokenAccount.publicKey}`);

    const createVestingTokenAccountIx = SystemProgram.createAccount({
      programId: TOKEN_PROGRAM_ID,
      space: AccountLayout.span,
      lamports: await provider.connection.getMinimumBalanceForRentExemption(AccountLayout.span, 'singleGossip'),
      fromPubkey: wallet.publicKey!,
      newAccountPubkey: vestingTokenAccount.publicKey
    });

    const initVestingTokenAccountIx = Token.createInitAccountInstruction(
      TOKEN_PROGRAM_ID, 
      MangoMint,
      vestingTokenAccount.publicKey, 
      wallet.publicKey!
    );

    const srcTokenAccountPk = await Token.getAssociatedTokenAddress(
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      MangoMint,
      wallet.publicKey!
    );

    const destTokenAccountPk = await Token.getAssociatedTokenAddress(
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      MangoMint,
      destWalletAddress
    );

    const releaseTime = Date.now();

    const transferToVestingAccountIx = Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      srcTokenAccountPk,
      vestingTokenAccount.publicKey,
      wallet.publicKey!,
      [],
      amount
    );

    await program.rpc.initVesting(
      MangoMint,
      vestingTokenAccount.publicKey,
      destTokenAccountPk,
      new BN(amount),
      new BN(releaseTime),
      {
        instructions: [
          createVestingTokenAccountIx,
          initVestingTokenAccountIx,
          transferToVestingAccountIx
        ],
        accounts: {
          vestingAccount: vestingAccount.publicKey,
          vestingTokenAccount: vestingTokenAccount.publicKey,
          treasuryAccount: treasuryAccount,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [vestingTokenAccount, vestingAccount]
      }
    );
  } catch (err) {
    console.log(err);
  }
}
