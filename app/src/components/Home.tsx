import React, { FC, useState } from 'react';
import {
  Button, 
  Space, 
} from 'antd';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

import Treasury from './Treasury';
import Contributor from './Contributor';

enum AccountType {
  None,
  Treasury,
  Contributor
}

const Home: FC = () => {
  const wallet = useWallet();
  // TODO: make navigation routable
  const [accountView, setAccountView] = useState<AccountType>(AccountType.None);

  if (!wallet.connected) {
    return <ConnectWallet />
  }

  if (accountView === AccountType.Treasury) {
    return <Treasury />
  } else if (accountView === AccountType.Contributor) {
    return <Contributor />
  } else {
    return <SelectAccountView onSelect={setAccountView} />
  }
};

const ConnectWallet: FC = () => (
  <Space direction="vertical" align="center">
    <WalletMultiButton />
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
