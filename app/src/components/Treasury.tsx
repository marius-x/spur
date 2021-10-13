import React, { FC, useEffect, useState } from 'react';
import {
  Button, 
  Card,
  Empty,
  Space,
} from 'antd';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { initGrant, revokeGrant} from '../lib/program';
import GrantCreate, { GrantCreateParams } from './GrantCreate';
import GrantDetails from './GrantDetails';
import { useProvider } from '../hooks/network';
import { shortSha } from '../util/text';
import useClient from '../hooks/spurClient';
import { unitOfTimeToSec } from '../util/time';
import usePsyProgram from '../hooks/psyProgram';
import { GrantAccount } from '../lib/client';

enum Page {
  Empty,
  Details,
  Create
}

const Treasury: FC = () => {
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
      const grantsFound = await client.findGrantsBySender(wallet.publicKey);
      setGrants(grantsFound);
    };
    setAsync();
  }, [client, wallet]);

  const handleSelectGrant = (grant: GrantAccount) => {
    setSelectedGrant(grant);
    setPage(Page.Details);
  }

  const handleCreateGrant = async (create: GrantCreateParams): Promise<boolean> => {
    try {
      await initGrant(
        psyProgram!,
        provider!, 
        client!,
        wallet, 
        new PublicKey(create.mintAddress),
        create.issueOptions,
        create.amount,
        create.duration[0],
        create.duration[1].diff(create.duration[0], "seconds"),
        create.cliff?.diff(create.duration[0], "seconds") || 0,
        unitOfTimeToSec(create.period),
        new PublicKey(create.recipient));
      return true;
    } catch (err) {
      console.error("error initializing grant:", err);
      return false;
    }
  }

  const handleRemoveGrant = async (grant: GrantAccount): Promise<boolean> => {
    
    return false
  }

  const handleRevokeGrant = async (grant: GrantAccount): Promise<boolean> => {
    try {
      await revokeGrant(client!, grant, wallet);
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
      <Button type="primary" onClick={() => setPage(Page.Create)}>+ New Grant</Button>
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
            (page === Page.Create) ? (<GrantCreate onCreate={handleCreateGrant} />) : 
            (page === Page.Details && selectedGrant) ? (
              <GrantDetails 
                grant={selectedGrant}
                onRemove={handleRemoveGrant}
                onRevoke={handleRevokeGrant}
              />
            ) : (<Empty description="No Grant Selected" />)
          }
        </Card>
      </Space>
      </Space>
    </div>
  );
}

export default Treasury;
