import React, { FC, useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useHistory, useParams } from "react-router-dom";
import {
  Button,
  Card, 
  Empty,
  List,
  Space
} from 'antd';

import { PublicKey } from '@solana/web3.js';
import { useProvider } from '../hooks/network';
import usePsyProgram from '../hooks/psyProgram';
import useClient from '../hooks/spurClient';
import { GrantAccount } from '../lib/client';
import { exercise, unlockGrant } from '../lib/program';
import { shortSha } from '../util/text';
import ContGrantDetails from './ContGrantDetails';

const Contributor: FC = () => {
  const history = useHistory();
  const { id } = useParams<{ id: string}>();
  const provider = useProvider();
  const wallet = useWallet();
  const client = useClient();
  const psyProgram = usePsyProgram();

  const [grants, setGrants] = useState<GrantAccount[]>([]);
  const grant = grants.find(grant => grant.publicKey.toString() === id);

  const reloadGrants = useCallback(async () => {
    if (!client || !wallet?.publicKey) {
      setGrants([]);
      return;
    }
    const foundGrants = await client.findGrantsByRecipient(wallet.publicKey);
    const sortedGrants = foundGrants.sort((a: GrantAccount, b: GrantAccount): number => a.account.issueTs - b.account.issueTs);
    setGrants(sortedGrants);
  }, [client, wallet]);

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
    history.push(`/contributor/${grant.publicKey.toString()}`);
  }

  const handleUnlockGrant = async (grant: GrantAccount): Promise<boolean> => {
    try {
      await unlockGrant(psyProgram!, client!, provider!, wallet, grant);
      reloadGrants();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  const handleExerciseGrant = async (grant: GrantAccount): Promise<boolean> => {
    try {
      await exercise(
        psyProgram!,
        provider!,
        wallet,
        grant);
      reloadGrants();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  const isSelected = (pk: PublicKey): boolean => {
    if (!grant) {
      return false; 
    }
    return grant.publicKey.equals(pk);
  }

  return (
    <Space align="start" size="large" style={{ textAlign: "left", marginLeft: "-120px" }}>
      <Space direction="vertical">
      <List
        dataSource={grants}
        renderItem={grant => (
          <List.Item>
            <Button 
              type={isSelected(grant.publicKey) ? "default" : "link"} 
              onClick={() => handleSelectGrant(grant)}
            >
              {shortSha(grant.publicKey.toString())}
            </Button>
          </List.Item>
        )}
      />
      </Space>
      <Space>
        <Card style={{ width: "648px", minHeight:"648px", borderRadius: "8px" }}>
          {
            grant ? (
              <ContGrantDetails
                wallet={wallet.publicKey!}
                psyProgram={psyProgram!}
                grant={grant}
                onUnlock={handleUnlockGrant}
                onExercise={handleExerciseGrant}
              />
            ) : (<Empty description="No Grant Selected" />)
          }
        </Card>
      </Space>
    </Space>
  );
}

export default Contributor;
