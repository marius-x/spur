import React, { FC, useEffect, useState } from 'react';
import { Button, Card, Divider, Layout, Space, Typography } from 'antd';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { web3 } from '@project-serum/anchor';
//import { PublicKey } from '@solana/web3.js';
import { initTreasury, initVesting, useAccounts, useProgram, useProvider, useTreasuryAccountPk } from './program';
import BN from "bn.js";

const { Title } = Typography;
const { SystemProgram, Keypair, PublicKey } = web3;

const Home: FC = () => {
  const wallet = useWallet();
  const provider = useProvider();
  const program = useProgram();
  const accounts = useAccounts();
  const treasuryPk = useTreasuryAccountPk();
  const [selectedVestingAccount, setSelectedVestingAccount] = useState<Nullable<string>>(null);

  if (!wallet.connected) {
    return <ConnectWallet />
  }

  const handleCreateTreasury = async () => {
    if (!program) {
      console.log('Program is not initialized!');
      return;
    }
    await initTreasury(program, wallet);
  }

  const handleCreateVesting = async () => {
    if (!provider || !program || !accounts?.treasury || !treasuryPk) {
      console.log('Canot create vesting account');
      return;
    }
    const amount = 100;
    const destWalletAddress = new PublicKey("JDgFLjT4fAYbPG9ucoQn6RZ2Shd42ybJCxp9hSbxWeqd");

    await initVesting(provider, program, wallet, amount, destWalletAddress, treasuryPk);
  }

  if (!accounts?.treasury) {
    return <EmptyState onCreateTreasury={handleCreateTreasury} />;
  }

  const handleSelectVestingAccount = (vestingAccount: string) => {
    setSelectedVestingAccount(vestingAccount);
  }

  return (
    <div>
      <Title level={4}>Treasury Account</Title>
      <Divider />
      <Space align="start" size="large">
      <Space direction="vertical">
      <Button type="primary" onClick={handleCreateVesting}>New Vesting Account</Button>
      {
        accounts.treasury.vestingAddresses.map((v: BN) => (
          <Card>
            <Button type="link" onClick={() => handleSelectVestingAccount(v.toString())}>
              {v.toString()}
            </Button>
          </Card>
        ))
      }
      </Space>
      <Space>
        <Card style={{ width: "460px", height:"460px"}}>
          {selectedVestingAccount ? (
            <Title level={5}>Vesting Account ({selectedVestingAccount})</Title>
          ) : (
            <div>No vesting account selected</div>
          )}
          
        </Card>
      </Space>
      </Space>
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
  <div style={{ textAlign: "center" }}>
    <Space>
      <Button onClick={() => onCreateTreasury()} className="card-button">Treasury Account</Button>
      <Button disabled className="card-button">Contributor Account</Button>
    </Space>
  </div>
);

export default Home;
