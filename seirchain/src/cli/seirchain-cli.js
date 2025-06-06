#!/usr/bin/env node

/**
 * @fileoverview SeirChain Command Line Interface
 * Provides command-line tools for managing wallets, triads, mining, and token operations
 */

const minimist = require('minimist');
const TriadMatrix = require('../core/TriadMatrix');
const Wallet = require('../core/Wallet');
const Tokenomics = require('../core/Tokenomics');
const { handleTokenInfo, handleTokenTransfer } = require('./token-handlers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

// Constants
const WALLET_FILE = path.resolve(process.cwd(), 'data', '.wallet');
const DEFAULT_TRIAD_LIST_LIMIT = 10;
const WALLET_FILE_PERMISSIONS = 0o600;

class SeirChainCLI {
  /**
   * Create a new SeirChainCLI instance
   */
  constructor() {
    this.initializeState();
    this.setupCleanupHandlers();
  }

  /**
   * Setup cleanup handlers for graceful shutdown
   * @private
   */
  setupCleanupHandlers() {
    process.on('SIGINT', async () => {
    // console.log('\nGracefully shutting down...');
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
    // console.log('\nReceived SIGTERM. Cleaning up...');
      await this.cleanup();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      // console.error('Uncaught Exception:', error);
      await this.cleanup();
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      // console.error('Unhandled Promise Rejection:', reason);
      await this.cleanup();
      process.exit(1);
    });
  }

  /**
   * Cleanup resources before shutdown
   * @private
   */
  async cleanup() {
    // console.log('Performing cleanup...');
    
    try {
      if (this.matrix) {
        // console.log('Closing TriadMatrix database...');
        await this.matrix.closeDB();
      }

      if (this.tokenomics) {
        // console.log('Closing Tokenomics database...');
        await this.tokenomics.closeDB();
      }

      // console.log('Cleanup completed successfully.');
    } catch (error) {
      // console.error('Error during cleanup:', error);
    }
  }

  /**
   * Initialize CLI state
   * @private
   */
  initializeState() {
    this.matrix = null;
    this.wallet = new Wallet();
    this.tokenomics = new Tokenomics();
    this.dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'triad.db');
    this.lastError = null;
  }

  /**
   * Initialize TriadMatrix
   * @returns {Promise<void>}
   */
  async initMatrix() {
    if (this.matrix?.isInitialized) return;

    try {
      await this.ensureDirectories();
      
      this.matrix = new TriadMatrix(this.dbPath, {
        dimensions: parseInt(process.env.MATRIX_DIMENSIONS, 10) || 3,
        complexity: parseInt(process.env.TRIAD_COMPLEXITY, 10) || 4,
        consensusThreshold: parseFloat(process.env.CONSENSUS_THRESHOLD) || 0.67,
      });

      await this.matrix.init();
      // console.log('✅ TriadMatrix initialized.');
    } catch (error) {
      this.lastError = error.message;
      // console.error('❌ Failed to initialize TriadMatrix:', error.message);
      throw error;
    }
  }

  /**
   * Ensure required directories exist
   * @private
   */
  async ensureDirectories() {
    const dirs = [
      path.dirname(this.dbPath),
      path.dirname(WALLET_FILE)
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Load wallet from file
   * @returns {boolean} True if wallet loaded successfully
   */
  loadWallet() {
    if (!fs.existsSync(WALLET_FILE)) {
      return false;
    }

    try {
      const privateKey = fs.readFileSync(WALLET_FILE, 'utf-8').trim();
      this.wallet.importFromPrivateKey(privateKey);
      // console.log(`🔑 Wallet loaded. Address: ${this.wallet.getAddress()}`);
      return true;
    } catch (error) {
      this.lastError = error.message;
      // console.error(`❌ Error loading wallet: ${error.message}. Please create or import a wallet.`);
      return false;
    }
  }

  /**
   * Save wallet to file
   * @param {string} privateKey - Private key to save
   */
  saveWallet(privateKey) {
    try {
      fs.writeFileSync(WALLET_FILE, privateKey);
      fs.chmodSync(WALLET_FILE, WALLET_FILE_PERMISSIONS);
      // console.log(`✅ Wallet saved to: ${WALLET_FILE}`);
      // console.warn("⚠️  IMPORTANT: Secure your wallet file and its backup. This file contains your private key.");
    } catch (error) {
      this.lastError = error.message;
      // console.error(`❌ Error saving wallet: ${error.message}`);
    }
  }

  /**
   * Create a new wallet
   * @param {boolean} save - Whether to save the wallet to file
   */
  async createWallet(save = true) {
    const { privateKey, publicKey, address } = this.wallet.generateKeyPair();
    
    // console.log('\n🔑 New Wallet Created:');
    // console.log(`   Address: ${address}`);
    // console.log(`   Public Key: ${publicKey}`);
    // console.log(`   Private Key: ${privateKey} (DO NOT SHARE THIS!)`);

    if (save) {
      this.saveWallet(privateKey);
    } else {
      // console.warn("\n⚠️  Wallet not saved. Use '--save-wallet' to persist it or save the private key manually.");
    }
  }

  /**
   * Import wallet from private key
   * @param {string} privateKey - Private key to import
   */
  async importWallet(privateKey) {
    try {
      this.wallet.importFromPrivateKey(privateKey);
      // console.log(`✅ Wallet imported successfully. Address: ${this.wallet.getAddress()}`);
      this.saveWallet(privateKey);
    } catch (error) {
      this.lastError = error.message;
      // console.error(`❌ Failed to import wallet: ${error.message}`);
    }
  }

  /**
   * Create a new triad
   * @param {string} dataString - Data for the triad
   */
  async createTriad(dataString) {
    if (!this.validateWalletState()) return;
    if (!this.validateTriadData(dataString)) return;

    let data;
    try {
      data = JSON.parse(dataString);
    } catch {
      data = dataString;
    }

    try {
      // console.log('Attempting to create triad with data:', data);
      // const triad = await this.matrix.createTriad(data, this.wallet.getAddress());
      // console.log('✅ Triad created successfully:');
      // console.log(JSON.stringify(triad, null, 2));
    } catch (error) {
      this.lastError = error.message;
      // console.error('❌ Failed to create triad:', error.message);
      if (process.env.DEBUG === 'true') {
        // console.error(error.stack);
      }
    }
  }

  /**
   * Get matrix status
   */
  async getStatus() {
    const state = this.matrix.getMatrixState();
    const validatedTriads = state.triads.filter(t => t.validated).length;

    // console.log('\n📊 TriadMatrix Status:');
    // console.log(`   Initialized: ${state.isInitialized ? '✅' : '❌'}`);
    // console.log(`   Dimensions: ${state.dimensions}x${state.dimensions}x${state.dimensions}`);
    // console.log(`   Complexity Factor: ${state.complexity}`);
    // console.log(`   Consensus Threshold: ${(state.consensusThreshold * 100).toFixed(2)}%`);
    // console.log(`   Total Triads in DB: ${state.triadsCount}`);
    // console.log(`   Validated Triads: ${validatedTriads} / ${state.triads.length}`);
    // console.log(`   Registered Validators: ${state.validators.length}`);
    
    if (state.validators.length > 0) {
      // console.log('\n   Validator List:');
      // state.validators.forEach(v => console.log(`   - ${v}`));
    }

    if (this.lastError) {
      // console.log(`\n⚠️  Last Error: ${this.lastError}`);
    }
  }

  /**
   * List triads
   * @param {number} limit - Maximum number of triads to list
   */
  async listTriads(limit = DEFAULT_TRIAD_LIST_LIMIT) {
    const state = this.matrix.getMatrixState();
    
    // console.log('\n📋 Triads List (Snapshot):');
    if (state.triads.length === 0) {
      // console.log('   No triads found in the current matrix snapshot.');
      return;
    }

    const triadsToDisplay = state.triads.slice(0, limit);
    this.displayTriadsList(triadsToDisplay);

    if (state.triads.length > limit) {
      // console.log(`\n   ... and ${state.triads.length - limit} more. Use --limit <num> to see more.`);
    }
  }

  /**
   * Display list of triads
   * @private
   * @param {Array} triads - Array of triads to display
   */
  displayTriadsList(triads) {
    triads.forEach((triad, index) => {
      // console.log(`\n${index + 1}. Triad ID: ${triad.id}`);
      // console.log(`   Validator: ${triad.validator}`);
      // console.log(`   Status: ${triad.validated ? '✅ Validated' : '⏳ Pending'}`);
      // console.log(`   Consensus: ${(triad.consensus * 100).toFixed(2)}%`);
      // console.log(`   Position: (X:${triad.position.x}, Y:${triad.position.y}, Z:${triad.position.z})`);
      // console.log(`   Created: ${new Date(triad.timestamp).toLocaleString()}`);
      
      if (typeof triad.data === 'object') {
        // console.log(`   Data: ${JSON.stringify(triad.data)}`);
      } else {
        // console.log(`   Data: ${triad.data}`);
      }
    });
  }

  /**
   * Start mining process
   */
  async mine() {
    if (!this.validateWalletState()) return;

    const walletAddress = this.wallet.getAddress();
    await this.displayMiningStart(walletAddress);
    await this.ensureValidatorRegistration(walletAddress);
    await this.performMiningCycle(walletAddress);
  }

  /**
   * Display mining start information
   * @private
   * @param {string} walletAddress - Wallet address
   */
  async displayMiningStart(walletAddress) {
    // console.log(`
    // 🔄 Starting TriadMatrix Validation Process
    //    Validator Address: ${walletAddress}
    //    Mining Reward: ${this.tokenomics.MINING_REWARD} ${this.tokenomics.tokenSymbol}
    //    Current Balance: ${this.tokenomics.getBalance(walletAddress)} ${this.tokenomics.tokenSymbol}
    // `);
  }

  /**
   * Ensure validator registration
   * @private
   * @param {string} walletAddress - Wallet address
   */
  async ensureValidatorRegistration(walletAddress) {
    if (!this.matrix.validators.has(walletAddress)) {
      this.matrix.addValidator(walletAddress);
      // console.log(`📬 Successfully registered ${walletAddress} as a validator.`);
    }
  }

  /**
   * Perform mining cycle
   * @private
   * @param {string} walletAddress - Wallet address
   */
  async performMiningCycle(walletAddress) {
    const state = this.matrix.getMatrixState();
    const unvalidatedTriads = state.triads.filter(t => !t.validated && t.validator !== walletAddress);

    if (unvalidatedTriads.length === 0) {
      // console.log('✅ No triads available for validation in current snapshot.');
      return;
    }

    // console.log(`
    // 📊 Mining Status:
    //    Total Triads: ${state.triads.length}
    //    Unvalidated Triads: ${unvalidatedTriads.length}
    //    Consensus Threshold: ${(this.matrix.consensusThreshold * 100).toFixed(2)}%
    // `);

    let validatedCount = 0;
    let totalRewards = 0;

    for (const triad of unvalidatedTriads) {
      const result = await this.validateTriad(triad, walletAddress);
      if (result.success) {
        validatedCount++;
        totalRewards += result.reward;
      }
    }

    this.displayMiningSummary(validatedCount, unvalidatedTriads.length, totalRewards, walletAddress);
  }

  /**
   * Validate a single triad
   * @private
   * @param {Object} triad - Triad to validate
   * @param {string} walletAddress - Validator address
   * @returns {Object} Validation result
   */
  async validateTriad(triad, walletAddress) {
    try {
      // console.log(`\n🔍 Validating Triad ${triad.id}...`);
      
      const updatedTriad = await this.matrix.validateTriad(triad.id, walletAddress);
      
      if (updatedTriad.validated) {
        try {
          await this.tokenomics.mint(walletAddress, this.tokenomics.MINING_REWARD);
          // console.log(`
          // ✅ Triad Validated Successfully:
          //    ID: ${triad.id}
          //    Consensus: ${(updatedTriad.consensus * 100).toFixed(2)}%
          //    Reward: +${this.tokenomics.MINING_REWARD} ${this.tokenomics.tokenSymbol}
          // `);
          return { success: true, reward: this.tokenomics.MINING_REWARD };
        } catch (mintError) {
          this.lastError = mintError.message;
          // console.error(`
          // ❌ Mining Reward Error:
          //    Triad ID: ${triad.id}
          //    Error: ${mintError.message}
          // `);
          return { success: false, reward: 0 };
        }
      } else {
        // console.log(`
        // ⚠️  Validation Unsuccessful:
        //    Triad ID: ${triad.id}
        //    Current Consensus: ${(updatedTriad.consensus * 100).toFixed(2)}%
        //    Required Consensus: ${(this.matrix.consensusThreshold * 100)}%
        // `);
        return { success: false, reward: 0 };
      }
    } catch (error) {
      this.lastError = error.message;
      // console.error(`
      // ❌ Validation Error:
      //    Triad ID: ${triad.id}
      //    Error: ${error.message}
      //    ${process.env.DEBUG === 'true' ? '\nStack: ' + error.stack : ''}
      // `);
      return { success: false, reward: 0 };
    }
  }

  /**
   * Display mining summary
   * @private
   */
  displayMiningSummary(validatedCount, totalTriads, totalRewards, walletAddress) {
    // console.log(`
    // 🎉 Mining Cycle Complete:
    //    Validated Triads: ${validatedCount}/${totalTriads}
    //    Total Rewards: ${totalRewards} ${this.tokenomics.tokenSymbol}
    //    New Balance: ${this.tokenomics.getBalance(walletAddress)} ${this.tokenomics.tokenSymbol}
    //    Total Supply: ${this.tokenomics.getTotalSupply()} ${this.tokenomics.tokenSymbol}
    // `);
  }

  /**
   * Get details for a specific triad
   * @param {string} triadId - ID of triad to fetch
   */
  async getTriadDetails(triadId) {
    if (!triadId) {
      // console.error('❌ Please provide a triad ID.');
      return;
    }

    try {
      const triad = await this.matrix.getTriadById(triadId);
      // console.log('🔍 Triad Details:');
      // console.log(JSON.stringify(triad, null, 2));
    } catch (error) {
      this.lastError = error.message;
      // console.error(`❌ Error fetching triad details: ${error.message}`);
    }
  }

  /**
   * Show help message
   */
  showHelp() {
    console.log(`
${path.basename(process.argv[1])} - SeirChain TriadMatrix Command Line Interface

Usage: node ${path.basename(process.argv[1])} [command] [options]

Wallet Commands:
  --create-wallet [--save]       Create a new wallet. --save is default.
  --import-wallet <privateKey>   Import a wallet from a private key and save it.
  --wallet-info                  Display current loaded wallet information.

Triad & Matrix Commands:
  --create-triad "<data>"        Create a new triad with the given data.
                                Example: --create-triad '{"message":"hello"}'
  --get-triad <triadId>         Fetch and display details for a specific triad.
  --status                       Show current TriadMatrix status and statistics.
  --list [--limit <number>]      List triads in the matrix (default limit 10).
  --mine                         Run the validation process for unvalidated triads.

Token Commands:
  --token-info                   Display WAC token info for your wallet.
  --transfer-tokens <recipient> <amount>  Transfer WAC tokens to another wallet.

General Options:
  --help                         Show this help message.

Environment Variables:
  DEBUG=true                     Enable debug mode with stack traces
  VERBOSE_LOGGING=true          Enable verbose logging
  MATRIX_DIMENSIONS=3           Set matrix dimensions (default: 3)
  TRIAD_COMPLEXITY=4           Set triad complexity (default: 4)
  CONSENSUS_THRESHOLD=0.67     Set consensus threshold (default: 0.67)

Examples:
  node ${path.basename(process.argv[1])} --create-wallet
  node ${path.basename(process.argv[1])} --import-wallet YOUR_PRIVATE_KEY_HERE
  node ${path.basename(process.argv[1])} --create-triad "My first triad data"
  node ${path.basename(process.argv[1])} --status
  node ${path.basename(process.argv[1])} --list --limit 5
  node ${path.basename(process.argv[1])} --mine
  node ${path.basename(process.argv[1])} --token-info
  node ${path.basename(process.argv[1])} --transfer-tokens RECIPIENT_ADDRESS AMOUNT
    `);
  }

  /**
   * Validate wallet state
   * @private
   * @returns {boolean} True if wallet is valid
   */
  validateWalletState() {
    if (!this.wallet.isInitialized()) {
      console.error('❌ Wallet not loaded or initialized. Use --create-wallet or ensure .wallet file exists.');
      return false;
    }
    return true;
  }

  /**
   * Validate triad data
   * @private
   * @param {string} dataString - Data to validate
   * @returns {boolean} True if data is valid
   */
  validateTriadData(dataString) {
    if (!dataString || dataString.trim() === "") {
      console.error('❌ Triad data cannot be empty.');
      return false;
    }
    return true;
  }
}

/**
 * Main CLI entry point
 */
async function main() {
  const cli = new SeirChainCLI();
  const args = minimist(process.argv.slice(2));

  try {
    cli.loadWallet();
    await cli.tokenomics.loadLedger();

    // Initialize matrix for commands that need it
    if (args['create-triad'] || args.status || args.list || args.mine || 
        args['get-triad'] || args['token-info']) {
      await cli.initMatrix();
    }

    await handleCommand(cli, args);

    // Cleanup resources if this was a one-off command
    if (!args.mine && !args['token-info']) {
      await cli.cleanup();
    }
  } catch (error) {
    console.error('❌ Unhandled error in CLI:', error.message);
    if (process.env.DEBUG === 'true' || process.env.VERBOSE_LOGGING === 'true') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Handle CLI command
 * @param {SeirChainCLI} cli - CLI instance
 * @param {Object} args - Command line arguments
 */
async function handleCommand(cli, args) {
  if (args.help || Object.keys(args).length === 1 && args._.length === 0) {
    cli.showHelp();
  } else if (args['create-wallet']) {
    await cli.createWallet(args.save !== false);
  } else if (args['import-wallet']) {
    if (!args['import-wallet'] || typeof args['import-wallet'] !== 'string') {
      console.error("❌ Private key must be provided for import.");
      cli.showHelp();
    } else {
      await cli.importWallet(args['import-wallet']);
    }
  } else if (args['wallet-info']) {
    if (cli.wallet.isInitialized()) {
      // console.log("🔑 Current Wallet Info:");
      // console.log(`   Address: ${cli.wallet.getAddress()}`);
      // console.log(`   Public Key: ${cli.wallet.getPublicKey()}`);
    } else {
      // console.log("❌ No wallet loaded. Use --create-wallet or --import-wallet.");
    }
  } else if (args['create-triad']) {
    if (typeof args['create-triad'] !== 'string') {
      console.error("❌ Data for triad must be a string.");
      cli.showHelp();
    } else {
      await cli.createTriad(args['create-triad']);
    }
  } else if (args['get-triad']) {
    await cli.getTriadDetails(args['get-triad']);
  } else if (args.status) {
    await cli.getStatus();
  } else if (args.list) {
    const limit = args.limit && Number.isInteger(parseInt(args.limit)) ? 
      parseInt(args.limit) : DEFAULT_TRIAD_LIST_LIMIT;
    await cli.listTriads(limit);
  } else if (args.mine) {
    await cli.mine();
  } else if (args['token-info']) {
    await handleTokenInfo(cli);
  } else if (args['transfer-tokens']) {
    if (args._.length < 2) {
      console.error("❌ Recipient address and amount must be provided for token transfer.");
      cli.showHelp();
      return;
    }
    const [recipient, amountStr] = args._;
    await handleTokenTransfer(cli, recipient, parseFloat(amountStr));
  }
}

// Start the CLI if this file is run directly
if (require.main === module) {
  main().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = SeirChainCLI;
