import React, { FC } from 'react';
import { PublicKey } from '@solana/web3.js';
import {
  message,
  Button, 
  Descriptions,
  PageHeader,
  Space,
  Spin,
} from 'antd';

import { GrantAccount, useGrantAccount } from '../lib/program';
import moment from 'moment';

interface props {
  grantPk: PublicKey,
  onRemove: (grantPk: PublicKey) => Promise<boolean>,
  onRevoke: (grantPk: PublicKey) => Promise<boolean>,
  onUnlock: (grantPk: PublicKey, grant: GrantAccount) => Promise<boolean>
}

const GrantDetails: FC<props> = ({
  grantPk,
  onRemove,
  onRevoke,
  onUnlock
}) => {
  const grant = useGrantAccount(grantPk);
  const handleRemove = async () => {
    const success = await onRemove(grantPk);
    if (success) {
      message.success("Grant successfully removed!");
    } else {
      message.error("Error removing grant!");
    }
  }
  const handleRevoke = async () => {
    const success = await onRevoke(grantPk);
    if (success) {
      message.success("Grant successfully revoked!");
    } else {
      message.error("Error revoking grant!");
    }
  }
  const handleUnlock = async () => {
    const success = await onUnlock(grantPk, grant!);
    if (success) {
      message.success("Grant successfully unlocked!");
    } else {
      message.error("Error unlocking grant!");
    }
  }
  return (
    <Space direction="vertical">
      <PageHeader title="Grant Details" subTitle={grantPk.toString()} extra={[
        <Button key="1" disabled={grant === null} onClick={handleRemove}>Remove</Button>,
        <Button key="2" disabled={grant === null} onClick={handleRevoke}>Revoke</Button>,
        <Button key="3" disabled={grant === null} onClick={handleUnlock} type="primary">Unlock</Button>
      ]} />
      {
        (grant == null) ? (<Spin />) : (
          <Space direction="vertical">
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Mint Address">{grant.mintAddress.toString()}</Descriptions.Item>
              <Descriptions.Item label="Recipient Wallet">{grant.recipientWallet.toString()}</Descriptions.Item>
              <Descriptions.Item label="Options">{grant.optionMarketKey ? "YES": "NO"}</Descriptions.Item>
              <Descriptions.Item label="Amount">{grant.amountTotal.toString()}</Descriptions.Item>
              <Descriptions.Item label="Issue Date">
                {moment.unix(grant.issueTs.toNumber()).format("MM-YYYY")}
              </Descriptions.Item>
              <Descriptions.Item label="End Date">
                {moment.unix(grant.issueTs.toNumber()).add(grant.durationSec.toNumber(), "seconds").format("MM-YYYY")}
              </Descriptions.Item>
              <Descriptions.Item label="Initial Cliff Date">
                {grant.initialCliffSec.toNumber() ? moment.unix(grant.issueTs.toNumber()).add(grant.initialCliffSec.toNumber(), "seconds").format("MM-YYYY"): "none"}
              </Descriptions.Item>
              <Descriptions.Item label="Vest Interval">
                {grant.vestIntervalSec.toNumber() / 3600 / 24} {"days"}
              </Descriptions.Item>
              <Descriptions.Item label="Vest Interval">
                {grant.lastUnlockTs.toNumber() ? moment.unix(grant.lastUnlockTs.toNumber()).format("MM/DD/YYYY") : "none"}
              </Descriptions.Item>
              <Descriptions.Item label="Amount Unlocked">
                {grant.amountUnlocked.toNumber()}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        )
      }
    </Space>
  );
}

export default GrantDetails;
