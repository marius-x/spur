import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  Button,
  Space
} from 'antd';
import React, { FC } from 'react';
import { Route, useHistory } from "react-router-dom";
import Contributor from './Contributor';
import Treasury from './Treasury';


enum AccountType {
  Treasury = "treasury",
  Contributor = "contributor"
}

const Home: FC = () => {
  const history = useHistory();
  const wallet = useWallet();

  if (!wallet.connected) {
    return <ConnectWallet />
  }

  const handleSelectAccount = (accountType: AccountType) => {
    history.push(`/${accountType}`);
  }

  return (
    <div>
      <Route path={[`/treasury/:page/:id`, '/treasury/:page', '/treasury']}>
        <Treasury />
      </Route>
      <Route path={`/contributor`}>
        <Contributor />
      </Route>
      <Route exact path={`/`}>
        <SelectAccountView onSelect={handleSelectAccount} />
      </Route>
    </div>
  );
};

const ConnectWallet: FC = () => (
  <Space direction="vertical" align="center">
    <WalletMultiButton style={{backgroundColor: "#24acfc"}} />
  </Space>
);

interface selectAccountViewProps {
  onSelect: (choice: AccountType) => void
}

const SelectAccountView: FC<selectAccountViewProps> = ({ onSelect }) => (
  <div style={{ textAlign: "center" }}>
    <Space>
      <Button 
        className="card-button" 
        onClick={() => onSelect(AccountType.Treasury)}
      >
        Treasury Account
      </Button>
      <Button 
        className="card-button" 
        onClick={() => onSelect(AccountType.Contributor)}
      >
        Contributor Account
      </Button>
    </Space>
  </div>
);

export default Home;
