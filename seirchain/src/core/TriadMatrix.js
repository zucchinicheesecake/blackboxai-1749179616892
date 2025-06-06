/**
 * @fileoverview TriadMatrix implementation for the SeirChain blockchain
 * Manages the creation, validation, and consensus of triads in a 3D matrix structure
 */

const { Level } = require('level');
const { EventEmitter } = require('events');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createChildLogger } = require('../utils/logger');
const ErrorHandler = require('../utils/errorHandler');

// Constants for validation and configuration
const DEFAULT_DIMENSIONS = 3;
const DEFAULT_COMPLEXITY = 4;
const DEFAULT_CONSENSUS_THRESHOLD = 0.67;

class TriadMatrix extends EventEmitter {
  /**
   * Create a new TriadMatrix instance
   * @param {string} dbPath - Path to the LevelDB database
   * @param {Object} options - Configuration options
   */
  constructor(dbPath, options = {}) {
    super();
    this.logger = createChildLogger('TriadMatrix');
    this.dimensions = this.validateDimensions(options.dimensions);
    this.complexity = this.validateComplexity(options.complexity);
    this.consensusThreshold = this.validateConsensusThreshold(options.consensusThreshold);
    this.matrix = [];
    this.triads = new Map();
    this.validators = new Set();
    this.isInitialized = false;
    this.dbPath = dbPath;
    this.lastError = null;

    this.ensureDbDirectory();
    
    // Initialize database
    this.db = new Level(this.dbPath, {
      valueEncoding: 'json',
      createIfMissing: true,
      errorIfExists: false
    });

    // Initialize the matrix
    this.init().catch(err => {
      this.lastError = err.message;
      this.logger.error('Failed to initialize matrix', { error: err.message });
      ErrorHandler.handleError(err, 'Matrix initialization');
      this.emit('error', err);
    });
  }

  /**
   * Ensure the database directory exists
   * @private
   */
  ensureDbDirectory() {
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  /**
   * Initialize the TriadMatrix
   * @returns {Promise<void>}
   */
  async init() {
    if (this.isInitialized) {
      this.logger.debug('Matrix already initialized, skipping initialization');
      return;
    }
    
    try {
    // this.logger.info('Initializing TriadMatrix...');
    await this.loadMatrixState();
    this.isInitialized = true;
    const state = this.getMatrixState();
    // this.logger.info('Matrix initialized successfully', {
    //   triadsCount: state.triadsCount,
    //   validatorsCount: state.validators.length
    // });
    this.emit('initialized', state);
  } catch (error) {
    this.lastError = error.message;
    // this.logger.error('Failed to initialize matrix', {
    //   error: error.message,
    //   stack: error.stack
    // });
    this.emit('error', error);
    throw error;
  }
  }

  /**
   * Create a new triad in the matrix
   * @param {Object|string} data - Triad data
   * @param {string} validator - Validator ID
   * @returns {Promise<Object>} Created triad
   */
  async createTriad(data, validator) {
    try {
      this.validateInitialization();
      this.validateTriadData(data);
      this.validateValidator(validator);

      // this.logger.debug('Creating new triad', { validator });

      const triad = {
        id: this.generateTriadId(),
        data,
        validator,
        timestamp: Date.now(),
        position: this.calculateOptimalPosition(),
        connections: [],
        validated: false,
        consensus: 0,
        validationAttempts: 0
      };

      // Use batch operations for atomic updates
      const batch = [
        { type: 'put', key: `triad:${triad.id}`, value: triad }
      ];

      this.matrix.push(triad);
      this.triads.set(triad.id, triad);
      
      await this.db.batch(batch);
      await this.saveMatrixState();

      // this.logger.info('Triad created successfully', {
      //   triadId: triad.id,
      //   validator,
      //   position: triad.position
      // });

      this.emit('triadCreated', triad);
      return triad;
    } catch (error) {
      this.lastError = error.message;
      // this.logger.error('Failed to create triad', {
      //   error: error.message,
      //   validator,
      //   stack: error.stack
      // });
      ErrorHandler.handleError(error, 'Triad creation');
      throw new Error(`Failed to create triad: ${error.message}`);
    }
  }

  /**
   * Validate a triad
   * @param {string} triadId - ID of the triad to validate
   * @param {string} validatorId - ID of the validator
   * @returns {Promise<Object>} Updated triad
   */
  async validateTriad(triadId, validatorId) {
    try {
      this.validateInitialization();
      
      // this.logger.debug('Starting triad validation', {
      //   triadId,
      //   validatorId
      // });

      const triad = await this.getTriadById(triadId);
      this.validateValidator(validatorId);

      if (triad.validated) {
        // this.logger.debug('Triad already validated', { triadId });
        return triad;
      }

      const previousConsensus = triad.consensus;
      const consensusScore = await this.calculateConsensus(triad, validatorId);
      triad.consensus = consensusScore;
      triad.validationAttempts += 1;

      const batch = [];
      if (consensusScore >= this.consensusThreshold) {
        triad.validated = true;
        // this.logger.info('Triad reached consensus threshold', {
        //   triadId,
        //   consensusScore,
        //   threshold: this.consensusThreshold,
        //   attempts: triad.validationAttempts
        // });
      } else {
        // this.logger.debug('Consensus threshold not yet reached', {
        //   triadId,
        //   currentConsensus: consensusScore,
        //   previousConsensus,
        //   threshold: this.consensusThreshold,
        //   attempts: triad.validationAttempts
        // });
      }

      // Use batch operation for atomic update
      batch.push({
        type: 'put',
        key: `triad:${triadId}`,
        value: triad
      });

      await this.db.batch(batch);
      this.emit('triadValidated', triad);

      return triad;
    } catch (error) {
      this.lastError = error.message;
      // this.logger.error('Failed to validate triad', {
      //   error: error.message,
      //   triadId,
      //   validatorId,
      //   stack: error.stack
      // });
      ErrorHandler.handleError(error, 'Triad validation');
      throw new Error(`Failed to validate triad: ${error.message}`);
    }
  }

  /**
   * Calculate consensus score for a triad
   * @private
   * @param {Object} triad - Triad to calculate consensus for
   * @param {string} currentValidatorId - Current validator's ID
   * @returns {Promise<number>} Consensus score
   */
  async calculateConsensus(triad, currentValidatorId) {
    try {
      // this.logger.debug('Calculating consensus', {
      //   triadId: triad.id,
      //   validatorId: currentValidatorId
      // });

      if (!this.validators.has(currentValidatorId)) {
        // this.logger.warn('Invalid validator attempting consensus calculation', {
        //   validatorId: currentValidatorId,
        //   triadId: triad.id
        // });
        return 0;
      }

      // Base validation score for registered validators
      let consensusScore = 0.7;  // Start with 70% consensus for registered validators

      // Additional score based on connections
      const connections = this.getTriadConnections(triad);
      // this.logger.debug('Found connected triads', {
      //   triadId: triad.id,
      //   connectionCount: connections.length
      // });

      if (connections.length > 0) {
        const validationScores = connections.map(conn => {
          const score = conn.validated ? 
            this.calculateConnectionScore(triad, conn) : 
            0.5 * this.calculateConnectionScore(triad, conn);
          
          return {
            connectedTriadId: conn.id,
            validated: conn.validated,
            score
          };
        });

        const connectionScore = validationScores.reduce((a, b) => a + b.score, 0) / validationScores.length;
        consensusScore += connectionScore * 0.3;  // Connection score can add up to 30%

        // this.logger.debug('Calculated connection scores', {
        //   triadId: triad.id,
        //   validationScores,
        //   connectionScore,
        //   finalConsensusScore: Math.min(1, consensusScore)
        // });
      }

      return Math.min(1, consensusScore);
    } catch (error) {
      // this.logger.error('Error calculating consensus', {
      //   error: error.message,
      //   triadId: triad.id,
      //   validatorId: currentValidatorId,
      //   stack: error.stack
      // });
      throw error;
    }
  }

  /**
   * Get a triad by its ID
   * @param {string} triadId - ID of the triad to retrieve
   * @returns {Promise<Object>} Retrieved triad
   */
  async getTriadById(triadId) {
    try {
      this.validateInitialization();
      
      // this.logger.debug('Fetching triad by ID', { triadId });

      if (!triadId || typeof triadId !== 'string') {
        throw new Error('Invalid triad ID provided');
      }

      const triad = await this.db.get(`triad:${triadId}`);
      
      if (!triad) {
        // this.logger.warn('Triad not found', { triadId });
        throw new Error(`Triad with ID ${triadId} not found`);
      }

      // this.logger.debug('Successfully retrieved triad', {
      //   triadId,
      //   validated: triad.validated,
      //   consensus: triad.consensus,
      //   validationAttempts: triad.validationAttempts
      // });

      return triad;
    } catch (error) {
      if (error.notFound) {
        // this.logger.warn('Triad not found in database', { triadId });
        throw new Error(`Triad with ID ${triadId} not found`);
      }
      this.lastError = error.message;
      // this.logger.error('Error fetching triad', {
      //   error: error.message,
      //   triadId,
      //   stack: error.stack
      // });
      throw error;
    }
  }

  /**
   * Get the current state of the matrix
   * @returns {Object} Matrix state
   */
  getMatrixState() {
    return {
      dimensions: this.dimensions,
      complexity: this.complexity,
      triadsCount: this.matrix.length,
      triads: Array.from(this.triads.values()),
      validators: Array.from(this.validators),
      consensusThreshold: this.consensusThreshold,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Add a validator to the matrix
   * @param {string} validatorId - ID of the validator to add
   * @returns {boolean} True if validator was added
   */
  addValidator(validatorId) {
    this.validateValidator(validatorId);
    if (this.validators.has(validatorId)) return false;
    
    this.validators.add(validatorId);
    this.saveMatrixState().catch(err => {
      this.lastError = err.message;
      this.logger.error('Failed to save state after adding validator', { 
        error: err.message,
        validatorId 
      });
    });
    return true;
  }

  /**
   * Generate a unique triad ID
   * @private
   * @returns {string} Generated ID
   */
  generateTriadId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Calculate optimal position for a new triad
   * @private
   * @returns {Object} Position coordinates
   */
  calculateOptimalPosition() {
    return {
      x: Math.floor(Math.random() * this.dimensions),
      y: Math.floor(Math.random() * this.dimensions),
      z: Math.floor(Math.random() * this.dimensions)
    };
  }

  /**
   * Get connected triads for a given triad
   * @private
   * @param {Object} triad - Triad to get connections for
   * @returns {Array} Connected triads
   */
  getTriadConnections(triad) {
    return this.matrix.filter(t => {
      if (t.id === triad.id) return false;
      const distance = this.calculateDistance(t.position, triad.position);
      return distance <= this.complexity && distance > 0;
    });
  }

  /**
   * Calculate connection score between two triads
   * @private
   * @param {Object} triad1 - First triad
   * @param {Object} triad2 - Second triad
   * @returns {number} Connection score
   */
  calculateConnectionScore(triad1, triad2) {
    const distance = this.calculateDistance(triad1.position, triad2.position);
    if (distance > this.complexity) return 0;
    return Math.max(0, 1 - (distance / this.complexity));
  }

  /**
   * Calculate distance between two positions
   * @private
   * @param {Object} pos1 - First position
   * @param {Object} pos2 - Second position
   * @returns {number} Calculated distance
   */
  calculateDistance(pos1, pos2) {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
      Math.pow(pos1.y - pos2.y, 2) +
      Math.pow(pos1.z - pos2.z, 2)
    );
  }

  /**
   * Load matrix state from database
   * @private
   * @returns {Promise<void>}
   */
  async loadMatrixState() {
    try {
      this.logger.debug('Loading matrix state from database...');
      
      const state = await this.db.get('matrix:state_metadata');
      this.dimensions = state.dimensions || this.dimensions;
      this.complexity = state.complexity || this.complexity;
      this.consensusThreshold = state.consensusThreshold || this.consensusThreshold;
      this.validators = new Set(state.validators || []);
      
      this.matrix = [];
      this.triads.clear();
      
      let triadCount = 0;
      for await (const [key, value] of this.db.iterator({ gte: 'triad:', lte: 'triad:~' })) {
        this.matrix.push(value);
        this.triads.set(value.id, value);
        triadCount++;
      }

      // this.logger.info('Matrix state loaded successfully', {
      //   dimensions: this.dimensions,
      //   complexity: this.complexity,
      //   validatorsCount: this.validators.size,
      //   triadsCount: triadCount
      // });
    } catch (error) {
      if (error.notFound) {
        // this.logger.info('No existing state found, initializing new state');
        await this.saveMatrixState();
      } else {
        this.lastError = error.message;
        // this.logger.error('Failed to load matrix state', {
        //   error: error.message,
        //   stack: error.stack
        // });
        throw error;
      }
    }
  }

  /**
   * Save matrix state to database
   * @private
   * @returns {Promise<void>}
   */
  async saveMatrixState() {
    try {
      // this.logger.debug('Saving matrix state...');

      const stateMetadata = {
        dimensions: this.dimensions,
        complexity: this.complexity,
        consensusThreshold: this.consensusThreshold,
        validators: Array.from(this.validators),
        lastUpdated: Date.now(),
        triadsCount: this.matrix.length,
        validatedTriadsCount: this.matrix.filter(t => t.validated).length
      };

      // Use batch operation for atomic update
      const batch = [
        { type: 'put', key: 'matrix:state_metadata', value: stateMetadata }
      ];

      await this.db.batch(batch);

      // this.logger.info('Matrix state saved successfully', {
      //   dimensions: this.dimensions,
      //   complexity: this.complexity,
      //   validatorsCount: this.validators.size,
      //   triadsCount: this.matrix.length,
      //   validatedTriadsCount: stateMetadata.validatedTriadsCount,
      //   timestamp: stateMetadata.lastUpdated
      // });
    } catch (error) {
      this.lastError = error.message;
      // this.logger.error('Failed to save matrix state', {
      //   error: error.message,
      //   stack: error.stack
      // });
      throw new Error(`Failed to save matrix state: ${error.message}`);
    }
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
      // this.logger.info('Database connection closed successfully');
    } catch (error) {
      this.lastError = error.message;
      // this.logger.error('Error closing database', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate matrix initialization
   * @private
   */
  validateInitialization() {
    if (!this.isInitialized) {
      const error = new Error('TriadMatrix not initialized');
      // this.logger.error('Attempted operation on uninitialized matrix', {
      //   error: error.message,
      //   stack: error.stack
      // });
      throw error;
    }
  }

  /**
   * Validate triad data
   * @private
   * @param {*} data - Data to validate
   */
  validateTriadData(data) {
    try {
      if (!data) {
        throw new Error('Invalid data format for triad');
      }
      
      if (typeof data !== 'object' && typeof data !== 'string') {
        throw new Error(`Invalid data type for triad: ${typeof data}. Expected object or string`);
      }

      if (typeof data === 'object' && Object.keys(data).length === 0) {
        throw new Error('Triad data object cannot be empty');
      }

      // this.logger.debug('Triad data validation successful', {
      //   dataType: typeof data,
      //   isString: typeof data === 'string',
      //   hasProperties: typeof data === 'object' ? Object.keys(data).length : 'N/A'
      // });
    } catch (error) {
      // this.logger.error('Triad data validation failed', {
      //   error: error.message,
      //   providedData: typeof data === 'object' ? JSON.stringify(data) : data,
      //   stack: error.stack
      // });
      throw error;
    }
  }

  /**
   * Validate validator ID
   * @private
   * @param {string} validatorId - Validator ID to validate
   */
  validateValidator(validatorId) {
    try {
      if (!validatorId) {
        throw new Error('Validator ID cannot be null or undefined');
      }
      
      if (typeof validatorId !== 'string') {
        throw new Error(`Invalid validator ID type: ${typeof validatorId}. Expected string`);
      }

      if (validatorId.trim().length === 0) {
        throw new Error('Validator ID cannot be empty');
      }

      // this.logger.debug('Validator ID validation successful', { validatorId });
    } catch (error) {
      // this.logger.error('Validator ID validation failed', {
      //   error: error.message,
      //   providedId: validatorId,
      //   stack: error.stack
      // });
      throw error;
    }
  }

  /**
   * Validate matrix dimensions
   * @private
   * @param {number} dimensions - Dimensions to validate
   * @returns {number} Validated dimensions
   */
  validateDimensions(dimensions) {
    try {
      if (typeof dimensions !== 'number') {
        this.logger.warn('Invalid dimensions type provided', {
          providedType: typeof dimensions,
          usingDefault: true,
          defaultValue: DEFAULT_DIMENSIONS
        });
        return DEFAULT_DIMENSIONS;
      }

      if (dimensions <= 0) {
        this.logger.warn('Invalid dimensions value provided', {
          providedValue: dimensions,
          usingDefault: true,
          defaultValue: DEFAULT_DIMENSIONS
        });
        return DEFAULT_DIMENSIONS;
      }

      this.logger.debug('Dimensions validation successful', { dimensions });
      return dimensions;
    } catch (error) {
      this.logger.error('Dimensions validation error', {
        error: error.message,
        stack: error.stack
      });
      return DEFAULT_DIMENSIONS;
    }
  }

  /**
   * Validate matrix complexity
   * @private
   * @param {number} complexity - Complexity to validate
   * @returns {number} Validated complexity
   */
  validateComplexity(complexity) {
    try {
      if (typeof complexity !== 'number') {
        this.logger.warn('Invalid complexity type provided', {
          providedType: typeof complexity,
          usingDefault: true,
          defaultValue: DEFAULT_COMPLEXITY
        });
        return DEFAULT_COMPLEXITY;
      }

      if (complexity <= 0) {
        this.logger.warn('Invalid complexity value provided', {
          providedValue: complexity,
          usingDefault: true,
          defaultValue: DEFAULT_COMPLEXITY
        });
        return DEFAULT_COMPLEXITY;
      }

      this.logger.debug('Complexity validation successful', { complexity });
      return complexity;
    } catch (error) {
      this.logger.error('Complexity validation error', {
        error: error.message,
        stack: error.stack
      });
      return DEFAULT_COMPLEXITY;
    }
  }

  /**
   * Validate consensus threshold
   * @private
   * @param {number} threshold - Threshold to validate
   * @returns {number} Validated threshold
   */
  validateConsensusThreshold(threshold) {
    try {
      if (typeof threshold !== 'number') {
        this.logger.warn('Invalid consensus threshold type provided', {
          providedType: typeof threshold,
          usingDefault: true,
          defaultValue: DEFAULT_CONSENSUS_THRESHOLD
        });
        return DEFAULT_CONSENSUS_THRESHOLD;
      }

      if (threshold <= 0 || threshold > 1) {
        this.logger.warn('Invalid consensus threshold value provided', {
          providedValue: threshold,
          usingDefault: true,
          defaultValue: DEFAULT_CONSENSUS_THRESHOLD
        });
        return DEFAULT_CONSENSUS_THRESHOLD;
      }

      this.logger.debug('Consensus threshold validation successful', { threshold });
      return threshold;
    } catch (error) {
      this.logger.error('Consensus threshold validation error', {
        error: error.message,
        stack: error.stack
      });
      return DEFAULT_CONSENSUS_THRESHOLD;
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

module.exports = TriadMatrix;
