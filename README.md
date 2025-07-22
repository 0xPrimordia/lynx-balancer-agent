# Lynx Balancer Agent 🦌⚡

A **TypeScript** **Hybrid** AI agent combining **Hedera Agent Kit v3** with **Standards Agent Plugin** for both blockchain operations AND agent-to-agent networking. This project demonstrates how to create intelligent agents that can perform sophisticated blockchain operations while coordinating with other agents through **HCS-10 standards**.

[![Hedera](https://img.shields.io/badge/Hedera-Testnet-00D4AA)](https://hedera.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![HCS-10](https://img.shields.io/badge/HCS--10-Compliant-purple)](https://hashgraphonline.com)
[![ED25519](https://img.shields.io/badge/Crypto-ED25519-red)](https://ed25519.cr.yp.to/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## 🚀 Hybrid Capabilities

### 🔗 **Blockchain Operations** (via Hedera Agent Kit v3)
- ✅ **Token Management**: Create, transfer, airdrop HTS tokens
- ✅ **HBAR Operations**: Transfer, balance queries, account management
- ✅ **Consensus Service**: Create topics, submit messages, query history
- ✅ **Real-time Queries**: Account info, token balances, transaction records

### 🌐 **Agent Networking** (via Standards Agent Plugin)
- ✅ **Agent Registration**: HCS-10 compliant agent discovery  
- ✅ **Network Discovery**: Find agents by capabilities, tags, account ID
- ✅ **P2P Connections**: Secure agent-to-agent communication
- ✅ **Message Coordination**: Multi-agent workflow orchestration
- ✅ **Connection Management**: Handle requests, approvals, monitoring

### 🤖 **AI Integration**
- ✅ **Natural Language Processing**: ChatGPT-4o powered interactions
- ✅ **Intelligent Automation**: Smart decision making for complex workflows
- ✅ **Multi-Agent Coordination**: AI-driven collaboration strategies  
- ✅ **Adaptive Responses**: Context-aware blockchain and networking operations

### 🔐 **Security & Performance**
- ✅ **ED25519 Cryptography**: High-performance elliptic curve signatures
- ✅ **DER Key Encoding**: Standard secure key format  
- ✅ **Optimized for Hedera**: Native support and lower transaction costs
- ✅ **Type-Safe Development**: Full TypeScript with strict type checking

## 📋 Prerequisites

- **Node.js 20+** installed
- **TypeScript 5.7+** (installed automatically with dev dependencies)
- **Hedera testnet account** with **ED25519 keys** and HBAR for transactions (≥5 HBAR recommended)
- **OpenAI API key** for AI functionality

## 🛠 Installation

### **Local Development**
```bash
git clone <your-repo-url>
cd lynx-balancer-agent
npm install
```

### **VM/Codespace Deployment** 
For ISP websocket restrictions or clean network environments:

📖 **[VM & Codespace Deployment Guide](docs/VM_DEPLOYMENT.md)**

Quick VM setup:
```bash
# GitHub Codespaces (recommended)
# Create codespace from your repo, then:
npm install
npm run build
```

## ⚙️ Configuration

1. **Setup environment variables:**
```bash
cp env.example .env
```

2. **Configure your `.env` file with ED25519 keys:**
```env
# Hedera Network Configuration
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID
# ED25519 DER-encoded private key (recommended)
HEDERA_PRIVATE_KEY=302a300506032b657004YOUR_ED25519_KEY_HERE

# OpenAI Configuration (for AI agent functionality)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 🔑 Getting Credentials

#### **Hedera Credentials (ED25519 Recommended):**
1. Visit [Hedera Portal](https://portal.hedera.com/)
2. Create testnet account with **ED25519** key type
3. Fund with test HBAR (≥5 HBAR recommended)
4. Get Account ID (`0.0.XXXXXXX`) and **ED25519 DER-encoded** Private Key
   - ED25519 DER keys start with: `302a300506032b657004`

#### **OpenAI API Key:**
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create API key and add to `.env`

## 🚀 Quick Start

### **1. Register Your Agent (First Time Setup)**
```bash
npm run register-agent
```
This script will:
- ✅ Register your agent in the HCS-10 agent network using **ED25519** security
- ✅ Set up agent discovery with DEFI and PORTFOLIO_MANAGEMENT capabilities
- ✅ Create secure communication topics with optimized cryptography
- ✅ Provide environment variables for your agent identity
- ✅ Enable other agents to find and connect with you

**Important**: Add the generated agent environment variables to your `.env` file after registration.

📖 **[Detailed Agent Registration Guide](docs/AGENT_REGISTRATION.md)**

### **2. Foundation Demo**
```bash
npm run dev
```
Shows foundational capabilities and hybrid architecture overview.

### **3. Hybrid Agent (Recommended)**
```bash
npm run hybrid:agent
```
Complete demonstration of blockchain + agent networking capabilities using **StandardsKit**.

### **4. Basic LangChain Integration**
```bash
npm run langchain:tool-calling-agent
npm run langchain:structured-chat-agent
```

## 🎯 Agent Capabilities

### **Individual Agent Operations**
```typescript
// Example: Portfolio management
await agent.processMessage(
  "Check my HBAR balance, then create a portfolio tracking token called 'MyPortfolio'"
);
```

### **Multi-Agent Networking**
```typescript
// Example: Agent discovery and coordination
await agent.processMessage(
  'Register me as a DeFi agent with PORTFOLIO_MANAGEMENT capability, then find other trading agents'
);
```

### **Hybrid Workflows**
```typescript
// Example: Coordinated DeFi strategy
await agent.processMessage(
  'Create a governance token, register as a DAO agent, find other governance agents, and propose a coordination strategy'
);
```

## 🏗 Project Architecture

```
lynx-balancer-agent/
├── src/                           # TypeScript source code
│   ├── index.ts                   # Foundation demo & hybrid overview
│   └── examples/                  # Advanced usage examples
│       ├── hybrid-agent.ts        # StandardsKit hybrid demo
│       ├── manual-hybrid-agent.ts # Future manual integration
│       ├── tool-calling-agent.ts  # LangChain tool calling
│       └── structured-chat-agent.ts # Conversational interface
├── scripts/                       # Setup and utility scripts
│   └── register-agent.ts          # Agent registration script
├── docs/                          # Documentation
│   ├── AGENT_REGISTRATION.md      # Agent registration guide
│   └── VM_DEPLOYMENT.md           # VM & Codespace deployment
├── dist/                          # Compiled JavaScript
├── env.example                    # Environment template
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Dependencies and scripts
```

## 🔧 Development Scripts

| Script | Description |
|--------|-------------|
| `npm run register-agent` | **Register agent in HCS-10 network with ED25519** |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run dev` | Foundation demo with hybrid overview |
| `npm start` | Build and run main application |
| `npm run hybrid:agent` | **Hybrid agent demo (StandardsKit)** |
| `npm run hybrid:manual` | Manual integration info |
| `npm run langchain:tool-calling-agent` | LangChain tool calling |
| `npm run langchain:structured-chat-agent` | Conversational agent |
| `npm run type-check` | Type check without building |
| `npm run lint` | Lint TypeScript files |

## 🌟 Use Cases & Examples

### **🏦 DeFi Portfolio Management**
```bash
# 1. First register your agent with ED25519 security
npm run register-agent

# 2. Test hybrid capabilities  
npm run hybrid:agent
```
- Automated portfolio rebalancing
- Multi-agent liquidity strategies
- Coordinated yield farming

### **🤝 Multi-Agent Coordination**
```bash
# Discover and connect with other agents
npm run hybrid:agent
```
- Agent discovery by capabilities
- Secure P2P communication with ED25519
- Collaborative workflows

### **🎮 Gaming & NFTs** 
```bash
# Create game tokens and agent NPCs
npm run hybrid:agent
```
- Token-based game economies
- AI-powered NPCs as agents
- Decentralized gaming coordination

### **🏭 Supply Chain**
```bash
# Verification and tracking agents
npm run hybrid:agent
```
- Multi-agent verification systems
- Supply chain coordination
- Automated compliance reporting

## 🧪 Advanced Integration

### **StandardsKit Approach (Recommended)**
```typescript
import { StandardsKit } from '@hashgraphonline/standards-agent-plugin';

const lynxAgent = new StandardsKit({
  accountId: process.env.HEDERA_ACCOUNT_ID!,
  privateKey: process.env.HEDERA_PRIVATE_KEY!, // ED25519 DER format
  network: 'testnet',
  openAIApiKey: process.env.OPENAI_API_KEY!,
  verbose: true
});

await lynxAgent.initialize();
```

### **LangChain Integration**
```typescript
import { HederaLangchainToolkit } from 'hedera-agent-kit';
import { createToolCallingAgent } from 'langchain/agents';

const hederaKit = new HederaLangchainToolkit({ client, configuration });
const tools = hederaKit.getTools();
const agent = createToolCallingAgent({ llm, tools, prompt });
```

## 🎯 Agent Registration Details

When you run `npm run register-agent`, your agent will be registered with:

### **🏷️ Capabilities**
- `DEFI`: Decentralized finance operations
- `PORTFOLIO_MANAGEMENT`: Portfolio balancing and optimization

### **🔖 Tags** 
- `defi`: DeFi-related services
- `balancing`: Portfolio balancing capabilities
- `automated`: Automated trading and operations  
- `trading`: Trading strategy coordination

### **🔑 Cryptographic Security**
- **ED25519 signatures** for high-performance security
- **DER encoding** for standard key format compatibility
- **Optimized for Hedera** with lower transaction costs

### **🔍 Discovery**
Other agents can find your Lynx Balancer Agent by searching for:
```typescript
// Find by capability
"Find agents with DEFI capability"

// Find by tags  
"Find agents with balancing tag"

// Find by account
"Find agent 0.0.YOUR_AGENT_ACCOUNT"
```

## 🛡 Security & Best Practices

- ✅ **Environment Variables**: Never commit private keys
- ✅ **ED25519 Cryptography**: Industry-leading elliptic curve signatures
- ✅ **DER Key Encoding**: Secure standardized key format
- ✅ **Type Safety**: Strict TypeScript configuration
- ✅ **Error Handling**: Comprehensive error management
- ✅ **Rate Limiting**: Built-in transaction throttling  
- ✅ **HCS-10 Compliance**: Standardized agent communication
- ✅ **Agent Registration**: Secure agent identity management

## 🔮 Roadmap & Future Features

### **Immediate Goals**
- [ ] Advanced portfolio balancing algorithms
- [ ] More agent networking examples
- [ ] Integration with external data feeds
- [ ] Enhanced error recovery mechanisms

### **Future Enhancements**
- [ ] Smart contract integration
- [ ] Advanced multi-agent consensus algorithms  
- [ ] Machine learning-based trading strategies
- [ ] Cross-chain agent coordination
- [ ] Web interface for agent management

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Write TypeScript with proper types
4. Add tests if applicable
5. Commit changes (`git commit -m 'Add AmazingFeature'`)
6. Push to branch (`git push origin feature/AmazingFeature`)
7. Open Pull Request

## 📄 License

Apache 2.0 - See [LICENSE](LICENSE) file for details.

## 🔗 Resources & Links

### **Core Technologies**
- [Hedera Agent Kit NPM](https://www.npmjs.com/package/hedera-agent-kit)
- [Standards Agent Plugin](https://github.com/hashgraph-online/standards-agent-plugin)
- [Hedera Documentation](https://docs.hedera.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

### **Agent Networking**
- [HCS-10 Standards](https://hcs-improvement-proposals.pages.dev/docs/standards)
- [Hashgraph Online](https://hashgraphonline.com)
- [OpenConvAI Documentation](https://hashgraphonline.com/docs/libraries/standards-agent-plugin/)

### **Cryptography & Security**
- [ED25519 Cryptography](https://ed25519.cr.yp.to/)
- [Hedera Keys and Signatures](https://docs.hedera.com/hedera/core-concepts/keys-and-signatures)
- [DER Encoding Standard](https://wiki.openssl.org/index.php/DER)

### **AI & LangChain**
- [LangChain Documentation](https://js.langchain.com/)
- [OpenAI API](https://platform.openai.com/)

### **Community**
- [Hedera Discord](https://discord.gg/hedera)
- [GitHub Issues](../../issues)

## 🎉 Acknowledgments

- **Hedera Team** for the excellent Agent Kit v3
- **Hashgraph Online** for pioneering HCS-10 agent standards
- **LangChain Team** for powerful AI agent framework
- **OpenAI** for GPT-4 integration capabilities
- **ED25519 Community** for high-performance cryptography

---

🦌 **Built with ❤️ using Hedera Agent Kit v3, Standards Agent Plugin, ED25519 cryptography, and TypeScript** ⚡

*Ready to build the future of multi-agent blockchain systems with cutting-edge security!* 