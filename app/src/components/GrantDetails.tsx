import React, { FC, useEffect, useState } from 'react';
import { Switch, Route, useHistory, useRouteMatch, useParams } from "react-router-dom";
import moment from 'moment';
import {
  message,
  Button, 
  Descriptions,
  PageHeader,
  Space,
  Spin,
  Empty,
} from 'antd';
import { GrantAccount } from '../lib/client';
import { intervalToStr } from '../lib/util';
import { Program } from '@project-serum/anchor';
import { getOptionByKey, OptionMarketWithKey } from '@mithraic-labs/psy-american';
import { getMintDecimals } from '../lib/program';

interface props {
  psyProgram: Program,
  grant: GrantAccount,
  onRevoke: (grant: GrantAccount) => Promise<boolean>,
}

const GrantDetails: FC<props> = ({ 
  psyProgram, grant, onRevoke,
}) => {
  const [market, setMarket] = useState<Nullable<OptionMarketWithKey>>(null);
  const [decimals, setDecimals] = useState(0);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    setLoading(true);
    const loadAsync = async () => {
      setDecimals(await getMintDecimals(
        psyProgram.provider.connection, grant.account.mintAddress));
      if (!grant.account.optionMarketKey) {
        setLoading(false);
        return;
      }
      const market = await getOptionByKey(psyProgram, grant.account.optionMarketKey);
      setMarket(market);
      setLoading(false);
    };
    loadAsync();
  }, [psyProgram, grant.account.optionMarketKey, grant.account.mintAddress]);

  if (loading) {
    return <Spin />;
  }

  const handleRevoke = async () => {
    const success = await onRevoke(grant);
    if (success) {
      message.success("Grant successfully revoked!");
    } else {
      message.error("Error revoking grant!");
    }
  }

  const isRevoked = grant.account.revoked;
  const mint = market ? market.underlyingAssetMint : grant.account.mintAddress;
  const issueDateStr = moment.unix(grant.account.issueTs).format("MM-DD-YYYY");
  const endDateStr = moment.unix(grant.account.issueTs)
    .add(grant.account.durationSec, "seconds").format("MM-DD-YYYY")
  let initialCliffDateStr = "N/A";
  if (grant.account.initialCliffSec) {
    initialCliffDateStr = moment.unix(grant.account.issueTs)
      .add(grant.account.initialCliffSec, "seconds").format("MM-DD-YYYY")
  }
  const vestIntervalStr = intervalToStr(grant.account.vestIntervalSec);
  const lastUnlockStr = grant.account.lastUnlockTs ? 
    moment.unix(grant.account.lastUnlockTs).format("MM/DD/YYYY") : "N/A"
  const amountTotal = (grant.account.amountTotal * 100 / Math.pow(10, decimals)) / 100;

  return (
    <Space direction="vertical">
      <PageHeader
        title="Grant"
        subTitle={grant.publicKey.toString()}
        extra={[<Button disabled={isRevoked} key="1" onClick={handleRevoke} type="primary" style={{ float: "right" }}>Revoke</Button>]}
      />
      <Space direction="vertical">
        <Descriptions bordered column={1}>
          <Descriptions.Item label="Recipient">{grant.account.recipientWallet.toString()}</Descriptions.Item>
          <Descriptions.Item label="Mint">{mint.toString()}</Descriptions.Item>
          <Descriptions.Item label="Amount">{amountTotal.toString()}</Descriptions.Item>
          <Descriptions.Item label="Options">{grant.account.optionMarketKey ? "Yes": "No"}</Descriptions.Item>
          <Descriptions.Item label="Issue Date">{issueDateStr}</Descriptions.Item>
          <Descriptions.Item label="End Date">{endDateStr}</Descriptions.Item>
          <Descriptions.Item label="Initial Cliff">{initialCliffDateStr}</Descriptions.Item>
          <Descriptions.Item label="Vest Interval">{vestIntervalStr}</Descriptions.Item>
          <Descriptions.Item label="Last Unlock">{lastUnlockStr}</Descriptions.Item>
          <Descriptions.Item label="Amount Unlocked">{grant.account.amountUnlocked}</Descriptions.Item>
          <Descriptions.Item label="Revoked">{grant.account.revoked ? "Yes" : "No"}</Descriptions.Item>
        </Descriptions>
      </Space>
    </Space>
  );
}

export default GrantDetails;
