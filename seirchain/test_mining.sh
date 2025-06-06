#!/bin/bash

echo "🔄 SeirChain Mining Test"
echo "━━━━━━━━━━━━━━━━━━━━━"

# Set environment variables
export MINING_REWARD=10
export MATRIX_DIMENSIONS=3
export TRIAD_COMPLEXITY=4
export CONSENSUS_THRESHOLD=0.67
export MINING_INTERVAL=3000
export DEBUG=true

# Clean up existing data
rm -rf data/
mkdir -p data/backup

# Create triad creator wallet
echo "📝 Creating triad creator wallet..."
node src/cli/seirchain-cli.js --create-wallet
CREATOR_ADDRESS=$(node src/cli/seirchain-cli.js --wallet-info | grep "Address:" | sed 's/.*Address: //' | head -n1)
cp data/.wallet data/backup/creator.wallet

# Create some test triads
echo "
🔨 Creating test triads..."
for i in {1..5}; do
    node src/cli/seirchain-cli.js --create-triad "{\"test\":\"data-$i\"}"
    sleep 1
done

# Create miner wallet
echo "
⛏️  Creating miner wallet..."
rm data/.wallet
node src/cli/seirchain-cli.js --create-wallet
MINER_ADDRESS=$(node src/cli/seirchain-cli.js --wallet-info | grep "Address:" | sed 's/.*Address: //' | head -n1)
cp data/.wallet data/backup/miner.wallet

echo "
✨ Test Setup Complete:
   Creator: $CREATOR_ADDRESS
   Miner: $MINER_ADDRESS

Starting miner in 3 seconds...
"
sleep 3

# Start the miner
npm run mine
