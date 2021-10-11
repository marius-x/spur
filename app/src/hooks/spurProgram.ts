import React, { useContext, useEffect, useState } from 'react';
import { useProvider } from './network';
import { Idl, Program, web3 } from '@project-serum/anchor';

import EndpointContext, { EndpointName } from '../context/EndpointContext';
import idl from "../spur.json";
import { PublicKey } from '@solana/web3.js';

// const programId = new PublicKey(idl.metadata.address);

const endpointToProgramId = new Map<EndpointName, string>([
  ["local", "BuyzX13Nh4XnV2U3M7krdKF8m39agkeedUD6veMMJim7"],
  ["devnet", "BuyzX13Nh4XnV2U3M7krdKF8m39agkeedUD6veMMJim7"],
]);

export function useProgramId(): Nullable<web3.PublicKey> {
  const [programId, setProgramId] = useState<Nullable<web3.PublicKey>>(null);
  const endpoint = useContext<EndpointName>(EndpointContext);
  useEffect(() => {
    const idStr = endpointToProgramId.get(endpoint);
    const id = idStr ? new PublicKey(idStr) : null;
    setProgramId(id);
  }, [endpoint]);
  return programId;
}

export default function useProgram(): Nullable<Program> {
  const [program, setProgram] = useState<Nullable<Program>>(null);
  const provider = useProvider();
  const programId = useProgramId();

  useEffect(() => {
    if (!provider || !programId) {
      setProgram(null);
      return;
    }
    setProgram(new Program(idl as Idl, programId, provider));
  }, [provider, programId]);

  return program;
}
