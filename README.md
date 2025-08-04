```
╔═══════════════════════════════════════════════════════════════╗
║                  🦌⚡ LYNX BALANCER AGENT                      ║
║           Autonomous Treasury Rebalancing Agent               ║
╚═══════════════════════════════════════════════════════════════╝
```

**Pure Agent-Driven Treasury Rebalancing** - An intelligent AI agent that autonomously manages tokenized index fund treasuries using Hedera blockchain tools with complete transparency and step-by-step decision-making.

**🤝 Works with:** [Lynx Governance Agent V2](https://github.com/0xPrimordia/lynx-governance-agentv2) - The companion governance agent that manages portfolio parameters and triggers rebalancing operations.

## 🎯 Overview

The Lynx Balancer Agent takes a **pure agentic approach** to treasury management - no complex parsing, no rigid JSON structures, just intelligent reasoning. The agent fetches real blockchain data, performs calculations transparently, and executes rebalancing operations with full visibility into its decision-making process.

### 🚀 **Pure Agent Approach - What Makes This Special**

Instead of traditional rule-based systems, this agent:
- **🧠 Reasons through problems** like a human treasury manager
- **📊 Shows its work step-by-step** with detailed calculations  
- **🔍 Fetches real-time data** directly from blockchain tools
- **⚖️ Makes intelligent decisions** based on current vs target ratios
- **💬 Explains everything** in plain English with full transparency

### Key Features

- ✅ **Transparent Calculations**: See every step of the agent's math and reasoning
- ✅ **Pure Agent Intelligence**: No parsing or rigid structures - agent handles everything
- ✅ **Real-time Data**: Fetches live contract ratios and token supplies from blockchain
- ✅ **Cost-Efficient**: Uses GPT-4o-mini for production-ready economics  
- ✅ **Step-by-Step Reporting**: Complete visibility into balance checks and transfers
- ✅ **Simple Deployment**: Straightforward setup with minimal configuration
- ✅ **Direct Tool Calling**: Agent calls Hedera tools directly for maximum flexibility

## 📋 **Agent Output Example**

See exactly how the agent thinks and works:

```
### STEP 1: GET CONTRACT RATIOS
The current ratios from the governance contract (0.0.6434231) are:
- HBAR: 40
- WBTC: 3  
- SAUCE: 25
- USDC: 24
- JAM: 5
- HEADSTART: 3

### STEP 2: GET LYNX TOTAL SUPPLY
The total supply of the LYNX token (0.0.6200902) is 38.

### STEP 3: GET CURRENT HBAR BALANCE
The current HBAR balance for the contract (0.0.6434231) is 152 HBAR.

### STEP 4: GET CURRENT TOKEN BALANCES
The current token balances for the contract (0.0.6434231) are:
- SAUCE (0.0.1183558): 11.4 tokens
- WBTC (0.0.6212932): 19 tokens
- USDC (0.0.6212931): 91.2 tokens
- JAM (0.0.6212932): 9.12 tokens
- HEADSTART (0.0.6212933): 11.4 tokens

### STEP 5: CALCULATE REQUIRED BALANCES  
Using the formula: Required = (LYNX Supply × Ratio) ÷ 10
- **HBAR**: Required = (38 × 40) ÷ 10 = 152 HBAR | Current = 152 HBAR | Difference = 0
- **WBTC**: Required = (38 × 3) ÷ 10 = 11.4 tokens | Current = 19 tokens | Difference = 7.6
- **SAUCE**: Required = (38 × 25) ÷ 10 = 95 tokens | Current = 11.4 tokens | Difference = 83.6
- **USDC**: Required = (38 × 24) ÷ 10 = 91.2 tokens | Current = 91.2 tokens | Difference = 0
- **JAM**: Required = (38 × 5) ÷ 10 = 19 tokens | Current = 9.12 tokens | Difference = 9.88
- **HEADSTART**: Required = (38 × 3) ÷ 10 = 11.4 tokens | Current = 11.4 tokens | Difference = 0

### STEP 6: CHECK TOLERANCE
Tokens OUT OF BALANCE (more than 5% difference):
- **WBTC**: Difference = 7.6 (out of balance)
- **SAUCE**: Difference = 83.6 (out of balance)  
- **JAM**: Difference = 9.88 (out of balance)

### STEP 7: EXECUTE TRANSFERS
Transfers executed:
- Transferred 83.6 SAUCE to the contract
- Transferred 9.88 JAM to the contract  
- Withdrew 7.6 WBTC from the contract

### STEP 8: VERIFY FINAL BALANCES
All tokens are now within the 5% tolerance. The treasury portfolio is successfully rebalanced.
```

**🎯 Complete Transparency**: Every calculation, every decision, every action is explained in detail.

## 🤔 **Pure Agent vs Traditional Approach**

| **Traditional Treasury Systems** | **Our Pure Agent Approach** |
|--------------------------------|----------------------------|
| ❌ Complex parsing and JSON structures | ✅ Natural language reasoning |
| ❌ Rigid rule-based logic | ✅ Intelligent decision-making |
| ❌ Hidden calculations | ✅ Complete transparency - shows all work |
| ❌ Black box operations | ✅ Step-by-step explanations |
| ❌ Hard to debug/audit | ✅ Full audit trail in plain English |
| ❌ Brittle when things change | ✅ Adapts to new situations intelligently |

**🧠 How It Works**: Instead of writing complex parsing logic, we give the agent clear instructions and let it reason through the problem like a human treasury manager would. It fetches data, does math, explains its reasoning, and executes transfers - all while showing its work.

## 🚀 Quick Start

### Prerequisites

1. **Node.js 20+** installed
2. **Hedera Testnet Account** with HBAR balance
3. **OpenAI API Key** for AI agent functionality
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

**💰 Cost Efficient**: Uses GPT-4o-mini (~60% cheaper than GPT-4o) while maintaining full functionality.

### 🔄 **Agent Operation**

The agent provides complete transparency in its operations:

```bash
# The agent shows exactly what it's doing:
🔍 Validating treasury ratios using pure agent approach...
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

The Lynx Balancer Agent is built with a **pure agentic approach** using:

- **Hedera Agent Kit V3**: Direct blockchain tool integration
- **LangChain Agent Framework**: Intelligent reasoning and tool calling
- **GPT-4o-mini**: Cost-efficient AI processing
- **TypeScript**: Type-safe development

Key components:
- **LynxBalancerAgent**: Main agent class with initialization and execution logic  
- **Custom Tools**: Specialized tools for token transfers and contract interactions
- **Environment Config**: Typed configuration interface for all settings

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