import React, { FC, useEffect, useState } from 'react';
import {
  message,
  Button, 
  Card, 
  Divider,
  Empty,
  Layout, 
  PageHeader, 
  Space, 
  Spin, 
  Typography, 
  Form, 
  Input, 
  InputNumber,
  Checkbox,
  Select,
  Switch,
  DatePicker,
  Radio
} from 'antd';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { web3 } from '@project-serum/anchor';
import { Loader, PublicKey } from '@solana/web3.js';
import { 
  initTreasury, 
  initGrant, 
  useAccounts, 
  useProgram, 
  useProvider, 
  useTreasuryAccountPk, 
  removeGrantFromTreasury,
  useGrantAccount} from './program';
import BN from "bn.js";

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title } = Typography;

const MangoMint = new PublicKey("7dXaobJ79k4GY6xNnfpXSeXiHcxE3tvVtE3GTwJ7BgTv");
const SolMint = new PublicKey("77ZJLL97MSG8kFePoLp69YPYR2n9JXmajqwoNDAHfhLB");
const UsdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const TOKEN_LIBRARY = [
  {
    name: "MNGO",
    address: MangoMint
  },
  {
    name: "SOL",
    address: SolMint
  },
  {
   name: "USDC",
   address: UsdcMint 
  }
]

enum Page {
  Empty,
  Details,
  Create
}

const Home: FC = () => {
  const wallet = useWallet();
  const provider = useProvider();
  const program = useProgram();
  const accounts = useAccounts();
  const treasuryPk = useTreasuryAccountPk();
  const [selectedGrantPk, setSelectedGrantPk] = useState<Nullable<PublicKey>>(null);
  // TODO: make it routable
  const [page, setPage] = useState<Page>(Page.Empty);

  if (!wallet.connected) {
    return <ConnectWallet />
  }

  const handleCreateTreasury = async () => {
    if (!program) {
      console.log('Program is not initialized!');
      return;
    }
    await initTreasury(program, wallet);
  }

  const handleCreateGrant = async (params: createGrantParams): Promise<boolean> => {
    console.log("create with params: ", params);

    if (!provider || !program || !accounts?.treasury || !treasuryPk) {
      console.log("Create grant: missing account fields");
      return false;
    }

    // const destWalletAddress = new PublicKey("JDgFLjT4fAYbPG9ucoQn6RZ2Shd42ybJCxp9hSbxWeqd");

    const periodToVestIntervalSec = {
      "day": 24 * 3600,
      "week": 7 * 24 * 3600,
      "month": 30 * 7 * 24 * 3600
    }

    try {
      await initGrant(
        provider, 
        program, 
        wallet, 
        new PublicKey(params.mintAddress),
        params.issueOptions,
        params.amount,
        params.duration[0].toDate(),
        params.duration[1].diff(params.duration[0], "seconds"),
        params.cliff?.diff(params.duration[0], "seconds") || 0,
        periodToVestIntervalSec[params.period],
        new PublicKey(params.recipient), 
        treasuryPk);
      return true;
    } catch (err) {
      console.log("Error calling initGrant:", err);
      return false;
    }
  }

  const handleRemoveGrant = async (grantPk: PublicKey) => {
    if (!provider || !program || !treasuryPk) {
      console.log('Cannot remove grant account!');
      return;
    }
    await removeGrantFromTreasury(provider, program, wallet, treasuryPk, grantPk);
  }

  if (!accounts?.treasury) {
    return <EmptyState onCreateTreasury={handleCreateTreasury} />;
  }

  const handleSelectGrant = (grantAddress: string) => {
    setSelectedGrantPk(new PublicKey(grantAddress));
    setPage(Page.Details);
  }

  const shortStr = (str: string) => {
    const top = str.substr(0, 5);
    const bottom = str.substr(str.length - 5, 5);
    return `${top}...${bottom}`;
  }

  return (
    <div>
      <Title level={4}>Treasury Account</Title>
      <Divider />
      <Space align="start" size="large">
      <Space direction="vertical">
      <Button type="primary" onClick={() => setPage(Page.Create)}>+ New Grant</Button>
      {
        accounts.treasury.grantAccounts.map((v: BN) => (
          <Card key={v.toString()}>
            <Button type="link" onClick={() => handleSelectGrant(v.toString())}>
              {shortStr(v.toString())}
            </Button>
          </Card>
        ))
      }
      </Space>
      <Space>
        <Card style={{ width: "800px", minHeight:"600px"}}>
          {
            (page === Page.Create) ? (<CreateGrant onCreate={handleCreateGrant} />) : 
            (page === Page.Details && selectedGrantPk) ? (
              <GrantDetails 
                grantPk={selectedGrantPk} 
                handleRemoveGrant={handleRemoveGrant} 
              />
            ) : (<Empty description="No Grant Selected" />)
          }
        </Card>
      </Space>
      </Space>
    </div>
  );
};

const ConnectWallet: FC = () => (
  <Space direction="vertical" align="center">
    <Title level={3}>Connect Wallet</Title>
    <WalletMultiButton />
  </Space>
  
);

const EmptyState: FC<{onCreateTreasury: any}> = ({ onCreateTreasury }) => (
  <div style={{ textAlign: "center" }}>
    <Space>
      <Button onClick={() => onCreateTreasury()} className="card-button">Treasury Account</Button>
      <Button disabled className="card-button">Contributor Account</Button>
    </Space>
  </div>
);

interface grantDetailsProps {
  grantPk: PublicKey,
  handleRemoveGrant: (grantPk: PublicKey) => void,
}

const GrantDetails: FC<grantDetailsProps> = ({ 
  grantPk,
  handleRemoveGrant
}) => {
  const grantAccount = useGrantAccount(grantPk);
  const isLoading = grantAccount == null;
  return (
    <Space direction="vertical">
      <Title level={5}>Grant { grantPk.toString() }</Title>
      <Divider />
      {
        !isLoading ? (<Spin />) : (
          <Button onClick={() => handleRemoveGrant(grantPk)}>Remove</Button>
        )
      }
    </Space>
  );
}

interface createGrantParams {
  amount: number,
  cliff: Nullable<moment.Moment>,
  duration: [moment.Moment, moment.Moment],
  issueOptions: boolean,
  mintAddress: string,
  period: "day" | "week" | "month",
  recipient: string,
}

interface createGrantProps {
  onCreate: (params: createGrantParams) => Promise<boolean>
}

const CreateGrant: FC<createGrantProps> = ({ onCreate }) => {
  const [form] = Form.useForm();
  
  const handleSelectMintToken = (value: string) => {
    const token = TOKEN_LIBRARY.find(({ name }) => name === value);
    if (!token) {
      form.resetFields(["mintAddress"]);
    } else {
      form.setFieldsValue({ mintAddress: token.address.toString() });
    }
  }

  const updateNumPeriods = (): number => {
    const duration = form.getFieldValue("duration") as Nullable<[moment.Moment, moment.Moment]>;
    const period = form.getFieldValue("period") as moment.unitOfTime.Diff;
    
    if (!duration || !period) {
      form.resetFields(["numPeriods"]);
      return 0;
    }
    const numPeriods = duration[1].diff(duration[0], period);
    form.setFieldsValue({ numPeriods });
    return numPeriods;
  }

  const updateAmountPerPeriod = () => {
    const totalAmount = form.getFieldValue("amount") as Nullable<number>;
    const numPeriods = updateNumPeriods();

    if (!totalAmount || !numPeriods) {
      form.resetFields(["amountPerPeriod"]);
    } else {
      form.setFieldsValue({ amountPerPeriod: totalAmount / numPeriods });
    }
  }

  const handleSubmit = async (values: createGrantParams) => {
    const success = await onCreate(values);
    if (success) {
      message.success("Successfully created new grant!");
    } else {
      message.error("Error creating grant!");
    }
    // TODO: navigate to newly created grant
  }

  return (
    <Space direction="vertical">
      <PageHeader title="Create Grant"></PageHeader>
      <Form
        form={form}
        name="basic"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
        initialValues={{ remember: true }}
        onFinish={handleSubmit}
        onFinishFailed={errorInfo => { console.log("failed", errorInfo); }}
        autoComplete="off"
        style={{ width: "600px" }}
      >
        <Form.Item
          label="Recipient"
          name="recipient"
          rules={[{ required: true, message: 'Please input recipient!' }]}
        >
          <Input placeholder="Enter wallet address" />
        </Form.Item>
        
        <Form.Item
          label="Mint Token"
          name="mintToken"
          initialValue="MNGO"
        >
          <Select onSelect={handleSelectMintToken}>
            {
              TOKEN_LIBRARY.map(({ name }) => (<Option key={name} value={name}>{name}</Option>))
            }
            <Option value="other">Other</Option>
          </Select>
        </Form.Item>
        <Form.Item
          wrapperCol={{ span: 16, offset: 6 }}
          label=""
          name="mintAddress"
          rules={[{ required: true, message: 'Please input mint address!' }]}
        >
          <Input placeholder="Enter SPL mint token address" />
        </Form.Item>

        <Form.Item
          label="Options"
          name="issueOptions"
          valuePropName="checked"
          initialValue={false}
          tooltip="Issue token options instead of tokens. Issuing options might have better tax benefits"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="Amount"
          name="amount"
          rules={[{ required: true, message: 'Please input amount!' }]}
        >
          <InputNumber onChange={updateAmountPerPeriod} />
        </Form.Item>

        <Form.Item
          label="Duration"
          name="duration"
          rules={[{ required: true, message: 'Please select grant duration!' }]}
        >
          <RangePicker picker="month" onChange={updateAmountPerPeriod} />
        </Form.Item>

        <Form.Item
          label="Initial Cliff"
          name="cliff"
        >
          <DatePicker />
        </Form.Item>

        <Form.Item
          label="Vest Period"
          name="period"
          initialValue="month"
        >
          <Radio.Group onChange={updateAmountPerPeriod}>
            <Radio.Button value="day">Day</Radio.Button>
            <Radio.Button value="week">Week</Radio.Button>
            <Radio.Button value="month">Month</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label="Number of Periods"
          name="numPeriods"
        >
          <InputNumber readOnly />
        </Form.Item>

        <Form.Item
          label="Amount per Period"
          name="amountPerPeriod"
        >
          <InputNumber readOnly />
        </Form.Item>

        <Form.Item wrapperCol={{ offset: 6, span: 16 }}>
          <Button type="primary" htmlType="submit">
            Create
          </Button>
        </Form.Item>
      </Form>
  </Space>
  );
}

export default Home;
