#!/bin/bash

# Enhanced SeirChain Setup Script
# Version: 2.2 (Fixed)
# Author: Enhanced for production use
# Architecture: TriadMatrix (NOT blockchain)

# Strict mode
set -euo pipefail
# set -x # Uncomment for deep debugging

# --- Configuration & Constants ---
# Colors and formatting
declare -r BLUE='\033[0;34m'
declare -r GREEN='\033[0;32m'
declare -r YELLOW='\033[1;33m'
declare -r RED='\033[0;31m'
declare -r CYAN='\033[0;36m'
declare -r PURPLE='\033[0;35m'
declare -r BOLD='\033[1m'
declare -r NC='\033[0m' # No Color

# Project details
declare -r PROJECT_NAME="seirchain"
declare -r DEFAULT_PROJECT_DIR="$HOME/seirchain" # Default to user's home directory
declare -r MIN_NODE_VERSION="14.18.0"
declare -r REQUIRED_TOOLS=("node" "npm" "openssl" "git" "df")
declare -r MIN_DISK_SPACE_GB=1 # Minimum required disk space in GB

# --- Global Variables (modifiable by arguments) ---
PROJECT_DIR="${1:-$DEFAULT_PROJECT_DIR}" # Allow overriding project directory via first argument
VERBOSE=false
SKIP_TESTS=false
AUTO_START=false
ASSUME_YES=false # For non-interactive mode

# --- Logging Functions ---
# _log: Internal logging function to output messages with specified color and level.
# Parameters: $1 (color), $2 (log level), Remaining arguments (message to log).
_log() {
    local color="$1"; shift
    local level="$1"; shift
    echo -e "${color}${BOLD}[${level}]${NC} ${color}$*${NC}"
}

# log_info: Logs an informational message in blue.
# Parameters: Message to log.
log_info() { _log "${BLUE}" "INFO" "$*"; }

# log_success: Logs a success message in green.
# Parameters: Message to log.
log_success() { _log "${GREEN}" "SUCCESS" "$*"; }

# log_warning: Logs a warning message in yellow.
# Parameters: Message to log.
log_warning() { _log "${YELLOW}" "WARNING" "$*"; }

# log_error: Logs an error message in red to stderr.
# Parameters: Message to log.
log_error() { _log "${RED}" "ERROR" "$*" >&2; }

# log_step: Logs a step message in cyan to highlight important actions.
# Parameters: Message to log.
log_step() { echo -e "\\n${CYAN}${BOLD}🚀 [STEP] $*${NC}"; }

# log_debug: Logs a debug message in purple if verbose mode is enabled.
# Parameters: Message to log.
log_debug() { [[ "$VERBOSE" == true ]] && _log "${PURPLE}" "DEBUG" "$*" || true; }

# --- Error Handling ---
# error_exit: Logs an error message and aborts the script.
# Parameters: Error message to display.
error_exit() {
    log_error "Failed at line ${BASH_LINENO[0]}: $1"
    log_error "Setup aborted. Review the logs above for details."
    # Add any cleanup logic here if necessary
    exit 1
}
# trap: Sets up error handling to call error_exit on errors, interrupts, and termination signals.
trap 'error_exit "An unexpected error occurred."' ERR SIGINT SIGTERM

# --- Utility Functions ---
# show_progress: Displays a simple progress indicator with a message.
# Parameters: $1 (optional duration in seconds, default 1), $2 (optional message).
show_progress() {
    local duration=${1:-1} # Default duration if not provided
    local message=${2:-"Processing..."}
    echo -ne "${CYAN}${message}${NC}"
    for ((i=0; i<duration*2; i++)); do # Loop twice per second for 0.5s sleep
        echo -n "."
        sleep 0.5
    done
    echo -e " ${GREEN}Done!${NC}"
}

# command_exists: Checks if a command is available in the system's PATH.
# Parameters: Command name.
# Returns: True if the command exists, false otherwise.
command_exists() {
    command -v "$1" &> /dev/null
}

# version_ge: Compares two semantic version strings.
# Parameters: $1 (version to check), $2 (minimum version).
# Returns: True if $1 is greater than or equal to $2, false otherwise.
version_ge() {
    # Test if $1 is greater than or equal to $2
    [[ "$(printf '%s\\n' "$2" "$1" | sort -V | head -n1)" == "$2" ]]
}

# --- Argument Parsing ---
# parse_args: Parses command-line arguments and sets global variables.
# Parameters: All command-line arguments passed to the script.
parse_args() {
    log_debug "Parsing arguments: $*"
    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--project-dir)
                PROJECT_DIR="$2"
                log_debug "Setting PROJECT_DIR to: $PROJECT_DIR"
                shift 2
                ;;
            -v|--verbose)
                VERBOSE=true
                log_debug "Verbose mode enabled"
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                log_debug "Skipping tests enabled"
                shift
                ;;
            --auto-start)
                AUTO_START=true
                log_debug "Auto-start enabled"
                shift
                ;;
            -y|--yes)
                ASSUME_YES=true
                log_debug "Assume yes enabled"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                if [[ -z "${PROJECT_DIR_SET_BY_ARG-}" && ! "$1" =~ ^- ]]; then
                    # Allow setting project dir as the first positional argument if not set by --project-dir
                    PROJECT_DIR="$1"
                    PROJECT_DIR_SET_BY_ARG=true
                    log_debug "Setting PROJECT_DIR from positional argument to: $PROJECT_DIR"
                    shift
                else
                    error_exit "Unknown option: $1. Use -h or --help for usage."
                fi
                ;;
        esac
    done
    log_debug "Effective PROJECT_DIR: $PROJECT_DIR"
}

# --- Help Function ---
# show_help: Displays the help message for the script.
show_help() {
    cat << EOF
${BOLD}SeirChain Enhanced Setup Script (v2.2)${NC}
${PURPLE}Sets up the TriadMatrix Architecture Environment${NC}

${BOLD}Usage:${NC}
    $0 [PROJECT_DIR_PATH] [OPTIONS]
    $0 [OPTIONS] [--project-dir PROJECT_DIR_PATH]

${BOLD}Arguments:${NC}
    PROJECT_DIR_PATH  Optional. Path to the project directory.
                      (default: $DEFAULT_PROJECT_DIR)

${BOLD}Options:${NC}
    -p, --project-dir DIR  Specify the project directory.
    -v, --verbose          Enable verbose (debug) output.
    --skip-tests           Skip running automated tests during setup.
    --auto-start           Automatically attempt to start services after setup.
    -y, --yes              Assume 'yes' to all prompts (non-interactive).
    -h, --help             Show this help message and exit.

${BOLD}Examples:${NC}
    $0                                         # Use default directory, interactive
    $0 /opt/seirchain                          # Use custom directory /opt/seirchain
    $0 --verbose --skip-tests -y               # Verbose, skip tests, non-interactive
    $0 --project-dir /srv/seirchain --auto-start # Custom path with auto-start

${BOLD}Important Note:${NC}
SeirChain utilizes TriadMatrix architecture, which is distinct from traditional blockchain technology.
This script will create configuration files (e.g., .env, .env.production).
${RED}For production, ensure you replace placeholder secrets in .env.production with strong, unique values.${NC}
EOF
}

# --- Core Setup Functions ---

# check_system_requirements: Verifies that the necessary system tools and Node.js version are installed.
check_system_requirements() {
    log_step "Checking system requirements for TriadMatrix setup..."

    # Check for each required tool
    for tool in "${REQUIRED_TOOLS[@]}"; do
        if ! command_exists "$tool"; then
            error_exit "$tool is required but not installed. Please install it and try again."
        fi
        log_debug "$tool found: $(command -v "$tool")"
    done

    # Check Node.js version
    local node_version
    node_version=$(node -v | sed 's/v//') # Remove 'v' prefix
    if ! version_ge "$node_version" "$MIN_NODE_VERSION"; then
        error_exit "Node.js v$MIN_NODE_VERSION or higher is required (found v$node_version). Consider using NVM to manage Node.js versions."
    fi
    log_debug "Node.js version: $node_version (meets >= $MIN_NODE_VERSION)"

    # Check npm version
    local npm_version
    npm_version=$(npm -v)
    log_debug "npm version: $npm_version"

    # Check available disk space
    local target_check_dir
    if [[ -d "$PROJECT_DIR" ]]; then
        target_check_dir="$PROJECT_DIR"
    else
        target_check_dir="$(dirname "$PROJECT_DIR")"
    fi

    if [[ ! -e "$target_check_dir" ]]; then
         target_check_dir="$(dirname "$target_check_dir")"
         if [[ ! -d "$target_check_dir" ]]; then
            target_check_dir="/"
         fi
    fi

    local available_space_gb
    available_space_gb=$(df -BG "$target_check_dir" | awk 'NR==2 {print $4}' | sed 's/G//')
    log_debug "Available disk space in '$target_check_dir': ${available_space_gb}G"
    if (( $(echo "$available_space_gb < $MIN_DISK_SPACE_GB" | bc -l) )); then # Using bc for float comparison
        log_warning "Less than ${MIN_DISK_SPACE_GB}GB of disk space available in '$target_check_dir'. This might be insufficient."
    fi

    log_success "System requirements check passed."
}

# check_permissions: Verifies read and write permissions for the project directory.
check_permissions() {
    log_step "Checking permissions for project directory: $PROJECT_DIR"

    local parent_dir
    parent_dir=$(dirname "$PROJECT_DIR")

    # Check parent directory permissions if project directory doesn't exist
    if [[ ! -d "$PROJECT_DIR" ]]; then
        if [[ ! -d "$parent_dir" ]]; then
            error_exit "Parent directory '$parent_dir' does not exist. Cannot create project directory."
        fi
        if [[ ! -w "$parent_dir" ]]; then
            error_exit "No write permissions in parent directory '$parent_dir'. Please check permissions or choose a different location."
        fi
    # Check project directory permissions if it exists
    elif [[ ! -w "$PROJECT_DIR" ]]; then
        error_exit "Project directory '$PROJECT_DIR' exists but is not writable."
    fi

    log_success "Permission check passed."
}

# backup_existing: Backs up the project directory if it already exists.
backup_existing() {
    if [[ -d "$PROJECT_DIR" ]]; then
        log_warning "Project directory '$PROJECT_DIR' already exists."
        # Prompt for backup unless --yes is used
        if [[ "$ASSUME_YES" != true ]]; then
            read -r -p "Do you want to back up and overwrite the existing directory? (y/N): " response
            if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
                log_info "Skipping backup and overwrite. Exiting setup."
                exit 0
            fi
        fi

        # Create backup directory
        local backup_dir="${PROJECT_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
        log_step "Creating backup of '$PROJECT_DIR' at: $backup_dir"
        # Copy the existing project directory to the backup location
        if cp -a "$PROJECT_DIR" "$backup_dir"; then
            log_success "Backup created successfully: $backup_dir"
            log_step "Removing existing project directory: $PROJECT_DIR"
            # Remove the original project directory
            rm -rf "$PROJECT_DIR"
            log_success "Existing project directory removed."
        else
            error_exit "Failed to create backup. Aborting."
        fi
    fi
}

# create_project_structure: Creates the basic directory structure for the TriadMatrix project.
create_project_structure() {
    log_step "Creating TriadMatrix project structure in: $PROJECT_DIR"
    # Create the main project directory
    mkdir -p "$PROJECT_DIR" || error_exit "Failed to create project directory: $PROJECT_DIR"
    # Change the current directory to the project directory
    cd "$PROJECT_DIR" || error_exit "Failed to change directory to $PROJECT_DIR"

    # Define an array of subdirectories to create
    local subdirs=(
        "src/core" "src/cli" "src/api" "src/network" "src/utils" "src/validators" "src/matrix"
        "scripts/deployment" "scripts/maintenance" "scripts/monitoring"
        "tests/unit" "tests/integration" "tests/matrix" "tests/setup"
        "tools/matrix-visualizer" "tools/network-monitor" "tools/triad-analyzer"
        "examples/basic" "examples/advanced" "examples/matrix-operations"
        "docs/onboarding" "docs/api" "docs/triad-architecture" "docs/deployment"
        "data/backups" "data/logs" "data/matrix-state"
        "config/environments" "config/certificates" "config/matrix-config"
        ".github/workflows"
    )

    # Create each subdirectory
    for subdir in "${subdirs[@]}"; do
        mkdir -p "$subdir"
        log_debug "Created directory: $PROJECT_DIR/$subdir"
    done
    # Create an empty setup file for Jest testing framework
    touch "tests/setup.js"

    log_success "TriadMatrix project structure created."
    log_info "Note: For large embedded code (JS files), consider managing them as templates or pulling from a versioned source in more complex deployment scenarios for easier maintenance."
}

# create_package_json: Creates the package.json file with project metadata and dependencies.
create_package_json() {
    log_step "Creating enhanced package.json for TriadMatrix..."
    # Use a heredoc to write the content of package.json to the file
    cat << 'EOF' > package.json
{
  "name": "seirchain",
  "version": "1.0.0",
  "description": "Advanced TriadMatrix implementation with distributed consensus",
  "main": "src/core/TriadMatrix.js",
  "keywords": ["triadmatrix", "distributed-systems", "p2p", "matrix", "consensus"],
  "author": "SeirChain Development Team",
  "license": "MIT",
  "engines": {
    "node": ">=14.18.0",
    "npm": ">=6.0.0"
  },
  "scripts": {
    "start": "node src/api/server.js",
    "dev": "nodemon src/api/server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:matrix": "jest tests/matrix",
    "test:integration": "jest tests/integration",
    "lint": "eslint src/ tests/",
    "lint:fix": "eslint src/ tests/ --fix",
    "format": "prettier --write src/ tests/",
    "cli": "node src/cli/seirchain-cli.js",
    "onboard": "node scripts/onboard.js",
    "api": "node src/api/server.js",
    "mine": "node src/cli/seirchain-cli.js --mine",
    "status": "node src/cli/seirchain-cli.js --status",
    "matrix:analyze": "node tools/triad-analyzer/analyze.js",
    "matrix:visualize": "node tools/matrix-visualizer/server.js",
    "network": "node src/network/P2PNode.js",
    "deploy": "node scripts/deployment/deploy.js",
    "monitor": "node scripts/monitoring/monitor.js",
    "validate": "node src/validators/matrix-validator.js",
    "triad:create": "node src/matrix/triad-creator.js",
    "triad:validate": "node src/matrix/triad-validator.js",
    "docs:serve": "node scripts/docs-server.js"
  },
  "dependencies": {
    "elliptic": "^6.5.4",
    "level": "^8.0.0",
    "superagent": "9.0.0",
    "@apollo/server": "^4.0.0",
    "ws": "^8.13.0",
    "minimist": "^1.2.8",
    "nodemailer": "^6.9.0",
    "bcrypt": "^5.1.0",
    "dotenv": "^16.0.0",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^6.0.0",
    "rate-limiter-flexible": "^2.4.0",
    "joi": "^17.9.0",
    "winston": "^3.8.0",
    "lodash": "^4.17.21",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^18.15.0",
    "eslint": "^8.39.0",
    "prettier": "^2.8.0",
    "nodemon": "^2.0.0",
    "supertest": "^6.3.0"
  }
}
EOF
    log_success "Enhanced package.json created."
}

# create_environment_config: Creates the .env and .env.production configuration files.
create_environment_config() {
    log_step "Creating environment configuration files (.env, .env.production)..."

    # Generate random hex strings for secrets
    local jwt_secret
    jwt_secret=$(openssl rand -hex 32)
    local matrix_seed
    matrix_seed=$(openssl rand -hex 16)
    local api_key
    api_key=$(openssl rand -hex 24)

    # Create the .env file for development
    cat << EOF > .env
# SeirChain TriadMatrix Development Configuration
# For development use only. Do not use these settings in production.
NODE_ENV=development
DB_PATH=./data/triad.db
MATRIX_STATE_PATH=./data/matrix-state
BACKUP_PATH=./data/backups
MATRIX_DIMENSIONS=3
TRIAD_COMPLEXITY=4
CONSENSUS_THRESHOLD=0.67
MATRIX_SEED=$matrix_seed
PORT=5000
P2P_PORT=6000
NETWORK_ID=seirchain-devnet
MAX_PEERS=20
JWT_SECRET=$jwt_secret
API_KEY=$api_key
RATE_LIMIT_WINDOW=900000 # 15 minutes in milliseconds
RATE_LIMIT_MAX=100
# Email (Optional - for notifications, onboarding script)
# Ensure you configure these if EMAIL_ENABLED is true
EMAIL_HOST=smtp.mail.me.com # iCloud SMTP Server
EMAIL_PORT=8888
EMAIL_USER=zalgorythm@icloud.com
read -r -p "Enter your email password for development: " EMAIL_PASS
EMAIL_ENABLED=false # Set to true to enable email features
# Logging
LOG_LEVEL=info
LOG_FILE=./data/logs/seirchain-dev.log
# Metrics (Prometheus compatible)
METRICS_ENABLED=true
METRICS_PORT=9090
# Debugging
DEBUG=false
VERBOSE_LOGGING=false
EOF

    # Create the .env.production file for production
    cat << EOF > .env.production
# SeirChain TriadMatrix Production Configuration
# !!! CRITICAL: Review and update all CHANGE_ME placeholders before deploying to production !!!
NODE_ENV=production
# Paths - Ensure these directories exist and have correct permissions
DB_PATH=/var/lib/seirchain/triad.db
MATRIX_STATE_PATH=/var/lib/seirchain/matrix-state
BACKUP_PATH=/var/lib/seirchain/backups
# Matrix Parameters
MATRIX_DIMENSIONS=3
TRIAD_COMPLEXITY=6
CONSENSUS_THRESHOLD=0.75
MATRIX_SEED=CHANGE_ME_STRONG_RANDOM_SEED_IN_PRODUCTION # Replace with a strong, unique random seed
# Network
PORT=5000 # Consider changing for production if needed
P2P_PORT=6000 # Consider changing for production if needed
NETWORK_ID=seirchain-mainnet
MAX_PEERS=100
# Security - Generate strong, unique secrets for production
JWT_SECRET=CHANGE_ME_STRONG_JWT_SECRET_IN_PRODUCTION
API_KEY=CHANGE_ME_STRONG_API_KEY_IN_PRODUCTION
# Rate Limiting
RATE_LIMIT_WINDOW=900000 # 15 minutes
RATE_LIMIT_MAX=50 # Stricter for production
# Email (For system notifications)
EMAIL_HOST=smtp.your-production-mailserver.com # Replace with your production SMTP server
EMAIL_PORT=587 # Or 465 for SSL
EMAIL_USER=noreply@your-domain.com # Replace with your sending email address
EMAIL_PASS=CHANGE_ME_SECURE_EMAIL_PASSWORD_OR_API_KEY # Replace with a secure password or API key
EMAIL_ENABLED=true # Set to false if not using email
# Logging
LOG_LEVEL=warn # Or 'error' for less verbosity
LOG_FILE=/var/log/seirchain/seirchain.log # Ensure /var/log/seirchain exists and is writable
# Metrics
METRICS_ENABLED=true
METRICS_PORT=9090 # Ensure this port is firewalled appropriately
# SSL (Highly Recommended for Production API)
SSL_ENABLED=true # Set to true if using HTTPS
SSL_CERT_PATH=/etc/ssl/certs/seirchain.crt # Path to your SSL certificate
SSL_KEY_PATH=/etc/ssl/private/seirchain.key # Path to your SSL private key
# Debugging (Should be false in production)
DEBUG=false
VERBOSE_LOGGING=false
EOF

    log_success "Environment configuration files created (.env, .env.production)."
    log_warning "${RED}IMPORTANT: Review '.env.production' and replace ALL 'CHANGE_ME' placeholders with strong, unique values before any production deployment.${NC}"
    log_warning "${RED}Also, ensure the production paths (e.g., /var/lib/seirchain, /var/log/seirchain) are created with appropriate permissions.${NC}"
}

# create_jest_config: Creates the jest.config.js file for the Jest testing framework.
create_jest_config() {
    log_step "Creating Jest configuration (jest.config.js)..."
    # Use a heredoc to write the Jest configuration
    cat << 'EOF' > jest.config.js
module.exports = {
  preset: 'ts-jest', // Assuming you might use TypeScript, otherwise 'jest-preset-node' or remove
  testEnvironment: 'node',
  coverageProvider: 'v8', // Or 'babel' if using Babel
  clearMocks: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/' // If you have a build step
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/index.js',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000, // 10 seconds, adjust as needed
  verbose: true // Show individual test results
};
EOF
    log_success "Jest configuration created."
}

# create_core_files: Creates the core TriadMatrix logic files (TriadMatrix.js and Wallet.js).
create_core_files() {
    log_step "Creating enhanced TriadMatrix core files (TriadMatrix.js, Wallet.js)..."
    # TriadMatrix.js content (using a heredoc)
    cat << 'EOF' > src/core/TriadMatrix.js
const level = require('level');
const { EventEmitter } = require('events');
const crypto = require('crypto');

class TriadMatrix extends EventEmitter {
  constructor(dbPath, options = {}) {
    super();
    this.db = level(dbPath, { valueEncoding: 'json' });
    this.dimensions = options.dimensions || 3;
    this.complexity = options.complexity || 4;
    this.consensusThreshold = options.consensusThreshold || 0.67;
    this.matrix = [];
    this.triads = new Map();
    this.validators = new Set();
    this.isInitialized = false;

    this.init().catch(err => this.emit('error', new Error(\`Initialization failed: ${err.message}\`)));
  }

  async init() {
    try {
      await this.loadMatrixState();
      this.isInitialized = true;
      this.emit('initialized', this.getMatrixState());
    } catch (error) {
      this.emit('error', error);
    }
  }

  async createTriad(data, validator) {
    if (!this.isInitialized) throw new Error('TriadMatrix not initialized');
    if (!data || typeof data !== 'object' && typeof data !== 'string') {
        throw new Error('Invalid data format for triad');
    }
    if (!validator || typeof validator !== 'string') {
        throw new Error('Invalid validator ID');
    }

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

    this.matrix.push(triad);
    this.triads.set(triad.id, triad);
    await this.db.put(\`triad:${triad.id}\`, triad);
    await this.saveMatrixState();
    this.emit('triadCreated', triad);
    return triad;
  }

  async validateTriad(triadId, validatorId) {
    if (!this.isInitialized) throw new Error('TriadMatrix not initialized');
    const triad = this.triads.get(triadId);
    if (!triad) throw new Error(\`Triad with ID ${triadId} not found\`);
    if (triad.validated) return triad;

    const consensusScore = await this.calculateConsensus(triad, validatorId);
    triad.consensus = consensusScore;
    triad.validationAttempts += 1;

    if (consensusScore >= this.consensusThreshold) {
      triad.validated = true;
    }
    await this.db.put(\`triad:${triadId}\`, triad);
    this.emit('triadValidated', triad);
    return triad;
  }

  async calculateConsensus(triad, currentValidatorId) {
    const connections = this.getTriadConnections(triad);
    if (connections.length === 0) return 0;

    const validationScores = connections.map(conn => {
        return conn.validated ? this.calculateConnectionScore(triad, conn) : 0.5 * this.calculateConnectionScore(triad, conn);
    });

    const selfValidationFactor = this.validators.has(currentValidatorId) ? 0.1 : 0.05;
    const averageScore = validationScores.reduce((a, b) => a + b, 0) / validationScores.length;
    return Math.min(1, averageScore + selfValidationFactor);
  }

  async getTriad(triadId) {
    if (!this.isInitialized) throw new Error('TriadMatrix not initialized');
    try {
      return await this.db.get(\`triad:${triadId}\`);
    } catch (error) {
      if (error.notFound) return null;
      throw error;
    }
  }

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

  addValidator(validatorId) {
    if (!validatorId || typeof validatorId !== 'string') {
        throw new Error('Invalid validator ID for registration.');
    }
    if (this.validators.has(validatorId)) return false;
    this.validators.add(validatorId);
    this.saveMatrixState().catch(err => console.error("Failed to save state after adding validator:", err));
    return true;
  }

  generateTriadId() {
    return crypto.randomBytes(16).toString('hex');
  }

  calculateOptimalPosition() {
    return {
      x: Math.floor(Math.random() * this.dimensions),
      y: Math.floor(Math.random() * this.dimensions),
      z: Math.floor(Math.random() * this.dimensions)
    };
  }

  getTriadConnections(triad) {
    return this.matrix.filter(t => {
      if (t.id === triad.id) return false;
      const distance = this.calculateDistance(t.position, triad.position);
      return distance <= this.complexity && distance > 0;
    });
  }

  calculateConnectionScore(triad1, triad2) {
    const distance = this.calculateDistance(triad1.position, triad2.position);
    if (distance > this.complexity) return 0;
    return Math.max(0, 1 - (distance / this.complexity));
  }

  calculateDistance(pos1, pos2) {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
      Math.pow(pos1.y - pos2.y, 2) +
      Math.pow(pos1.z - pos2.z, 2)
    );
  }

  async loadMatrixState() {
    try {
      const state = await this.db.get('matrix:state_metadata');
      this.dimensions = state.dimensions || this.dimensions;
      this.complexity = state.complexity || this.complexity;
      this.consensusThreshold = state.consensusThreshold || this.consensusThreshold;
      this.validators = new Set(state.validators || []);
      this.matrix = [];
      this.triads.clear();
      for await (const [key, value] of this.db.iterator({ gte: 'triad:', lte: 'triad:~' })) {
        this.matrix.push(value);
        this.triads.set(value.id, value);
      }
    } catch (error) {
      if (error.notFound) {
        await this.saveMatrixState();
      } else {
        throw error;
      }
    }
  }

  async saveMatrixState() {
    const stateMetadata = {
      dimensions: this.dimensions,
      complexity: this.complexity,
      consensusThreshold: this.consensusThreshold,
      validators: Array.from(this.validators),
      lastUpdated: Date.now()
    };
    await this.db.put('matrix:state_metadata', stateMetadata);
  }

  async closeDB() {
    if (this.db && this.db.isOpen()) {
        await this.db.close();
    }
  }
}

module.exports = TriadMatrix;
EOF

    # Wallet.js content (using a heredoc)
    cat << 'EOF' > src/core/Wallet.js
const { ec: EC } = require('elliptic');
const crypto = require('crypto');
const { Buffer } = require('buffer');

const ec = new EC('secp256k1');

class Wallet {
  constructor(privateKeyHex) {
    this.keyPair = null;
    this.address = null;
    this.publicKey = null;

    if (privateKeyHex) {
      this.importFromPrivateKey(privateKeyHex);
    }
  }

  generateKeyPair() {
    this.keyPair = ec.genKeyPair();
    this.publicKey = this.keyPair.getPublic(true, 'hex');
    this.address = this._generateAddress(this.publicKey);
    return {
      publicKey: this.publicKey,
      privateKey: this.getPrivateKey(),
      address: this.address,
    };
  }

  importFromPrivateKey(privateKeyHex) {
    if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
      throw new Error('Invalid private key format. Expected 64 hex characters.');
    }
    try {
      this.keyPair = ec.keyFromPrivate(privateKeyHex, 'hex');
      this.publicKey = this.keyPair.getPublic(true, 'hex');
      this.address = this._generateAddress(this.publicKey);
      return true;
    } catch (error) {
      this.keyPair = null;
      this.publicKey = null;
      this.address = null;
      throw new Error(\`Failed to import private key: ${error.message}\`);
    }
  }

  getPublicKey() {
    return this.publicKey;
  }

  getPrivateKey() {
    return this.keyPair ? this.keyPair.getPrivate('hex') : null;
  }

  getAddress() {
    return this.address;
  }

  _generateAddress(publicKeyHex) {
    if (!publicKeyHex) return null;
    const hash1 = crypto.createHash('sha256').update(Buffer.from(publicKeyHex, 'hex')).digest();
    const hash2 = crypto.createHash('ripemd160').update(hash1).digest('hex');
    return \`seir${hash2.substring(0, 36)}\`;
  }

  signData(data) {
    if (!this.keyPair) throw new Error('Wallet not initialized or no private key loaded.');
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const dataHash = crypto.createHash('sha256').update(dataString).digest();

    const signature = this.keyPair.sign(dataHash, { canonical: true });
    return {
      r: signature.r.toString(16),
      s: signature.s.toString(16),
      recoveryParam: signature.recoveryParam,
    };
  }

  static verifySignature(data, signatureObj, publicKeyHex) {
    if (!publicKeyHex || !signatureObj || !signatureObj.r || !signatureObj.s) {
      return false;
    }
    try {
      const key = ec.keyFromPublic(publicKeyHex, 'hex');
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const dataHash = crypto.createHash('sha256').update(dataString).digest();

      const signature = {
        r: signatureObj.r,
        s: signatureObj.s,
        recoveryParam: signatureObj.recoveryParam
      };
      return key.verify(dataHash, signature);
    } catch (error) {
      return false;
    }
  }

  exportPublicData() {
    if (!this.isInitialized()) {
      return null;
    }
    return {
      publicKey: this.getPublicKey(),
      address: this.getAddress(),
    };
  }

  isInitialized() {
    return this.keyPair !== null && this.address !== null;
  }
}

module.exports = Wallet;
EOF
    log_success "Enhanced TriadMatrix core files created."
}

# create_cli_files: Creates the seirchain-cli.js file for the command-line interface.
create_cli_files() {
    log_step "Creating CLI interface files (seirchain-cli.js)..."
    # Use a heredoc to write the CLI script content
    cat << 'EOF' > src/cli/seirchain-cli.js
#!/usr/bin/env node
const minimist = require('minimist');
const TriadMatrix = require('../core/TriadMatrix');
const Wallet = require('../core/Wallet');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const WALLET_FILE = path.resolve(process.cwd(), 'data', '.wallet');

class SeirChainCLI {
  constructor() {
    this.matrix = null;
    this.wallet = new Wallet();
    this.dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'triad.db');
  }

  async initMatrix() {
    if (this.matrix && this.matrix.isInitialized) return;

    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const walletDataDir = path.dirname(WALLET_FILE);
    if (!fs.existsSync(walletDataDir)) {
      fs.mkdirSync(walletDataDir, { recursive: true });
    }

    this.matrix = new TriadMatrix(this.dbPath, {
      dimensions: parseInt(process.env.MATRIX_DIMENSIONS, 10) || 3,
      complexity: parseInt(process.env.TRIAD_COMPLEXITY, 10) || 4,
      consensusThreshold: parseFloat(process.env.CONSENSUS_THRESHOLD) || 0.67,
    });

    return new Promise((resolve, reject) => {
      this.matrix.once('initialized', (state) => {
        console.log('✅ TriadMatrix initialized.');
        resolve();
      });
      this.matrix.once('error', (err) => {
        console.error('❌ Failed to initialize TriadMatrix:', err.message);
        reject(err);
      });
    });
  }

  loadWallet() {
    if (fs.existsSync(WALLET_FILE)) {
      try {
        const privateKey = fs.readFileSync(WALLET_FILE, 'utf-8').trim();
        this.wallet.importFromPrivateKey(privateKey);
        console.log(\`🔑 Wallet loaded. Address: ${this.wallet.getAddress()}\`);
        return true;
      } catch (error) {
        console.error(\`❌ Error loading wallet: ${error.message}. Please create or import a wallet.\`);
        return false;
      }
    }
    return false;
  }

  saveWallet(privateKey) {
    try {
      fs.writeFileSync(WALLET_FILE, privateKey);
      fs.chmodSync(WALLET_FILE, 0o600);
      console.log(\`✅ Wallet saved to: ${WALLET_FILE}\`);
      console.warn("⚠️ IMPORTANT: Secure your wallet file and its backup. This file contains your private key.");
    } catch (error) {
      console.error(\`❌ Error saving wallet: ${error.message}\`);
    }
  }

  async createWallet(save = true) {
    const { privateKey, publicKey, address } = this.wallet.generateKeyPair();
    console.log('\n🔑 New Wallet Created:');
    console.log(\`   Address: ${address}\`);
    console.log(\`   Public Key: ${publicKey}\`);
    console.log(\`   Private Key: ${privateKey} (DO NOT SHARE THIS!)\`);

    if (save) {
      this.saveWallet(privateKey);
    } else {
      console.warn("\\n⚠️ Wallet not saved. Use '--save-wallet' to persist it or save the private key manually.");
    }
  }

  async importWallet(privateKey) {
    try {
      this.wallet.importFromPrivateKey(privateKey);
      console.log(\`✅ Wallet imported successfully. Address: ${this.wallet.getAddress()}\`);
      this.saveWallet(privateKey);
    } catch (error) {
      console.error(\`❌ Failed to import wallet: ${error.message}\`);
    }
  }

  async createTriad(dataString) {
    if (!this.wallet.isInitialized()) {
      console.error('❌ Wallet not loaded or initialized. Use --create-wallet or ensure .wallet file exists.');
      return;
    }
    if (!dataString || dataString.trim() === "") {
      console.error('❌ Triad data cannot be empty.');
      return;
    }
    let data;
    try {
      data = JSON.parse(dataString);
    } catch (e) {
      data = dataString;
    }

    try {
      console.log(\`Attempt ing to create triad with data:\`, data);
      const triad = await this.matrix.createTriad(data, this.wallet.getAddress());
      console.log('✅ Triad created successfully:');
      console.log(JSON.stringify(triad, null, 2));
    } catch (error) {
      console.error('❌ Failed to create triad:', error.message, error.stack);
    }
  }

  async getStatus() {
    const state = this.matrix.getMatrixState();
    console.log('\n📊 TriadMatrix Status:');
    console.log(\`   Initialized: ${state.isInitialized}\`);
    console.log(\`   Dimensions: ${state.dimensions}x${state.dimensions}x${state.dimensions}\`);
    console.log(\`   Complexity Factor: ${state.complexity}\`);
    console.log(\`   Consensus Threshold: ${(state.consensusThreshold * 100).toFixed(2)}%\`);
    console.log(\`   Total Triads in DB: ${state.triadsCount}\`);
    console.log(\`   Registered Validators: ${state.validators.length > 0 ? state.validators.join(', ') : 'None'}\`);
    const validatedTriads = state.triads.filter(t => t.validated).length;
    console.log(\`   Validated Triads: ${validatedTriads} / ${state.triads.length} (in current memory snapshot)\`);
  }

  async listTriads(limit = 10) {
    const state = this.matrix.getMatrixState();
    console.log('\n📋 Triads List (Snapshot):');
    if (state.triads.length === 0) {
      console.log('   No triads found in the current matrix snapshot.');
      return;
    }
    const triadsToDisplay = state.triads.slice(0, limit);

    triadsToDisplay.forEach((triad, index) => {
      console.log(\`\n${index + 1}. Triad ID: ${triad.id}\`);
      console.log(\`     Validator (Creator): ${triad.validator}\`);
      console.log(\`     Validated: ${triad.validated ? '✅ Yes' : '❌ No'}\`);
      console.log(\`     Consensus: ${(triad.consensus * 100).toFixed(2)}%\`);
      console.log(\`     Position: (X:${triad.position.x}, Y:${triad.position.y}, Z:${triad.position.z})\`);
      console.log(\`     Timestamp: ${new Date(triad.timestamp).toISOString()}\`);
    });
    if (state.triads.length > limit) {
      console.log(\`\n   ... and ${state.triads.length - limit} more. Use --limit <num> to see more.\`);
    }
  }

  async mine() {
    if (!this.wallet.isInitialized()) {
      console.error('❌ Wallet not loaded. Create or import a wallet first.');
      return;
    }
    const walletAddress = this.wallet.getAddress();
    console.log(\`⛏️  Starting TriadMatrix validation process as ${walletAddress}...\`);

    if (!this.matrix.validators.has(walletAddress)) {
      this.matrix.addValidator(walletAddress);
      console.log(\`📬 Registered ${walletAddress} as a validator.\`);
    }

    const state = this.matrix.getMatrixState();
    const unvalidatedTriads = state.triads.filter(t => !t.validated && t.validator !== walletAddress);

    if (unvalidatedTriads.length === 0) {
      console.log('✅ No triads (from others) currently require validation in this snapshot.');
      return;
    }

    console.log(\`Found ${unvalidatedTriads.length} triads from others to attempt validation.\`);
    let validatedCount = 0;
    for (const triad of unvalidatedTriads) {
      try {
        console.log(\`   Validating triad ${triad.id}...\`);
        const updatedTriad = await this.matrix.validateTriad(triad.id, walletAddress);
        if (updatedTriad.validated) {
          validatedCount++;
          console.log(\`   ✅ Successfully validated triad ${triad.id}. Consensus: ${(updatedTriad.consensus * 100).toFixed(2)}%\`);
        } else {
          console.log(\`   ⚠️  Triad ${triad.id} not validated. Consensus: ${(updatedTriad.consensus * 100).toFixed(2)}% (Threshold: ${this.matrix.consensusThreshold * 100}%)\`);
        }
      } catch (error) {
        console.error(\`   ❌ Error validating triad ${triad.id}: ${error.message}\`);
      }
    }
    console.log(\`\n⛏️  Validation cycle complete. Validated ${validatedCount} triad(s).\`);
  }

  async getTriadDetails(triadId) {
    if (!triadId) {
      console.error('❌ Please provide a triad ID.');
      return;
    }
    try {
      const triad = await this.matrix.getTriad(triadId);
      if (triad) {
        console.log('🔍 Triad Details:');
        console.log(JSON.stringify(triad, null, 2));
      } else {
        console.log(\`❌ Triad with ID '${triadId}' not found.\`);
      }
    } catch (error) {
      console.error(\`❌ Error fetching triad details: ${error.message}\`);
    }
  }

  showHelp() {
    console.log(\`
${path.basename(process.argv[1])} - SeirChain TriadMatrix Command Line Interface

Usage: node ${path.basename(process.argv[1])} [command] [options]

Wallet Commands:
  --create-wallet [--save]         Create a new wallet. --save is default.
  --import-wallet <privateKey>   Import a wallet from a private key and save it.
  --wallet-info                    Display current loaded wallet information.

Triad & Matrix Commands:
  --create-triad "<data>"          Create a new triad with the given data (JSON string or plain string).
                                   Example: --create-triad '{"message":"hello"}'
  --get-triad <triadId>            Fetch and display details for a specific triad.
  --status                         Show current TriadMatrix status and statistics.
  --list [--limit <number>]        List triads in the matrix (default limit 10).
  --mine                           Run the validation process for unvalidated triads.

General Options:
  --help                           Show this help message.

Examples:
  node ${path.basename(process.argv[1])} --create-wallet
  node ${path.basename(process.argv[1])} --import-wallet YOUR_PRIVATE_KEY_HERE
  node ${path.basename(process.argv[1])} --create-triad "My first triad data"
  node ${path.basename(process.argv[1])} --status
  node ${path.basename(process.argv[1])} --list --limit 5
  node ${path.basename(process.argv[1])} --mine
    \`);
  }
}

async function main() {
  const cli = new SeirChainCLI();
  const args = minimist(process.argv.slice(2));

  cli.loadWallet();

  if (args['create-triad'] || args.status || args.list || args.mine || args['get-triad']) {
    try {
      await cli.initMatrix();
    } catch (error) {
      process.exit(1);
    }
  }

  if (args.help || Object.keys(args).length === 1 && args._.length === 0) {
    cli.showHelp();
  } else if (args['create-wallet']) {
    await cli.createWallet(args.save !== false);
  } else if (args['import-wallet']) {
    if (typeof args['import-wallet'] !== 'string' || args['import-wallet'].trim() === "") {
      console.error("❌ Private key must be provided for import.");
      cli.showHelp();
    } else {
      await cli.importWallet(args['import-wallet']);
    }
  } else if (args['wallet-info']) {
    if (cli.wallet.isInitialized()) {
      console.log("🔑 Current Wallet Info:");
      console.log(\`   Address: ${cli.wallet.getAddress()}\`);
      console.log(\`   Public Key: ${cli.wallet.getPublicKey()}\`);
    } else {
      console.log("❌ No wallet loaded. Use --create-wallet or --import-wallet.");
    }
  } else if (args['create-triad']) {
    if (typeof args['create-triad'] !== 'string') {
      console.error("❌ Data for triad must be a string.");
      cli.showHelp();
    } else {
      await cli.createTriad(args['create-triad']);
    }
  } else if (args['get-triad']) {
    await cli.getTriadDetails(args['get-triad']);
  } else if (args.status) {
    await cli.getStatus();
  } else if (args.list) {
    const limit = args.limit && Number.isInteger(parseInt(args.limit)) ? parseInt(args.limit) : 10;
    await cli.listTriads(limit);
  } else if (args['mine']) {
    await cli.mine();
  }

  if (cli.matrix) {
    await cli.matrix.closeDB().catch(err => console.warn("Warning: Error closing DB on exit:", err.message));
  }
}

main().catch(err => {
  console.error('❌ Unhandled error in CLI:', err.message);
  if (process.env.DEBUG === 'true' || process.env.VERBOSE_LOGGING === 'true') {
    console.error(err.stack);
  }
  process.exit(1);
});
EOF
    chmod +x src/cli/seirchain-cli.js
    log_success "CLI interface files created."
}

# create_api_files: Creates the server.js file for the API.
create_api_files() {
    log_step "Creating API server files (server.js)..."
    # Use a heredoc to write the API server script content
    cat << 'EOF' > src/api/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const TriadMatrix = require('../core/TriadMatrix');
const Wallet = require('../core/Wallet');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const port = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const rateLimiterPoints = parseInt(process.env.RATE_LIMIT_MAX, 10) || (process.env.NODE_ENV === 'production' ? 50 : 100);
const rateLimiterDuration = parseInt(process.env.RATE_LIMIT_WINDOW, 10) / 1000 || (process.env.NODE_ENV === 'production' ? 15 * 60 : 15 * 60);

const rateLimiter = new RateLimiterMemory({
  points: rateLimiterPoints,
  duration: rateLimiterDuration,
});

app.use((req, res, next) => {
  rateLimiter.consume(req.ip)
    .then(() => {
      next();
    })
    .catch(_ => {
      res.status(429).send('Too Many Requests');
    });
});

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'triad.db');
const matrix = new TriadMatrix(dbPath, {
  dimensions: parseInt(process.env.MATRIX_DIMENSIONS, 10) || 3,
  complexity: parseInt(process.env.TRIAD_COMPLEXITY, 10) || 4,
  consensusThreshold: parseFloat(process.env.CONSENSUS_THRESHOLD) || 0.67,
});

matrix.on('initialized', (state) => {
    console.log(\`✅ TriadMatrix API ready. DB: ${dbPath}\`);
});
matrix.on('error', (err) => {
    console.error('❌ TriadMatrix API initialization error:', err.message);
});

app.get('/', (req, res) => {
    res.json({
        message: "SeirChain TriadMatrix API",
        status: matrix.isInitialized ? "operational" : "initializing",
        timestamp: new Date().toISOString()
    });
});

app.get('/status', (req, res) => {
  if (!matrix.isInitialized) {
    return res.status(503).json({ error: "TriadMatrix is not yet initialized." });
  }
  res.json(matrix.getMatrixState());
});

app.get('/triads/:id', async (req, res) => {
  if (!matrix.isInitialized) {
    return res.status(503).json({ error: "TriadMatrix is not yet initialized." });
  }
  try {
    const triad = await matrix.getTriad(req.params.id);
    if (triad) {
      res.json(triad);
    } else {
      res.status(404).json({ error: 'Triad not found' });
    }
  } catch (error) {
    console.error(\`API Error GET /triads/${req.params.id}:\`, error);
    res.status(500).json({ error: 'Failed to retrieve triad' });
  }
});

app.post('/triads', async (req, res) => {
  if (!matrix.isInitialized) {
    return res.status(503).json({ error: "TriadMatrix is not yet initialized." });
  }
  const { data, validatorId } = req.body;

  if (!data || !validatorId) {
    return res.status(400).json({ error: 'Missing data or validatorId in request body' });
  }

  try {
    const newTriad = await matrix.createTriad(data, validatorId);
    res.status(201).json(newTriad);
  } catch (error) {
    console.error('API Error POST /triads:', error);
    res.status(500).json({ error: \`Failed to create triad: ${error.message}\` });
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled API Error:", err.stack);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

let server;
if (require.main === module) {
    server = app.listen(port, () => {
        console.log(\`⚡️ SeirChain API server listening on port ${port}\`);
        if (process.env.NODE_ENV === 'production') {
            console.warn("🔒 API running in PRODUCTION mode.");
            if(process.env.SSL_ENABLED === 'true') {
                console.log("   HTTPS should be enabled (e.g., via reverse proxy like Nginx/Caddy or direct SSL config).");
            } else {
                console.warn("   WARNING: SSL_ENABLED is false. HTTPS is highly recommended for production.");
            }
        } else {
            console.log("   Running in DEVELOPMENT mode.");
        }
    });
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server and DB');
  await matrix.closeDB();
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server and DB');
  if (matrix) await matrix.closeDB();
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

module.exports = app;
EOF
    log_success "API server files created."
}

# create_network_files: Creates the P2PNode.js file for the peer-to-peer network.
create_network_files() {
    log_step "Creating P2P network files (P2PNode.js)..."
    # Use a heredoc to write the P2P node script content
    cat << 'EOF' > src/network/P2PNode.js
const WebSocket = require('ws');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

const MESSAGE_TYPES = {
  HANDSHAKE: 'HANDSHAKE',
  DISCOVERY: 'DISCOVERY',
  PEERS: 'PEERS',
  NEW_TRIAD: 'NEW_TRIAD',
  VALIDATE_TRIAD: 'VALIDATE_TRIAD',
  TRIAD_VALIDATED: 'TRIAD_VALIDATED_CONFIRMATION',
  GET_STATUS: 'GET_STATUS',
  STATUS_UPDATE: 'STATUS_UPDATE',
  ERROR: 'ERROR'
};

class P2PNode extends EventEmitter {
  constructor(port, triadMatrix, initialPeers = []) {
    super();
    this.nodeId = uuidv4();
    this.port = port;
    this.triadMatrix = triadMatrix;
    this.peers = new Map();
    this.maxPeers = parseInt(process.env.MAX_PEERS, 10) || 10;
    this.networkId = process.env.NETWORK_ID || 'seirchain-default';

    this.server = new WebSocket.Server({ port, clientTracking: true });
    console.log(\`🅿️  P2P Node listening on ws://localhost:${this.port} (Node ID: ${this.nodeId})\`);

    this.server.on('connection', (ws, req) => this.handleNewConnection(ws, req));
    this.server.on('error', (error) => {
      console.error(\`[P2P] Server error:\`, error);
      this.emit('error', error);
    });

    this.connectToInitialPeers(initialPeers);

    if (this.triadMatrix) {
        this.triadMatrix.on('triadCreated', (triad) => {
            this.broadcast({ type: MESSAGE_TYPES.NEW_TRIAD, payload: triad });
        });
        this.triadMatrix.on('triadValidated', (triad) => {
            this.broadcast({ type: MESSAGE_TYPES.TRIAD_VALIDATED, payload: triad });
        });
    }

    setInterval(() => {
        if (this.peers.size < this.maxPeers / 2) {
            this.broadcast({ type: MESSAGE_TYPES.DISCOVERY, payload: { nodeId: this.nodeId, address: \`ws://<YOUR_PUBLIC_IP_OR_DOMAIN>:${this.port}\` } });
        }
    }, 60000);
  }

  handleNewConnection(ws, req) {
    const peerIp = req.socket.remoteAddress;

    if (this.peers.size >= this.maxPeers) {
        console.warn(\`[P2P] Max peers reached. Rejecting new connection from ${peerIp}\`);
        ws.terminate();
        return;
    }
    const peerId = uuidv4();
    console.log(\`[P2P] 🔗 New peer connected: ${peerIp} (assigned ID: ${peerId})\`);
    this.addPeer(ws, peerId, 'incoming');

    this.sendMessage(ws, { type: MESSAGE_TYPES.HANDSHAKE,
        payload: {
            nodeId: this.nodeId,
            networkId: this.networkId,
            timestamp: Date.now()
        }
    });

    ws.on('message', (messageBuffer) => {
      try {
        const message = JSON.parse(messageBuffer.toString());
        this.handleMessage(ws, message, peerId);
      } catch (error) {
        console.error(\`[P2P] Error processing message from ${peerId}: ${error.message}. Message: ${messageBuffer.toString()}\`);
        this.sendMessage(ws, { type: MESSAGE_TYPES.ERROR, payload: { message: 'Invalid message format' } });
      }
    });

    ws.on('close', () => {
      console.log(\`[P2P] 🔌 Peer disconnected: ${peerIp} (ID: ${peerId})\`);
      this.removePeer(peerId);
    });

    ws.on('error', (error) => {
      console.error(\`[P2P] Error with peer ${peerIp} (ID: ${peerId}):\`, error);
      this.removePeer(peerId);
 });
  }

  connectToPeer(peerAddress) {
    if (this.peers.size >= this.maxPeers) {
        console.log("[P2P] Max peers reached. Cannot connect to new peer:", peerAddress);
        return;
    }

    for (const peer of this.peers.values()) {
        if (peer.url === peerAddress) {
            console.log(\`[P2P] Already connected or attempting to connect to ${peerAddress}\`);
            return;
        }
    }

    console.log(\`[P2P] 🚀 Attempting to connect to peer: ${peerAddress}\`);
    const ws = new WebSocket(peerAddress, { handshakeTimeout: 5000 });
    const tempId = \`outgoing-${uuidv4()}\`;

    ws.on('open', () => {
      const peerId = this.addPeer(ws, tempId, 'outgoing', peerAddress);
      console.log(\`[P2P] ✅ Successfully connected to peer: ${peerAddress} (as ID: ${peerId})\`);
      this.sendMessage(ws, { type: MESSAGE_TYPES.HANDSHAKE,
        payload: {
            nodeId: this.nodeId,
            networkId: this.networkId,
            address: \`ws://<YOUR_PUBLIC_IP_OR_DOMAIN>:${this.port}\`,
            timestamp: Date.now()
        }
      });
      this.sendMessage(ws, { type: MESSAGE_TYPES.DISCOVERY });
    });

    ws.on('message', (messageBuffer) => {
        try {
            const message = JSON.parse(messageBuffer.toString());
            this.handleMessage(ws, message, this.findPeerIdByWs(ws) || tempId);
        } catch (error) {
            console.error(\`[P2P] Error processing message from ${peerAddress}: ${error.message}\`);
        }
    });

    ws.on('close', (code, reason) => {
      console.log(\`[P2P] 🔌 Connection to ${peerAddress} closed. Code: ${code}, Reason: ${reason.toString()}\`);
      this.removePeer(this.findPeerIdByWs(ws) || tempId);
    });

    ws.on('error', (error) => {
      console.error(\`[P2P] ❌ Error connecting to peer ${peerAddress}: ${error.message}\`);
      this.removePeer(this.findPeerIdByWs(ws) || tempId);
    });
  }

  addPeer(ws, peerId, direction, url = null) {
    this.peers.set(peerId, { ws, id: peerId, direction, url, connectedAt: Date.now() });
    this.emit('peerConnected', { peerId, direction, url });
    return peerId;
  }

  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
        if (peer.ws.readyState === WebSocket.OPEN || peer.ws.readyState === WebSocket.CONNECTING) {
            peer.ws.terminate();
        }
        this.peers.delete(peerId);
        this.emit('peerDisconnected', { peerId });
    }
  }

  findPeerIdByWs(wsInstance) {
    for (const [id, peer] of this.peers.entries()) {
        if (peer.ws === wsInstance) {
            return id;
        }
    }
    return null;
  }

  handleMessage(ws, message, peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) {
        ws.terminate();
        return;
    }

    switch (message.type) {
      case MESSAGE_TYPES.HANDSHAKE:
        if (message.payload.networkId !== this.networkId) {
            this.sendMessage(ws, { type: MESSAGE_TYPES.ERROR, payload: { message: 'Network ID mismatch' } });
            this.removePeer(peerId);
            return;
        }
        peer.nodeId = message.payload.nodeId;
        peer.address = message.payload.address;
        this.sendMessage(ws, { type: MESSAGE_TYPES.PEERS, payload: this.getPeerAddresses() });
        break;

      case MESSAGE_TYPES.DISCOVERY:
        this.sendMessage(ws, { type: MESSAGE_TYPES.PEERS, payload: this.getPeerAddresses() });
        break;

      case MESSAGE_TYPES.PEERS:
        message.payload.forEach(peerAddr => {
          if (peerAddr && !this.isSelf(peerAddr) && !this.isConnectedTo(peerAddr)) {
            this.connectToPeer(peerAddr);
          }
        });
        break;

      case MESSAGE_TYPES.NEW_TRIAD:
        if (this.triadMatrix) {
            this.triadMatrix.getTriad(message.payload.id).then(existing => {
                if (!existing) {
                    this.triadMatrix.createTriad(message.payload.data, message.payload.validator)
                        .catch(err => console.error(\`[P2P] Error creating triad from network: ${err.message}\`));
                }
            });
            this.broadcast(message, peerId);
        }
        break;

      case MESSAGE_TYPES.VALIDATE_TRIAD:
        if (this.triadMatrix && message.payload && message.payload.triadId && message.payload.validatorId) {
            this.triadMatrix.validateTriad(message.payload.triadId, message.payload.validatorId)
                .catch(err => console.error(\`[P2P] Error validating triad from network request: ${err.message}\`));
        }
        break;

      case MESSAGE_TYPES.TRIAD_VALIDATED:
        if (this.triadMatrix && message.payload && message.payload.id) {
            this.triadMatrix.getTriad(message.payload.id).then(localTriad => {
                if (localTriad && !localTriad.validated && message.payload.validated) {
                    Object.assign(localTriad, message.payload);
                    this.triadMatrix.db.put(\`triad:${localTriad.id}\`, localTriad)
                        .catch(err => console.error(\`[P2P] Error saving updated triad from network: ${err.message}\`));
                }
            });
            this.broadcast(message, peerId);
        }
        break;

      case MESSAGE_TYPES.GET_STATUS:
        if (this.triadMatrix) {
            this.sendMessage(ws, { type: MESSAGE_TYPES.STATUS_UPDATE, payload: this.triadMatrix.getMatrixState() });
        }
        break;

      case MESSAGE_TYPES.ERROR:
        console.warn(\`[P2P] Received error message from peer ${peerId}: ${message.payload.message}\`);
        break;

      default:
        this.sendMessage(ws, { type: MESSAGE_TYPES.ERROR, payload: { message: \`Unknown message type: ${message.type}\` } });
    }
  }

  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(\`[P2P] Error sending message: ${error.message}\`, message);
      }
    }
  }

  broadcast(message, originatorPeerId = null) {
    this.peers.forEach((peer, peerId) => {
      if (peerId !== originatorPeerId) {
        this.sendMessage(peer.ws, message);
      }
    });
  }

  connectToInitialPeers(peerAddresses) {
    if (Array.isArray(peerAddresses) && peerAddresses.length > 0) {
        peerAddresses.forEach(addr => this.connectToPeer(addr));
    }
  }

  getPeerAddresses() {
    const addresses = [];
    this.peers.forEach(peer => {
        if (peer.address && peer.nodeId) {
            addresses.push(peer.address);
        }
    });
    return [...new Set(addresses)];
  }

  isSelf(peerAddress) {
    const selfPattern1 = new RegExp(\`ws://(localhost|127\\.0\\.0\\.1):${this.port}\`);
    if (selfPattern1.test(peerAddress)) return true;

    const advertisedSelf = process.env.P2P_ADVERTISED_ADDRESS;
    if (advertisedSelf && peerAddress === advertisedSelf) return true;

    return false;
  }

  isConnectedTo(peerAddress) {
    for (const peer of this.peers.values()) {
        if (peer.url === peerAddress || peer.address === peerAddress) {
            return true;
        }
    }
    return false;
  }

  async close() {
    console.log('[P2P] Closing P2P node...');
    this.server.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.terminate();
        }
    });
    this.server.close(() => {
        console.log('[P2P] Server closed.');
    });
    this.peers.forEach(peer => {
        if (peer.ws.readyState === WebSocket.OPEN) {
            peer.ws.terminate();
        }
    });
    this.peers.clear();
  }
}

if (require.main === module) {
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

    const port = parseInt(process.env.P2P_PORT, 10) || 6001;
    const initialPeersEnv = process.env.P2P_INITIAL_PEERS;
    const initialPeers = initialPeersEnv ? initialPeersEnv.split(',').map(s => s.trim()).filter(Boolean) : [];

    const p2pNode = new P2PNode(port, new EventEmitter(), initialPeers);

    process.on('SIGINT', async () => {
        console.log("Shutting down P2P node...");
        await p2pNode.close();
        process.exit(0);
    });
}

module.exports = P2PNode;
EOF
    log_success "P2P network files created."
}

# create_onboarding_script: Creates the onboard.js script for node onboarding.
create_onboarding_script() {
    log_step "Creating node onboarding script (scripts/onboard.js)..."
    # Use a heredoc to write the onboarding script content
    cat << 'EOF' > scripts/onboard.js
const Wallet = require('../src/core/Wallet');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const WALLET_BACKUP_DIR = path.resolve(__dirname, '../data/onboarded-wallets');
if (!fs.existsSync(WALLET_BACKUP_DIR)){
    fs.mkdirSync(WALLET_BACKUP_DIR, { recursive: true });
}

async function onboardNode(isFounder = false, emailRecipient) {
  const wallet = new Wallet();
  const { privateKey, publicKey, address } = wallet.generateKeyPair();

  console.log('\n🌟 New Node Onboarding Process Initiated 🌟');
  console.log('------------------------------------------');
  console.log(\`🔑 Wallet Address: ${address}\`);
  console.log(\`📢 Public Key: ${publicKey}\`);
  console.log(\`🔒 Private Key: ${privateKey}  <--- CRITICAL: STORE THIS SECURELY AND OFFLINE!\`);
  console.log(\`⭐ Node Type: ${isFounder ? 'Founder Node' : 'Regular Node'}\`);
  console.log('------------------------------------------');

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const walletBackupFile = path.join(WALLET_BACKUP_DIR, \`wallet-${address.slice(0,10)}-${timestamp}.json\`);
  const walletDetails = {
    address,
    publicKey,
    privateKey,
    nodeType: isFounder ? 'Founder' : 'Regular',
    onboardedAt: new Date().toISOString()
  };

  try {
    fs.writeFileSync(walletBackupFile, JSON.stringify(walletDetails, null, 2));
    console.log(\`\n📄 Wallet details (including private key) backed up to: ${walletBackupFile}\`);
    console.warn("   🚨 SECURITY WARNING: This backup file contains your private key. Move it to a secure, offline location immediately and then delete it from here if desired.");
  } catch (error) {
    console.error(\`❌ Failed to write wallet backup file: ${error.message}\`);
  }

  if (process.env.EMAIL_ENABLED === 'true' && emailRecipient) {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn("\\n📧 Email sending is enabled, but email configuration is incomplete in .env. Skipping email notification.");
        return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10) || 587,
      secure: (parseInt(process.env.EMAIL_PORT, 10) === 465),
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    });

    const mailOptions = {
      from: \`"SeirChain Onboarding" <${process.env.EMAIL_USER}>\`,
      to: emailRecipient,
      subject: \`✅ SeirChain Node Onboarding Successful - ${isFounder ? 'Founder' : 'Regular'} Node\`,
      html: \`
        <h1>Welcome to the SeirChain Network!</h1>
        <p>Your new ${isFounder ? '<strong>Founder</strong>' : 'Regular'} Node has been successfully configured.</p>
        <hr>
        <h2>Node Details:</h2>
        <ul>
          <li><strong>Address:</strong> <code>${address}</code></li>
          <li><strong>Public Key:</strong> <code>${publicKey}</code></li>
          <li><strong>Node Type:</strong> ${isFounder ? 'Founder' : 'Regular'}</li>
        </ul>
        <hr>
        <p style="color: red; font-weight: bold;">
          🔴 IMPORTANT SECURITY NOTICE 🔴
        </p>
        <p>
          Your private key has been generated: <code>${privateKey}</code>
        </p>
        <p>
          <strong>DO NOT SHARE YOUR PRIVATE KEY WITH ANYONE.</strong> Store it in a secure, offline location.
          The security of your node and any associated assets depends on keeping your private key confidential.
          A backup of these details (including the private key) was also attempted to be saved at:
          <code>${walletBackupFile.replace(/\\\\/g, '/')}</code> on the machine where this script was run.
          Please ensure this file is secured or properly disposed of after backing up the key.
        </p>
        <hr>
        <h2>Next Steps:</h2>
        <ol>
          <li>Securely back up your private key.</li>
          <li>Consult the SeirChain documentation in the <code>docs/onboarding</code> directory for guidance on node operation and network participation.</li>
          <li>If this is a validator node, ensure it's properly configured to connect to the network and begin its duties.</li>
        </ol>
        <p>If you have any questions, please refer to the SeirChain community channels or documentation.</p>
        <br>
        <p><em>The SeirChain Team</em></p>
      \`
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(\`\n📧 Onboarding confirmation email sent to ${emailRecipient}.\`);
    } catch (error) {
      console.error(\`\n❌ Failed to send onboarding email: ${error.message}\`);
    }
  } else if (emailRecipient) {
     console.warn("\\n📧 Email recipient provided, but email sending is not enabled in .env (EMAIL_ENABLED=false). Skipping email notification.");
  }

  console.log('\n✅ Node onboarding process complete. Remember to secure your private key!');
}

// --- Script Execution ---
const args = require('minimist')(process.argv.slice(2));

const isFounderNode = args.founder || args.f || false;
const recipientEmail = args.email || args.e || process.env.ONBOARDING_DEFAULT_EMAIL;

if (args.help || args.h) {
    console.log(\`
SeirChain Node Onboarding Script

This script generates a new wallet (address, public key, private key) for a SeirChain node
and optionally sends an email with the details.

Usage:
  node scripts/onboard.js [options]

Options:
  --founder, -f         Configure as a Founder Node. (Default: Regular Node)
  --email <address>, -e <address>
                        Email address to send onboarding details to.
                        Requires EMAIL_ENABLED=true and email server configured in .env.
                        If not provided, checks ONBOARDING_DEFAULT_EMAIL in .env.
  --help, -h            Show this help message.

Example:
  node scripts/onboard.js --founder --email newvalidator@example.com
  node scripts/onboard.js -e admin@example.com

Security:
  - The generated private key will be displayed on the console and saved to a local file.
  - SECURE THE PRIVATE KEY IMMEDIATELY. It is critical for node operation and security.
    \`);
    process.exit(0);
}

onboardNode(isFounderNode, recipientEmail)
  .catch(error => {
    console.error("\\n❌ An error occurred during the onboarding process:", error.message);
    process.exit(1);
  });
EOF
    log_success "Node onboarding script created."
}

# create_gitignore: Creates the .gitignore file to specify intentionally untracked files.
create_gitignore() {
    log_step "Creating .gitignore file..."
    # Use a heredoc to write the .gitignore content
    cat << EOF > .gitignore
# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
package-lock.json
# yarn.lock

# Environment files - CRITICAL: DO NOT COMMIT THESE if they contain secrets
.env
.env.*
!.env.example

# Application Data / Logs
data/
!data/.gitkeep
coverage/
*.log
logs/
!logs/.gitkeep

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE / Editor specific files
.idea/
.vscode/
*.swp
*~
*.sublime-project
*.sublime-workspace

# Build output (if any)
dist/
build/
out/

# Test reports
junit.xml
test-results/

# Other
wallet.dat
*.backup.*
onboarded-wallets/
!onboarded-wallets/.gitkeep
EOF
    log_success ".gitignore file created."
}

# install_dependencies: Installs the project dependencies using npm.
install_dependencies() {
    log_step "Installing Node.js dependencies (npm install)..."
    log_info "This may take a few minutes depending on your internet connection..."
    # Run the npm install command
    if npm install; then
        log_success "Node.js dependencies installed successfully."
    else
        error_exit "Failed to install Node.js dependencies. Check npm output for errors."
    fi
}

# run_tests: Runs the automated tests using npm test.
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        log_warning "Skipping tests as per --skip-tests flag."
        return
    fi
    log_step "Running automated tests (npm test)..."
    # Run the npm test command
    if npm test; then
        log_success "All tests passed successfully."
    else
        log_warning "Some tests failed. Review the output above. Setup will continue, but the application might not be stable."
    fi
}

# show_post_setup_instructions: Displays instructions to the user after the setup is complete.
show_post_setup_instructions() {
    log_info "${GREEN}🎉 SeirChain TriadMatrix setup complete in: $PROJECT_DIR 🎉${NC}"
    echo -e "\n${BOLD}Next Steps:${NC}\n1.  ${BOLD}Navigate to the project directory:${NC}\n    ${CYAN}cd \\"$PROJECT_DIR\\"${NC}\n\n2.  ${BOLD}Review Configuration (IMPORTANT for Production):${NC}\n    Open ${YELLOW}.env.production${NC} and ${RED}REPLACE ALL 'CHANGE_ME_...' placeholders${NC} with strong, unique values.\n    Ensure production paths (e.g., for DB, logs) exist and have correct permissions.\n\n3.  ${BOLD}Wallet Management:${NC}\n    * Create a new wallet (CLI will guide saving it):\n        ${CYAN}npm run cli -- --create-wallet${NC}\n    * Or import an existing wallet:\n        ${CYAN}npm run cli -- --import-wallet YOUR_PRIVATE_KEY_HEX_HERE${NC}\n    * View wallet info:\n        ${CYAN}npm run cli -- --wallet-info${NC}\n\n4.  ${BOLD}Core Operations (using CLI):${NC}\n    * Check TriadMatrix status:\n        ${CYAN}npm run status${NC}\n    * Create a new triad (ensure wallet is loaded/created):\n        ${CYAN}npm run cli -- --create-triad '{\\"message\\":\\"Hello TriadMatrix!\\"}'${NC}\n    * List triads:\n        ${CYAN}npm run list${NC}\n    * Start mining/validation (ensure wallet is loaded/created):\n        ${CYAN}npm run mine${NC}\n\n5.  ${BOLD}Running Services:${NC}\n    * Start the API server (development):\n        ${CYAN}npm run dev${NC} (uses nodemon for auto-restarts)\n    * Start the API server (production build - if you add one):\n        ${CYAN}npm start${NC}\n    * Start the P2P network node:\n        ${CYAN}npm run network${NC} (configure P2P_INITIAL_PEERS in .env)\n\n6.  ${BOLD}Node Onboarding (for new participants):${NC}\n    ${CYAN}npm run onboard${NC}\n    ${CYAN}npm run onboard -- --founder --email your_email@example.com${NC}\n\n7.  ${BOLD}Explore Documentation:${NC}\n    Check the ${YELLOW}docs/${NC} directory for detailed information on architecture, API, and deployment.\n\n${BOLD}Production Deployment Note:${NC}\nFor actual production, use a process manager (like PM2, systemd) to run the API and P2P Node services robustly.\nExample with PM2 (install PM2 first: npm install pm2 -g):\n    ${CYAN}pm2 start npm --name \\"seirchain-api\\" -- run start${NC}\n    ${CYAN}pm2 start npm --name \\"seirchain-p2p\\" -- run network${NC}\n    ${CYAN}pm2 save${NC}\n    ${CYAN}pm2 startup${NC}\n"\n}

# --- Main Setup Orchestration ---
# main: Main function to orchestrate the entire setup process.
main() {
    parse_args "$@"

    log_info "Starting SeirChain TriadMatrix Setup Script (v2.2)..."
    log_info "Project Directory: $PROJECT_DIR"
    [[ "$VERBOSE" == true ]] && log_info "Verbose mode enabled."
    [[ "$SKIP_TESTS" == true ]] && log_info "Skipping tests."
    [[ "$AUTO_START" == true ]] && log_info "Auto-start enabled."
    [[ "$ASSUME_YES" == true ]] && log_info "Non-interactive mode enabled."

    check_system_requirements
    check_permissions
    backup_existing
    create_project_structure
    create_package_json
    create_environment_config
    create_jest_config
    create_core_files
    create_cli_files
    create_api_files
    create_network_files
    create_onboarding_script
    create_gitignore
    install_dependencies
    run_tests

    if [[ "$AUTO_START" == true ]]; then
        log_step "Attempting to auto-start services (API and P2P Node)..."
        log_info "Starting API server in the background..."
        (npm run api &> "$PROJECT_DIR/data/logs/api-auto-start.log" &)
        API_PID=$!
        log_info "API server process started with PID: $API_PID (logs: data/logs/api-auto-start.log)"

        log_info "Starting P2P Node in the background..."
        (npm run network &> "$PROJECT_DIR/data/logs/p2p-auto-start.log" &)
        P2P_PID=$!
        log_info "P2P Node process started with PID: $P2P_PID (logs: data/logs/p2p-auto-start.log)"
        log_warning "For production, manage these services with a process manager like PM2 or systemd."
    fi

    show_post_setup_instructions
    log_success "SeirChain TriadMatrix setup has completed!"
    log_info "Please review all output, especially any WARNINGS or Next Steps."
}

# --- Script Entry Point ---
# Call the main function with any command-line arguments passed to the script.
main "$@"

