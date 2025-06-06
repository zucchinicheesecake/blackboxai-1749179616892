/**
 * @fileoverview P2P Network Node for SeirChain
 * Handles peer-to-peer communication, message broadcasting, and network state management
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const ErrorHandler = require('../utils/errorHandler');
const syncLedger = require('../ledger/ledgerSync');

// Message types for P2P communication
const MESSAGE_TYPES = {
  HANDSHAKE: 'HANDSHAKE',
  DISCOVERY: 'DISCOVERY',
  PEERS: 'PEERS',
  NEW_TRIAD: 'NEW_TRIAD',
  VALIDATE_TRIAD: 'VALIDATE_TRIAD',
  TRIAD_VALIDATED: 'TRIAD_VALIDATED_CONFIRMATION',
  GET_STATUS: 'GET_STATUS',
  STATUS_UPDATE: 'STATUS_UPDATE',
  ERROR: 'ERROR',
  SYNC_LEDGER: 'SYNC_LEDGER',
  SYNC_LEDGER_CONFIRMATION: 'SYNC_LEDGER_CONFIRMATION'
};

// Constants for network configuration
const DEFAULT_MAX_PEERS = 10;
const DEFAULT_NETWORK_ID = 'seirchain-default';
const PEER_DISCOVERY_INTERVAL = 60000; // 60 seconds
const HANDSHAKE_TIMEOUT = 5000; // 5 seconds

class P2PNode extends EventEmitter {
  /**
   * Create a new P2P Node
   * @param {number} port - Port to listen on
   * @param {Object} triadMatrix - TriadMatrix instance
   * @param {Array<string>} initialPeers - Initial peer addresses to connect to
   */
  constructor(port, triadMatrix, initialPeers = [], dbConnection = null) {
    super();
    this.nodeId = uuidv4();
    this.port = port;
    this.triadMatrix = triadMatrix;
    this.peers = new Map();
    this.maxPeers = parseInt(process.env.MAX_PEERS, 10) || DEFAULT_MAX_PEERS;
    this.networkId = process.env.NETWORK_ID || DEFAULT_NETWORK_ID;
    this.lastError = null;
    this.dbConnection = dbConnection;

    this.initializeServer();
    this.setupEventHandlers();
    this.connectToInitialPeers(initialPeers);
    this.startPeerDiscovery();
  }

  /**
   * Initialize WebSocket server
   * @private
   */
  initializeServer() {
    try {
      this.server = new WebSocket.Server({ 
        port: this.port, 
        clientTracking: true,
        handleProtocols: this.handleProtocols.bind(this)
      });

      // console.log(`🅿️  P2P Node listening on ws://localhost:${this.port} (Node ID: ${this.nodeId})`);
    } catch (error) {
      this.lastError = error.message;
      ErrorHandler.handleError(error, 'P2P server initialization');
      throw new Error(`Failed to initialize P2P server: ${error.message}`);
    }
  }

  /**
   * Handle WebSocket protocols
   * @private
   * @param {Array<string>} protocols - Requested protocols
   * @param {Object} request - HTTP request
   * @returns {string|false} Selected protocol or false to reject
   */
  handleProtocols(protocols, request) {
    try {
      // Accept any protocol that includes 'seirchain'
      const validProtocol = protocols.find(p => p.includes('seirchain'));
      if (validProtocol) {
        return validProtocol;
      }

      // If no valid protocol found but protocols array is not empty,
      // accept the first protocol as fallback
      if (protocols.length > 0) {
        // console.warn('[P2P] No seirchain protocol found, using fallback:', protocols[0]);
        return protocols[0];
      }

      // If no protocols provided, use default
      return 'seirchain-default';
    } catch (error) {
      this.lastError = error.message;
      ErrorHandler.handleError(error, 'WebSocket protocol handling');
      // console.error('[P2P] Protocol handling error:', error.message);
      return false; // Reject the connection on error
    }
  }

  /**
   * Handle server errors
   * @private
   * @param {Error} error - Server error
   */
  handleServerError(error) {
    this.lastError = error.message;
    ErrorHandler.handleError(error, 'P2P server');
    // console.error(`[P2P] Server error: ${error.message}`);
    
    // Attempt to restart server if it's a recoverable error
    if (error.code === 'EADDRINUSE') {
      // console.log('[P2P] Attempting to restart server in 5 seconds...');
      setTimeout(() => {
        try {
          this.server.close(() => {
            this.initializeServer();
          });
        } catch (restartError) {
          ErrorHandler.handleError(restartError, 'P2P server restart');
          // console.error('[P2P] Failed to restart server:', restartError.message);
        }
      }, 5000);
    }
  }

  /**
   * Setup event handlers for TriadMatrix events
   * @private
   */
  setupEventHandlers() {
    this.server.on('connection', (ws, req) => this.handleNewConnection(ws, req));
    this.server.on('error', this.handleServerError.bind(this));

    if (this.triadMatrix) {
      this.triadMatrix.on('triadCreated', (triad) => {
        // this.broadcast({ type: MESSAGE_TYPES.NEW_TRIAD, payload: triad });
      });

      this.triadMatrix.on('triadValidated', (triad) => {
        // this.broadcast({ type: MESSAGE_TYPES.TRIAD_VALIDATED, payload: triad });
      });
    }
  }

  /**
   * Start periodic peer discovery
   * @private
   */
  startPeerDiscovery() {
    setInterval(() => {
      if (this.peers.size < this.maxPeers / 2) {
        this.broadcast({ 
          type: MESSAGE_TYPES.DISCOVERY, 
          payload: { 
            nodeId: this.nodeId, 
            address: this.getPublicAddress() 
          } 
        });
      }
    }, PEER_DISCOVERY_INTERVAL);
  }

  /**
   * Handle new WebSocket connection
   * @private
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} req - HTTP request
   */
  handleNewConnection(ws, req) {
    const peerIp = req.socket.remoteAddress;

      if (this.peers.size >= this.maxPeers) {
      // console.warn(`[P2P] Max peers reached. Rejecting new connection from ${peerIp}`);
      ws.terminate();
      return;
    }

    const peerId = uuidv4();
    // console.log(`[P2P] 🔗 New peer connected: ${peerIp} (assigned ID: ${peerId})`);
    
    this.addPeer(ws, peerId, 'incoming');
    this.sendHandshake(ws);

    ws.on('message', (messageBuffer) => this.handleMessage(ws, messageBuffer, peerId));
    ws.on('close', () => this.handlePeerDisconnection(peerId, peerIp));
    ws.on('error', (error) => this.handlePeerError(error, peerId, peerIp));
  }

  /**
   * Handle peer connection errors
   * @private
   * @param {Error} error - Error object
   * @param {string} peerId - Peer ID
   * @param {string} peerIp - Peer IP address
   */
  handlePeerError(error, peerId, peerIp) {
    this.lastError = error.message;
    ErrorHandler.handleError(error, `P2P peer error (ID: ${peerId}, IP: ${peerIp})`);
    // console.error(`[P2P] Error on peer ${peerId} (${peerIp}): ${error.message}`);
  }

  /**
   * Handle peer disconnection
   * @private
   * @param {string} peerId - Peer ID
   * @param {string} peerIp - Peer IP address
   */
  handlePeerDisconnection(peerId, peerIp) {
    try {
      // console.log(`[P2P] 🔌 Peer disconnected: ${peerIp} (ID: ${peerId})`);
      
      const peer = this.peers.get(peerId);
      if (!peer) {
        throw new Error(`Peer ${peerId} not found in peers map`);
      }

      // Clean up any pending operations for this peer
      if (peer.ws) {
        try {
          peer.ws.terminate();
        } catch (error) {
          ErrorHandler.handleError(error, `P2P peer termination (ID: ${peerId})`);
        }
      }

      // Remove from peers map
      this.peers.delete(peerId);
      
      // Emit disconnection event
      this.emit('peerDisconnected', { peerId, peerIp });

      // If peers count is low, trigger discovery
      if (this.peers.size < this.maxPeers / 2) {
        this.broadcast({ 
          type: MESSAGE_TYPES.DISCOVERY, 
          payload: { nodeId: this.nodeId, address: this.getPublicAddress() } 
        });
      }
    } catch (error) {
      this.lastError = error.message;
      ErrorHandler.handleError(error, `P2P peer disconnection handling (ID: ${peerId})`);
      // console.error(`[P2P] Error handling peer disconnection: ${error.message}`);
    }
  }

  /**
   * Connect to a peer
   * @param {string} peerAddress - Address of peer to connect to
   */
  connectToPeer(peerAddress) {
    if (this.peers.size >= this.maxPeers) {
      // console.log("[P2P] Max peers reached. Cannot connect to new peer:", peerAddress);
      return;
    }

    if (this.isConnectedTo(peerAddress)) {
      // console.log(`[P2P] Already connected to ${peerAddress}`);
      return;
    }

    // console.log(`[P2P] 🚀 Attempting to connect to peer: ${peerAddress}`);
    
    const ws = new WebSocket(peerAddress, { 
      handshakeTimeout: HANDSHAKE_TIMEOUT,
      headers: { 'X-Node-ID': this.nodeId }
    });

    const tempId = `outgoing-${uuidv4()}`;
    this.setupOutgoingConnection(ws, tempId, peerAddress);
  }

  /**
   * Setup handlers for outgoing connection
   * @private
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} tempId - Temporary peer ID
   * @param {string} peerAddress - Peer address
   */
  setupOutgoingConnection(ws, tempId, peerAddress) {
    ws.on('open', () => {
      const peerId = this.addPeer(ws, tempId, 'outgoing', peerAddress);
      // console.log(`[P2P] ✅ Successfully connected to peer: ${peerAddress} (as ID: ${peerId})`);
      this.sendHandshake(ws);
      this.sendMessage(ws, { type: MESSAGE_TYPES.DISCOVERY });
    });

    ws.on('message', (messageBuffer) => {
      this.handleMessage(ws, messageBuffer, this.findPeerIdByWs(ws) || tempId);
    });

    ws.on('close', (code, reason) => {
      // console.log(`[P2P] 🔌 Connection to ${peerAddress} closed. Code: ${code}, Reason: ${reason.toString()}`);
      this.removePeer(this.findPeerIdByWs(ws) || tempId);
    });

    ws.on('error', (error) => {
      this.lastError = error.message;
      ErrorHandler.handleError(error, 'P2P peer connection');
      // console.error(`[P2P] ❌ Error connecting to peer ${peerAddress}: ${error.message}`);
      this.removePeer(this.findPeerIdByWs(ws) || tempId);
    });
  }

  /**
   * Add a peer to the network
   * @private
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} peerId - Peer ID
   * @param {string} direction - Connection direction ('incoming' or 'outgoing')
   * @param {string} [url] - Peer URL (optional)
   * @returns {string} Peer ID
   */
  addPeer(ws, peerId, direction, url = null) {
    this.peers.set(peerId, { 
      ws, 
      id: peerId, 
      direction, 
      url, 
      connectedAt: Date.now() 
    });
    
    this.emit('peerConnected', { peerId, direction, url });
    return peerId;
  }

  /**
   * Remove a peer from the network
   * @private
   * @param {string} peerId - Peer ID
   */
  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      if (peer.ws.readyState === WebSocket.OPEN || 
          peer.ws.readyState === WebSocket.CONNECTING) {
        peer.ws.terminate();
      }
      this.peers.delete(peerId);
      this.emit('peerDisconnected', { peerId });
    }
  }

  /**
   * Handle incoming message
   * @private
   * @param {WebSocket} ws - WebSocket connection
   * @param {Buffer} messageBuffer - Raw message buffer
   * @param {string} peerId - Peer ID
   */
  async handleMessage(ws, messageBuffer, peerId) {
    try {
      const message = JSON.parse(messageBuffer.toString());
      const peer = this.peers.get(peerId);
      
      if (!peer) {
        ws.terminate();
        return;
      }

  switch (message.type) {
        case MESSAGE_TYPES.HANDSHAKE:
          this.handleHandshake(ws, message, peer);
          break;

        case MESSAGE_TYPES.DISCOVERY:
          this.sendMessage(ws, { 
            type: MESSAGE_TYPES.PEERS, 
            payload: this.getPeerAddresses() 
          });
          break;

        case MESSAGE_TYPES.PEERS:
          try {
            this.handlePeersList(message.payload);
          } catch (error) {
            ErrorHandler.handleError(error, 'Peers list handling');
            console.error(`[P2P] Failed to handle peers list: ${error.message}`);
          }
          break;

        case MESSAGE_TYPES.NEW_TRIAD:
          try {
            this.handleNewTriad(message, peerId);
          } catch (error) {
            ErrorHandler.handleError(error, 'New triad handling');
            console.error(`[P2P] Failed to handle new triad: ${error.message}`);
          }
          break;

        case MESSAGE_TYPES.VALIDATE_TRIAD:
          try {
            this.handleTriadValidation(message);
          } catch (error) {
            ErrorHandler.handleError(error, 'Triad validation handling');
            console.error(`[P2P] Failed to handle triad validation: ${error.message}`);
          }
          break;

        case MESSAGE_TYPES.TRIAD_VALIDATED:
          try {
            this.handleTriadValidated(message, peerId);
          } catch (error) {
            ErrorHandler.handleError(error, 'Triad validation confirmation');
            console.error(`[P2P] Failed to handle triad validation confirmation: ${error.message}`);
          }
          break;

        case MESSAGE_TYPES.GET_STATUS:
          try {
            this.handleStatusRequest(ws);
          } catch (error) {
            ErrorHandler.handleError(error, 'Status request handling');
            console.error(`[P2P] Failed to handle status request: ${error.message}`);
          }
          break;

        case MESSAGE_TYPES.ERROR:
          this.lastError = message.payload.message;
          ErrorHandler.handleError(
            new Error(message.payload.message),
            `P2P message from peer ${peerId}`
          );
          console.warn(`[P2P] Received error message from peer ${peerId}: ${message.payload.message}`);
          break;

        case MESSAGE_TYPES.SYNC_LEDGER:
          if (!this.dbConnection) {
            this.sendMessage(ws, {
              type: MESSAGE_TYPES.ERROR,
              payload: { message: "Database connection not available for ledger sync" }
            });
            return;
          }
          try {
            const result = await syncLedger(this.dbConnection, message.payload.ledgerData);
            this.sendMessage(ws, {
              type: MESSAGE_TYPES.SYNC_LEDGER_CONFIRMATION,
              payload: { status: result.status }
            });
          } catch (error) {
            this.sendMessage(ws, {
              type: MESSAGE_TYPES.ERROR,
              payload: { message: error.message }
            });
          }
          break;

        default:
          {
            const error = new Error(`Unknown message type: ${message.type}`);
            this.lastError = error.message;
            ErrorHandler.handleError(error, 'P2P message type handling');
            this.sendMessage(ws, { 
              type: MESSAGE_TYPES.ERROR, 
              payload: { message: error.message } 
            });
          }
      }
    } catch (error) {
      this.lastError = error.message;
      ErrorHandler.handleError(error, 'P2P message processing');
      console.error(`[P2P] Error processing message from ${peerId}: ${error.message}`);
      this.sendMessage(ws, { 
        type: MESSAGE_TYPES.ERROR, 
        payload: { message: 'Invalid message format' } 
      });
    }
  }

  /**
   * Send message to a peer
   * @private
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Message to send
   */
  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        this.lastError = error.message;
        ErrorHandler.handleError(error, 'P2P message sending');
        // console.error(`[P2P] Error sending message: ${error.message}`, message);
        
        // Try to handle specific message sending errors
        if (error.code === 'EPIPE' || error.code === 'ECONNRESET') {
          // console.log('[P2P] Connection lost while sending message. Removing peer...');
          const peerId = this.findPeerIdByWs(ws);
          if (peerId) {
            this.removePeer(peerId);
          }
        }
      }
    }
  }

  /**
   * Broadcast message to all peers
   * @param {Object} message - Message to broadcast
   * @param {string} [originatorPeerId] - ID of peer that originated the message
   */
  broadcast(message, originatorPeerId = null) {
    try {
      let sentCount = 0;
      let errorCount = 0;
      
      this.peers.forEach((peer, peerId) => {
        if (peerId !== originatorPeerId) {
          try {
            this.sendMessage(peer.ws, message);
            sentCount++;
          } catch (error) {
            errorCount++;
            ErrorHandler.handleError(error, 'P2P broadcast to peer');
            // console.error(`[P2P] Failed to broadcast to peer ${peerId}: ${error.message}`);
          }
        }
      });

      if (errorCount > 0) {
        // console.warn(`[P2P] Broadcast partially failed: ${sentCount} successful, ${errorCount} failed`);
      }
    } catch (error) {
      this.lastError = error.message;
      ErrorHandler.handleError(error, 'P2P broadcast');
      // console.error('[P2P] Broadcast failed:', error.message);
    }
  }

  /**
   * Get the node's public address
   * @private
   * @returns {string} Public address
   */
  getPublicAddress() {
    return process.env.P2P_ADVERTISED_ADDRESS || 
           `ws://localhost:${this.port}`;
  }

  /**
   * Close the P2P node
   * @returns {Promise<void>}
   */
  async close() {
    // console.log('[P2P] Closing P2P node...');
    
    try {
      // Notify peers about shutdown
      this.broadcast({
        type: MESSAGE_TYPES.ERROR,
        payload: { message: 'Node shutting down' }
      });

      // Close all peer connections gracefully
      const closePromises = Array.from(this.peers.values()).map(peer => {
        return new Promise((resolve) => {
          if (peer.ws.readyState === WebSocket.OPEN) {
            peer.ws.close(1000, 'Node shutting down');
            peer.ws.once('close', resolve);
            // Force close after timeout
            setTimeout(() => {
              if (peer.ws.readyState !== WebSocket.CLOSED) {
                peer.ws.terminate();
                resolve();
              }
            }, 5000);
          } else {
            resolve();
          }
        });
      });

      // Wait for all connections to close with timeout
      await Promise.race([
        Promise.all(closePromises),
        new Promise(resolve => setTimeout(resolve, 6000))
      ]);

      this.peers.clear();

      // Close the server gracefully
      if (this.server) {
        await new Promise((resolve, reject) => {
          this.server.close((err) => {
            if (err) {
              // console.error('[P2P] Error closing server:', err);
              reject(err);
            } else {
              // console.log('[P2P] Server closed successfully.');
              resolve();
            }
          });
        });
      }

      // Clear any remaining event listeners
      this.removeAllListeners();
      
      // console.log('[P2P] Node shutdown completed.');
    } catch (error) {
      this.lastError = error.message;
      ErrorHandler.handleError(error, 'P2P node shutdown');
      // console.error('[P2P] Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Get the last error that occurred
   * @returns {string|null} Last error message or null if no error
   */
  getLastError() {
    return this.lastError;
  }
}

// Start standalone P2P node if this file is run directly
if (require.main === module) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

  const port = parseInt(process.env.P2P_PORT, 10) || 6001;
  const initialPeersEnv = process.env.P2P_INITIAL_PEERS;
  const initialPeers = initialPeersEnv ? 
    initialPeersEnv.split(',').map(s => s.trim()).filter(Boolean) : 
    [];

  const p2pNode = new P2PNode(port, new EventEmitter(), initialPeers);

  process.on('SIGINT', async () => {
    console.log("Shutting down P2P node...");
    await p2pNode.close();
    process.exit(0);
  });
}

module.exports = P2PNode;
