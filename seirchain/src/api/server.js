/**
 * @fileoverview API Server for SeirChain
 * Provides RESTful endpoints for interacting with the TriadMatrix blockchain
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const TriadMatrix = require('../core/TriadMatrix');
const Wallet = require('../core/Wallet');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Constants
const DEFAULT_PORT = 5000;
const RATE_LIMIT_POINTS = {
  production: 50,
  development: 100
};
const RATE_LIMIT_DURATION = 15 * 60; // 15 minutes in seconds

class APIServer {
  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT, 10) || DEFAULT_PORT;
    this.setupMiddleware();
    this.setupMatrix();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configure middleware
   * @private
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Body parsing middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    const points = process.env.RATE_LIMIT_MAX || 
      (process.env.NODE_ENV === 'production' ? 
        RATE_LIMIT_POINTS.production : 
        RATE_LIMIT_POINTS.development);

    const duration = parseInt(process.env.RATE_LIMIT_WINDOW, 10) / 1000 || RATE_LIMIT_DURATION;

    const rateLimiter = new RateLimiterMemory({
      points,
      duration,
    });

    this.app.use((req, res, next) => {
      rateLimiter.consume(req.ip)
        .then(() => next())
        .catch(() => res.status(429).json({
          error: 'Too Many Requests',
          retryAfter: Math.ceil(duration / 60) + ' minutes'
        }));
    });
  }

  /**
   * Initialize TriadMatrix
   * @private
   */
  setupMatrix() {
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'triad.db');
    this.matrix = new TriadMatrix(dbPath, {
      dimensions: parseInt(process.env.MATRIX_DIMENSIONS, 10) || 3,
      complexity: parseInt(process.env.TRIAD_COMPLEXITY, 10) || 4,
      consensusThreshold: parseFloat(process.env.CONSENSUS_THRESHOLD) || 0.67,
    });

    this.matrix.on('initialized', (state) => {
      // console.log(`✅ TriadMatrix API ready. DB: ${dbPath}`);
    });

    this.matrix.on('error', (err) => {
      // console.error('❌ TriadMatrix API initialization error:', err.message);
    });
  }

  /**
   * Configure API routes
   * @private
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'SeirChain TriadMatrix API',
        status: this.matrix.isInitialized ? 'operational' : 'initializing',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // Matrix status endpoint
    this.app.get('/status', this.validateMatrixInitialization.bind(this), (req, res) => {
      res.json(this.matrix.getMatrixState());
    });

    // Get triad by ID
    this.app.get('/triads/:id', this.validateMatrixInitialization.bind(this), async (req, res, next) => {
      try {
        const triad = await this.matrix.getTriadById(req.params.id);
        if (!triad) {
          return res.status(404).json({ error: 'Triad not found' });
        }
        res.json(triad);
      } catch (error) {
        next(error);
      }
    });

    // Create new triad
    this.app.post('/triads', this.validateMatrixInitialization.bind(this), async (req, res, next) => {
      try {
        const { data, validatorId } = req.body;

        if (!data || !validatorId) {
          return res.status(400).json({ 
            error: 'Missing required fields',
            required: ['data', 'validatorId']
          });
        }

        const newTriad = await this.matrix.createTriad(data, validatorId);
        res.status(201).json(newTriad);
      } catch (error) {
        next(error);
      }
    });
  }

  /**
   * Configure error handling middleware
   * @private
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ 
        error: 'Not Found',
        path: req.path
      });
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      // console.error('API Error:', {
      //   path: req.path,
      //   method: req.method,
      //   error: err.message,
      //   stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      // });

      res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });
  }

  /**
   * Middleware to validate matrix initialization
   * @private
   */
  validateMatrixInitialization(req, res, next) {
    if (!this.matrix.isInitialized) {
      return res.status(503).json({ 
        error: 'Service Unavailable',
        message: 'TriadMatrix is not yet initialized'
      });
    }
    next();
  }

  /**
   * Start the server
   * @returns {Promise<void>}
   */
  async start() {
    try {
      await this.matrix.init();
      this.server = this.app.listen(this.port, () => {
        // console.log(`⚡️ SeirChain API server listening on port ${this.port}`);
        this.logEnvironmentInfo();
      });

      this.setupGracefulShutdown();
    } catch (error) {
      // console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Log environment information
   * @private
   */
  logEnvironmentInfo() {
    if (process.env.NODE_ENV === 'production') {
      // console.warn('🔒 API running in PRODUCTION mode');
      if (process.env.SSL_ENABLED === 'true') {
        // console.log('   HTTPS enabled');
      } else {
        // console.warn('   WARNING: SSL_ENABLED is false. HTTPS is highly recommended for production.');
      }
    } else {
      // console.log('   Running in DEVELOPMENT mode');
    }
  }

  /**
   * Configure graceful shutdown
   * @private
   */
  setupGracefulShutdown() {
    const SHUTDOWN_TIMEOUT = 10000; // 10 seconds

    const shutdown = async (signal) => {
      // console.log(`\n${signal} signal received: initiating graceful shutdown...`);
      
      const shutdownTimer = setTimeout(() => {
        // console.error('Forced shutdown due to timeout');
        process.exit(1);
      }, SHUTDOWN_TIMEOUT);

      try {
        // Stop accepting new requests
        if (this.server) {
          // console.log('Closing HTTP server...');
          await new Promise((resolve, reject) => {
            this.server.close((err) => {
              if (err) {
                // console.error('Error closing HTTP server:', err);
                reject(err);
              } else {
                // console.log('HTTP server closed successfully');
                resolve();
              }
            });
          });
        }

        // Close database connections
        if (this.matrix) {
          // console.log('Closing TriadMatrix database...');
          await this.matrix.closeDB();
          // console.log('Database connection closed successfully');
        }

        // Clear the timeout since shutdown was successful
        clearTimeout(shutdownTimer);
        // console.log('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        // console.error('Error during shutdown:', error);
        clearTimeout(shutdownTimer);
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      shutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Promise Rejection:', reason);
      shutdown('UNHANDLED_REJECTION');
    });
  }
}

// Create and start server if this file is run directly
if (require.main === module) {
  const server = new APIServer();
  server.start();
}

module.exports = APIServer;
