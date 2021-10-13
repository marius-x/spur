import { useWallet } from '@solana/wallet-adapter-react';
import {
  Button,
  Card, Empty,
  Space
} from 'antd';
import React, { FC, useEffect, useState } from 'react';
import { useProvider } from '../hooks/network';
import usePsyProgram from '../hooks/psyProgram';
import useClient from '../hooks/spurClient';
import { GrantAccount } from '../lib/client';
import { exercise, unlockGrant } from '../lib/program';
import { shortSha } from '../util/text';
import ContGrantDetails from './ContGrantDetails';

enum Page {
  Empty,
  Details
}

const Contributor: FC = () => {
  const provider = useProvider();
  const wallet = useWallet();
  const client = useClient();
  const psyProgram = usePsyProgram();
  const [page, setPage] = useState<Page>(Page.Empty);
  const [selectedGrant, setSelectedGrant] = useState<Nullable<GrantAccount>>(null);

  const [grants, setGrants] = useState<GrantAccount[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(false);

  useEffect(() => {
    setLoadingGrants(true);
    const setAsync = async () => {
      if (!client || !wallet?.publicKey) {
        setGrants([]);
        setLoadingGrants(false);
        return;
      }
      const grantsFound = await client.findGrantsByRecipient(wallet.publicKey);
      setGrants(grantsFound);
      setLoadingGrants(false);
    };
    setAsync();
  }, [client, wallet]);

  const handleSelectGrant = (grant: GrantAccount) => {
    setSelectedGrant(grant);
    setPage(Page.Details);
  }

  const handleUnlockGrant = async (): Promise<boolean> => {
    try {
      await unlockGrant(psyProgram!, client!, provider!, wallet, selectedGrant!);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  const handleExerciseGrant = async (): Promise<boolean> => {
    try {
      await exercise(
        psyProgram!,
        provider!,
        wallet,
        selectedGrant!,
        10);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  return (
    <div>
      <Space align="start" size="large">
      <Space direction="vertical">
      {
        grants.map((grant: GrantAccount) => (
          <Card key={grant.publicKey.toString()}>
            <Button type="link" onClick={() => handleSelectGrant(grant)}>
              {shortSha(grant.publicKey.toString())}
            </Button>
          </Card>
        ))
      }
      </Space>
      <Space>
        <Card style={{ width: "800px", minHeight:"600px"}}>
          {
            (page === Page.Details && selectedGrant) ? (
              <ContGrantDetails 
                grant={selectedGrant}
                onUnlock={handleUnlockGrant}
                onExercise={handleExerciseGrant}
              />
            ) : (<Empty description="No Grant Selected" />)
          }
        </Card>
      </Space>
      </Space>
    </div>
  );
}

export default Contributor;
