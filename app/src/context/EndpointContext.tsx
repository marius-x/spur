import React from 'react';

export type EndpointName = "local" | "devnet" | "mainnet-beta";

const EndpointContext = React.createContext<EndpointName>("local");

export default EndpointContext;
