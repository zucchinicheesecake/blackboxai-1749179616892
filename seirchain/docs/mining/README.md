# SeirChain Mining System

## Overview

The SeirChain mining system is a sophisticated implementation that rewards validators for maintaining network consensus through the validation of triads. This document provides comprehensive information about the mining system, its features, and how to use it.

## Features

- **Continuous Validation**: Automatically validates triads and maintains network consensus
- **Real-time Statistics**: Monitor mining performance, rewards, and network status
- **Token Rewards**: Earn WAC tokens for successful validations
- **Consensus Mechanism**: Advanced consensus calculation based on validator status and connections

## Getting Started

### Prerequisites

- Node.js >= 14.18.0
- NPM >= 6.0.0
- SeirChain wallet

### Basic Setup

1. Create a new wallet:
```bash
npm run cli -- --create-wallet
```

2. Start mining:
```bash
npm run mine
```

3. Monitor your mining status:
```bash
npm run cli -- --token-info
```

## Configuration

The mining system can be configured through environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `MINING_REWARD` | WAC tokens awarded per validation | 10 |
| `MATRIX_DIMENSIONS` | Size of the TriadMatrix | 3 |
| `TRIAD_COMPLEXITY` | Complexity level for validation | 4 |
| `CONSENSUS_THRESHOLD` | Required consensus for validation | 0.67 |
| `MINING_INTERVAL` | Time between mining cycles (ms) | 5000 |

## Mining Process

### 1. Initialization
- Loads wallet configuration
- Connects to the TriadMatrix
- Registers as a validator

### 2. Validation Cycle
- Scans for unvalidated triads
- Calculates consensus for each triad
- Validates triads meeting threshold
- Mints rewards for successful validations

### 3. Statistics Tracking
- Monitors validation success rate
- Tracks token earnings
- Calculates network share
- Records runtime metrics

## Consensus Calculation

The consensus mechanism uses multiple factors:
1. Base validation score (70%) for registered validators
2. Connection-based scoring (up to 30%)
3. Threshold requirement (default 67%)

## Testing

Two test scripts are provided:

1. Basic Mining Test:
```bash
./test_mining.sh
```
Tests basic mining functionality with:
- Wallet creation
- Triad generation
- Mining process
- Reward distribution

2. Comprehensive Test:
```bash
./test_script.sh
```
Verifies:
- Token distribution
- Consensus calculation
- Validator registration
- Mining rewards
- System stability

## Monitoring

### Real-time Statistics
The miner provides real-time information:
```
⛏️  SeirChain Miner Status
━━━━━━━━━━━━━━━━━━━━━━━━

📍 Miner Details
   Address: [your-address]
   Current Balance: [X] WAC
   Mining Reward: [Y] WAC per validation

📊 Mining Statistics
   Runtime: [time] minutes
   Triads Validated: [count]
   Total Rewards: [amount] WAC
   Rewards/Hour: [rate] WAC

💎 Network Statistics
   Total Supply: [supply] WAC
   Share: [percentage]%
```

### CLI Commands

Monitor mining activity:
```bash
# Check token balance and mining status
npm run cli -- --token-info

# View system status
npm run cli -- --status

# List validated triads
npm run cli -- --list
```

## Troubleshooting

Common issues and solutions:

1. **Mining not starting**
   - Verify wallet exists and is loaded
   - Check matrix initialization
   - Ensure no other mining process is running

2. **No rewards received**
   - Verify validator registration
   - Check consensus threshold
   - Confirm unvalidated triads exist

3. **Low validation rate**
   - Check network connectivity
   - Verify matrix dimensions
   - Adjust mining interval

## Mining Process Flowchart

```
+---------------------+
| 1. Initialization   |
| - Load wallet       |
| - Connect TriadMatrix|
| - Register validator|
+----------+----------+
           |
           v
+---------------------+
| 2. Validation Cycle |
| - Scan triads       |
| - Calculate consensus|
| - Validate triads   |
| - Mint rewards     |
+----------+----------+
           |
           v
+---------------------+
| 3. Statistics       |
| - Track success rate|
| - Token earnings    |
| - Network share     |
| - Runtime metrics   |
+---------------------+
```

## Best Practices

1. **Optimal Performance**
   - Run on stable network connection
   - Monitor system resources
   - Adjust mining interval based on hardware

2. **Security**
   - Backup wallet regularly
   - Secure private keys
   - Monitor for unusual activity

3. **Maintenance**
   - Regular status checks
   - Update software as needed
   - Monitor disk space for database

## Support

For additional help:
- Check GitHub issues
- Review error logs
- Contact development team
