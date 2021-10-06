import React, { FC } from 'react';
import { PublicKey } from '@solana/web3.js';
import {
  message,
  Button, 
  PageHeader, 
  Space,
  Form, 
  Input, 
  InputNumber,
  Select,
  Switch,
  DatePicker,
  Radio
} from 'antd';

const { RangePicker } = DatePicker;
const { Option } = Select;

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
];

export interface GrantCreateParams {
  amount: number,
  cliff: Nullable<moment.Moment>,
  duration: [moment.Moment, moment.Moment],
  issueOptions: boolean,
  mintAddress: string,
  period: "day" | "week" | "month",
  recipient: string,
}

interface props {
  onCreate: (params: GrantCreateParams) => Promise<boolean>
}

const GrantCreate: FC<props> = ({ onCreate }) => {
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

  const handleSubmit = async (values: GrantCreateParams) => {
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
          initialValue={MangoMint.toString()}
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

export default GrantCreate;
