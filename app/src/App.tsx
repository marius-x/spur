import React, { FC } from 'react';
import { Layout, Select, Space, Typography } from 'antd';
import { Content, Header, Footer } from 'antd/lib/layout/layout';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from "react-router-dom";
import { getPhantomWallet, getSolletWallet } from '@solana/wallet-adapter-wallets';
import { WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import EndpointContext, {EndpointName} from './context/EndpointContext';
import { getEndpointUrl } from './lib/util';
import Home from './components/Home';
import './App.less';

const { Title } = Typography;
const { Option } = Select;

const wallets = [
  /* view list of available wallets at https://github.com/solana-labs/wallet-adapter#wallets */
  getPhantomWallet(),
  getSolletWallet()
];

const App: FC = () => {
  const [endpoint, setEndpoint] = React.useState<EndpointName>("devnet");
  return (
    <EndpointContext.Provider value={endpoint}>
      <ConnectionProvider endpoint={getEndpointUrl(endpoint)}>
      <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
      <Router>
        <Layout>
          <Header>
            <Space>
              <Link to="/"><Title level={3} >Owner Comp</Title></Link>
            </Space>
            <Space style={{ float: "right", margin: '6px' }}><WalletMultiButton /></Space>
            <Space style={{ float: "right" }}>
              <Select size="large" defaultValue="devnet" bordered={false} onSelect={setEndpoint}>
                <Option value="mainnet-beta">Mainnet</Option>
                <Option value="devnet">Devnet</Option>
                <Option value="local">Local</Option>
              </Select>
            </Space>
          </Header>
          <Content style={{ padding: "24px 48px", minHeight: "384px"}}>
            <Switch>
              <Route path="/about">
                <About />
              </Route>
              <Route path="/">
                <Home />
              </Route>
            </Switch>
          </Content>
          <Footer style={{ textAlign: "center", position: "fixed", bottom: "0", width: "100%" }}>
            Owner Comp © 2021
          </Footer>
        </Layout>
      </Router>
      </WalletModalProvider>
      </WalletProvider>
      </ConnectionProvider>
    </EndpointContext.Provider>
  );
}

const About: FC = () => (
  <div>about</div>
);

export default App;
