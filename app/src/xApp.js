import './App.css';
import { useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  Program, Provider, web3
} from '@project-serum/anchor';
import idl from './spur.json';
import BN from "bn.js";

import { getPhantomWallet, getSolletWallet } from '@solana/wallet-adapter-wallets';
import { useWallet, WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Token, TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";

const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

const MangoMint = new PublicKey("7dXaobJ79k4GY6xNnfpXSeXiHcxE3tvVtE3GTwJ7BgTv");
const destWalletAddress = new PublicKey("JDgFLjT4fAYbPG9ucoQn6RZ2Shd42ybJCxp9hSbxWeqd");

const wallets = [
  /* view list of available wallets at https://github.com/solana-labs/wallet-adapter#wallets */
  getPhantomWallet(),
  getSolletWallet()
]

const { SystemProgram, Keypair } = web3;
//const baseAccount = Keypair.generate();

const opts = {
  preflightCommitment: "processed"
}
const programID = new PublicKey(idl.metadata.address);

function App() {
  const [value, setValue] = useState(null);
  const [currVestingAcc, setCurrVestingAcc] = useState(null);
  const wallet = useWallet();

  async function getProvider() {
    /* create the provider and return it to the caller */
    /* network set to local network for now */
    const network = "http://127.0.0.1:8899";
    const connection = new Connection(network, opts.preflightCommitment);

    const provider = new Provider(
      connection, wallet, opts.preflightCommitment,
    );
    return provider;
  }

  async function createVesting() {
    const provider = await getProvider()
    /* create the program interface combining the idl, program ID, and provider */
    const program = new Program(idl, programID, provider);
    try {
      const vestingAccount = Keypair.generate();
      const vestingTokenAccount = Keypair.generate();

      console.log(`vestingAccount: ${vestingAccount.publicKey}`);
      console.log(`vestingTokenAccount: ${vestingTokenAccount.publicKey}`);

      const createVestingTokenAccountIx = SystemProgram.createAccount({
        programId: TOKEN_PROGRAM_ID,
        space: AccountLayout.span,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(AccountLayout.span, 'singleGossip'),
        fromPubkey: wallet.publicKey,
        newAccountPubkey: vestingTokenAccount.publicKey
      });

      const initVestingTokenAccountIx = Token.createInitAccountInstruction(
        TOKEN_PROGRAM_ID, 
        MangoMint,
        vestingTokenAccount.publicKey, 
        wallet.publicKey
      );

      const srcTokenAccountPk = await Token.getAssociatedTokenAddress(
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        MangoMint,
        wallet.publicKey
      );

      const destTokenAccountPk = await Token.getAssociatedTokenAddress(
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        MangoMint,
        destWalletAddress
      );

      const releaseTime = Date.now();
      const amount = 100;

      const transferToVestingAccountIx = Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        srcTokenAccountPk,
        vestingTokenAccount.publicKey,
        wallet.publicKey,
        [],
        amount
      );

      await program.rpc.initialize(
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
            user: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [vestingTokenAccount, vestingAccount]
        }
      );

      const account = await program.account.vestingAccount.fetch(vestingAccount.publicKey);
      console.log(
        `account: mint=${account.mintAddress}, dest=${account.destTokenAddress}, pda=${account.pda}, amount=${account.amount.toString()}, release=${account.releaseTime.toString()}`);
      setCurrVestingAcc(vestingAccount.publicKey);
      // setValue(account.count.toString());
    } catch (err) {
      console.log("Transaction error: ", err);
    }
  }

  async function unlockVesting() {
    const provider = await getProvider();
    const program = new Program(idl, programID, provider);
    const account = await program.account.vestingAccount.fetch(currVestingAcc);
    const vestUint8Arr = new TextEncoder("utf-8").encode("vest");
    const [pda, _bump_seed] = await PublicKey.findProgramAddress([vestUint8Arr], programID);
    console.log(`unlockVesting: vesting=${account.vestingTokenAddress}, dest=${account.destTokenAddress}, pda=${pda}`);

    await program.rpc.unlock({
      accounts: {
        vestingAccount: currVestingAcc,
        vestingTokenAccount: account.vestingTokenAddress,
        destTokenAccount: account.destTokenAddress,
        pdaAccount: pda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      }
    });

    //const account = await program.account.baseAccount.fetch(baseAccount.publicKey);
    //console.log('account: ', account);
    //setValue(account.count.toString());
  }

  if (!wallet.connected) {
    /* If the user's wallet is not connected, display connect wallet button. */
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop:'100px' }}>
        <WalletMultiButton />
      </div>
    )
  } else {
    return (
      <div className="App">
        <div>
          <button onClick={createVesting}>Create Vesting</button>
          {
            currVestingAcc && (<button onClick={unlockVesting}>Unlock Vesting</button>)
          }
          {
            value && value >= Number(0) ? (
              <h2>{value}</h2>
            ) : (
              <h3>Please create the counter.</h3>
            )
          }
        </div>
      </div>
    );
  }
}

const AppWithProvider = () => (
  <ConnectionProvider endpoint="http://127.0.0.1:8899">
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <App />
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
)

export default AppWithProvider;
