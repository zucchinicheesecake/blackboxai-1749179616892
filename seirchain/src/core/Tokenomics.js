/**
 * @fileoverview Tokenomics management for the SeirChain blockchain
 * Handles token minting, transfers, and ledger state management using LevelDB
 */

const { Level } = require('level');
const path = require('path');
const fs = require('fs');

// Constants for validation and configuration
const DEFAULT_MINING_REWARD = 10;
const MIN_TRANSFER_AMOUNT = 0.000001;

class Tokenomics {
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'tokenomics.db');
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Level(this.dbPath, { 
      valueEncoding: 'json',
      createIfMissing: true,
      errorIfExists: false
    });
    
    this.tokenName = options.tokenName || 'Wacłaium';
    this.tokenSymbol = options.tokenSymbol || 'WAC';
    this.totalSupply = 0;
    this.ledger = new Map();
    this.lastError = null;
    
    // Enhanced mining reward initialization with validation
    const miningReward = parseFloat(process.env.MINING_REWARD);
    if (isNaN(miningReward) || miningReward <= 0) {
      console.warn(`Invalid MINING_REWARD value in environment. Using default value of ${DEFAULT_MINING_REWARD}.`);
      this.MINING_REWARD = DEFAULT_MINING_REWARD;
    } else {
      this.MINING_REWARD = miningReward;
    }
  }

  async loadLedger() {
    try {
      // Load account balances
      for await (const [key, value] of this.db.iterator({ gt: 'acct:', lt: 'acct:~' })) {
        const address = key.replace('acct:', '');
        if (this.validateBalance(value.balance)) {
          this.ledger.set(address, value.balance);
        } else {
          console.warn(`Invalid balance found for address ${address}. Setting to 0.`);
          this.ledger.set(address, 0);
        }
      }
      
      // Load total supply with enhanced error handling
      try {
        const ts = await this.db.get('totalSupply');
        if (typeof ts === 'number' && ts >= 0) {
          this.totalSupply = ts;
        } else {
          console.warn('Invalid total supply found in DB. Resetting to 0.');
          this.totalSupply = 0;
          await this.db.put('totalSupply', 0);
        }
      } catch (tsErr) {
        if (tsErr.notFound) {
          console.log('Initializing total supply to 0.');
          await this.db.put('totalSupply', this.totalSupply);
        } else {
          throw tsErr; // Propagate critical DB errors
        }
      }
    } catch (error) {
      this.lastError = error.message;
      console.error('Error loading token ledger:', error.message);
      throw new Error(`Failed to load token ledger: ${error.message}`);
    }
  }

  async saveAccount(address) {
    try {
      const balance = this.ledger.get(address) || 0;
      if (!this.validateBalance(balance)) {
        throw new Error(`Invalid balance for address ${address}`);
      }
      await this.db.put(`acct:${address}`, { balance });
    } catch (error) {
      this.lastError = error.message;
      console.error(`Error saving account ${address}:`, error.message);
      throw error;
    }
  }

  async mint(address, amount) {
    if (!this.validateAddress(address)) {
      throw new Error('Invalid address provided for minting.');
    }
    
    if (!this.validateAmount(amount)) {
      throw new Error('Mint amount must be a positive number.');
    }

    const currentBalance = this.ledger.get(address) || 0;
    const previousTotalSupply = this.totalSupply;

    try {
      // Update ledger and total supply
      const newBalance = currentBalance + amount;
      this.ledger.set(address, newBalance);
      this.totalSupply += amount;

      // Persist changes atomically
      await Promise.all([
        this.db.put('totalSupply', this.totalSupply),
        this.saveAccount(address)
      ]);

      console.log(`
🎯 Mining Reward Minted Successfully:
   Address: ${address}
   Amount: +${amount} ${this.tokenSymbol}
   Previous Balance: ${currentBalance} ${this.tokenSymbol}
   New Balance: ${newBalance} ${this.tokenSymbol}
   Total Supply: ${previousTotalSupply} → ${this.totalSupply} ${this.tokenSymbol}
      `);

      return true;
    } catch (error) {
      // Revert memory state on DB failure
      if (this.ledger.has(address)) {
        this.ledger.set(address, currentBalance);
      }
      this.totalSupply = previousTotalSupply;
      this.lastError = error.message;
      throw new Error(`Failed to mint tokens: ${error.message}`);
    }
  }

  async transfer(fromAddress, toAddress, amount) {
    if (!this.validateAddress(fromAddress) || !this.validateAddress(toAddress)) {
      throw new Error('Invalid addresses provided for transfer.');
    }
    
    if (!this.validateAmount(amount)) {
      throw new Error('Transfer amount must be a positive number.');
    }

    const fromBalance = this.ledger.get(fromAddress) || 0;
    if (fromBalance < amount) {
      throw new Error(`Insufficient balance in account ${fromAddress}. Required: ${amount}, Available: ${fromBalance}`);
    }

    const toBalance = this.ledger.get(toAddress) || 0;

    try {
      // Update ledger
      this.ledger.set(fromAddress, fromBalance - amount);
      this.ledger.set(toAddress, toBalance + amount);

      // Persist changes atomically
      await Promise.all([
        this.saveAccount(fromAddress),
        this.saveAccount(toAddress)
      ]);

      console.log(`
💸 Transfer Completed Successfully:
   From: ${fromAddress}
   To: ${toAddress}
   Amount: ${amount} ${this.tokenSymbol}
   Sender Balance: ${fromBalance} → ${fromBalance - amount} ${this.tokenSymbol}
   Recipient Balance: ${toBalance} → ${toBalance + amount} ${this.tokenSymbol}
      `);

      return true;
    } catch (error) {
      // Revert memory state on DB failure
      this.ledger.set(fromAddress, fromBalance);
      this.ledger.set(toAddress, toBalance);
      this.lastError = error.message;
      throw new Error(`Failed to complete transfer: ${error.message}`);
    }
  }

  getBalance(address) {
    if (!this.validateAddress(address)) {
      console.warn(`Invalid address format: ${address}`);
      return 0;
    }
    return this.ledger.get(address) || 0;
  }

  getTotalSupply() {
    return this.totalSupply;
  }

  getLastError() {
    return this.lastError;
  }

  validateAddress(address) {
    return typeof address === 'string' && address.length > 0;
  }

  validateAmount(amount) {
    return Number.isFinite(amount) && amount >= MIN_TRANSFER_AMOUNT;
  }

  validateBalance(balance) {
    return Number.isFinite(balance) && balance >= 0;
  }

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  async closeDB() {
    if (!this.db) {
      return;
    }
    try {
      await this.db.close();
      console.log('Tokenomics database connection closed successfully');
    } catch (error) {
      this.lastError = error.message;
      console.error('Error closing tokenomics database:', error.message);
      throw error;
    }
  }
}

module.exports = Tokenomics;
