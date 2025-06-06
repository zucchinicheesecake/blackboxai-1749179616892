# TriadMatrix Technical Documentation

## Overview

The TriadMatrix is the core component of SeirChain, implementing a three-dimensional matrix structure for storing and validating triads. This document provides technical details about its implementation, consensus mechanism, and usage.

## Architecture

### Matrix Structure
```
Dimensions: 3x3x3 (default)
Structure: Three-dimensional array
Position: {x, y, z} coordinates
Connections: Inter-triad links
```

### Architecture Diagram

```plaintext
+-----------------------+
|      TriadMatrix      |
|  3D Matrix Structure  |
+-----------+-----------+
            |
+-----------v-----------+
|       Triads          |
|  Data, Validator,     |
|  Position, Status     |
+-----------+-----------+
            |
+-----------v-----------+
|     Validators        |
|  Address, Status,     |
|  Reputation           |
+-----------------------+
```

### Components

1. **Triad**
```javascript
{
  id: string,          // Unique identifier
  data: object,        // Custom data payload
  validator: string,   // Creator's address
  timestamp: number,   // Creation time
  position: {         // 3D coordinates
    x: number,
    y: number,
    z: number
  },
  connections: [],     // Connected triads
  validated: boolean,  // Validation status
  consensus: number,   // Current consensus level
  validationAttempts: number  // Number of validation attempts
}
```

2. **Validator**
```javascript
{
  address: string,     // Validator's wallet address
  status: string,      // Active/Inactive
  validations: number, // Total validations
  reputation: number   // Validation success rate
}
```

## Consensus Mechanism

### Calculation Formula
```javascript
consensusScore = baseValidationScore + connectionScore

where:
- baseValidationScore = 0.7 (70% for registered validators)
- connectionScore = (sum of connection validations) * 0.3
```

### Validation Rules
1. Only registered validators can validate
2. Self-validation is not allowed
3. Minimum consensus threshold: 67%
4. Multiple validation attempts allowed

### Consensus Calculation Diagram

```plaintext
+-------------------------+
| Base Validation Score   | 70%
+-------------------------+
            +
+-------------------------+
| Connection Score        | 30%
+-------------------------+
            =
+-------------------------+
| Consensus Score         |
+-------------------------+
```

## Implementation Details

### Initialization
```javascript
const matrix = new TriadMatrix(dbPath, {
  dimensions: 3,
  complexity: 4,
  consensusThreshold: 0.67
});
await matrix.init();
```

### Core Operations

1. **Creating Triads**
```javascript
async createTriad(data, validator) {
  // Generate unique ID
  // Find available position
  // Initialize triad
  // Store in database
  // Return triad object
}
```

2. **Validating Triads**
```javascript
async validateTriad(triadId, validatorId) {
  // Check validator eligibility
  // Calculate consensus
  // Update validation status
  // Trigger rewards if validated
  // Return updated triad
}
```

3. **Managing Connections**
```javascript
async connectTriads(triadId1, triadId2) {
  // Verify triads exist
  // Check connection validity
  // Update both triads
  // Return connection status
}
```

### Core Operations Flowchart

```plaintext
+-----------------------+
| Create Triad          |
+-----------+-----------+
            |
+-----------v-----------+
| Validate Triad        |
+-----------+-----------+
            |
+-----------v-----------+
| Connect Triads        |
+-----------------------+
```

## Database Structure

### LevelDB Schema
```
Keys:
- triad:{id} → Triad object
- validator:{address} → Validator object
- position:{x}:{y}:{z} → Triad ID
- connection:{triad1}:{triad2} → Connection object
```

### Indexes
1. Position Index
2. Validator Index
3. Connection Index
4. Validation Status Index

## API Reference

### Triad Management
```javascript
// Create new triad
const triad = await matrix.createTriad(data, validatorAddress);

// Get triad by ID
const triad = await matrix.getTriad(triadId);

// Update triad
await matrix.updateTriad(triadId, updates);

// Delete triad
await matrix.deleteTriad(triadId);
```

### Validation Operations
```javascript
// Register validator
await matrix.addValidator(address);

// Validate triad
const result = await matrix.validateTriad(triadId, validatorAddress);

// Check consensus
const consensus = await matrix.calculateConsensus(triad, validatorId);
```

### Query Operations
```javascript
// Get all triads
const triads = await matrix.getAllTriads();

// Get unvalidated triads
const pending = await matrix.getUnvalidatedTriads();

// Get validator info
const validator = await matrix.getValidator(address);
```

## Performance Optimization

### Caching Strategy
1. Position cache
2. Validator cache
3. Connection cache
4. Consensus cache

### Database Optimization
1. Batch operations
2. Index management
3. Compaction scheduling

## Error Handling

### Common Errors
1. Position conflicts
2. Validation conflicts
3. Connection conflicts
4. Database errors

### Error Types
```javascript
class TriadMatrixError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// Error codes
const ERROR_CODES = {
  POSITION_TAKEN: 'E001',
  INVALID_VALIDATOR: 'E002',
  CONSENSUS_FAILED: 'E003',
  DATABASE_ERROR: 'E004'
};
```

## Testing

### Test Categories
1. Unit Tests
2. Integration Tests
3. Performance Tests
4. Stress Tests

### Test Commands
```bash
# Run all tests
npm test

# Run matrix tests
npm run test:matrix

# Run integration tests
npm run test:integration
```

## Monitoring

### Metrics
1. Creation rate
2. Validation rate
3. Consensus levels
4. Network health

### Visualization
```bash
# Start matrix visualizer
npm run matrix:visualize

# Run analysis
npm run matrix:analyze
```

## Best Practices

### Development
1. Use batch operations for multiple updates
2. Implement proper error handling
3. Maintain index efficiency
4. Regular performance monitoring

### Production
1. Regular backups
2. Performance optimization
3. Error monitoring
4. Resource management

## Support

For technical assistance:
- Review source code
- Check test cases
- Contact development team

### Architecture Summary Diagram

```plaintext
+-----------------------+
| TriadMatrix Core      |
| - 3D Matrix           |
| - Triads & Validators |
+-----------+-----------+
            |
+-----------v-----------+
| Consensus Mechanism   |
| - Validation Rules    |
| - Consensus Score     |
+-----------+-----------+
            |
+-----------v-----------+
| API & Operations      |
| - Create/Validate     |
| - Connect Triads      |
+-----------------------+
```
