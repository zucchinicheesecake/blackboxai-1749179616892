#!/bin/bash

# Test Script for SeirChain Setup
# Tests basic functionality after setup

set -euo pipefail

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Testing SeirChain Setup...${NC}"

# Test Node.js installation
echo -n "Testing Node.js... "
if ! command -v node &> /dev/null; then
    echo -e "${RED}Failed: Node.js not found${NC}"
    exit 1
fi
node_version=$(node -v | sed 's/v//')
echo -e "${GREEN}OK (v$node_version)${NC}"

# Test npm installation
echo -n "Testing npm... "
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Failed: npm not found${NC}"
    exit 1
fi
npm_version=$(npm -v)
echo -e "${GREEN}OK (v$npm_version)${NC}"

# Test project structure
echo -n "Testing project structure... "
required_dirs=(
    "src/core"
    "src/cli"
    "src/api"
    "src/network"
    "scripts"
    "tests"
    "data"
    "config"
)

for dir in "${required_dirs[@]}"; do
    if [[ ! -d "$dir" ]]; then
        echo -e "${RED}Failed: Directory '$dir' not found${NC}"
        exit 1
    fi
done
echo -e "${GREEN}OK${NC}"

# Test core files existence
echo -n "Testing core files... "
required_files=(
    "src/core/TriadMatrix.js"
    "src/core/Wallet.js"
    "src/cli/seirchain-cli.js"
    "src/api/server.js"
    "src/network/P2PNode.js"
    "package.json"
    ".env"
    ".gitignore"
)

for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}Failed: File '$file' not found${NC}"
        exit 1
    fi
done
echo -e "${GREEN}OK${NC}"

# Test package.json
echo -n "Testing package.json... "
if ! jq . package.json &> /dev/null; then
    echo -e "${RED}Failed: Invalid package.json${NC}"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# Test npm dependencies
echo -n "Testing npm dependencies... "
if [[ ! -d "node_modules" ]]; then
    echo -e "${YELLOW}Warning: node_modules not found, running npm install...${NC}"
    if ! npm install; then
        echo -e "${RED}Failed: npm install failed${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}OK${NC}"

# Test CLI functionality
echo -n "Testing CLI... "
if ! node src/cli/seirchain-cli.js --help &> /dev/null; then
    echo -e "${RED}Failed: CLI not working${NC}"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# Test environment configuration
echo -n "Testing environment configuration... "
if ! grep -q "NODE_ENV" .env; then
    echo -e "${RED}Failed: Invalid .env file${NC}"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# Test file permissions
echo -n "Testing file permissions... "
if [[ ! -x "src/cli/seirchain-cli.js" ]]; then
    echo -e "${YELLOW}Warning: CLI script not executable, fixing...${NC}"
    chmod +x src/cli/seirchain-cli.js
fi
echo -e "${GREEN}OK${NC}"

# Summary
echo -e "\n${GREEN}All tests passed successfully!${NC}"
echo -e "${BLUE}SeirChain setup verification complete.${NC}"

# Optional: Run npm tests if available
if grep -q "\"test\":" package.json; then
    echo -e "\n${YELLOW}Running npm tests...${NC}"
    if npm test; then
        echo -e "${GREEN}npm tests passed${NC}"
    else
        echo -e "${RED}npm tests failed${NC}"
        exit 1
    fi
fi

exit 0
