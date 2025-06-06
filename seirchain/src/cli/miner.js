#!/usr/bin/env node

/**
 * @fileoverview SeirChain Mining Client
 * Handles blockchain mining operations, triad validation, and reward distribution
 */

const TriadMatrix = require('../core/TriadMatrix');
const Wallet = require('../core/Wallet');
const Tokenomics = require('../core/Tokenomics');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Constants
const DEFAULT_MINING_INTERVAL = 5000;
const WALLET_FILE = '.wallet';
const STATS_UPDATE_INTERVAL = 1000;

class SeirMiner {
  /**
   * Create a new SeirMiner instance
   */
  constructor() {
    this.initializeState();
    this.setupEventHandlers();
  }

  /**
   * Initialize miner state
   * @private
   */
  initializeState() {
    this.matrix = null;
    this.wallet = new Wallet();
    this.tokenomics = new Tokenomics();
    this.dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'triad.db');
    this.miningInterval = parseInt(process.env.MINING_INTERVAL, 10) || DEFAULT_MINING_INTERVAL;
    this.isRunning = false;
    this.lastError = null;
    this.stats = this.initializeStats();
  }

  /**
   * Initialize mining statistics
   * @private
   * @returns {Object} Initial stats object
   */
  initializeStats() {
    return {
      totalValidated: 0,
      totalRewards: 0,
      startTime: null,
      lastReward: null,
      successfulValidations: 0,
      failedValidations: 0,
      averageConsensus: 0,
      highestConsensus: 0,
      totalAttempts: 0
    };
  }

  /**
   * Setup event handlers
   * @private
   */
  setupEventHandlers() {
    process.on('SIGINT', async () => {
      // console.log('\n🛑 Stopping miner...');
      await this.stop();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      // console.error('\n❌ Uncaught exception:', error);
      this.lastError = error.message;
      await this.stop();
      process.exit(1);
    });
  }

  /**
   * Load wallet from file
   * @private
   * @returns {boolean} True if wallet loaded successfully
   */
  loadWallet() {
    const walletFile = path.join(process.cwd(), 'data', WALLET_FILE);
    
    try {
      if (!fs.existsSync(walletFile)) {
        throw new Error('No wallet found. Please create one using seirchain-cli first.');
      }

      const privateKey = fs.readFileSync(walletFile, 'utf-8').trim();
      this.wallet.importFromPrivateKey(privateKey);
      return true;
    } catch (error) {
      this.lastError = error.message;
      // console.error(`❌ Error loading wallet: ${error.message}`);
      return false;
    }
  }

  /**
   * Initialize the miner
   * @returns {Promise<void>}
   */
  async init() {
    try {
      if (!this.loadWallet()) {
        process.exit(1);
      }

      await this.initializeDataDirectory();
      await this.initializeComponents();
      await this.registerValidator();
      
      this.printWelcomeMessage();
    } catch (error) {
      this.lastError = error.message;
      // console.error('❌ Failed to initialize miner:', error.message);
      throw error;
    }
  }

  /**
   * Initialize data directory
   * @private
   */
  async initializeDataDirectory() {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * Initialize TriadMatrix and Tokenomics
   * @private
   */
  async initializeComponents() {
    this.matrix = new TriadMatrix(this.dbPath, {
      dimensions: parseInt(process.env.MATRIX_DIMENSIONS, 10) || 3,
      complexity: parseInt(process.env.TRIAD_COMPLEXITY, 10) || 4,
      consensusThreshold: parseFloat(process.env.CONSENSUS_THRESHOLD) || 0.67,
    });

    await this.matrix.init();
    await this.tokenomics.loadLedger();
  }

  /**
   * Register wallet as validator
   * @private
   */
  async registerValidator() {
    const walletAddress = this.wallet.getAddress();
    if (!this.matrix.validators.has(walletAddress)) {
      this.matrix.addValidator(walletAddress);
      // console.log(`📬 Registered ${walletAddress} as a validator.`);
    }
  }

  /**
   * Print welcome message with initial status
   * @private
   */
  printWelcomeMessage() {
    const walletAddress = this.wallet.getAddress();
    // console.log(`
    // ✨ Miner Initialized Successfully
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //    🔑 Address: ${walletAddress}
    //    💰 Current Balance: ${this.tokenomics.getBalance(walletAddress)} WAC
    //    🎁 Mining Reward: ${this.tokenomics.MINING_REWARD} WAC
    //    ⏱️  Mining Interval: ${this.miningInterval}ms
    //    🎯 Consensus Threshold: ${this.matrix.consensusThreshold * 100}%
    //     `);
  }

  /**
   * Print mining statistics
   * @private
   */
  printStats() {
    const walletAddress = this.wallet.getAddress();
    const currentBalance = this.tokenomics.getBalance(walletAddress);
    const runTime = ((Date.now() - this.stats.startTime) / 1000 / 60).toFixed(2);
    const rewardsPerHour = (this.stats.totalRewards / (runTime / 60)).toFixed(2);
    const successRate = this.stats.totalAttempts ? 
      ((this.stats.successfulValidations / this.stats.totalAttempts) * 100).toFixed(2) : 
      0;

    // console.clear();
    // console.log(`
    // ⛏️  SeirChain Miner Status
    // ━━━━━━━━━━━━━━━━━━━━━━━━

    // 📍 Miner Details
    //    Address: ${walletAddress}
    //    Current Balance: ${currentBalance} WAC
    //    Mining Reward: ${this.tokenomics.MINING_REWARD} WAC per validation
    //    Last Error: ${this.lastError || 'None'}

    // 📊 Mining Statistics
    //    Runtime: ${runTime} minutes
    //    Triads Validated: ${this.stats.totalValidated}
    //    Success Rate: ${successRate}%
    //    Average Consensus: ${this.stats.averageConsensus.toFixed(2)}%
    //    Highest Consensus: ${this.stats.highestConsensus.toFixed(2)}%
    //    Total Rewards: ${this.stats.totalRewards} WAC
    //    Rewards/Hour: ${rewardsPerHour} WAC
    //    Last Reward: ${this.stats.lastReward ? new Date(this.stats.lastReward).toLocaleTimeString() : 'None'}

    // 💎 Network Statistics
    //    Total Supply: ${this.tokenomics.getTotalSupply()} WAC
    //    Your Share: ${((currentBalance / this.tokenomics.getTotalSupply()) * 100).toFixed(2)}%
    //    Active Validators: ${this.matrix.validators.size}
    //    Total Triads: ${this.matrix.triads.size}

    // ⚙️  System Status
    //    Mining: ${this.isRunning ? '🟢 Active' : '🔴 Stopped'}
    //    Interval: ${this.miningInterval}ms
    //    Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB

    // Press Ctrl+C to stop mining...
    //     `);
  }

  /**
   * Perform one mining cycle
   * @private
   */
  async miningCycle() {
    try {
      const walletAddress = this.wallet.getAddress();
      const state = this.matrix.getMatrixState();
      const unvalidatedTriads = state.triads.filter(t => !t.validated && t.validator !== walletAddress);

      if (unvalidatedTriads.length > 0) {
        for (const triad of unvalidatedTriads) {
          try {
            this.stats.totalAttempts++;
            const updatedTriad = await this.matrix.validateTriad(triad.id, walletAddress);
            
            // Update consensus statistics
            const consensusPercent = updatedTriad.consensus * 100;
            this.stats.averageConsensus = (
              (this.stats.averageConsensus * (this.stats.totalAttempts - 1) + consensusPercent) / 
              this.stats.totalAttempts
            );
            this.stats.highestConsensus = Math.max(this.stats.highestConsensus, consensusPercent);

            if (updatedTriad.validated) {
              await this.tokenomics.mint(walletAddress, this.tokenomics.MINING_REWARD);
              this.updateSuccessStats();
            } else {
              this.stats.failedValidations++;
            }
          } catch (error) {
            this.lastError = error.message;
            this.stats.failedValidations++;
            // console.error(`Error validating triad ${triad.id}:`, error.message);
          }
        }
      }

      this.printStats();
    } catch (error) {
      this.lastError = error.message;
      // console.error('Error in mining cycle:', error.message);
    }
  }

  /**
   * Update statistics after successful validation
   * @private
   */
  updateSuccessStats() {
    this.stats.totalValidated++;
    this.stats.successfulValidations++;
    this.stats.totalRewards += this.tokenomics.MINING_REWARD;
    this.stats.lastReward = Date.now();
  }

  /**
   * Start mining operations
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.stats.startTime = Date.now();
    // console.log('🚀 Starting miner...');

    // Start stats update interval
    this.statsInterval = setInterval(() => this.printStats(), STATS_UPDATE_INTERVAL);

    while (this.isRunning) {
      await this.miningCycle();
      await new Promise(resolve => setTimeout(resolve, this.miningInterval));
    }
  }

  /**
   * Stop mining operations
   * @returns {Promise<void>}
   */
  async stop() {
    this.isRunning = false;
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    if (this.matrix) {
      await this.matrix.closeDB();
    }

    // console.log('\n✨ Mining stopped. Final stats:');
    this.printStats();
  }
}

// Start the miner if this file is run directly
if (require.main === module) {
  const miner = new SeirMiner();
  miner.init()
    .then(() => miner.start())
    .catch(error => {
      console.error('Failed to start miner:', error);
      process.exit(1);
    });
}

module.exports = SeirMiner;
