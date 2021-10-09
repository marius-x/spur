import * as anchor from '@project-serum/anchor';
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection, PublicKey, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
const { SystemProgram } = anchor.web3;
import * as assert from "assert";
import {Client, GrantAccountInfo} from '../app/src/lib/client';

function nowTs(): number {
  return Math.trunc((new Date()).getTime() / 1000);
}

describe('spur', () => {
  const program = anchor.workspace.Spur;
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  let mint: Token;
  const senderWallet = anchor.web3.Keypair.generate();
  const recipientWallet = anchor.web3.Keypair.generate();
  const client = new Client(program);

  before(async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(senderWallet.publicKey, 10000000000),
      "confirmed"
    );
    mint = await Token.createMint(
      program.provider.connection,
      senderWallet,
      senderWallet.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );
  });

  xit("Can create a grant account", async () => {
    const optMarketKey: PublicKey | null = null;
    const amountTotal = 100;
    const issueTs = nowTs();
    const durationSec = 60;
    const initialCliffSec = 1;
    const vestIntervalSec = 1;

    const senderTokenAccountPk = await mint.createAssociatedTokenAccount(senderWallet.publicKey);
    await mint.mintTo(
      senderTokenAccountPk,
      senderWallet.publicKey,
      [senderWallet],
      amountTotal
    );

    const grantAccountPk = await client.createGrant(
      mint.publicKey, 
      optMarketKey,
      amountTotal,
      issueTs,
      durationSec,
      initialCliffSec,
      vestIntervalSec,
      senderWallet.publicKey,
      senderTokenAccountPk,
      recipientWallet.publicKey,
      [senderWallet],
    );

    const grant = await client.getGrant(grantAccountPk);
    const [pda, bump] = await client.getPda();
    assert.ok(grant.pda.equals(pda));
    assert.equal(grant.bump, bump);
    assert.ok(grant.mintAddress.equals(mint.publicKey));
    if (optMarketKey === null) {
      assert.equal(grant.optionMarketKey, null);
    } else {
      assert.ok(optMarketKey.equals(grant.optionMarketKey));
    }
    assert.equal(grant.amountTotal, amountTotal);
    assert.equal(grant.issueTs, issueTs);
    assert.equal(grant.durationSec, durationSec);
    assert.equal(grant.initialCliffSec, initialCliffSec);
    assert.equal(grant.vestIntervalSec, vestIntervalSec);
    assert.ok(grant.senderWallet.equals(senderWallet.publicKey));
    assert.ok(grant.recipientWallet.equals(recipientWallet.publicKey));
    assert.equal(grant.lastUnlockTs, 0);
    assert.equal(grant.amountUnlocked, 0);
    assert.equal(grant.revoked, false);

    let senderTokenInfo = await mint.getAccountInfo(senderTokenAccountPk);
    assert.equal(senderTokenInfo.amount, 0);

    let grantTokenInfo = await mint.getAccountInfo(grant.grantTokenAccount);
    assert.equal(grantTokenInfo.amount, amountTotal);
  });

  xdescribe("Revoke", () => {
    const amountTotal = 100;
    let senderTokenAccountPk: PublicKey;
    let grantAccountPk: PublicKey;
    let grant: GrantAccountInfo;

    before(async () => {
      senderTokenAccountPk = await mint.createAssociatedTokenAccount(senderWallet.publicKey);
      // TODO: mint beforeEach and burn afterEach. Error: cannot mint twice in the same test!
      await mint.mintTo(
        senderTokenAccountPk,
        senderWallet.publicKey,
        [senderWallet],
        amountTotal
      );
    });

    beforeEach(async () => {
      grantAccountPk = await client.createGrant(
        mint.publicKey, 
        null,
        amountTotal,
        nowTs(),
        60,
        1,
        1,
        senderWallet.publicKey,
        senderTokenAccountPk,
        recipientWallet.publicKey,
        [senderWallet],
      );
      grant = await client.getGrant(grantAccountPk);
    });

    it ("Can revoke owned grant", async () => {
      await client.revokeGrant(
        grantAccountPk, 
        grant.grantTokenAccount, 
        senderTokenAccountPk,
        senderWallet,
      );
      const grantRevoked = await client.getGrant(grantAccountPk);
      assert.equal(grantRevoked.revoked, true);
  
      let senderTokenInfo = await mint.getAccountInfo(senderTokenAccountPk);
      assert.equal(senderTokenInfo.amount, amountTotal);
  
      let grantTokenInfo = await mint.getAccountInfo(grant.grantTokenAccount);
      assert.equal(grantTokenInfo.amount, 0);
    });

    it ("Can't revoke not owned grant", async () => {
      let raisedError = false;
      let invalidWallet = recipientWallet;
      try {
        await client.revokeGrant(
          grantAccountPk, 
          grant.grantTokenAccount, 
          senderTokenAccountPk,
          invalidWallet,
        );
      } catch (err) {
        raisedError = err.code === 0x8f;
      }
      assert.ok(raisedError, "program constraint violated");

      const grantRevoked = await client.getGrant(grantAccountPk);
      assert.equal(grantRevoked.revoked, false);
      
      let senderTokenInfo = await mint.getAccountInfo(senderTokenAccountPk);
      assert.equal(senderTokenInfo.amount, 0);
      
      let grantTokenInfo = await mint.getAccountInfo(grant.grantTokenAccount);
      assert.equal(grantTokenInfo.amount, amountTotal);
    });
  });

  describe("Unlock", () => {
    it("Can unlock entire vested grant", async () => {
      const optMarketKey: PublicKey | null = null;
      const amountTotal = 100;
      const issueTs = nowTs();
      const durationSec = 1;
      const initialCliffSec = 0;
      const vestIntervalSec = 1;
  
      const senderTokenAccountPk = await mint.createAssociatedTokenAccount(senderWallet.publicKey);
      await mint.mintTo(
        senderTokenAccountPk,
        senderWallet.publicKey,
        [senderWallet],
        amountTotal
      );
      const grantAccountPk = await client.createGrant(
        mint.publicKey, 
        optMarketKey,
        amountTotal,
        issueTs,
        durationSec,
        initialCliffSec,
        vestIntervalSec,
        senderWallet.publicKey,
        senderTokenAccountPk,
        recipientWallet.publicKey,
        [senderWallet],
      );
      const grant = await client.getGrant(grantAccountPk);
      const recipientTokenAccountPk = await mint.createAssociatedTokenAccount(recipientWallet.publicKey);

      await new Promise(resolve => setTimeout(resolve, 1000));

      await client.unlockGrant(
        grantAccountPk, 
        grant.grantTokenAccount, 
        recipientTokenAccountPk,
        recipientWallet);

      let recipientTokenInfo = await mint.getAccountInfo(recipientTokenAccountPk);
      assert.equal(recipientTokenInfo.amount.toNumber(), 100);
      // const allAccounts = await program.account.grantAccount.all(
      //   senderWallet.publicKey.toBuffer()
      // );
      const allAccounts = await client.findAllBySenderWallet(senderWallet.publicKey);
      console.log("allAccounts", allAccounts);
    });
  });
});
