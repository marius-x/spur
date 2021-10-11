import React, { useEffect, useState } from 'react';
import { Program } from '@project-serum/anchor';
import { useProvider } from './network';
import { PsyAmericanIdl } from "@mithraic-labs/psy-american"

export const programId = "R2y9ip6mxmWUj4pt54jP2hz2dgvMozy9VTSwMWE7evs";

export default function useProgram() {
  const [program, setProgram] = useState<Nullable<Program>>(null);
  const provider = useProvider();

  useEffect(() => {
    if (!provider) {
      setProgram(null);
      return;
    }
    setProgram(new Program(PsyAmericanIdl, programId, provider));
  }, [provider]);

  return program;
}
