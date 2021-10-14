import React, { FC, useEffect, useState } from 'react';
import {
  Button, 
  Card,
  Empty,
  List,
  Space,
} from 'antd';
import { PublicKey, SystemProgram, Transaction, TransferParams, TransferWithSeedParams } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { initGrant, revokeGrant} from '../lib/program';
import GrantCreate, { GrantCreateParams } from './GrantCreate';
import GrantDetails from './GrantDetails';
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
      const foundGrants = await client.findGrantsBySender(wallet.publicKey);
      const sortedGrants = foundGrants.sort((a: GrantAccount, b: GrantAccount): number => a.account.issueTs - b.account.issueTs);
      setGrants(sortedGrants);
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
    // make it an instruction, since the program owns the account.
    // try {
    //   const balance = await provider!.connection.getBalance(grant.publicKey);
    //   console.log("grant", grant.publicKey.toString());
    //   console.log("account balance", balance);
    //   const ix = SystemProgram.transfer(params);
    //   const tx = new Transaction().add(ix);
    //   const sendTx = await provider!.send(tx);
    //   console.log("sendTx", sendTx);
    // } catch (err) {
    //   console.error(err);
    //   return false;
    // }
    return true;
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

  const isSelected = (grant: GrantAccount): boolean => {
    if (!selectedGrant || (page !== Page.Details)) { return false }
    return selectedGrant.publicKey.equals(grant.publicKey);
  }

  return (
    <div>
      <Space align="start" size="large">
      <Space direction="vertical">
      <Button 
        type={page === Page.Create ? "default" : "primary"} 
        onClick={() => setPage(Page.Create)}
      >
        + New Grant
      </Button>
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
            (page === Page.Create) ? (<GrantCreate onCreate={handleCreateGrant} />) : 
            (page === Page.Details && selectedGrant) ? (
              <GrantDetails
                psyProgram={psyProgram!}
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
