import React, { FC } from 'react';
import moment from 'moment';
import {
  message,
  Button, 
  Descriptions,
  PageHeader,
  Space,
} from 'antd';
import { GrantAccount } from '../lib/client';

interface props {
  grant: GrantAccount,
  onRemove: (grant: GrantAccount) => Promise<boolean>,
  onRevoke: (grant: GrantAccount) => Promise<boolean>,
}

const GrantDetails: FC<props> = ({
  grant,
  onRemove,
  onRevoke,
}) => {
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
          <Descriptions.Item label="Mint">{grant.account.mintAddress.toString()}</Descriptions.Item>
          <Descriptions.Item label="Amount">{grant.account.amountTotal.toString()}</Descriptions.Item>
          <Descriptions.Item label="Options">{grant.account.optionMarketKey ? "Yes": "No"}</Descriptions.Item>
          <Descriptions.Item label="Issue Date">
            {moment.unix(grant.account.issueTs).format("MM-DD-YYYY")}
          </Descriptions.Item>
          <Descriptions.Item label="End Date">
            {moment.unix(grant.account.issueTs).add(grant.account.durationSec, "seconds").format("MM-DD-YYYY")}
          </Descriptions.Item>
          <Descriptions.Item label="Initial Cliff">
            {grant.account.initialCliffSec ? moment.unix(grant.account.issueTs).add(grant.account.initialCliffSec, "seconds").format("MM-DD-YYYY"): "none"}
          </Descriptions.Item>
          <Descriptions.Item label="Vest Interval">
            {grant.account.vestIntervalSec / 3600 / 24} {"days"}
          </Descriptions.Item>
          <Descriptions.Item label="Last Unlock">
            {grant.account.lastUnlockTs ? moment.unix(grant.account.lastUnlockTs).format("MM/DD/YYYY") : "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="Amount Unlocked">
            {grant.account.amountUnlocked}
          </Descriptions.Item>
          <Descriptions.Item label="Revoked">
            {grant.account.revoked ? "Yes" : "No"}
          </Descriptions.Item>
        </Descriptions>
      </Space>
    </Space>
  );
}

export default GrantDetails;
