#!/usr/bin/env node

/**
 * @fileoverview Interactive CLI Dashboard for SeirChain
 * Provides real-time visualization of blockchain state, mining activity, and wallet information
 */

const blessed = require('blessed');
const contrib = require('blessed-contrib');
const TriadMatrix = require('../core/TriadMatrix');
const Wallet = require('../core/Wallet');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Constants
const UPDATE_INTERVAL = 2000;
const MINING_INTERVAL = 3000;
const MATRIX_UPDATE_INTERVAL = 100;
const MAX_HISTORY_POINTS = 30;
const NEW_TRIAD_PROBABILITY = 0.2;
const WALLET_FILE = '.wallet';

class SeirChainDashboard {
  constructor() {
    this.initializeState();
    this.setupScreen();
    this.setupGrid();
    this.setupWidgets();
    this.setupKeys();
    this.initializeSystem();
  }

  /**
   * Initialize dashboard state
   * @private
   */
  initializeState() {
    this.dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'triad.db');
    this.matrix = null;
    this.wallet = new Wallet();
    this.consensusHistory = {};
    this._miningInterval = null;
    this.lastError = null;
  }

  /**
   * Setup blessed screen
   * @private
   */
  setupScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'SeirChain Dashboard',
      debug: true
    });
  }

  /**
   * Setup grid layout
   * @private
   */
  setupGrid() {
    this.grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen
    });
  }

  /**
   * Setup dashboard widgets
   * @private
   */
  setupWidgets() {
    this.setupMatrixVisualization();
    this.setupMatrixStatus();
    this.setupWalletInfo();
    this.setupTriadsTable();
    this.setupMiningLog();
    this.setupHelpBox();
  }

  /**
   * Setup matrix visualization widget
   * @private
   */
  setupMatrixVisualization() {
    this.matrixViz = this.grid.set(0, 0, 4, 6, contrib.line, {
      label: ' Consensus Progress ',
      showLegend: true,
      legend: { width: 20 },
      style: {
        line: 'yellow',
        text: 'green',
        baseline: 'white'
      },
      xLabelPadding: 3,
      xPadding: 5,
      numYLabels: 5,
      maxY: 100,
      minY: 0,
      wholeNumbersOnly: true
    });
  }

  /**
   * Setup matrix status widget
   * @private
   */
  setupMatrixStatus() {
    this.matrixStatus = this.grid.set(4, 0, 4, 6, blessed.box, {
      label: ' Matrix Status ',
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'white' }
      },
      content: 'Initializing...'
    });
  }

  /**
   * Setup wallet information widget
   * @private
   */
  setupWalletInfo() {
    this.walletInfo = this.grid.set(4, 6, 4, 6, blessed.box, {
      label: ' Wallet Information ',
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'white' }
      },
      content: 'Loading wallet...'
    });
  }

  /**
   * Setup triads table widget
   * @private
   */
  setupTriadsTable() {
    this.triadsTable = this.grid.set(8, 0, 4, 12, contrib.table, {
      label: ' Recent Triads ',
      keys: true,
      interactive: true,
      columnSpacing: 2,
      columnWidth: [16, 40, 12, 12, 12],
      style: {
        border: { fg: 'white' },
        header: {
          fg: 'cyan',
          bold: true
        }
      }
    });

    this.triadsTable.setData({
      headers: ['ID', 'Data', 'Validator', 'Consensus', 'Status'],
      data: []
    });
  }

  /**
   * Setup mining log widget
   * @private
   */
  setupMiningLog() {
    this.miningLog = this.grid.set(0, 6, 4, 6, contrib.log, {
      label: ' Mining Activity ',
      tags: true,
      style: {
        border: { fg: 'white' }
      }
    });
  }

  /**
   * Setup help box widget
   * @private
   */
  setupHelpBox() {
    this.helpBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: '50%',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'white'
        }
      },
      content: this.getHelpContent(),
      hidden: true
    });
  }

  /**
   * Setup keyboard shortcuts
   * @private
   */
  setupKeys() {
    // Quit on Q, Esc, or Ctrl-C
    this.screen.key(['q', 'escape', 'C-c'], () => this.shutdown());

    // Refresh data on R
    this.screen.key(['r'], () => this.refreshData());

    // Toggle mining on M
    this.screen.key(['m'], () => this.toggleMining());

    // Create new triad on N
    this.screen.key(['n'], () => this.createNewTriad());

    // Show/hide help on H
    this.screen.key(['h'], () => this.toggleHelp());

    // Focus triads table on T
    this.screen.key(['t'], () => this.triadsTable.focus());
  }

  /**
   * Get help content
   * @private
   * @returns {string} Help content
   */
  getHelpContent() {
    return (
      '{center}{bold}SeirChain Dashboard Help{/bold}{/center}\n\n' +
      '{bold}Keyboard Shortcuts:{/bold}\n' +
      '  {yellow-fg}Q{/yellow-fg} or {yellow-fg}Esc{/yellow-fg} - Quit\n' +
      '  {yellow-fg}R{/yellow-fg} - Refresh Data\n' +
      '  {yellow-fg}M{/yellow-fg} - Toggle Mining\n' +
      '  {yellow-fg}N{/yellow-fg} - Create New Triad\n' +
      '  {yellow-fg}T{/yellow-fg} - Focus Triads Table\n' +
      '  {yellow-fg}H{/yellow-fg} - Toggle Help\n\n' +
      '{bold}Navigation:{/bold}\n' +
      '  Use arrow keys to navigate the triads table\n' +
      '  Press Enter to view detailed triad information'
    );
  }

  /**
   * Toggle help display
   * @private
   */
  toggleHelp() {
    this.helpBox.hidden = !this.helpBox.hidden;
    this.screen.render();
  }

  /**
   * Draw matrix visualization
   * @private
   */
  drawMatrix() {
    if (!this.matrix?.getMatrixState()?.triads) return;

    const triads = this.matrix.getMatrixState().triads;
    
    // Update consensus history
    triads.forEach(triad => {
      if (!this.consensusHistory[triad.id]) {
        this.consensusHistory[triad.id] = [];
      }
      
      this.consensusHistory[triad.id].push(triad.consensus * 100);
      
      if (this.consensusHistory[triad.id].length > MAX_HISTORY_POINTS) {
        this.consensusHistory[triad.id].shift();
      }
    });
    
    // Clean up history for removed triads
    Object.keys(this.consensusHistory).forEach(id => {
      if (!triads.find(t => t.id === id)) {
        delete this.consensusHistory[id];
      }
    });
    
    // Prepare line chart data
    const data = triads.map(triad => ({
      title: triad.id.substring(0, 6),
      x: [...Array(this.consensusHistory[triad.id].length).keys()],
      y: this.consensusHistory[triad.id],
      style: {
        line: triad.validated ? 'green' : 'yellow'
      }
    }));

    this.matrixViz.setData(data);
    this.screen.render();
  }

  /**
   * Initialize the system
   * @private
   */
  async initializeSystem() {
    try {
      await this.initializeWallet();
      await this.initializeMatrix();
      
      this.miningLog.log('{green-fg}✓{/green-fg} System initialized successfully');
      
      this.startPeriodicUpdates();
    } catch (error) {
      this.lastError = error.message;
      this.miningLog.log(`{red-fg}✗{/red-fg} Initialization error: ${error.message}`);
    }
  }

  /**
   * Initialize wallet
   * @private
   */
  async initializeWallet() {
    const walletPath = path.join(process.cwd(), 'data', WALLET_FILE);
    
    try {
      if (fs.existsSync(walletPath)) {
        const privateKey = fs.readFileSync(walletPath, 'utf-8').trim();
        this.wallet.importFromPrivateKey(privateKey);
      } else {
        const { privateKey } = this.wallet.generateKeyPair();
        fs.mkdirSync(path.dirname(walletPath), { recursive: true });
        fs.writeFileSync(walletPath, privateKey);
      }
    } catch (error) {
      throw new Error(`Failed to initialize wallet: ${error.message}`);
    }
  }

  /**
   * Initialize matrix
   * @private
   */
  async initializeMatrix() {
    this.matrix = new TriadMatrix(this.dbPath, {
      dimensions: parseInt(process.env.MATRIX_DIMENSIONS, 10) || 3,
      complexity: parseInt(process.env.TRIAD_COMPLEXITY, 10) || 4,
      consensusThreshold: parseFloat(process.env.CONSENSUS_THRESHOLD) || 0.67,
    });

    await this.matrix.init();
  }

  /**
   * Start periodic updates
   * @private
   */
  startPeriodicUpdates() {
    this.refreshData();
    
    // Store intervals for cleanup
    this._intervals = {
      refreshData: setInterval(() => this.refreshData(), UPDATE_INTERVAL),
      drawMatrix: setInterval(() => this.drawMatrix(), MATRIX_UPDATE_INTERVAL)
    };
  }

  /**
   * Refresh dashboard data
   * @private
   */
  async refreshData() {
    if (!this.matrix?.isInitialized) return;

    try {
      await this.updateMatrixStatus();
      await this.updateWalletInfo();
      await this.updateTriadsTable();
      this.screen.render();
    } catch (error) {
      this.lastError = error.message;
      this.miningLog.log(`{red-fg}✗{/red-fg} Refresh error: ${error.message}`);
    }
  }

  /**
   * Update matrix status display
   * @private
   */
  updateMatrixStatus() {
    const state = this.matrix.getMatrixState();
    this.matrixStatus.setContent(
      `{bold}Dimensions:{/bold} ${state.dimensions}x${state.dimensions}x${state.dimensions}\n` +
      `{bold}Complexity:{/bold} ${state.complexity}\n` +
      `{bold}Consensus Threshold:{/bold} ${(state.consensusThreshold * 100).toFixed(2)}%\n` +
      `{bold}Total Triads:{/bold} ${state.triadsCount}\n` +
      `{bold}Validated Triads:{/bold} ${state.triads.filter(t => t.validated).length}\n` +
      `{bold}Validators:{/bold} ${state.validators.length}\n` +
      `{bold}Mining Status:{/bold} ${this._miningInterval ? '{green-fg}Active{/green-fg}' : '{yellow-fg}Inactive{/yellow-fg}'}`
    );
  }

  /**
   * Update wallet information display
   * @private
   */
  updateWalletInfo() {
    const state = this.matrix.getMatrixState();
    this.walletInfo.setContent(
      `{bold}Address:{/bold} ${this.wallet.getAddress()}\n` +
      `{bold}Public Key:{/bold} ${this.wallet.getPublicKey()}\n` +
      `{bold}Is Validator:{/bold} ${state.validators.includes(this.wallet.getAddress()) ? 
        '{green-fg}Yes{/green-fg}' : '{yellow-fg}No{/yellow-fg}'}\n` +
      `{bold}Last Error:{/bold} ${this.lastError || 'None'}`
    );
  }

  /**
   * Update triads table
   * @private
   */
  updateTriadsTable() {
    const state = this.matrix.getMatrixState();
    const tableData = state.triads.map(triad => [
      triad.id.substring(0, 8),
      JSON.stringify(triad.data).substring(0, 35),
      triad.validator.substring(0, 8),
      (triad.consensus * 100).toFixed(2) + '%',
      triad.validated ? '{green-fg}Validated{/green-fg}' : '{yellow-fg}Pending{/yellow-fg}'
    ]);

    this.triadsTable.setData({
      headers: ['ID', 'Data', 'Validator', 'Consensus', 'Status'],
      data: tableData
    });
  }

  /**
   * Toggle mining state
   * @private
   */
  toggleMining() {
    if (this._miningInterval) {
      this.stopMining();
      this.miningLog.log('{yellow-fg}⚠{/yellow-fg} Mining stopped');
    } else {
      this.startMining();
      this.miningLog.log('{green-fg}✓{/green-fg} Mining started');
    }
    this.refreshData();
  }

  /**
   * Start mining process
   * @private
   */
  startMining() {
    if (this._miningInterval) return;

    this._miningInterval = setInterval(async () => {
      if (!this.matrix?.isInitialized) return;

      try {
        await this.performMiningCycle();
      } catch (error) {
        this.lastError = error.message;
        this.miningLog.log(`{red-fg}✗{/red-fg} Mining error: ${error.message}`);
      }
    }, MINING_INTERVAL);
  }

  /**
   * Perform one mining cycle
   * @private
   */
  async performMiningCycle() {
    const walletAddress = this.wallet.getAddress();
    
    if (!this.matrix.validators.has(walletAddress)) {
      this.matrix.addValidator(walletAddress);
      this.miningLog.log(`{green-fg}✓{/green-fg} Registered as validator`);
    }

    const state = this.matrix.getMatrixState();
    const unvalidatedTriads = state.triads.filter(t => !t.validated && t.validator !== walletAddress);

    if (unvalidatedTriads.length > 0) {
      await this.validateRandomTriad(unvalidatedTriads);
    }

    // Occasionally create new triads
    if (Math.random() < NEW_TRIAD_PROBABILITY) {
      await this.createNewTriad();
    }

    this.refreshData();
  }

  /**
   * Validate a random triad
   * @private
   * @param {Array} unvalidatedTriads - Array of unvalidated triads
   */
  async validateRandomTriad(unvalidatedTriads) {
    const randomTriad = unvalidatedTriads[Math.floor(Math.random() * unvalidatedTriads.length)];
    try {
      this.miningLog.log(`{cyan-fg}⚡{/cyan-fg} Validating triad ${randomTriad.id}`);
      const updatedTriad = await this.matrix.validateTriad(randomTriad.id, this.wallet.getAddress());
      
      if (updatedTriad.validated) {
        this.miningLog.log(`{green-fg}✓{/green-fg} Validated triad ${randomTriad.id} (${(updatedTriad.consensus * 100).toFixed(2)}%)`);
      } else {
        this.miningLog.log(`{yellow-fg}⚠{/yellow-fg} Consensus: ${(updatedTriad.consensus * 100).toFixed(2)}%`);
      }
    } catch (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  /**
   * Stop mining process
   * @private
   */
  stopMining() {
    if (this._miningInterval) {
      clearInterval(this._miningInterval);
      this._miningInterval = null;
    }
  }

  /**
   * Create a new triad
   * @private
   */
  async createNewTriad() {
    if (!this.matrix?.isInitialized) return;

    try {
      const data = { 
        message: `Triad created at ${new Date().toISOString()}`,
        creator: this.wallet.getAddress()
      };
      const triad = await this.matrix.createTriad(data, this.wallet.getAddress());
      this.miningLog.log(`{green-fg}✓{/green-fg} Created new triad: ${triad.id}`);
      this.refreshData();
    } catch (error) {
      this.lastError = error.message;
      this.miningLog.log(`{red-fg}✗{/red-fg} Error creating triad: ${error.message}`);
    }
  }

  /**
   * Gracefully shutdown the dashboard
   * @private
   */
  async shutdown() {
    const SHUTDOWN_TIMEOUT = 5000; // 5 seconds

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Shutdown timed out')), SHUTDOWN_TIMEOUT);
    });

    try {
      // Stop all periodic updates
      this.stopPeriodicUpdates();

      // Stop mining if active
      this.stopMining();

      // Show shutdown message
      this.miningLog.log('{yellow-fg}⚠{/yellow-fg} Shutting down dashboard...');
      this.screen.render();

      // Cleanup resources with timeout
      await Promise.race([
        this.cleanupResources(),
        timeoutPromise
      ]);

      this.miningLog.log('{green-fg}✓{/green-fg} Shutdown completed successfully');
      this.screen.render();

      // Small delay to show final message
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Exit gracefully
      process.exit(0);
    } catch (error) {
      this.miningLog.log(`{red-fg}✗{/red-fg} Error during shutdown: ${error.message}`);
      this.screen.render();
      
      // Force exit after brief delay
      setTimeout(() => process.exit(1), 1000);
    }
  }

  /**
   * Stop all periodic updates
   * @private
   */
  stopPeriodicUpdates() {
    // Clear all intervals
    for (const interval of Object.values(this._intervals || {})) {
      clearInterval(interval);
    }
    this._intervals = {};
  }

  /**
   * Cleanup system resources
   * @private
   */
  async cleanupResources() {
    if (this.matrix) {
      this.miningLog.log('Closing database connection...');
      this.screen.render();
      await this.matrix.closeDB();
    }

    // Clear screen state
    this.screen.destroy();
  }

  /**
   * Start the dashboard
   */
  start() {
    this.screen.render();
  }
}

// Start the dashboard if this file is run directly
if (require.main === module) {
  const dashboard = new SeirChainDashboard();
  dashboard.start();
}

module.exports = SeirChainDashboard;
