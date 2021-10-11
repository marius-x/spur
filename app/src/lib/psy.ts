import { instructions, ProgramVersions, PsyAmericanIdl, PSY_AMERICAN_PROGRAM_IDS } from "@mithraic-labs/psy-american"
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

const oldProgramId = "3KAqLcLAY8W7ZxGT1MJcFPDMNJKJsXaE1m9i1JPahfmH";
const programId = "R2y9ip6mxmWUj4pt54jP2hz2dgvMozy9VTSwMWE7evs";

//1633838242
//1633838224015

export const createPsy = async (provider: anchor.Provider) => {
  const p = new Program(PsyAmericanIdl, programId, provider);
  const tsNow = ((new Date()).getTime() / 1000) + 3600*24*14;
  const res = await instructions.initializeMarket(p, {
    expirationUnixTimestamp: new anchor.BN(tsNow),
    quoteAmountPerContract: new anchor.BN(1),
    quoteMint: new PublicKey("ZgDg4kcSHnVpfp7qhrpjsiZFFNtKNWtF1Y2DfoMUxgB"),
    //quoteMint: new PublicKey("7dXaobJ79k4GY6xNnfpXSeXiHcxE3tvVtE3GTwJ7BgTv"),
    underlyingAmountPerContract: new anchor.BN(1),
    underlyingMint: new PublicKey("So11111111111111111111111111111111111111112"), // wrapped SOL
    //underlyingMint: new PublicKey("77ZJLL97MSG8kFePoLp69YPYR2n9JXmajqwoNDAHfhLB"),
  });
  console.log(res);
}
