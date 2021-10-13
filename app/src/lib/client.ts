import * as anchor from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { AccountMeta, PublicKey, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
const { SystemProgram } = anchor.web3;

const GRANT_PDA_SEED = "grant";

export interface GrantAccount {
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
    instructions: anchor.web3.TransactionInstruction[],
    signers: anchor.web3.Signer[]
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
          instructions: instructions.length ? instructions : undefined,
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
          signers: [grantAccount, ...signers, grantTokenAccount]
      });
      return grantAccount.publicKey;
  }
  async revokeGrant(
    grantAccountPk: PublicKey,
    grantTokenAccountPk: PublicKey,
    senderTokenAccountPk: PublicKey,
    senderWallet: PublicKey,
    signers: anchor.web3.Signer[]
  ): Promise<void> {
    const [pda, ] = await this.getPda();
    await this.program.rpc.revokeGrant({
      accounts: {
        senderWallet: senderWallet,
        pda: pda,
        grantAccount: grantAccountPk,
        grantTokenAccount: grantTokenAccountPk,
        senderTokenAccount: senderTokenAccountPk,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: signers.length ? signers : undefined,
    });
  }
  async unlockGrant(
    grantAccountPk: PublicKey,
    grantTokenAccountPk: PublicKey,
    recipientTokenAccountPk: PublicKey,
    recipientWallet: PublicKey,
    instructions: anchor.web3.TransactionInstruction[],
    signers: anchor.web3.Signer[]
  ): Promise<void> {
    const [pda, ] = await this.getPda();
    await this.program.rpc.unlockGrant({
      instructions: instructions.length ? instructions : undefined,
      accounts: {
        recipientWallet: recipientWallet,
        pda: pda,
        grantAccount: grantAccountPk,
        grantTokenAccount: grantTokenAccountPk,
        recipientTokenAccount: recipientTokenAccountPk,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      signers: signers.length ? signers : undefined
    });
  }
  async getPda(): Promise<[PublicKey, number]> {
    return await PublicKey.findProgramAddress(
      [Buffer.from(GRANT_PDA_SEED)], this.program.programId);
  }
  async findGrantsBySender(senderWalletPk: PublicKey): Promise<GrantAccount[]> {
    const accounts = await this.program.account.grantAccount.all(senderWalletPk.toBuffer());
    return accounts.map((a: any) => ({
      publicKey: new PublicKey(a.publicKey.toString()),
      account: {
        pda: new PublicKey(a.account.pda.toString()),
        bump: a.account.bump,
        mintAddress: new PublicKey(a.account.mintAddress.toString()),
        optionMarketKey: a.account.optionMarketKey ? new PublicKey(a.account.optionMarketKey.toString()) : null,
        amountTotal: a.account.amountTotal.toNumber(),
        issueTs: a.account.issueTs.toNumber(),
        durationSec: a.account.durationSec.toNumber(),
        initialCliffSec: a.account.initialCliffSec.toNumber(),
        vestIntervalSec: a.account.vestIntervalSec.toNumber(),
        senderWallet: new PublicKey(a.account.senderWallet.toString()),
        recipientWallet: new PublicKey(a.account.recipientWallet.toString()),
        grantTokenAccount: new PublicKey(a.account.grantTokenAccount.toString()),
        amountUnlocked: a.account.amountUnlocked.toNumber(),
        revoked: a.account.revoked,
      }
    }));
  }
  async findGrantsByRecipient(recipientWalletPk: PublicKey): Promise<GrantAccount[]> {
    const accounts = await this.program.account.grantAccount.all([{
      memcmp: {
        offset: 40,
        bytes: recipientWalletPk.toBase58(),
      },
    }]);
    return accounts.map(Client.toGrantAccount);
  }
  static toGrantAccount(a: any): GrantAccount {
    return {
      publicKey: new PublicKey(a.publicKey.toString()),
      account: {
        pda: new PublicKey(a.account.pda.toString()),
        bump: a.account.bump,
        mintAddress: new PublicKey(a.account.mintAddress.toString()),
        optionMarketKey: a.account.optionMarketKey ? new PublicKey(a.account.optionMarketKey.toString()) : null,
        amountTotal: a.account.amountTotal.toNumber(),
        issueTs: a.account.issueTs.toNumber(),
        durationSec: a.account.durationSec.toNumber(),
        initialCliffSec: a.account.initialCliffSec.toNumber(),
        vestIntervalSec: a.account.vestIntervalSec.toNumber(),
        senderWallet: new PublicKey(a.account.senderWallet.toString()),
        recipientWallet: new PublicKey(a.account.recipientWallet.toString()),
        grantTokenAccount: new PublicKey(a.account.grantTokenAccount.toString()),
        amountUnlocked: a.account.amountUnlocked.toNumber(),
        lastUnlockTs: a.account.lastUnlockTs.toNumber(),
        revoked: a.account.revoked,
      }
    };
  }
};
