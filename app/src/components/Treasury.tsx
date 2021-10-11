import React, { FC, useEffect, useMemo, useState } from 'react';
import {
  Button, 
  Card,
  Divider,
  Empty,
  Space,
  Typography
} from 'antd';
import { Loader, PublicKey } from '@solana/web3.js';

import { web3 } from '@project-serum/anchor';
import { 
  initTreasury, 
  initGrant, 
  useAccounts, 
  //useProgram, 
  //useProvider, 
  useTreasuryAccountPk, 
  removeGrantFromTreasury,
  unlockGrant} from '../lib/program';
import BN from "bn.js";
import GrantCreate, { GrantCreateParams } from './GrantCreate';
import GrantDetails from './GrantDetails';
import { createPsy } from '../lib/psy';
import { useEndpointUrl, useProvider } from '../hooks/network';

import { shortSha } from '../util/text';
import useClient from '../hooks/spurClient';
import { useWallet } from '@solana/wallet-adapter-react';
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
  const [loadingGrants, setLoadingGrants] = useState(false);

  useEffect(() => {
    setLoadingGrants(true);
    const setAsync = async () => {
      if (!client || !wallet?.publicKey) {
        setGrants([]);
        setLoadingGrants(false);
        return;
      }
      const grantsFound = await client.findGrantsBySender(wallet.publicKey);
      setGrants(grantsFound);
      setLoadingGrants(false);
    };
    setAsync();
  }, [client, wallet]);

  const handleSelectGrant = (grant: GrantAccount) => {
    setSelectedGrant(grant);
    setPage(Page.Details);
  }

  const handleCreateGrant = async (create: GrantCreateParams): Promise<boolean> => {
    try {
      console.log("handleCreateGrant", create.duration[0].toLocaleString());
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

  const handleRemoveGrant = async (grantPk: PublicKey): Promise<boolean> => {
    return false;
  }
  //   if (!provider || !program || !treasuryPk) {
  //     console.log('Cannot remove grant!');
  //     return false;
  //   }
  //   try {
  //     await removeGrantFromTreasury(provider, program, wallet, treasuryPk, grantPk);
  //     return true;
  //   } catch (err) {
  //     console.log(err);
  //     return false;
  //   }
  // }

  const handleRevokeGrant = async (grantPk: PublicKey): Promise<boolean> => {
    return false;
  }
  //   if (!provider || !program || !treasuryPk) {
  //     console.log('Cannot revoke grant!');
  //     return false;
  //   }
  //   try {
  //     await removeGrantFromTreasury(provider, program, wallet, treasuryPk, grantPk);
  //     return true;
  //   } catch (err) {
  //     console.log(err);
  //     return false;
  //   }
  // }

  // const handleUnlockGrant = async (grantPk: PublicKey, grant: GrantAccount): Promise<boolean> => {
  //   if (!provider || !program || !treasuryPk) {
  //     console.log('Cannot unlock grant!');
  //     return false;
  //   }
  //   try {
  //     await unlockGrant(provider, program, wallet, treasuryPk, grantPk, grant);
  //     return true;
  //   } catch (err) {
  //     console.log(err);
  //     return false;
  //   }
  // }

  // const handleCreateMarket = async () => {
  //   if (!program || !provider) {
  //     return;
  //   }
  //   await createPsy(provider);
  // }

  // if (!accounts?.treasury) {
  //   return <Button onClick={handleCreateMarket}>Create Psy</Button>;
  //   //return <EmptyState onCreateTreasury={handleCreateTreasury} />;
  // }

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
