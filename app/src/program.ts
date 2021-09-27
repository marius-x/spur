import { useEffect, useState } from 'react';
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./spur.json";
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl, ConfirmOptions } from '@solana/web3.js';
import { Idl, Program, Provider } from '@project-serum/anchor';
import { useWallet, WalletContextState } from '@solana/wallet-adapter-react';

export const programId = new PublicKey(idl.metadata.address);

const IS_LOCAL_NETWORK = true;
const CLUSTER_NETWORK: WalletAdapterNetwork = WalletAdapterNetwork.Devnet;

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

function useProvider() {
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
  initialized: boolean
}

export interface Accounts {
  treasury?: TreasuryAccount
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Nullable<Accounts>>(null);
  const program = useProgram();
  const wallet = useWallet();

  useEffect(() => {
    const setAsync = async () => {
      if (!program || !wallet.connected || !wallet.publicKey) {
        setAccounts(null);
        return;
      }
      try {
        const treasuryPk = await PublicKey.createWithSeed(wallet.publicKey, SEED_TREASURY_ACCOUNT, programId);
        const treasury = await program.account.vestingAccount.fetch(treasuryPk) as TreasuryAccount;
        setAccounts({ treasury });
      } catch (err) {
        if (!isErrAccountNotExist(err as Error)) {
          console.log(`Error initializing accounts: ${err}`); 
        }
        setAccounts(null);
      }
    }
    setAsync();
  }, [wallet, program]);

  return accounts;
}

function isErrAccountNotExist(err: Error): boolean {
  return err && err.message.includes("Account does not exist");
}
