```
╔═══════════════════════════════════════════════════════════════╗
║                  🦌⚡ LYNX BALANCER AGENT                      ║
║           Autonomous Treasury Rebalancing Agent               ║
╚═══════════════════════════════════════════════════════════════╝
```

**Autonomous Treasury Rebalancing Agent** - Automatically maintains tokenized index fund treasury balances on Hedera blockchain by monitoring contract ratios and executing transfers when needed.

**🤝 Works with:** [Lynx Governance Agent V2](https://github.com/0xPrimordia/lynx-governance-agentv2) - The companion governance agent that manages portfolio parameters and triggers rebalancing operations.

## 🎯 Overview

The Lynx Balancer Agent automatically rebalances treasury portfolios by:
1. **Fetching real-time data** from Hedera blockchain contracts
2. **Calculating required balances** based on governance-set ratios
3. **Executing transfers** when balances deviate from targets
4. **Providing complete transparency** of all operations

### Key Features

- ✅ **Real-time Monitoring**: Continuously checks contract balances against target ratios
- ✅ **Automatic Transfers**: Executes HBAR and token transfers to maintain balance
- ✅ **Precise Calculations**: Uses mathematical formulas to determine exact transfer amounts
- ✅ **Tolerance Checking**: Only rebalances when deviation exceeds 5% threshold
- ✅ **Complete Logging**: Detailed audit trail of all decisions and actions
- ✅ **Flexible Units**: Supports both decimal and raw token unit transfers
- ✅ **Dashboard Integration**: Sends notifications when rebalancing completes

## 📋 **How It Works**

The agent follows this process for each token in the portfolio:

```
🔍 Starting treasury validation...
🔄 Fetching contract state and ratios...
✅ Contract ratios: { HBAR: 50, WBTC: 3, SAUCE: 7, USDC: 20, JAM: 10, HEADSTART: 10 }
✅ LYNX total supply: 40 tokens
✅ Current balances: HBAR=162, WBTC=95.06, SAUCE=12.8, USDC=95.2, JAM=21, HEADSTART=2.114

🔍 Processing HBAR...
📊 HBAR Analysis: Current=162, Required=200.00, Diff=19.0% (REBALANCE NEEDED)
⚖️ HBAR needs rebalancing - executing transfer...
🪙 Transferring 38 units of HBAR to contract...
✅ HBAR Transfer: Successfully transferred 38 HBAR to governance contract

🔍 Processing WBTC...
📊 WBTC Analysis: Current=95.06, Required=12.00, Diff=692.2% (REBALANCE NEEDED)
⚖️ WBTC needs rebalancing - executing transfer...
🪙 Withdrawing 83.06 WBTC from contract...
✅ WBTC Transfer: Successfully withdrawn 83.06 WBTC from governance contract

✅ Sequential token processing completed
🔄 Refreshing contract state after transfers...
📊 Updated State Summary: [Fresh contract state after transfers]
📡 Sending rebalancing notification to dashboard...
✅ Dashboard notification sent successfully
```

**Balance Calculation Formula**: `Required Balance = (LYNX Supply × Target Ratio) ÷ 10`

## 🚀 Quick Start

### Prerequisites

1. **Node.js 20+** installed
2. **Hedera Testnet Account** with HBAR balance
3. **OpenAI API Key** for agent functionality
4. **[Lynx Governance Agent V2](https://github.com/0xPrimordia/lynx-governance-agentv2)** - Optional for automated governance integration

### Installation

```bash
# Clone and install dependencies
npm install

# Copy and configure environment
cp env.example .env
# Edit .env with your credentials
```

### Environment Configuration

Configure your `.env` file with the following sections:

```env
# Hedera Network Configuration
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID
HEDERA_PRIVATE_KEY=YOUR_ED25519_DER_PRIVATE_KEY_HERE

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Treasury Configuration
LYNX_CONTRACT_ID=0.0.6216949
CONTRACT_SAUCE_TOKEN=0.0.1183558
CONTRACT_LYNX_TOKEN=0.0.6200902
CONTRACT_WBTC_TOKEN=0.0.6212930
CONTRACT_USDC_TOKEN=0.0.6212931
CONTRACT_JAM_TOKEN=0.0.6212932
CONTRACT_HEADSTART_TOKEN=0.0.6212933
TREASURY_ACCOUNT_ID=0.0.4340026
```

## 🔗 Integration with Governance Agent

The Lynx Balancer Agent works seamlessly with the **[Lynx Governance Agent V2](https://github.com/0xPrimordia/lynx-governance-agentv2)** to provide complete decentralized portfolio management:

- **Governance Agent**: Manages governance parameters, voting, and ratio updates
- **Balancer Agent**: Executes portfolio rebalancing based on current contract ratios

The balancer agent can operate independently by monitoring contract ratios directly, or integrate with governance alerts for immediate rebalancing when parameters change.

## 🛠️ Usage

### 🎯 **Basic Treasury Rebalancing**

Start the agent for automatic treasury management:

```bash
# Build and start the agent
npm run build
npm start

# Or use development mode
npm run dev
```

The agent will:
1. **Fetch live data** from your governance contract and token supplies
2. **Calculate required balances** using the formula: `Required = (LYNX Supply × Ratio) ÷ 10`
3. **Check 5% tolerance** for each token 
4. **Execute transfers** automatically for out-of-balance tokens
5. **Report everything** with complete transparency

### 🔄 **Agent Operation**

The agent provides complete transparency in its operations:

```bash
# The agent shows exactly what it's doing:
🔍 Validating treasury ratios...
✅ Contract ratios retrieved: { HBAR: '40', SAUCE: '25', ... }
✅ Token supply retrieved: 38 (3800000000 raw units, 8 decimals)
📄 Agent Response: [Complete step-by-step analysis]
```

### 🔧 **Testing & Validation**

Test the agent's rebalancing functionality:

```bash
# Test rebalancing logic
npm run test:balancing

# Send test alert (if using with governance agent)
npm run test:alert
```

The agent will show detailed step-by-step calculations and execute any necessary transfers to maintain the target portfolio ratios.

## 🔧 Development

### Available Scripts

```bash
# Core functionality
npm run dev                    # Development mode with hot reload
npm run build                  # Build TypeScript
npm run start                  # Production mode

# Testing and validation
npm run test:balancing         # Test rebalancing logic
npm run test:alert             # Send test alert
npm run clean                  # Clean build directory
npm run type-check             # TypeScript type checking
npm run lint                   # ESLint code checking
npm run lint:fix               # Fix ESLint issues
```

### Agent Architecture

The Lynx Balancer Agent uses a modular architecture for reliable treasury management:

- **Hedera Agent Kit V3**: Direct blockchain tool integration
- **LangChain Agent Framework**: Intelligent reasoning and tool calling
- **GPT-4o-mini**: Cost-efficient AI processing
- **TypeScript**: Type-safe development

Key components:
- **LynxBalancerAgent**: Main agent class with sequential token processing
- **ContractStateManager**: Centralized blockchain data fetching and parsing
- **TokenRatioTool**: Precise mathematical analysis for balance calculations
- **TokenTransferTool**: Flexible transfer execution supporting decimal/raw units
- **Balance Verifier**: Independent utility for debugging and validation

## 🔐 Security & Best Practices

### Environment Security
- **Private Key Protection**: Never commit private keys to version control
- **Environment Variables**: Use `.env` files for all sensitive configuration
- **Operator Account**: Use dedicated accounts with minimal required permissions

### Transaction Safety
- **Validation**: All environment variables are validated before agent initialization
- **Error Handling**: Comprehensive error handling with detailed logging
- **Tolerance Checks**: Built-in 5% tolerance to prevent unnecessary micro-adjustments

## 📊 Monitoring & Debugging

### Agent Logs
The agent provides detailed logging for:
- Environment variable validation and initialization
- Contract ratio retrieval and analysis
- Balance calculations and tolerance checks
- Transfer execution and confirmation
- Error handling and recovery

### Common Issues & Troubleshooting

**❌ "Missing required environment variables"**
```bash
✅ Solution: 
1. Copy env.example to .env
2. Fill in all required values (HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, etc.)
3. Ensure private key is in correct ED25519 DER format
```

**❌ "Cannot read properties of undefined (reading 'publicKey')"**
```bash
✅ Solution: 
1. Check that HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY are set
2. Verify private key format is correct ED25519 DER encoding
3. Ensure .env file is in the project root directory
```

**❌ OpenAI Rate Limits**
```bash
✅ Solution: 
1. Wait for rate limits to reset (usually 1-2 minutes)
2. Consider upgrading your OpenAI plan for higher rate limits
3. The agent uses GPT-4o-mini for cost efficiency
```

## 🚀 Deployment

### Production Deployment

1. **Configure Production Environment**
```bash
# Use mainnet for production
HEDERA_NETWORK=mainnet
HEDERA_ACCOUNT_ID=0.0.PRODUCTION_ACCOUNT
HEDERA_PRIVATE_KEY=production_private_key
OPENAI_API_KEY=sk-production-key-here
```

2. **Build and Start**
```bash
npm run build
npm start
```

3. **Monitor Agent Health**
```bash
# Check logs for successful initialization
# Monitor balance validation outputs
# Verify transaction execution in HashScan
```

### Docker Deployment
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

## 🤝 Integration with Lynx Governance Agent V2

The Lynx Balancer Agent is designed to work seamlessly with the **[Lynx Governance Agent V2](https://github.com/0xPrimordia/lynx-governance-agentv2)**:

### Architecture Overview
```
┌─────────────────────────┐    ┌─────────────────────────┐
│   Governance Agent V2   │    │    Balancer Agent       │
│                         │    │                         │
│ • Parameter Management  │    │ • Portfolio Rebalancing │
│ • Voting & Proposals    │    │ • Real-time Monitoring  │
│ • Ratio Updates         │    │ • Transfer Execution    │
└─────────────────────────┘    └─────────────────────────┘
            │                              │
            └──────────── Hedera ──────────┘
                     Contract State
```

### Key Integration Points
- **Shared Contract**: Both agents interact with the same governance contract
- **Real-time Ratios**: Balancer fetches live ratios set by governance agent
- **Autonomous Operation**: Each agent operates independently while staying synchronized

### Example Integration Flow
1. **Governance Agent** updates portfolio ratios via governance contract
2. **Balancer Agent** detects ratio changes during regular monitoring
3. **Automatic Rebalancing** executes transfers to match new target allocations
4. **Complete Transparency** with full audit trail of all operations

## 📚 Documentation

For additional documentation and examples, check the `docs/` directory:
- Implementation details and architecture decisions
- Deployment guides and best practices  
- Integration examples with governance systems

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

For questions and support:
- Review the documentation in the `docs/` directory
- Check the implementation examples in the source code
- Test functionality with `npm run test:balancing`

## 🔗 Related Projects

- **[Lynx Governance Agent V2](https://github.com/0xPrimordia/lynx-governance-agentv2)** - Companion governance agent for parameter management

---

**Built with ❤️ using Hedera Hashgraph, LangChain, and the Hedera Agent Kit V3** 