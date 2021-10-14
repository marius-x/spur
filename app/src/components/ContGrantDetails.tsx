import React, { useState, useEffect, FC } from 'react';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  message,
  Button, 
  Descriptions,
  PageHeader,
  Space,
  Spin
} from 'antd';
import moment from 'moment';
import { Program } from '@project-serum/anchor';
import { getOptionByKey, OptionMarketWithKey } from '@mithraic-labs/psy-american';
import { GrantAccount } from '../lib/client';
import { getMintDecimals } from '../lib/program';
import { intervalToStr } from '../lib/util';
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

interface props {
  wallet: PublicKey,
  psyProgram: Program,
  grant: GrantAccount,
  onUnlock: (grantPk: PublicKey) => Promise<boolean>
  onExercise: (grantPk: PublicKey) => Promise<boolean>
}

const ContGrantDetails: FC<props> = ({
  wallet,
  psyProgram,
  grant,
  onUnlock,
  onExercise,
}) => {
  const [market, setMarket] = useState<Nullable<OptionMarketWithKey>>(null);
  const [optionMintAmount, setOptionMintAmount] = useState(0);
  const [decimals, setDecimals] = useState(0);
  const [loading, setLoading] = useState(true);

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
      if (market) {
        const mint = new Token(
          psyProgram.provider.connection, 
          market.optionMint, 
          TOKEN_PROGRAM_ID, 
          new Keypair());
        const mintAccount = await Token.getAssociatedTokenAddress(
          ASSOCIATED_TOKEN_PROGRAM_ID, 
          TOKEN_PROGRAM_ID, 
          market.optionMint, 
          wallet);
        const info = await mint.getAccountInfo(mintAccount);
        setOptionMintAmount(info.amount.toNumber());
      }
      setLoading(false);
    };
    loadAsync();
  }, [psyProgram, grant.account.optionMarketKey, grant.account.mintAddress, wallet]);

  if (loading) {
    return <Spin />;
  }

  const handleUnlock = async () => {
    const success = await onUnlock(grant.publicKey);
    if (success) {
      message.success("Grant successfully unlocked!");
    } else {
      message.error("Error unlocking grant!");
    }
  }

  const handleExercise = async () => {
    const success = await onExercise(grant.publicKey);
    if (success) {
      message.success("Grant successfully exercised!");
    } else {
      message.error("Error exercising grant!");
    }
  }

  const fixed2Decimals = (n: number): number => {
    return (n * 100 / Math.pow(10, decimals)) / 100;
  }

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

  let amountAvailable = 0;
  const durationSinceIssueSec = moment().unix() - grant.account.issueTs;
  if (durationSinceIssueSec > grant.account.durationSec) {
    amountAvailable = grant.account.amountTotal;
  } else {
    const totalNumPeriods = Math.round(grant.account.durationSec / grant.account.vestIntervalSec);
    const amountPerPeriod = Math.trunc(grant.account.amountTotal / totalNumPeriods);
    const numPeriodsSinceIssue = Math.trunc(durationSinceIssueSec / grant.account.vestIntervalSec);
    amountAvailable = numPeriodsSinceIssue * amountPerPeriod;
  }
  const amountToUnlock = amountAvailable - grant.account.amountUnlocked;

  const displayAmountTotal = fixed2Decimals(grant.account.amountTotal);
  const displayAmountToUnlock = fixed2Decimals(amountToUnlock);
  const displayAmountUnlocked = fixed2Decimals(grant.account.amountUnlocked);
  const displayAmountToExercise = optionMintAmount ? fixed2Decimals(optionMintAmount) : 0;

  return (
    <Space direction="vertical">
      <PageHeader title="Grant" subTitle={grant.publicKey.toString()} />
      <Space direction="vertical">
        <Descriptions bordered column={1}>
          <Descriptions.Item labelStyle={{fontWeight: 600}} label="Unlock Amount">
            {displayAmountToUnlock}
            <Button 
              onClick={handleUnlock} 
              type="primary" 
              style={{width: "120px", float: "right"}}
              disabled={!amountToUnlock}
            >
              Unlock
            </Button>
          </Descriptions.Item>
          {market && 
            <Descriptions.Item labelStyle={{fontWeight: 600}} label="Exercise Amount">
              {displayAmountToExercise}
              <Button 
                onClick={handleExercise} 
                type="primary" 
                style={{width: "120px", float: "right"}}
                disabled={!displayAmountToExercise}
              >
                Exercise
              </Button>
            </Descriptions.Item>
          }
          <Descriptions.Item label="Sender">{grant.account.senderWallet.toString()}</Descriptions.Item>
          <Descriptions.Item label="Mint">{mint.toString()}</Descriptions.Item>
          <Descriptions.Item label="Amount">{displayAmountTotal.toString()}</Descriptions.Item>
          <Descriptions.Item label="Options">{grant.account.optionMarketKey ? "Yes": "No"}</Descriptions.Item>
          <Descriptions.Item label="Issue Date">{issueDateStr}</Descriptions.Item>
          <Descriptions.Item label="End Date">{endDateStr}</Descriptions.Item>
          <Descriptions.Item label="Initial Cliff">{initialCliffDateStr}</Descriptions.Item>
          <Descriptions.Item label="Vest Interval">{vestIntervalStr}</Descriptions.Item>
          <Descriptions.Item label="Last Unlock">{lastUnlockStr}</Descriptions.Item>
          <Descriptions.Item label="Amount Unlocked">{displayAmountUnlocked}</Descriptions.Item>
          <Descriptions.Item label="Revoked">{grant.account.revoked ? "Yes" : "No"}</Descriptions.Item>
        </Descriptions>
      </Space>
    </Space>
  );
}

export default ContGrantDetails;
