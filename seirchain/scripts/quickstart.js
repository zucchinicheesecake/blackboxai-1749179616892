#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Wallet = require('../src/core/Wallet');

// Configuration
const DATA_DIR = path.join(process.cwd(), 'data');
const WALLET_DIR = path.join(DATA_DIR, 'wallets');
const DB_DIR = path.join(DATA_DIR, 'triad.db');
const ENV_FILE = path.join(process.cwd(), '.env');

function ensureDirectories() {
    console.log('🔧 Setting up directories...');
    [DATA_DIR, WALLET_DIR, DB_DIR].forEach(dir => {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`  ✓ Created ${dir}`);
            }
        } catch (error) {
            console.error(`\n❌ Error creating directory ${dir}:`);
            console.error('🔧 How to fix:');
            if (error.code === 'EACCES') {
                console.error(`1. Run the following command to fix permissions:`);
                console.error(`   sudo chown -R ${process.getuid()}:${process.getgid()} ${process.cwd()}`);
                console.error(`2. Then run 'npm run quickstart' again`);
            } else if (error.code === 'ENOSPC') {
                console.error('1. Free up disk space by removing unnecessary files');
                console.error('2. Run "df -h" to check available space');
                console.error('3. Run "du -sh *" in your home directory to find large files');
                console.error('4. After freeing space, run "npm run quickstart" again');
            } else {
                console.error(`1. Ensure you have write permissions to ${process.cwd()}`);
                console.error('2. Try running: chmod -R u+w .');
                console.error(`3. If using Docker, ensure volume mounts are configured correctly`);
            }
            process.exit(1);
        }
    });
}

function setupEnvironment() {
    console.log('🔧 Setting up environment...');
    try {
        if (!fs.existsSync(ENV_FILE)) {
            const envContent = `MATRIX_DIMENSIONS=3
TRIAD_COMPLEXITY=4
CONSENSUS_THRESHOLD=0.67
P2P_PORT=6001
DB_PATH=${DB_DIR}
TOKENOMICS_DB_PATH=${path.join(DATA_DIR, 'tokenomics.db')}
DEBUG=true
VERBOSE_LOGGING=true`;
            fs.writeFileSync(ENV_FILE, envContent);
            console.log('  ✓ Created .env file');
        }
    } catch (error) {
        console.error('\n❌ Error setting up environment:');
        console.error('🔧 How to fix:');
        if (error.code === 'EACCES') {
            console.error('1. Fix file permissions with:');
            console.error(`   sudo chown ${process.getuid()}:${process.getgid()} ${ENV_FILE}`);
            console.error('2. Or manually create .env file with:');
            console.error('   echo "MATRIX_DIMENSIONS=3\\nTRIAD_COMPLEXITY=4..." > .env');
        } else {
            console.error('1. Manually create a .env file in the project root');
            console.error('2. Copy the following content into it:');
            console.error(`MATRIX_DIMENSIONS=3
TRIAD_COMPLEXITY=4
CONSENSUS_THRESHOLD=0.67
P2P_PORT=6001
DB_PATH=${DB_DIR}
TOKENOMICS_DB_PATH=${path.join(DATA_DIR, 'tokenomics.db')}
DEBUG=true
VERBOSE_LOGGING=true`);
        }
        process.exit(1);
    }
}

function findExistingWallets() {
    console.log('\n🔍 Searching for existing wallets...');
    const wallets = [];
    
    // Search in data/wallets directory
    if (fs.existsSync(WALLET_DIR)) {
        fs.readdirSync(WALLET_DIR).forEach(file => {
            if (file.endsWith('.json')) {
                try {
                    const walletData = JSON.parse(fs.readFileSync(path.join(WALLET_DIR, file)));
                    wallets.push({
                        file,
                        ...walletData
                    });
                } catch (error) {
                    console.warn(`  ⚠️  Could not read wallet file: ${file}`);
                }
            }
        });
    }

    // Search for .wallet files in project root
    const rootWalletFile = path.join(process.cwd(), '.wallet');
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
        } catch (error) {
            console.warn('  ⚠️  Could not read .wallet file in root directory');
        }
    }

    if (wallets.length > 0) {
        console.log('\n📝 Found existing wallets:');
        wallets.forEach((wallet, index) => {
            console.log(`\n${index + 1}. Wallet Details:`);
            console.log(`   📁 File: ${wallet.file}`);
            console.log(`   🔑 Address: ${wallet.address}`);
            console.log(`   🌐 Public Key: ${wallet.publicKey}`);
        });
    } else {
        console.log('  ℹ️  No existing wallets found');
    }

    return wallets;
}

function createNewWallet() {
    console.log('\n🔑 Creating new wallet...');
    const wallet = new Wallet();
    const { privateKey, publicKey, address } = wallet.generateKeyPair();
    
    const walletData = {
        address,
        publicKey,
        privateKey,
        createdAt: new Date().toISOString()
    };

    // Save in data/wallets directory
    const filename = `wallet-${address.slice(0, 10)}-${Date.now()}.json`;
    const walletPath = path.join(WALLET_DIR, filename);
    fs.writeFileSync(walletPath, JSON.stringify(walletData, null, 2));
    fs.chmodSync(walletPath, 0o600);

    console.log('\n✅ New wallet created successfully:');
    console.log(`   📁 Saved to: ${walletPath}`);
    console.log(`   🔑 Address: ${address}`);
    console.log(`   🌐 Public Key: ${publicKey}`);
    console.log(`   🔒 Private Key: ${privateKey}`);
    console.log('\n⚠️  IMPORTANT: Backup your private key securely!');

    return walletData;
}

function startDashboard(selectedWallet) {
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

async function main() {
    try {
        console.log('\n🌟 SeirChain QuickStart\n');

        // Setup basic requirements
        ensureDirectories();
        setupEnvironment();

        // Find or create wallet
        const existingWallets = findExistingWallets();
        let selectedWallet;

        if (existingWallets.length > 0) {
        console.log('\n❓ Would you like to:');
        console.log('1. Use an existing wallet');
        console.log('2. Create a new wallet');
        
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise(resolve => {
            readline.question('Enter your choice (1 or 2): ', resolve);
        });

        if (answer === '1') {
            const walletIndex = await new Promise(resolve => {
                readline.question(`Enter wallet number (1-${existingWallets.length}): `, resolve);
            });
            selectedWallet = existingWallets[parseInt(walletIndex) - 1];
        } else {
            selectedWallet = createNewWallet();
        }
        readline.close();
    } else {
        selectedWallet = createNewWallet();
    }

        // Start the dashboard with selected wallet
        startDashboard(selectedWallet);
    } catch (error) {
        console.error('\n❌ Unexpected error:');
        console.error('🔧 How to fix:');
        console.error('1. Check system requirements:');
        console.error('   • Node.js >= 14.18.0 (current: ' + process.version + ')');
        console.error('   • npm >= 6.0.0 (run: npm -v)');
        console.error('2. Check file permissions:');
        console.error('   • Run: ls -la');
        console.error('   • Ensure you own the files: chown -R $(whoami) .');
        console.error('3. Check disk space:');
        console.error('   • Run: df -h');
        console.error('4. If all else fails:');
        console.error('   • Clear everything and start fresh:');
        console.error('   rm -rf node_modules/ data/ .env');
        console.error('   npm cache clean --force');
        console.error('   npm install');
        console.error('   npm run quickstart');
        process.exit(1);
    }
}

// Run the script
main().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
