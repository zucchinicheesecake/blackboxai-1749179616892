# Ledger Synchronization

This document describes the ledger synchronization functionality in SeirChain, which handles database access for new users and prevents the "database is not open for new users" error.

## Overview

The ledger sync system provides a reliable way to synchronize ledger data across nodes while ensuring proper database access control. It includes:

- A dedicated ledger sync module
- P2P message types for ledger synchronization
- Error handling for database access issues
- Integration with the P2P network

## Components

### 1. Ledger Sync Module (`src/ledger/ledgerSync.js`)

The core synchronization logic that:
- Verifies database availability for new users
- Handles ledger updates safely
- Provides proper error handling

### 2. P2P Integration (`src/network/P2PNode.js`)

Added message types:
- `SYNC_LEDGER`: Request ledger synchronization
- `SYNC_LEDGER_CONFIRMATION`: Acknowledge sync completion

## Usage

### Initializing P2P Node with Database Connection

```javascript
const P2PNode = require('./network/P2PNode');
const dbConnection = require('./your-db-connection');

const node = new P2PNode(port, triadMatrix, initialPeers, dbConnection);
```

### Database Connection Requirements

Your database connection object must implement:
- `isOpenForNewUsers()`: Returns boolean indicating if the database accepts new users
- `updateLedger(ledgerData)`: Updates the ledger with provided data

Example:
```javascript
const dbConnection = {
    isOpenForNewUsers() {
        // Check if database is ready for new users
        return true;
    },
    async updateLedger(ledgerData) {
        // Update ledger with new data
        await db.transaction(async (trx) => {
            // Your update logic here
        });
    }
};
```

## Error Handling

The system handles several types of errors:
1. Database not open for new users
2. Connection failures
3. Update failures

Error responses are sent back through the P2P network using the `ERROR` message type.

## Testing

Run the test suite:
```bash
npm test tests/core/LedgerSync.test.js
```

The tests cover:
- Successful ledger synchronization
- Database availability checks
- Error handling scenarios

## Best Practices

1. **Database Connection**
   - Always check database availability before updates
   - Use proper connection pooling
   - Implement retry mechanisms for temporary failures

2. **Error Handling**
   - Log all sync errors
   - Provide meaningful error messages
   - Implement proper cleanup on failures

3. **Network Communication**
   - Validate incoming sync requests
   - Implement timeouts for sync operations
   - Handle network disconnections gracefully

## Troubleshooting

Common issues and solutions:

1. **"Database is not open for new users" Error**
   - Check database connection status
   - Verify user permissions
   - Ensure database is not in maintenance mode

2. **Sync Failures**
   - Check network connectivity
   - Verify data format
   - Review database logs

3. **Performance Issues**
   - Monitor sync operation timing
   - Check database load
   - Review network latency

## API Reference

### syncLedger(dbConnection, ledgerData)

Synchronizes ledger data if the database is accepting new users.

Parameters:
- `dbConnection`: Database connection object
- `ledgerData`: Object containing ledger updates

Returns:
- Promise resolving to `{ status: "success" }` on successful sync
- Throws error if database is not available or sync fails

Example:
```javascript
try {
    const result = await syncLedger(dbConnection, {
        entries: [
            { id: 1, data: "example data" }
        ]
    });
    console.log("Sync successful:", result);
} catch (error) {
    console.error("Sync failed:", error.message);
}
