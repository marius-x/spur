import { clusterApiUrl } from '@solana/web3.js';
import { EndpointName } from '../context/EndpointContext';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

export function getEndpointUrl(endpoint: EndpointName): string {
  if (endpoint === "local") {
    return "http://127.0.0.1:8899";
  }
  return clusterApiUrl(endpoint as WalletAdapterNetwork);
}

export function maybePluralize(count: number, noun: string, suffix = 's'): string {
  return `${count} ${noun}${count !== 1 ? suffix : ''}`;
}

export function intervalToStr(sec: number): string {
  const days = sec / 3600 / 24;
  const weeks = Math.trunc(days / 7);
  const months = Math.trunc(days / 30);
  return months ? maybePluralize(months, "month") : 
    weeks ? maybePluralize(weeks, "week") : 
      maybePluralize(days, "day");
}
