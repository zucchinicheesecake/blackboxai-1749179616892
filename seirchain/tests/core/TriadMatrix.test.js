const TriadMatrix = require('../../src/core/TriadMatrix');
const path = require('path');
const fs = require('fs');

describe('TriadMatrix', () => {
  jest.setTimeout(30000); // Increase timeout to 30 seconds
  let matrix;
  const testDbPath = path.join(__dirname, '../../data/test-triad.db');

  beforeEach(async () => {
    // Clean up test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { force: true, recursive: true });
    }
    
    // Ensure the data directory exists
    const dataDir = path.dirname(testDbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    matrix = new TriadMatrix(testDbPath, {
      dimensions: 3,
      complexity: 4,
      consensusThreshold: 0.67
    });

    // Wait for initialization
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Matrix initialization timed out'));
      }, 10000);

      matrix.once('initialized', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      matrix.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });

  afterEach(async () => {
    if (matrix) {
      await matrix.closeDB();
    }
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { force: true, recursive: true });
    }
  });

  test('should initialize with correct configuration', () => {
    const state = matrix.getMatrixState();
    
    expect(state.dimensions).toBe(3);
    expect(state.complexity).toBe(4);
    expect(state.consensusThreshold).toBe(0.67);
    expect(state.triadsCount).toBe(0);
    expect(state.isInitialized).toBe(true);
  });

  test('should create and retrieve a triad', async () => {
    const testData = { message: 'Test Triad' };
    const validatorId = 'test-validator';
    
    const createdTriad = await matrix.createTriad(testData, validatorId);
    
    expect(createdTriad).toBeDefined();
    expect(createdTriad.data).toEqual(testData);
    expect(createdTriad.validator).toBe(validatorId);
    expect(createdTriad.id).toBeDefined();
    expect(createdTriad.position).toBeDefined();
    expect(createdTriad.validated).toBe(false);
    
    const retrievedTriad = await matrix.getTriadById(createdTriad.id);
    expect(retrievedTriad).toEqual(createdTriad);
  });

  test('should add validator', () => {
    const validatorId = 'test-validator';
    
    const result = matrix.addValidator(validatorId);
    
    expect(result).toBe(true);
    expect(matrix.validators.has(validatorId)).toBe(true);
    
    // Adding same validator again should return false
    const secondResult = matrix.addValidator(validatorId);
    expect(secondResult).toBe(false);
  });

  test('should calculate optimal position within dimensions', () => {
    const position = matrix.calculateOptimalPosition();
    
    expect(position).toBeDefined();
    expect(position.x).toBeGreaterThanOrEqual(0);
    expect(position.x).toBeLessThan(matrix.dimensions);
    expect(position.y).toBeGreaterThanOrEqual(0);
    expect(position.y).toBeLessThan(matrix.dimensions);
    expect(position.z).toBeGreaterThanOrEqual(0);
    expect(position.z).toBeLessThan(matrix.dimensions);
  });

  test('should validate triad with sufficient consensus', async () => {
    const testData = { message: 'Test Triad' };
    const validatorId = 'test-validator';
    const validatorId2 = 'test-validator-2';
    
    matrix.addValidator(validatorId);
    matrix.addValidator(validatorId2);
    
    const triad = await matrix.createTriad(testData, validatorId);
    const validatedTriad = await matrix.validateTriad(triad.id, validatorId2);
    
    expect(validatedTriad.validationAttempts).toBe(1);
    expect(validatedTriad.consensus).toBeGreaterThan(0);
  });

  test('should reject invalid triad data', async () => {
    await expect(matrix.createTriad(null, 'test-validator'))
      .rejects.toThrow('Invalid data format for triad');
      
    await expect(matrix.createTriad(undefined, 'test-validator'))
      .rejects.toThrow('Invalid data format for triad');
  });
});
