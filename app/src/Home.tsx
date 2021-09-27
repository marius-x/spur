import React, { FC, useEffect, useState } from 'react';
import { Button, Card, Layout, Space, Typography } from 'antd';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { web3 } from '@project-serum/anchor';
import { useAccounts, useProgram } from './program';

const { Title } = Typography;
const { SystemProgram, Keypair } = web3;

const Home: FC = () => {
  const wallet = useWallet();
  const program = useProgram();
  const accounts = useAccounts();

  if (!wallet.connected) {
    return <ConnectWallet />
  }

  const handleCreateTreasury = async () => {
    console.log("Creating Treasury Account");
    // if (!program) {
    //   console.log('Program is not initialized!');
    //   return;
    // }
    // await program.rpc.initialize(
    //   {
    //     instructions: [
    //       createVestingTokenAccountIx,
    //       initVestingTokenAccountIx,
    //       transferToVestingAccountIx
    //     ],
    //     accounts: {
    //       vestingAccount: vestingAccount.publicKey,
    //       vestingTokenAccount: vestingTokenAccount.publicKey,
    //       user: provider.wallet.publicKey,
    //       systemProgram: SystemProgram.programId,
    //       tokenProgram: TOKEN_PROGRAM_ID,
    //     },
    //     signers: [vestingTokenAccount, vestingAccount]
    //   });
    }

  if (!accounts?.treasury) {
    return <EmptyState onCreateTreasury={handleCreateTreasury} />;
  }
  return (
    <div>
      <Button type="primary">Account Found</Button>
    </div>
  );
};

const ConnectWallet: FC = () => (
  <Space direction="vertical" align="center">
    <Title level={3}>Connect Wallet</Title>
    <WalletMultiButton />
  </Space>
  
);

const EmptyState: FC<{onCreateTreasury: any}> = ({ onCreateTreasury }) => (
  <Space>
    <Button onClick={() => onCreateTreasury()} className="card-button">Treasury Account</Button>
    <Button disabled className="card-button">Contributor Account</Button>
  </Space>
);

export default Home;
