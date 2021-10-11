import React, { useEffect, useState } from "react";
import EndpointContext from "../context/EndpointContext";
import { getEndpointUrl } from "../lib/util";
import { useWallet, WalletContextState } from '@solana/wallet-adapter-react';
import { Provider, web3 } from '@project-serum/anchor';
import { ConfirmOptions } from '@solana/web3.js';

const { Connection } = web3;

export function useEndpointUrl() {
  const endpoint = React.useContext(EndpointContext);
  return getEndpointUrl(endpoint);
}

function toAnchorWallet(wallet: WalletContextState) {
  if (!wallet.connected) {
    return null;
  }
  if (
    !wallet.publicKey ||
    !wallet.signMessage || 
    !wallet.signTransaction || 
    !wallet.signAllTransactions) {
    return null;
  }
  return Object.assign({}, {
    publicKey: wallet.publicKey,
    signMessage: wallet.signMessage,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions
  });
}

export function useProvider() {
  const [provider, setProvider] = useState<Nullable<Provider>>(null);
  const wallet = useWallet();
  const endpoint = useEndpointUrl();
  
  useEffect(() => {
    const anchorWallet = toAnchorWallet(wallet);
    if (!anchorWallet) {
      setProvider(null);
      return;
    }
    const opts: ConfirmOptions = {
      preflightCommitment: "processed"
    };
    const connection = new Connection(endpoint, opts.preflightCommitment);
    setProvider(new Provider(connection, anchorWallet, opts));
  }, [wallet, endpoint]);

  return provider;
}
