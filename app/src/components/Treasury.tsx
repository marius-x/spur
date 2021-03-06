import React, { FC, useEffect, useState } from 'react';
import { Link, useHistory, useParams } from "react-router-dom";
import {
  Button, 
  Card,
  Empty,
  List,
  Space
} from 'antd';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { initGrant, revokeGrant} from '../lib/program';
import GrantCreate, { GrantCreateParams } from './GrantCreate';
import GrantDetails from './GrantDetails';
import { shortSha } from '../util/text';
import useClient from '../hooks/spurClient';
import { unitOfTimeToSec } from '../util/time';
import usePsyProgram from '../hooks/psyProgram';
import { GrantAccount } from '../lib/client';


const Treasury: FC = () => {
  const history = useHistory();
  const { page, id } = useParams<{page: string, id: string}>();
  const wallet = useWallet();
  const client = useClient();
  const psyProgram = usePsyProgram();
  const [grants, setGrants] = useState<GrantAccount[]>([]);
  const grant = grants.find(grant => grant.publicKey.toString() === id );

  const loadGrants = React.useCallback(async () => {
    if (!client || !wallet?.publicKey) {
      setGrants([]);
      return;
    }
    const foundGrants = await client.findGrantsBySender(wallet.publicKey);
    const sortedGrants = foundGrants.sort((a: GrantAccount, b: GrantAccount): number => a.account.issueTs - b.account.issueTs);
    setGrants(sortedGrants);
  }, [client, wallet]);

  useEffect(() => {
    const setAsync = async () => {
      if (!client || !wallet?.publicKey) {
        setGrants([]);
        return;
      }
      const foundGrants = await client.findGrantsBySender(wallet.publicKey);
      const sortedGrants = foundGrants.sort((a: GrantAccount, b: GrantAccount): number => a.account.issueTs - b.account.issueTs);
      const printGrant = foundGrants.find((g: GrantAccount) => g.publicKey.toString() === "AWWsFSNk9MawmjxAu5okKa14qzb2nDFSgvuQthNJUD75");
      console.log("printGrant", printGrant);
      setGrants(sortedGrants);
    };
    setAsync();
  }, [client, wallet]);

  const handleSelectGrant = (grant: GrantAccount) => {
    history.push(`/treasury/details/${grant.publicKey.toString()}`);
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
      loadGrants();
      return true;
    } catch (err) {
      console.error("error initializing grant:", err);
      return false;
    }
  }

  const handleRevokeGrant = async (grant: GrantAccount): Promise<boolean> => {
    try {
      await revokeGrant(psyProgram!, client!, grant, wallet);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  const isSelected = (pk: PublicKey): boolean => {
    if (!grant || page !== "details") {
      return false; 
    }
    return grant.publicKey.equals(pk);
  }

  return (
    <Space align="start" size="large" style={{ textAlign: "left", marginLeft: "-120px" }}>
      <Space direction="vertical" style={{marginTop: "12px"}}>
      <Button 
        type="primary"
        onClick={() => history.push('/treasury/create')}
      >
        + New Grant
      </Button>
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
          {(
            (page === "create") ? <GrantCreate onCreate={handleCreateGrant} /> :
            (page === "details" && !grant) ? <Empty description="Grant Not Found" /> :
            (page === "details" && grant) ?
              <GrantDetails grant={grant}
                  psyProgram={psyProgram!}
                  onRevoke={handleRevokeGrant}
              /> :
            <Empty description="No Grant Selected" />
          )}
        </Card>
      </Space>
    </Space>
  );
}

export default Treasury;
