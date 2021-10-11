import { clusterApiUrl } from '@solana/web3.js';
import { EndpointName } from '../context/EndpointContext';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

export function getEndpointUrl(endpoint: EndpointName): string {
  if (endpoint === "local") {
    return "http://127.0.0.1:8899";
  }
  return clusterApiUrl(endpoint as WalletAdapterNetwork);
}
