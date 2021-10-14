import { useWallet } from '@solana/wallet-adapter-react';
import {
  Button,
  Card, 
  Empty,
  List,
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

  useEffect(() => {
    const setAsync = async () => {
      if (!client || !wallet?.publicKey) {
        setGrants([]);
        return;
      }
      const foundGrants = await client.findGrantsByRecipient(wallet.publicKey);
      const sortedGrants = foundGrants.sort((a: GrantAccount, b: GrantAccount): number => a.account.issueTs - b.account.issueTs);
      setGrants(sortedGrants);
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
    if (!selectedGrant || !selectedGrant.account.optionMarketKey) {
      return false;
    }
    try {
      await exercise(
        psyProgram!,
        provider!,
        wallet,
        selectedGrant!);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  const isSelected = (grant: GrantAccount): boolean => {
    if (!selectedGrant || (page !== Page.Details)) { return false }
    return selectedGrant.publicKey.equals(grant.publicKey);
  }

  return (
    <div>
      <Space align="start" size="large">
      <Space direction="vertical">
      <List
        dataSource={grants}
        renderItem={grant => (
          <List.Item>
            <Button 
              type={isSelected(grant) ? "default" : "link"} 
              onClick={() => handleSelectGrant(grant)}
            >
              {shortSha(grant.publicKey.toString())}
            </Button>
          </List.Item>
        )}
      />
      </Space>
      <Space>
        <Card style={{ width: "800px", minHeight:"600px"}}>
          {
            (page === Page.Details && selectedGrant) ? (
              <ContGrantDetails
                wallet={wallet.publicKey!}
                psyProgram={psyProgram!}
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
