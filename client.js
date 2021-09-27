const anchor = require('@project-serum/anchor');
const { SystemProgram } = anchor.web3;

// Configure the local cluster.
const provider = anchor.Provider.local();
anchor.setProvider(provider);

async function main() {
  // #region main
  // Read the generated IDL.
  const idl = JSON.parse(require('fs').readFileSync('./target/idl/spur.json', 'utf8'));
  
  // Address of the deployed program.
  const programId = new anchor.web3.PublicKey('6ojRC5neU8YLjfiR3igYvxPyuJLfjYYASfoioPsCamAV');
  
  // Generate the program client from IDL.
  const program = new anchor.Program(idl, programId);

  const vestingAccount = anchor.web3.Keypair.generate();
  const mintAccount = anchor.web3.Keypair.generate();
  const destAccount = anchor.web3.Keypair.generate();
  
  // Create the new account and initialize it with the program.
  // #region code-simplified
  await program.rpc.initialize(
    mintAccount.publicKey,
    destAccount.publicKey,
    new anchor.BN(123456),
    new anchor.BN(Date.now()),
    {
      accounts: {
        vestingAccount: vestingAccount.publicKey,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [vestingAccount] 
    }
  );

  const account = await program.account.vestingAccount.fetch(vestingAccount.publicKey);
  console.log(account);

  // #endregion main
}

console.log('Running client.');
main().then(() => console.log('Success'));
