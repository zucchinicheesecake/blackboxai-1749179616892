const fs = require('fs');
const path = require('path');

class ErrorHandler {
    static handleError(error, context = '') {
        console.error(`\n❌ Error${context ? ` in ${context}` : ''}:`);
        console.error('🔧 How to fix:');

        // Database errors
        if (error.message.includes('database') || error.code === 'LEVEL_LOCKED') {
            console.error('1. Database access error. Try these steps:');
            console.error('   • Stop any running instances of the application');
            console.error('   • Remove the database: rm -rf data/triad.db/');
            console.error('   • Restart the application');
            console.error('2. If error persists:');
            console.error('   • Check disk permissions: ls -la data/');
            console.error('   • Ensure sufficient disk space: df -h');
            return;
        }

        // Network/Port errors
        if (error.code === 'EADDRINUSE') {
            console.error('1. Port already in use. To fix:');
            console.error('   • Find the process: lsof -i :6001');
            console.error('   • Kill the process: kill -9 <PID>');
            console.error('   • Or change P2P_PORT in .env file');
            return;
        }

        // File system errors
        if (error.code === 'EACCES') {
            console.error('1. Permission denied. Fix with:');
            console.error(`   sudo chown -R ${process.getuid()}:${process.getgid()} ${process.cwd()}`);
            console.error('2. Or run with proper permissions:');
            console.error('   sudo chmod -R u+w .');
            return;
        }

        if (error.code === 'ENOENT') {
            console.error('1. File or directory not found. Check:');
            console.error('   • Ensure all required files are present');
            console.error('   • Run: npm install (to reinstall dependencies)');
            console.error('2. If files are missing:');
            console.error('   • git checkout main');
            console.error('   • git pull origin main');
            return;
        }

        // Disk space errors
        if (error.code === 'ENOSPC') {
            console.error('1. No space left on device:');
            console.error('   • Check available space: df -h');
            console.error('   • Find large files: du -sh * | sort -hr');
            console.error('   • Clear npm cache: npm cache clean --force');
            console.error('   • Remove node_modules: rm -rf node_modules/');
            console.error('2. After freeing space:');
            console.error('   • npm install');
            return;
        }

        // Wallet errors
        if (error.message.includes('wallet') || error.message.includes('private key')) {
            console.error('1. Wallet error. Try:');
            console.error('   • Check if .wallet file exists');
            console.error('   • Ensure wallet file permissions: chmod 600 .wallet');
            console.error('   • Create new wallet: npm run cli -- --create-wallet');
            console.error('2. If importing wallet:');
            console.error('   • Verify private key format (64 hex characters)');
            console.error('   • Try creating new wallet instead');
            return;
        }

        // Network P2P errors
        if (error.message.includes('WebSocket') || error.message.includes('connection')) {
            console.error('1. Network connection error:');
            console.error('   • Check if port 6001 is open: nc -zv localhost 6001');
            console.error('   • Verify firewall settings');
            console.error('   • Check P2P_PORT in .env file');
            console.error('2. If using Docker:');
            console.error('   • Ensure ports are properly mapped');
            console.error('   • Check container networking');
            return;
        }

        // Validation errors
        if (error.message.includes('validation') || error.message.includes('consensus')) {
            console.error('1. Validation error:');
            console.error('   • Check CONSENSUS_THRESHOLD in .env');
            console.error('   • Verify matrix dimensions are correct');
            console.error('   • Ensure sufficient validators are running');
            console.error('2. Try:');
            console.error('   • Restart validation process');
            console.error('   • Clear existing validation data');
            return;
        }

        // Environment errors
        if (error.message.includes('.env') || error.message.includes('environment')) {
            console.error('1. Environment configuration error:');
            console.error('   • Ensure .env file exists');
            console.error('   • Copy .env.example to .env');
            console.error('   • Check all required variables are set');
            return;
        }

        // Node.js version errors
        if (error.message.includes('SyntaxError') || error.message.includes('ES')) {
            console.error('1. JavaScript compatibility error:');
            console.error(`   • Current Node.js version: ${process.version}`);
            console.error('   • Required: >= 14.18.0');
            console.error('2. Update Node.js:');
            console.error('   • nvm install 14.18.0');
            console.error('   • nvm use 14.18.0');
            return;
        }

        // Memory errors
        if (error.message.includes('heap') || error.message.includes('memory')) {
            console.error('1. Memory limit reached:');
            console.error('   • Increase Node.js memory: NODE_OPTIONS="--max-old-space-size=4096"');
            console.error('   • Check for memory leaks');
            console.error('   • Monitor memory usage: node --trace-gc');
            return;
        }

        // Generic fallback
        console.error('1. General troubleshooting steps:');
        console.error('   • Check logs for details');
        console.error('   • Verify all dependencies are installed');
        console.error('   • Ensure correct Node.js version (>=14.18.0)');
        console.error('2. Clean and rebuild:');
        console.error('   • rm -rf node_modules/');
        console.error('   • npm cache clean --force');
        console.error('   • npm install');
        console.error('3. If problem persists:');
        console.error('   • Check GitHub issues');
        console.error('   • Report bug with error details');
    }
}

module.exports = ErrorHandler;
