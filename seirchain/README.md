# SeirChain

An advanced implementation of the TriadMatrix with distributed consensus and tokenomics for building robust decentralized applications.

## Project Overview

SeirChain provides a sophisticated framework for implementing distributed consensus using the TriadMatrix architecture. This project aims to facilitate the development of peer-to-peer applications, enhancing reliability, scalability, and performance. Its design is inspired by cutting-edge distributed system practices and incorporates a tokenomics system with mining rewards.

## Documentation

Comprehensive documentation is available in the [docs](docs) directory:

- [Complete Documentation](docs/README.md)
- [Mining System](docs/mining/README.md)
- [Tokenomics System](docs/tokenomics/README.md)
- [TriadMatrix Technical Guide](docs/triad-matrix/README.md)

## Features

- **Distributed Consensus**: Implements a novel consensus mechanism based on the TriadMatrix.
- **Tokenomics System**: Built-in WAC (Wacłaium) token with mining rewards and validation incentives.
- **Mining System**: Advanced mining capabilities with real-time statistics and continuous validation.
- **Peer-to-Peer Networking**: Facilitates seamless communication between decentralized nodes.
- **Built-in API**: Allows easy interaction with the system via HTTP.
- **CLI Tools**: Comprehensive command-line tools for managing and monitoring the system.

## Quick Start

### Prerequisites
- Node.js >= 14.18.0
- NPM >= 6.0.0

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/littlekickoffkittie/seirchain.git
   cd seirchain
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a wallet:
   ```bash
   npm run cli -- --create-wallet
   ```

4. Start mining:
   ```bash
   npm run mine
   ```

### Basic Commands

```bash
# Check wallet information
npm run cli -- --wallet-info

# View token balance
npm run cli -- --token-info

# Create a triad
npm run cli -- --create-triad '{"data":"example"}'

# Check system status
npm run cli -- --status
```

## Development

### Available Scripts

- **start**: Run the server in production mode
- **dev**: Run the server with hot reloading
- **test**: Run all tests
- **mine**: Start the mining process
- **cli**: Access command-line interface
- **lint**: Check code for issues
- **format**: Format code with Prettier

### Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:matrix
npm run test:integration
```

## Project Structure

```
seirchain/
├── docs/               # Comprehensive documentation
├── src/               # Source code
│   ├── api/           # API server
│   ├── cli/           # Command-line tools
│   ├── core/          # Core components
│   └── network/       # P2P networking
├── tests/             # Test suites
└── tools/             # Utility tools
```

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](docs/CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

Need help? Check our [documentation](docs) or open an issue on GitHub.

## Changelog

### v1.0.0 - Initial Release
- Core TriadMatrix implementation
- Distributed consensus mechanism
- Tokenomics and mining system
- CLI tools and API server
