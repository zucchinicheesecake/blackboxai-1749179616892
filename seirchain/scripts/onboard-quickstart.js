#!/usr/bin/env node

/**
 * @fileoverview Combined Onboarding and Quickstart Script for SeirChain
 * Handles node initialization, wallet creation, environment setup, and dashboard launch
 */

const Wallet = require('../src/core/Wallet');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const qrcode = require('qrcode-terminal');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Constants
const WALLET_BACKUP_DIR = path.resolve(__dirname, '../data/onboarded-wallets');
const CONFIG_DIR = path.resolve(__dirname, '../config');
const DATA_DIR = path.resolve(__dirname, '../data');
const WALLET_DIR = path.join(DATA_DIR, 'wallets');
const DB_DIR = path.join(DATA_DIR, 'triad.db');
const ENV_FILE = path.resolve(__dirname, '../.env');
const DEFAULT_PORT = 6001;
const MIN_PASSWORD_LENGTH = 12;

class SeirChainSetup {
  constructor() {
    this.wallet = new Wallet();
    this.ensureDirectories();
  }

  ensureDirectories() {
    [WALLET_BACKUP_DIR, CONFIG_DIR, DATA_DIR, WALLET_DIR, DB_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async run() {
    console.clear();
    this.displayWelcomeBanner();

    try {
      // Gather configuration including environment variables
      const config = await this.gatherConfiguration();

      // Write .env file with config
      this.writeEnvFile(config);

      // Find or create wallet
      const selectedWallet = await this.handleWalletSelection();

      // Create node configuration
      const nodeConfig = await this.createNodeConfig(config, selectedWallet);

      // Save configurations
      await this.saveConfigurations(nodeConfig, selectedWallet);

      // Display node info and QR codes
      this.displayNodeInformation(selectedWallet, nodeConfig);
      this.generateBackupQRCodes(selectedWallet);

      // Send onboarding email if configured
      if (config.email) {
        await this.sendOnboardingEmail(config.email, selectedWallet, nodeConfig);
      }

      // Display next steps
      this.displayNextSteps(nodeConfig);

      // Start dashboard
      this.startDashboard(selectedWallet);

    } catch (error) {
      console.error(chalk.red('\n❌ Setup Error:'), error.message);
      if (process.env.DEBUG === 'true') {
        console.error(chalk.gray('\nStack trace:'), error.stack);
      }
      process.exit(1);
    }
  }

  displayWelcomeBanner() {
    console.log(chalk.cyan(`
╔════════════════════════════════════════╗
║       Welcome to SeirChain Setup       ║
║ Initialize Your Node, Wallet & Env Vars║
╚════════════════════════════════════════╝
    `));
  }

  async gatherConfiguration() {
    const questions = [
      {
        type: 'list',
        name: 'nodeType',
        message: 'Select node type:',
        choices: [
          { name: 'Validator Node (participates in consensus)', value: 'validator' },
          { name: 'Full Node (syncs and verifies blockchain)', value: 'full' },
          { name: 'Light Node (minimal verification)', value: 'light' }
        ]
      },
      {
        type: 'input',
        name: 'port',
        message: 'Enter port number for P2P communication:',
        default: DEFAULT_PORT,
        validate: input => {
          const port = parseInt(input);
          return port >= 1024 && port <= 65535 ? true : 'Please enter a valid port number (1024-65535)';
        }
      },
      {
        type: 'password',
        name: 'password',
        message: 'Enter a strong password for wallet encryption:',
        validate: input => input.length >= MIN_PASSWORD_LENGTH ? 
          true : `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
      },
      {
        type: 'input',
        name: 'email',
        message: 'Enter email for notifications (optional):',
        validate: input => {
          if (!input) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) ? 
            true : 'Please enter a valid email address';
        }
      },
      {
        type: 'input',
        name: 'miningReward',
        message: 'Enter mining reward amount (default 10):',
        default: '10',
        validate: input => {
          const val = parseFloat(input);
          return val > 0 ? true : 'Mining reward must be a positive number';
        }
      },
      {
        type: 'input',
        name: 'matrixDimensions',
        message: 'Enter matrix dimensions (default 3):',
        default: '3',
        validate: input => {
          const val = parseInt(input);
          return val > 0 ? true : 'Matrix dimensions must be a positive integer';
        }
      },
      {
        type: 'input',
        name: 'triadComplexity',
        message: 'Enter triad complexity (default 4):',
        default: '4',
        validate: input => {
          const val = parseInt(input);
          return val > 0 ? true : 'Triad complexity must be a positive integer';
        }
      },
      {
        type: 'input',
        name: 'consensusThreshold',
        message: 'Enter consensus threshold (0-1, default 0.67):',
        default: '0.67',
        validate: input => {
          const val = parseFloat(input);
          return val > 0 && val <= 1 ? true : 'Consensus threshold must be between 0 and 1';
        }
      }
    ];

    const answers = await inquirer.prompt(questions);
    return answers;
  }

  writeEnvFile(config) {
    const envContent = `MATRIX_DIMENSIONS=${config.matrixDimensions}
TRIAD_COMPLEXITY=${config.triadComplexity}
CONSENSUS_THRESHOLD=${config.consensusThreshold}
P2P_PORT=${config.port}
MINING_REWARD=${config.miningReward}
DEBUG=true
VERBOSE_LOGGING=true
EMAIL_ENABLED=${config.email ? 'true' : 'false'}
EMAIL_ADDRESS=${config.email || ''}
`;

    fs.writeFileSync(ENV_FILE, envContent);
    console.log(chalk.green(`\n✅ .env file created at ${ENV_FILE}`));
  }

  async handleWalletSelection() {
    const existingWallets = this.findExistingWallets();
    let selectedWallet;

    if (existingWallets.length > 0) {
      console.log('\n❓ Would you like to:');
      console.log('1. Use an existing wallet');
      console.log('2. Create a new wallet');

      const answer = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: 'Select an option:',
        choices: ['Use existing wallet', 'Create new wallet']
      }]);

      if (answer.choice === 'Use existing wallet') {
        const walletChoices = existingWallets.map((w, i) => ({
          name: `${w.address} (File: ${w.file})`,
          value: i
        }));

        const walletAnswer = await inquirer.prompt([{
          type: 'list',
          name: 'walletIndex',
          message: 'Select a wallet:',
          choices: walletChoices
        }]);

        selectedWallet = existingWallets[walletAnswer.walletIndex];
      } else {
        selectedWallet = this.createNewWallet();
      }
    } else {
      selectedWallet = this.createNewWallet();
    }

    return selectedWallet;
  }

  findExistingWallets() {
    const wallets = [];

    if (fs.existsSync(WALLET_DIR)) {
      fs.readdirSync(WALLET_DIR).forEach(file => {
        if (file.endsWith('.json')) {
          try {
            const walletData = JSON.parse(fs.readFileSync(path.join(WALLET_DIR, file)));
            wallets.push({
              file,
              ...walletData
            });
          } catch {
            // ignore invalid wallet files
          }
        }
      });
    }

    const rootWalletFile = path.resolve(process.cwd(), '.wallet');
    if (fs.existsSync(rootWalletFile)) {
      try {
        const privateKey = fs.readFileSync(rootWalletFile, 'utf8').trim();
        const wallet = new Wallet();
        wallet.importFromPrivateKey(privateKey);
        wallets.push({
          file: '.wallet',
          address: wallet.getAddress(),
          privateKey,
          publicKey: wallet.getPublicKey()
        });
      } catch {
        // ignore errors
      }
    }

    return wallets;
  }

  createNewWallet() {
    const { privateKey, publicKey, address } = this.wallet.generateKeyPair();

    const walletData = {
      address,
      publicKey,
      privateKey,
      createdAt: new Date().toISOString()
    };

    const filename = `wallet-${address.slice(0, 10)}-${Date.now()}.json`;
    const walletPath = path.join(WALLET_DIR, filename);
    fs.writeFileSync(walletPath, JSON.stringify(walletData, null, 2));
    fs.chmodSync(walletPath, 0o600);

    console.log(chalk.green('\n✅ New wallet created successfully:'));
    console.log(`   📁 Saved to: ${walletPath}`);
    console.log(`   🔑 Address: ${address}`);
    console.log(`   🌐 Public Key: ${publicKey}`);
    console.log(chalk.red('   🔒 Private Key (KEEP SECURE):'));
    console.log(chalk.red(privateKey));
    console.log(chalk.yellow('\n⚠️  IMPORTANT: Backup your private key securely!'));

    return walletData;
  }

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

  generateBackupQRCodes(walletDetails) {
    console.log(chalk.yellow('\nWallet QR Codes:'));
    console.log('━━━━━━━━━━━━━━');
    console.log('Scan these QR codes with a secure device for backup:\n');

    console.log(chalk.cyan('Address QR:'));
    qrcode.generate(walletDetails.address, { small: true });

    console.log(chalk.red('\nPrivate Key QR (KEEP SECURE):'));
    qrcode.generate(walletDetails.privateKey, { small: true });
  }

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

  validateEmailConfig() {
    return process.env.EMAIL_ENABLED === 'true' &&
           process.env.EMAIL_HOST &&
           process.env.EMAIL_USER &&
           process.env.EMAIL_PASS;
  }

  startDashboard(selectedWallet) {
    console.log('\n🚀 Starting dashboard...');

    try {
      // Save selected wallet as .wallet file for dashboard to use
      fs.writeFileSync(path.join(process.cwd(), '.wallet'), selectedWallet.privateKey);
      console.log('  ✓ Wallet configured for dashboard');

      console.log('\n📊 Starting dashboard with the following controls:');
      console.log('   • Press M to toggle mining');
      console.log('   • Press N to create new triad');
      console.log('   • Press R to refresh data');
      console.log('   • Press Q or Esc to quit');

      // Start the dashboard
      execSync('node src/cli/dashboard.js', { stdio: 'inherit' });
    } catch (error) {
      console.error('\n❌ Error starting dashboard:');
      console.error('🔧 How to fix:');

      if (error.message.includes('ENOENT')) {
        console.error('1. Ensure all required files are present:');
        console.error('   • Check if src/cli/dashboard.js exists');
        console.error('   • Run: npm install (to reinstall dependencies)');
        console.error('2. If files are missing, try:');
        console.error('   • git checkout main');
        console.error('   • git pull origin main');
      } else if (error.message.includes('Error: listen EADDRINUSE')) {
        console.error('1. Port 6001 is already in use. To fix:');
        console.error('   • Kill existing process: lsof -i :6001');
        console.error('   • Or change P2P_PORT in .env file');
      } else if (error.message.includes('database')) {
        console.error('1. Database error. Try:');
        console.error(`   • Remove database: rm -rf ${DB_DIR}`);
        console.error('   • Restart: npm run quickstart');
      } else {
        console.error('1. Check the logs for specific errors');
        console.error('2. Ensure Node.js version is >= 14.18.0');
        console.error('3. Try cleaning and reinstalling:');
        console.error('   rm -rf node_modules/');
        console.error('   npm cache clean --force');
        console.error('   npm install');
      }
      process.exit(1);
    }
  }
}

// Script execution
if (require.main === module) {
  const setup = new SeirChainSetup();
  setup.run();
}

module.exports = SeirChainSetup;
