/**
 * Handle token info command
 * @param {import('./seirchain-cli').SeirChainCLI} cli - CLI instance
 */
async function handleTokenInfo(cli) {
  if (!cli.validateWalletState()) return;
  
  const address = cli.wallet.getAddress();
  const balance = cli.tokenomics.getBalance(address);
  const totalSupply = cli.tokenomics.getTotalSupply();
  
  console.log(`
💰 Token Information:
   Symbol: ${cli.tokenomics.tokenSymbol}
   Your Address: ${address}
   Your Balance: ${balance} ${cli.tokenomics.tokenSymbol}
   Total Supply: ${totalSupply} ${cli.tokenomics.tokenSymbol}
  `);
}

/**
 * Handle token transfer command
 * @param {import('./seirchain-cli').SeirChainCLI} cli - CLI instance
 * @param {string} recipient - Recipient address
 * @param {number} amount - Amount to transfer
 */
async function handleTokenTransfer(cli, recipient, amount) {
  if (!cli.validateWalletState()) return;
  
  try {
    await cli.tokenomics.transfer(cli.wallet.getAddress(), recipient, amount);
    console.log(`
✅ Transfer Successful:
   From: ${cli.wallet.getAddress()}
   To: ${recipient}
   Amount: ${amount} ${cli.tokenomics.tokenSymbol}
   New Balance: ${cli.tokenomics.getBalance(cli.wallet.getAddress())} ${cli.tokenomics.tokenSymbol}
    `);
  } catch (error) {
    console.error(`❌ Transfer failed: ${error.message}`);
  }
}

module.exports = {
  handleTokenInfo,
  handleTokenTransfer
};
