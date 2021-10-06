import React, { FC, useEffect, useState } from 'react';
import {
  Button, 
  Card, 
  Divider,
  Empty,
  PageHeader, 
  Space, 
  Spin, 
  Typography, 
} from 'antd';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { web3 } from '@project-serum/anchor';
import { Loader, PublicKey } from '@solana/web3.js';
import { 
  initTreasury, 
  initGrant, 
  useAccounts, 
  useProgram, 
  useProvider, 
  useTreasuryAccountPk, 
  removeGrantFromTreasury,
  useGrantAccount,
  GrantAccount,
  unlockGrant} from '../lib/program';
import BN from "bn.js";
import GrantCreate, { GrantCreateParams } from './GrantCreate';
import GrantDetails from './GrantDetails';

const { Title } = Typography;

enum Page {
  Empty,
  Details,
  Create
}

const Home: FC = () => {
  const wallet = useWallet();
  const provider = useProvider();
  const program = useProgram();
  const accounts = useAccounts();
  const treasuryPk = useTreasuryAccountPk();
  const [selectedGrantPk, setSelectedGrantPk] = useState<Nullable<PublicKey>>(null);
  // TODO: make navigation routable
  const [page, setPage] = useState<Page>(Page.Empty);

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

  const handleCreateGrant = async (params: GrantCreateParams): Promise<boolean> => {
    console.log("create with params: ", params);

    if (!provider || !program || !accounts?.treasury || !treasuryPk) {
      console.log("Create grant: missing account fields");
      return false;
    }

    // const destWalletAddress = new PublicKey("JDgFLjT4fAYbPG9ucoQn6RZ2Shd42ybJCxp9hSbxWeqd");

    const periodToVestIntervalSec = {
      "day": 24 * 3600,
      "week": 7 * 24 * 3600,
      "month": 30 * 7 * 24 * 3600
    }

    try {
      await initGrant(
        provider, 
        program, 
        wallet, 
        new PublicKey(params.mintAddress),
        params.issueOptions,
        params.amount,
        params.duration[0].toDate(),
        params.duration[1].diff(params.duration[0], "seconds"),
        params.cliff?.diff(params.duration[0], "seconds") || 0,
        periodToVestIntervalSec[params.period],
        new PublicKey(params.recipient), 
        treasuryPk);
      return true;
    } catch (err) {
      console.log("Error calling initGrant:", err);
      return false;
    }
  }

  const handleRemoveGrant = async (grantPk: PublicKey): Promise<boolean> => {
    if (!provider || !program || !treasuryPk) {
      console.log('Cannot remove grant!');
      return false;
    }
    try {
      await removeGrantFromTreasury(provider, program, wallet, treasuryPk, grantPk);
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  const handleRevokeGrant = async (grantPk: PublicKey): Promise<boolean> => {
    if (!provider || !program || !treasuryPk) {
      console.log('Cannot revoke grant!');
      return false;
    }
    try {
      await removeGrantFromTreasury(provider, program, wallet, treasuryPk, grantPk);
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  const handleUnlockGrant = async (grantPk: PublicKey, grant: GrantAccount): Promise<boolean> => {
    if (!provider || !program || !treasuryPk) {
      console.log('Cannot unlock grant!');
      return false;
    }
    try {
      await unlockGrant(provider, program, wallet, treasuryPk, grantPk, grant);
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  if (!accounts?.treasury) {
    return <EmptyState onCreateTreasury={handleCreateTreasury} />;
  }

  const handleSelectGrant = (grantAddress: string) => {
    setSelectedGrantPk(new PublicKey(grantAddress));
    setPage(Page.Details);
  }

  const shortStr = (str: string) => {
    const top = str.substr(0, 4);
    const bottom = str.substr(str.length - 4, 4);
    return `${top}...${bottom}`;
  }

  return (
    <div>
      <Title level={4}>Treasury Account</Title>
      <Divider />
      <Space align="start" size="large">
      <Space direction="vertical">
      <Button type="primary" onClick={() => setPage(Page.Create)}>+ New Grant</Button>
      {
        accounts.treasury.grantAccounts.map((v: BN) => (
          <Card key={v.toString()}>
            <Button type="link" onClick={() => handleSelectGrant(v.toString())}>
              {shortStr(v.toString())}
            </Button>
          </Card>
        ))
      }
      </Space>
      <Space>
        <Card style={{ width: "800px", minHeight:"600px"}}>
          {
            (page === Page.Create) ? (<GrantCreate onCreate={handleCreateGrant} />) : 
            (page === Page.Details && selectedGrantPk) ? (
              <GrantDetails 
                grantPk={selectedGrantPk}
                onRemove={handleRemoveGrant}
                onRevoke={handleRevokeGrant}
                onUnlock={handleUnlockGrant}
              />
            ) : (<Empty description="No Grant Selected" />)
          }
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
