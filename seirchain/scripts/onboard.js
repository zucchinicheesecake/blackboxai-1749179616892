#!/usr/bin/env node

/**
 * @fileoverview SeirChain Node Onboarding Script
 * Handles node initialization, wallet creation, and onboarding notifications
 */

const Wallet = require('../src/core/Wallet');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const qrcode = require('qrcode-terminal');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Constants
const WALLET_BACKUP_DIR = path.resolve(__dirname, '../data/onboarded-wallets');
const CONFIG_DIR = path.resolve(__dirname, '../config');
const DEFAULT_PORT = 6001;
const MIN_PASSWORD_LENGTH = 12;

class NodeOnboarder {
  constructor() {
    this.wallet = new Wallet();
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   * @private
   */
  ensureDirectories() {
    [WALLET_BACKUP_DIR, CONFIG_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Start the onboarding process
   * @param {Object} options - Onboarding options
   */
  async onboardNode(options = {}) {
    console.clear();
    this.displayWelcomeBanner();

    try {
      // Interactive setup if not provided via CLI
      const config = await this.gatherConfiguration(options);
      
      // Generate wallet
      const walletDetails = this.generateWallet();
      
      // Create node configuration
      const nodeConfig = await this.createNodeConfig(config, walletDetails);
      
      // Save configurations
      await this.saveConfigurations(nodeConfig, walletDetails);
      
      // Display node information
      this.displayNodeInformation(walletDetails, nodeConfig);
      
      // Send email notification if enabled
      if (config.email) {
        await this.sendOnboardingEmail(config.email, walletDetails, nodeConfig);
      }

      // Generate QR codes for easy mobile backup
      this.generateBackupQRCodes(walletDetails);

      // Display next steps
      this.displayNextSteps(nodeConfig);

    } catch (error) {
      console.error(chalk.red('\n❌ Onboarding Error:'), error.message);
      if (process.env.DEBUG === 'true') {
        console.error(chalk.gray('\nStack trace:'), error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * Display welcome banner
   * @private
   */
  displayWelcomeBanner() {
    console.log(chalk.cyan(`
╔════════════════════════════════════════╗
║       Welcome to SeirChain Setup       ║
║    Initialize Your Node and Wallet     ║
╚════════════════════════════════════════╝
    `));
  }

  /**
   * Gather node configuration through CLI or interactive prompts
   * @private
   * @param {Object} options - CLI options
   * @returns {Promise<Object>} Configuration object
   */
  async gatherConfiguration(options) {
    const questions = [];

    if (!options.nodeType) {
      questions.push({
        type: 'list',
        name: 'nodeType',
        message: 'Select node type:',
        choices: [
          { name: 'Validator Node (participates in consensus)', value: 'validator' },
          { name: 'Full Node (syncs and verifies blockchain)', value: 'full' },
          { name: 'Light Node (minimal verification)', value: 'light' }
        ]
      });
    }

    if (!options.port) {
      questions.push({
        type: 'input',
        name: 'port',
        message: 'Enter port number for P2P communication:',
        default: DEFAULT_PORT,
        validate: input => {
          const port = parseInt(input);
          return port >= 1024 && port <= 65535 ? true : 'Please enter a valid port number (1024-65535)';
        }
      });
    }

    if (!options.password && !options.skipPassword) {
      questions.push({
        type: 'password',
        name: 'password',
        message: 'Enter a strong password for wallet encryption:',
        validate: input => input.length >= MIN_PASSWORD_LENGTH ? 
          true : `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
      });
    }

    if (!options.email && !options.skipEmail) {
      questions.push({
        type: 'input',
        name: 'email',
        message: 'Enter email for notifications (optional):',
        validate: input => {
          if (!input) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) ? 
            true : 'Please enter a valid email address';
        }
      });
    }

    const answers = await inquirer.prompt(questions);
    return { ...options, ...answers };
  }

  /**
   * Generate wallet credentials
   * @private
   * @returns {Object} Wallet details
   */
  generateWallet() {
    const { privateKey, publicKey, address } = this.wallet.generateKeyPair();
    return { privateKey, publicKey, address };
  }

  /**
   * Create node configuration
   * @private
   * @param {Object} config - User configuration
   * @param {Object} walletDetails - Wallet details
   * @returns {Promise<Object>} Node configuration
   */
  async createNodeConfig(config, walletDetails) {
    return {
      nodeType: config.nodeType || 'full',
      port: config.port || DEFAULT_PORT,
      address: walletDetails.address,
      publicKey: walletDetails.publicKey,
      initialPeers: config.peers || [],
      networkId: process.env.NETWORK_ID || 'seirchain-mainnet',
      created: new Date().toISOString()
    };
  }

  /**
   * Save configurations to files
   * @private
   * @param {Object} nodeConfig - Node configuration
   * @param {Object} walletDetails - Wallet details
   */
  async saveConfigurations(nodeConfig, walletDetails) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    
    // Save wallet backup
    const walletBackupFile = path.join(
      WALLET_BACKUP_DIR, 
      `wallet-${walletDetails.address.slice(0,10)}-${timestamp}.json`
    );
    
    fs.writeFileSync(walletBackupFile, JSON.stringify({
      ...walletDetails,
      createdAt: timestamp
    }, null, 2));
    fs.chmodSync(walletBackupFile, 0o600);

    // Save node configuration
    const nodeConfigFile = path.join(CONFIG_DIR, 'node-config.json');
    fs.writeFileSync(nodeConfigFile, JSON.stringify(nodeConfig, null, 2));
  }

  /**
   * Display node information
   * @private
   * @param {Object} walletDetails - Wallet details
   * @param {Object} nodeConfig - Node configuration
   */
  displayNodeInformation(walletDetails, nodeConfig) {
    console.log(chalk.green('\n✨ Node Successfully Initialized!\n'));
    
    console.log(chalk.yellow('Node Configuration:'));
    console.log('━━━━━━━━━━━━━━━━━━━━');
    console.log(`Type: ${chalk.cyan(nodeConfig.nodeType)}`);
    console.log(`Network: ${chalk.cyan(nodeConfig.networkId)}`);
    console.log(`P2P Port: ${chalk.cyan(nodeConfig.port)}`);
    
    console.log(chalk.yellow('\nWallet Details:'));
    console.log('━━━━━━━━━━━━━━');
    console.log(`Address: ${chalk.cyan(walletDetails.address)}`);
    console.log(`Public Key: ${chalk.cyan(walletDetails.publicKey)}`);
    console.log(chalk.red('\n🔒 PRIVATE KEY (KEEP SECURE):'));
    console.log(chalk.red(walletDetails.privateKey));
  }

  /**
   * Generate QR codes for backup
   * @private
   * @param {Object} walletDetails - Wallet details
   */
  generateBackupQRCodes(walletDetails) {
    console.log(chalk.yellow('\nWallet QR Codes:'));
    console.log('━━━━━━━━━━━━━━');
    console.log('Scan these QR codes with a secure device for backup:\n');

    console.log(chalk.cyan('Address QR:'));
    qrcode.generate(walletDetails.address, { small: true });

    console.log(chalk.red('\nPrivate Key QR (KEEP SECURE):'));
    qrcode.generate(walletDetails.privateKey, { small: true });
  }

  /**
   * Send onboarding email
   * @private
   * @param {string} email - Recipient email
   * @param {Object} walletDetails - Wallet details
   * @param {Object} nodeConfig - Node configuration
   */
  async sendOnboardingEmail(email, walletDetails, nodeConfig) {
    if (!this.validateEmailConfig()) {
      console.warn(chalk.yellow('\n⚠️  Email notification skipped: Invalid email configuration'));
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10) || 587,
      secure: (parseInt(process.env.EMAIL_PORT, 10) === 465),
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      }
    });

    const mailOptions = {
      from: `"SeirChain Onboarding" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `🎉 SeirChain ${nodeConfig.nodeType} Node Successfully Initialized`,
      html: this.generateEmailTemplate(walletDetails, nodeConfig)
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(chalk.green(`\n📧 Onboarding email sent to ${email}`));
    } catch (error) {
      console.warn(chalk.yellow(`\n⚠️  Failed to send email: ${error.message}`));
    }
  }

  /**
   * Generate email template
   * @private
   * @param {Object} walletDetails - Wallet details
   * @param {Object} nodeConfig - Node configuration
   * @returns {string} HTML email template
   */
  generateEmailTemplate(walletDetails, nodeConfig) {
    return `
      <h1>Welcome to SeirChain! 🎉</h1>
      <p>Your ${nodeConfig.nodeType} node has been successfully initialized.</p>
      
      <h2>Node Configuration</h2>
      <ul>
        <li><strong>Type:</strong> ${nodeConfig.nodeType}</li>
        <li><strong>Network:</strong> ${nodeConfig.networkId}</li>
        <li><strong>P2P Port:</strong> ${nodeConfig.port}</li>
      </ul>

      <h2>Wallet Information</h2>
      <ul>
        <li><strong>Address:</strong> ${walletDetails.address}</li>
        <li><strong>Public Key:</strong> ${walletDetails.publicKey}</li>
      </ul>

      <div style="background-color: #ffebee; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <h3 style="color: #c62828;">🔒 IMPORTANT SECURITY NOTICE</h3>
        <p>Your private key is not included in this email for security reasons.</p>
        <p>Please ensure you have securely backed up your private key from the initialization process.</p>
      </div>

      <h2>Next Steps</h2>
      <ol>
        <li>Secure your private key backup</li>
        <li>Configure your firewall to allow P2P communication on port ${nodeConfig.port}</li>
        <li>Start your node using the provided configuration</li>
        <li>Monitor your node's status through the dashboard</li>
      </ol>

      <p>For additional help, consult the documentation or reach out to the community.</p>
    `;
  }

  /**
   * Display next steps
   * @private
   * @param {Object} nodeConfig - Node configuration
   */
  displayNextSteps(nodeConfig) {
    console.log(chalk.yellow('\nNext Steps:'));
    console.log('━━━━━━━━━━━');
    console.log('1. 🔒 Secure your private key backup');
    console.log(`2. 🛡️  Configure firewall for port ${nodeConfig.port}`);
    console.log('3. 🚀 Start your node:');
    console.log(chalk.cyan(`   npm run start:${nodeConfig.nodeType}`));
    console.log('4. 📊 Monitor through dashboard:');
    console.log(chalk.cyan('   npm run dashboard'));
  }

  /**
   * Validate email configuration
   * @private
   * @returns {boolean} True if email configuration is valid
   */
  validateEmailConfig() {
    return process.env.EMAIL_ENABLED === 'true' &&
           process.env.EMAIL_HOST &&
           process.env.EMAIL_USER &&
           process.env.EMAIL_PASS;
  }
}

// Script execution
if (require.main === module) {
  const args = require('minimist')(process.argv.slice(2));

  if (args.help || args.h) {
    console.log(`
SeirChain Node Onboarding Script

Initialize a new SeirChain node with wallet creation and configuration.

Usage:
  node scripts/onboard.js [options]

Options:
  --type <type>     Node type: 'validator', 'full', or 'light'
  --port <port>     P2P communication port (default: 6001)
  --email <email>   Email for notifications
  --peers <peers>   Comma-separated list of initial peer addresses
  --skip-email      Skip email notification setup
  --skip-password   Skip wallet encryption password
  --help, -h        Show this help message

Examples:
  node scripts/onboard.js --type validator --port 6001
  node scripts/onboard.js --type full --email admin@example.com
  node scripts/onboard.js --skip-email --peers "peer1.example.com,peer2.example.com"
    `);
    process.exit(0);
  }

  const options = {
    nodeType: args.type,
    port: args.port,
    email: args.email,
    skipEmail: args['skip-email'],
    skipPassword: args['skip-password'],
    peers: args.peers ? args.peers.split(',') : []
  };

  const onboarder = new NodeOnboarder();
  onboarder.onboardNode(options).catch(error => {
    console.error(chalk.red('\nFatal Error:'), error.message);
    process.exit(1);
  });
}

module.exports = NodeOnboarder;
