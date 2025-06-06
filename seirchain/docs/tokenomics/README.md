# SeirChain Tokenomics System

## Overview

The SeirChain tokenomics system implements the Wacłaium (WAC) token, designed to incentivize network participation and reward validators. This document details the token mechanics, distribution, and management features.

## Token Specifications

- **Name**: Wacłaium
- **Symbol**: WAC
- **Decimals**: 0 (whole tokens only)
- **Initial Supply**: 0
- **Supply Model**: Dynamic, based on mining rewards

## Token Economics

### Supply Mechanism
- Tokens are minted through validation rewards
- No pre-mine or initial distribution
- Supply grows based on network activity

### Mining Rewards
- Base reward: 10 WAC per validated triad
- Rewards are instant upon successful validation
- Automatic distribution to validator's wallet

### Distribution Model
- 100% of new tokens go to validators
- Fair distribution based on validation work
- No reserved tokens or team allocation

### Tokenomics Flowchart

```plaintext
+---------------------+
| Token Minting       |
| - Validation Rewards |
+----------+----------+
           |
           v
+---------------------+
| Token Distribution  |
| - Validators Wallet |
+----------+----------+
           |
           v
+---------------------+
| Token Transfers     |
| - Peer-to-peer      |
+---------------------+
```

## Wallet System

### Features
- Secure key generation
- Transaction signing
- Balance management
- Address generation
- Token transfers

### Commands
```bash
# Create new wallet
npm run cli -- --create-wallet

# Import existing wallet
npm run cli -- --import-wallet <private-key>

# View wallet info
npm run cli -- --wallet-info

# Transfer tokens
npm run cli -- --transfer-tokens <recipient> <amount>
```

## Token Management

### Checking Balances
```bash
# View token information
npm run cli -- --token-info

# Check specific address balance
npm run cli -- --check-balance <address>
```

### Transaction Types
1. **Mining Rewards**
   - Automatic distribution
   - No transaction fee
   - Instant confirmation

2. **Transfers**
   - Peer-to-peer transactions
   - Requires sender signature
   - Immediate settlement

## Network Statistics

### Monitoring Tools
```bash
# View total supply
npm run cli -- --total-supply

# Check circulation
npm run cli -- --circulation

# View network stats
npm run cli -- --network-stats
```

### Key Metrics
- Total Supply
- Circulation Rate
- Mining Rate
- Distribution Ratio
- Network Share

## Implementation Details

### Token Ledger
- Persistent storage using LevelDB
- Atomic transactions
- Balance tracking
- Transaction history

### Security Features
- Cryptographic signatures
- Private key encryption
- Secure key storage
- Transaction verification

## Integration Guide

### Using the Token API
```javascript
const Tokenomics = require('../core/Tokenomics');

// Initialize
const tokenomics = new Tokenomics();
await tokenomics.loadLedger();

// Check balance
const balance = tokenomics.getBalance(address);

// Transfer tokens
await tokenomics.transfer(from, to, amount);

// Mint rewards
await tokenomics.mint(validator, reward);
```

### Event Handling
```javascript
// Listen for token events
tokenomics.on('mint', (address, amount) => {
  console.log(`Minted ${amount} WAC to ${address}`);
});

tokenomics.on('transfer', (from, to, amount) => {
  console.log(`Transferred ${amount} WAC from ${from} to ${to}`);
});
```

## Best Practices

### Security
1. **Private Key Management**
   - Secure storage
   - Regular backups
   - Never share private keys

2. **Transaction Safety**
   - Verify addresses
   - Double-check amounts
   - Keep logs

### Performance
1. **Ledger Optimization**
   - Regular maintenance
   - Index management
   - Cache utilization

2. **Transaction Handling**
   - Batch processing
   - Rate limiting
   - Error handling

## Troubleshooting

### Common Issues

1. **Balance Discrepancies**
   - Check transaction history
   - Verify mining rewards
   - Confirm transfers

2. **Transaction Failures**
   - Verify sender balance
   - Check address format
   - Confirm signature

3. **Mining Rewards**
   - Verify validator status
   - Check consensus threshold
   - Confirm successful validation

## Future Development

### Planned Features
1. **Advanced Tokenomics**
   - Staking mechanisms
   - Governance features
   - Token burning

2. **Enhanced Security**
   - Multi-signature support
   - Advanced encryption
   - Audit logging

3. **Network Upgrades**
   - Scalability improvements
   - Performance optimization
   - Feature expansion

## Support

For assistance with the tokenomics system:
- Review documentation
- Check GitHub issues
- Contact development team
