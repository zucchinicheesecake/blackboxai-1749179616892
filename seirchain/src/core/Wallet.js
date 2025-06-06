/**
 * @fileoverview Wallet management for the SeirChain blockchain
 * Handles key pair generation, address management, and transaction signing
 * using the secp256k1 elliptic curve and SHA256/RIPEMD160 for address generation
 */

const { ec: EC } = require('elliptic');
const crypto = require('crypto');
const { Buffer } = require('buffer');
const ErrorHandler = require('../utils/errorHandler');
const { createChildLogger } = require('../utils/logger');

// Initialize elliptic curve with secp256k1 (same as Bitcoin)
const ec = new EC('secp256k1');

// Constants for validation
const PRIVATE_KEY_LENGTH = 64;
const ADDRESS_PREFIX = 'seir';
const ADDRESS_HASH_LENGTH = 36;

/**
 * Wallet class for managing cryptographic keys and addresses
 */
class Wallet {
  /**
   * Create a new Wallet instance
   * @param {string} [privateKeyHex] - Optional hex-encoded private key to initialize the wallet
   */
  constructor(privateKeyHex) {
    /** @private */
    this.keyPair = null;
    /** @private */
    this.address = null;
    /** @private */
    this.publicKey = null;
    /** @private */
    this.lastError = null;
    /** @private */
    this.logger = createChildLogger('Wallet');

    if (privateKeyHex) {
      try {
        this.logger.debug('Initializing wallet with provided private key');
        this.importFromPrivateKey(privateKeyHex);
        this.logger.info('Wallet initialized successfully with provided private key');
      } catch (error) {
        this.lastError = error.message;
        this.logger.error('Failed to initialize wallet', {
          error: error.message,
          stack: error.stack
        });
        ErrorHandler.handleError(error, 'Wallet initialization');
      }
    } else {
      this.logger.debug('Creating new empty wallet instance');
    }
  }

  /**
   * Generate a new key pair and corresponding address
   * @returns {Object} Object containing public key, private key, and address
   * @throws {Error} If key generation fails
   */
  generateKeyPair() {
    this.logger.debug('Starting key pair generation');
    
    try {
      this.keyPair = ec.genKeyPair();
      this.publicKey = this.keyPair.getPublic(true, 'hex');
      
      this.logger.debug('Generated public key', { publicKey: this.publicKey });
      
      this.address = this._generateAddress(this.publicKey);
      if (!this.address) {
        throw new Error('Failed to generate address from public key');
      }
      
      const keyData = {
        publicKey: this.publicKey,
        privateKey: this.getPrivateKey(),
        address: this.address,
      };

      // Validate generated data
      if (!this._validateKeyData(keyData)) {
        throw new Error('Generated key data validation failed');
      }

      this.logger.info('Key pair generated successfully', {
        address: this.address,
        publicKeyLength: this.publicKey.length
      });

      return keyData;
    } catch (error) {
      this.lastError = error.message;
      this.logger.error('Failed to generate key pair', {
        error: error.message,
        stack: error.stack
      });
      ErrorHandler.handleError(error, 'Key pair generation');
      throw new Error(`Failed to generate key pair: ${error.message}`);
    }
  }

  /**
   * Import a wallet from an existing private key
   * @param {string} privateKeyHex - Hex-encoded private key
   * @returns {boolean} True if import was successful
   * @throws {Error} If private key is invalid or import fails
   */
  importFromPrivateKey(privateKeyHex) {
    this.logger.debug('Starting private key import');

    // Validate private key format
    if (!this._validatePrivateKeyFormat(privateKeyHex)) {
      const error = new Error(`Invalid private key format. Expected ${PRIVATE_KEY_LENGTH} hex characters.`);
      this.logger.error('Private key validation failed', {
        error: error.message,
        providedLength: privateKeyHex.length
      });
      throw error;
    }

    try {
      this.keyPair = ec.keyFromPrivate(privateKeyHex, 'hex');
      this.publicKey = this.keyPair.getPublic(true, 'hex');
      
      this.logger.debug('Derived public key from private key', {
        publicKeyLength: this.publicKey.length
      });

      this.address = this._generateAddress(this.publicKey);
      if (!this.address) {
        throw new Error('Failed to generate address from public key');
      }

      // Validate the imported key pair
      if (!this._validateKeyPair()) {
        throw new Error('Key pair validation failed after import');
      }

      this.logger.info('Private key imported successfully', {
        address: this.address,
        publicKeyLength: this.publicKey.length
      });

      return true;
    } catch (error) {
      // Reset wallet state on failure
      this._resetWalletState();
      this.lastError = error.message;
      this.logger.error('Failed to import private key', {
        error: error.message,
        stack: error.stack
      });
      ErrorHandler.handleError(error, 'Wallet import');
      throw new Error(`Failed to import private key: ${error.message}`);
    }
  }

  /**
   * Get the wallet's public key
   * @returns {string|null} Hex-encoded public key or null if wallet not initialized
   */
  getPublicKey() {
    return this.publicKey;
  }

  /**
   * Get the wallet's private key
   * @returns {string|null} Hex-encoded private key or null if wallet not initialized
   */
  getPrivateKey() {
    return this.keyPair ? this.keyPair.getPrivate('hex') : null;
  }

  /**
   * Get the wallet's address
   * @returns {string|null} Wallet address or null if wallet not initialized
   */
  getAddress() {
    return this.address;
  }

  /**
   * Get the last error that occurred
   * @returns {string|null} Last error message or null if no error
   */
  getLastError() {
    return this.lastError;
  }

  /**
   * Generate a wallet address from a public key using SHA256 and RIPEMD160
   * @private
   * @param {string} publicKeyHex - Hex-encoded public key
   * @returns {string|null} Generated address or null if input is invalid
   */
  _generateAddress(publicKeyHex) {
    if (!publicKeyHex) {
      this.logger.error('Cannot generate address: public key is missing');
      return null;
    }
    
    try {
      this.logger.debug('Starting address generation from public key', {
        publicKeyLength: publicKeyHex.length
      });

      // Double hash: SHA256 -> RIPEMD160 (similar to Bitcoin's address generation)
      const hash1 = crypto.createHash('sha256').update(Buffer.from(publicKeyHex, 'hex')).digest();
      const hash2 = crypto.createHash('ripemd160').update(hash1).digest('hex');
      
      this.logger.debug('Generated intermediate hashes', {
        sha256Length: hash1.length,
        ripemd160Length: hash2.length
      });

      // Create address with prefix and fixed length
      const address = `${ADDRESS_PREFIX}${hash2.substring(0, ADDRESS_HASH_LENGTH)}`;
      
      // Validate generated address
      if (!this._validateAddress(address)) {
        const error = new Error('Generated address validation failed');
        this.logger.error('Address validation failed', {
          error: error.message,
          address,
          expectedLength: ADDRESS_PREFIX.length + ADDRESS_HASH_LENGTH
        });
        throw error;
      }
      
      this.logger.debug('Address generated successfully', {
        addressLength: address.length,
        prefix: ADDRESS_PREFIX
      });

      return address;
    } catch (error) {
      this.lastError = error.message;
      this.logger.error('Address generation failed', {
        error: error.message,
        stack: error.stack,
        publicKeyLength: publicKeyHex.length
      });
      return null;
    }
  }

  /**
   * Sign data with the wallet's private key
   * @param {string|Object} data - Data to sign
   * @returns {Object} Signature object containing r, s values and recovery parameter
   * @throws {Error} If wallet is not initialized or signing fails
   */
  signData(data) {
    this.logger.debug('Starting data signing process');

    if (!this.isInitialized()) {
      const error = new Error('Wallet not initialized or no private key loaded.');
      this.logger.error('Attempted to sign with uninitialized wallet', {
        error: error.message,
        isKeyPairPresent: !!this.keyPair,
        isAddressPresent: !!this.address
      });
      throw error;
    }

    try {
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const dataHash = crypto.createHash('sha256').update(dataString).digest();

      this.logger.debug('Generated hash for signing', {
        dataType: typeof data,
        hashLength: dataHash.length
      });

      const signature = this.keyPair.sign(dataHash, { canonical: true });
      const signatureObj = {
        r: signature.r.toString(16),
        s: signature.s.toString(16),
        recoveryParam: signature.recoveryParam,
      };

      this.logger.debug('Generated signature components', {
        rLength: signatureObj.r.length,
        sLength: signatureObj.s.length,
        recoveryParam: signatureObj.recoveryParam
      });

      // Validate signature
      if (!this._validateSignature(data, signatureObj)) {
        const error = new Error('Generated signature validation failed');
        this.logger.error('Signature validation failed', {
          error: error.message,
          signatureComponents: {
            rPresent: !!signatureObj.r,
            sPresent: !!signatureObj.s,
            recoveryParamPresent: signatureObj.recoveryParam !== undefined
          }
        });
        throw error;
      }

      this.logger.info('Data signed successfully', {
        address: this.address,
        signatureLength: signatureObj.r.length + signatureObj.s.length
      });

      return signatureObj;
    } catch (error) {
      this.lastError = error.message;
      this.logger.error('Signing failed', {
        error: error.message,
        stack: error.stack,
        dataType: typeof data
      });
      ErrorHandler.handleError(error, 'Data signing');
      throw new Error(`Signing failed: ${error.message}`);
    }
  }

  /**
   * Verify a signature against data and a public key
   * @static
   * @param {string|Object} data - Original data that was signed
   * @param {Object} signatureObj - Signature object containing r, s values
   * @param {string} publicKeyHex - Hex-encoded public key to verify against
   * @returns {boolean} True if signature is valid
   */
  static verifySignature(data, signatureObj, publicKeyHex) {
    // Create a static logger instance for this method
    const logger = createChildLogger('Wallet:verifySignature');
    
    logger.debug('Starting signature verification', {
      hasPublicKey: !!publicKeyHex,
      hasSignature: !!signatureObj
    });

    if (!publicKeyHex || !signatureObj || !signatureObj.r || !signatureObj.s) {
      logger.error('Invalid verification parameters', {
        hasPublicKey: !!publicKeyHex,
        hasSignature: !!signatureObj,
        hasR: signatureObj?.r !== undefined,
        hasS: signatureObj?.s !== undefined
      });
      return false;
    }

    try {
      const key = ec.keyFromPublic(publicKeyHex, 'hex');
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const dataHash = crypto.createHash('sha256').update(dataString).digest();

      logger.debug('Prepared verification data', {
        dataType: typeof data,
        hashLength: dataHash.length,
        publicKeyLength: publicKeyHex.length
      });

      const signature = {
        r: signatureObj.r,
        s: signatureObj.s,
        recoveryParam: signatureObj.recoveryParam
      };

      const isValid = key.verify(dataHash, signature);

      logger.info('Signature verification completed', {
        isValid,
        publicKeyLength: publicKeyHex.length
      });

      return isValid;
    } catch (error) {
      logger.error('Signature verification failed', {
        error: error.message,
        stack: error.stack,
        publicKeyLength: publicKeyHex?.length
      });
      return false;
    }
  }

  /**
   * Export public wallet data
   * @returns {Object|null} Object containing public key and address, or null if not initialized
   */
  exportPublicData() {
    if (!this.isInitialized()) {
      return null;
    }
    return {
      publicKey: this.getPublicKey(),
      address: this.getAddress(),
    };
  }

  /**
   * Check if the wallet is properly initialized
   * @returns {boolean} True if wallet is initialized
   */
  isInitialized() {
    return this.keyPair !== null && this.address !== null;
  }

  /**
   * Reset wallet state
   * @private
   */
  _resetWalletState() {
    this.keyPair = null;
    this.publicKey = null;
    this.address = null;
  }

  /**
   * Validate private key format
   * @private
   * @param {string} privateKeyHex - Private key to validate
   * @returns {boolean} True if format is valid
   */
  _validatePrivateKeyFormat(privateKeyHex) {
    this.logger.debug('Validating private key format');

    const isValid = new RegExp(`^[0-9a-fA-F]{${PRIVATE_KEY_LENGTH}}$`).test(privateKeyHex);

    if (!isValid) {
      this.logger.error('Private key format validation failed', {
        expectedLength: PRIVATE_KEY_LENGTH,
        actualLength: privateKeyHex?.length,
        isHexString: /^[0-9a-fA-F]*$/.test(privateKeyHex || '')
      });
    } else {
      this.logger.debug('Private key format validation successful');
    }

    return isValid;
  }

  /**
   * Validate generated or imported key pair
   * @private
   * @returns {boolean} True if key pair is valid
   */
  _validateKeyPair() {
    this.logger.debug('Validating key pair');

    if (!this.keyPair || !this.publicKey || !this.address) {
      this.logger.error('Key pair validation failed: missing components', {
        hasKeyPair: !!this.keyPair,
        hasPublicKey: !!this.publicKey,
        hasAddress: !!this.address
      });
      return false;
    }

    // Verify that the public key can be derived from the private key
    const derivedPublicKey = this.keyPair.getPublic(true, 'hex');
    const isValid = derivedPublicKey === this.publicKey;

    if (!isValid) {
      this.logger.error('Key pair validation failed: public key mismatch', {
        derivedLength: derivedPublicKey.length,
        storedLength: this.publicKey.length
      });
    } else {
      this.logger.debug('Key pair validation successful');
    }

    return isValid;
  }

  /**
   * Validate key data structure
   * @private
   * @param {Object} keyData - Key data to validate
   * @returns {boolean} True if data is valid
   */
  _validateKeyData(keyData) {
    this.logger.debug('Validating key data');

    const validations = {
      hasPublicKey: !!keyData.publicKey,
      hasPrivateKey: !!keyData.privateKey,
      hasAddress: !!keyData.address,
      validPrivateKeyFormat: this._validatePrivateKeyFormat(keyData.privateKey),
      validAddress: this._validateAddress(keyData.address)
    };

    const isValid = Object.values(validations).every(v => v);

    if (!isValid) {
      this.logger.error('Key data validation failed', {
        validations,
        publicKeyLength: keyData.publicKey?.length,
        addressLength: keyData.address?.length
      });
    } else {
      this.logger.debug('Key data validation successful', {
        publicKeyLength: keyData.publicKey.length,
        addressLength: keyData.address.length
      });
    }

    return isValid;
  }

  /**
   * Validate signature
   * @private
   * @param {string|Object} data - Original data
   * @param {Object} signatureObj - Signature to validate
   * @returns {boolean} True if signature is valid
   */
  _validateSignature(data, signatureObj) {
    return Wallet.verifySignature(data, signatureObj, this.publicKey);
  }

  /**
   * Validate address format
   * @private
   * @param {string} address - Address to validate
   * @returns {boolean} True if address format is valid
   */
  _validateAddress(address) {
    this.logger.debug('Validating address format');

    const validations = {
      hasPrefix: address?.startsWith(ADDRESS_PREFIX),
      correctLength: address?.length === ADDRESS_PREFIX.length + ADDRESS_HASH_LENGTH,
      validCharacters: /^[0-9a-f]+$/.test(address?.slice(ADDRESS_PREFIX.length) || '')
    };

    const isValid = Object.values(validations).every(v => v);

    if (!isValid) {
      this.logger.error('Address validation failed', {
        validations,
        addressLength: address?.length,
        expectedLength: ADDRESS_PREFIX.length + ADDRESS_HASH_LENGTH
      });
    } else {
      this.logger.debug('Address validation successful', {
        prefix: ADDRESS_PREFIX,
        length: address.length
      });
    }

    return isValid;
  }
}

module.exports = Wallet;
