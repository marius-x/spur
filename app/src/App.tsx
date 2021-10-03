import React, { FC } from 'react';
import { Layout, Space, Typography } from 'antd';
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
import Home from './Home';
import './App.less';

const { Title } = Typography;

const App: FC = () => (
  <Router>
    <Layout>
      <Header>
        <Space>
          <Link to="/"><Title level={3} style={{ color: "#f5f1ee" }}>Owner Comp</Title></Link>
        </Space>
        <Space style={{ float: "right" }}><WalletMultiButton /></Space>
      </Header>
      <Content style={{ padding: "25px 50px", minHeight: "360px"}}>
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
);

const About: FC = () => (
  <div>about</div>
);

const wallets = [
  /* view list of available wallets at https://github.com/solana-labs/wallet-adapter#wallets */
  getPhantomWallet(),
  getSolletWallet()
];

const AppWithProvider = () => (
  <ConnectionProvider endpoint="http://127.0.0.1:8899">
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <App />
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
)

export default AppWithProvider;
