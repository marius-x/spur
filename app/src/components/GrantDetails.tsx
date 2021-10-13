import React, { FC, useEffect, useState } from 'react';
import moment from 'moment';
import {
  message,
  Button, 
  Descriptions,
  PageHeader,
  Space,
  Spin,
} from 'antd';
import { GrantAccount } from '../lib/client';
import { intervalToStr } from '../lib/util';
import { Program } from '@project-serum/anchor';
import { getOptionByKey, OptionMarketWithKey } from '@mithraic-labs/psy-american';

interface props {
  psyProgram: Program,
  grant: GrantAccount,
  onRemove: (grant: GrantAccount) => Promise<boolean>,
  onRevoke: (grant: GrantAccount) => Promise<boolean>,
}

const GrantDetails: FC<props> = ({ 
  psyProgram, grant, onRemove, onRevoke,
}) => {
  const [market, setMarket] = useState<Nullable<OptionMarketWithKey>>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    setLoading(true);
    const loadAsync = async () => {
      if (!grant.account.optionMarketKey) {
        setLoading(false);
        return;
      }
      const market = await getOptionByKey(psyProgram, grant.account.optionMarketKey);
      setMarket(market);
      setLoading(false);
    };
    loadAsync();
  }, [psyProgram, grant.account.optionMarketKey]);

  if (loading) {
    return <Spin />;
  }

  const handleRemove = async () => {
    const success = await onRemove(grant);
    if (success) {
      message.success("Grant successfully removed!");
    } else {
      message.error("Error removing grant!");
    }
  }
  const handleRevoke = async () => {
    const success = await onRevoke(grant);
    if (success) {
      message.success("Grant successfully revoked!");
    } else {
      message.error("Error revoking grant!");
    }
  }

  const canRemove = grant.account.revoked;
  const actionHandler = canRemove ? handleRemove : handleRevoke;
  const action = canRemove ? "Remove" : "Revoke"

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

  return (
    <Space direction="vertical">
      <PageHeader
        title="Grant"
        subTitle={grant.publicKey.toString()}
        extra={[<Button key="1" onClick={actionHandler} type="primary">{action}</Button>]}
      />
      <Space direction="vertical">
        <Descriptions bordered column={1}>
          <Descriptions.Item label="Recipient">{grant.account.recipientWallet.toString()}</Descriptions.Item>
          <Descriptions.Item label="Mint">{mint.toString()}</Descriptions.Item>
          <Descriptions.Item label="Amount">{grant.account.amountTotal.toString()}</Descriptions.Item>
          <Descriptions.Item label="Options">{grant.account.optionMarketKey ? "Yes": "No"}</Descriptions.Item>
          <Descriptions.Item label="Issue Date">{issueDateStr}</Descriptions.Item>
          <Descriptions.Item label="End Date">{endDateStr}</Descriptions.Item>
          <Descriptions.Item label="Initial Cliff">{initialCliffDateStr}</Descriptions.Item>
          <Descriptions.Item label="Vest Interval">{vestIntervalStr}</Descriptions.Item>
          <Descriptions.Item label="Last Unlock">{lastUnlockStr}</Descriptions.Item>
          <Descriptions.Item label="Amount Unlocked">{grant.account.amountUnlocked}</Descriptions.Item>
          <Descriptions.Item label="Revoked">{grant.account.revoked ? "Yes" : "No"}
          </Descriptions.Item>
        </Descriptions>
      </Space>
    </Space>
  );
}

export default GrantDetails;
