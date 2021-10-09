import * as anchor from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
const { SystemProgram } = anchor.web3;

const GRANT_PDA_SEED = "grant";

interface GrantAccount {
  publicKey: PublicKey,
  account: GrantAccountInfo,
}

export interface GrantAccountInfo {
  pda: PublicKey,
  bump: number,
  mintAddress: PublicKey,
  optionMarketKey: PublicKey | null,
  amountTotal: number,
  issueTs: number,
  durationSec: number,
  initialCliffSec: number,
  vestIntervalSec: number,
  senderWallet: PublicKey,
  recipientWallet: PublicKey,
  grantTokenAccount: PublicKey,
  lastUnlockTs: number,
  amountUnlocked: number,
  revoked: boolean,
}

export class Client {
  program: any;
  constructor(program: any) {
    this.program = program;
  }
  async getGrant(grantPk: PublicKey): Promise<GrantAccountInfo> {
    const grant = await this.program.account.grantAccount.fetch(grantPk);
    return {
      pda: new PublicKey(grant.pda.toString()),
      bump: grant.bump,
      mintAddress: new PublicKey(grant.mintAddress.toString()),
      optionMarketKey: grant.optionMarketKey ? new PublicKey(grant.optionMarketKey.toString()) : null,
      amountTotal: grant.amountTotal.toNumber(),
      issueTs: grant.issueTs.toNumber(),
      durationSec: grant.durationSec.toNumber(),
      initialCliffSec: grant.initialCliffSec.toNumber(),
      vestIntervalSec: grant.vestIntervalSec.toNumber(),
      senderWallet: new PublicKey(grant.senderWallet.toString()),
      recipientWallet: new PublicKey(grant.recipientWallet.toString()),
      grantTokenAccount: new PublicKey(grant.grantTokenAccount.toString()),
      lastUnlockTs: grant.lastUnlockTs.toNumber(),
      amountUnlocked: grant.amountUnlocked.toNumber(),
      revoked: grant.revoked,
    }
  }
  async createGrant(
    mintAddress: PublicKey, 
    optMarketKey: PublicKey | null,
    amountTotal: number,
    issueTs: number,
    durationSec: number,
    initialCliffSec: number,
    vestIntervalSec: number,
    senderWallet: PublicKey,
    senderTokenAccountPk: PublicKey,
    recipientWallet: PublicKey,
    signers: anchor.web3.Signer[],
    ): Promise<PublicKey> {
      const grantAccount = anchor.web3.Keypair.generate();
      const grantTokenAccount = anchor.web3.Keypair.generate();
      const [pda, bump] = await this.getPda();
      await this.program.rpc.initGrant(
        bump,
        optMarketKey,
        new anchor.BN(amountTotal),
        new anchor.BN(issueTs),
        new anchor.BN(durationSec),
        new anchor.BN(initialCliffSec),
        new anchor.BN(vestIntervalSec),
        recipientWallet,
        {
          accounts: {
            pda: pda,
            grantAccount: grantAccount.publicKey,
            grantTokenAccount: grantTokenAccount.publicKey,
            senderWallet: senderWallet,
            senderTokenAccount: senderTokenAccountPk,
            mint: mintAddress,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          },
          signers: [grantAccount, ...signers, grantTokenAccount],
      });
      return grantAccount.publicKey;
  }
  async revokeGrant(
    grantAccountPk: PublicKey,
    grantTokenAccountPk: PublicKey,
    senderTokenAccountPk: PublicKey,
    senderWallet: anchor.web3.Signer,
  ): Promise<void> {
    const [pda, ] = await this.getPda();
    await this.program.rpc.revokeGrant({
      accounts: {
        senderWallet: senderWallet.publicKey,
        pda: pda,
        grantAccount: grantAccountPk,
        grantTokenAccount: grantTokenAccountPk,
        senderTokenAccount: senderTokenAccountPk,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [senderWallet],
    });
  }
  async unlockGrant(
    grantAccountPk: PublicKey,
    grantTokenAccountPk: PublicKey,
    recipientTokenAccountPk: PublicKey,
    recipientWallet: anchor.web3.Signer,
  ): Promise<void> {
    const [pda, ] = await this.getPda();
    await this.program.rpc.unlockGrant({
      accounts: {
        recipientWallet: recipientWallet.publicKey,
        pda: pda,
        grantAccount: grantAccountPk,
        grantTokenAccount: grantTokenAccountPk,
        recipientTokenAccount: recipientTokenAccountPk,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      signers: [recipientWallet],
    });
  }
  async getPda(): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from(GRANT_PDA_SEED)], this.program.programId);
  }
  async findAllBySenderWallet(senderWalletPk: PublicKey): Promise<GrantAccount[]> {
    const accounts = await this.program.account.grantAccount.all(senderWalletPk.toBuffer());
    console.log(accounts[0].account);
    return [];
    // return accounts.map((a: any) => ({
    //   publicKey: a.publicKey,
    //   account: {
    //     senderWallet: a.account.senderWallet[0],
    //     recipientWallet: a.account.recipientWallet[0],
    //     pda: a.account.pda[0],
    //     // bump: number,
    //     // mintAddress: PublicKey,
    //     // optionMarketKey: PublicKey | null,
    //     // amountTotal: number,
    //     // issueTs: number,
    //     // durationSec: number,
    //     // initialCliffSec: number,
    //     // vestIntervalSec: number,
    //     // grantTokenAccount: PublicKey,
    //     // lastUnlockTs: number,
    //     // amountUnlocked: number,
    //     // revoked: boolean,
    //   }
    // }));
  }
  async findAllByRecipientWallet(recipientWalletPk: PublicKey): Promise<GrantAccount[]> {
    return await this.program.account.grantAccount.all([{
      memcmp: {
        offset: 40,
        bytes: recipientWalletPk.toBase58(),
      },
    }]);
  }
};
