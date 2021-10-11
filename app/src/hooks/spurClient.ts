import React, { useMemo } from 'react';
import { Client } from '../lib/client';
import useProgram from './spurProgram';

export default function useClient() {
  const program = useProgram();
  const client = useMemo<Nullable<Client>>(() => {
    if (!program) {
      return null;
    }
    return new Client(program);
  }, [program]);
  return client;
}
