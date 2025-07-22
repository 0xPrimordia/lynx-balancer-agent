# 🤖 Agent Registration Process

This document explains how the Lynx Balancer Agent registration works and what happens when you run `npm run register-agent`.

## 🔍 Overview

The agent registration process creates a unique agent identity in the **HCS-10 compliant agent network** that allows your Lynx Balancer Agent to:

- ✅ Be discovered by other agents
- ✅ Establish secure peer-to-peer connections
- ✅ Coordinate multi-agent workflows
- ✅ Participate in decentralized agent ecosystems

## 🏷️ Agent Identity

Your registered agent will have the following properties:

### **📛 Name & Alias**
- **Name**: `LynxBalancerAgent{timestamp}` (e.g., `LynxBalancerAgent1703123456789`)
- **Alias**: Random unique identifier for discovery
- **Description**: "Intelligent portfolio balancing agent for Hedera DeFi - automated rebalancing, yield optimization, and multi-agent coordination"

### **🎯 Capabilities**
- **`DEFI`**: Indicates this agent provides decentralized finance services
- **`PORTFOLIO_MANAGEMENT`**: Shows this agent can manage and balance portfolios

### **🔖 Tags**
- **`defi`**: DeFi-related operations
- **`balancing`**: Portfolio balancing capabilities  
- **`automated`**: Automated trading and rebalancing
- **`trading`**: Trading strategy coordination

## 🌐 HCS Topics Created

The registration process creates secure **Hedera Consensus Service (HCS)** topics for communication:

### **📨 Inbound Topic** 
- **Purpose**: Receives messages from other agents
- **Access**: Only your agent can read messages
- **Usage**: Connection requests, coordination messages, data sharing

### **📤 Outbound Topic**
- **Purpose**: Sends messages to connected agents
- **Access**: Your agent publishes, others read with permission
- **Usage**: Responses, status updates, coordination replies

### **👤 Profile Topic** (Optional)
- **Purpose**: Stores agent profile information and metadata
- **Access**: Publicly readable for agent discovery
- **Usage**: Profile picture, detailed capabilities, service descriptions

## 🔐 Security Features

### **Account Isolation**
- Each agent gets a **unique account ID** for identity
- **Private key management** for secure transactions
- **Topic-based communication** with access controls

### **ED25519 Cryptography (Recommended)**
- **ED25519 signature scheme** - High-performance elliptic curve cryptography
- **DER-encoded private keys** - Standard encoding format
- **Superior performance** compared to ECDSA
- **Recommended by Hedera** for optimal security and efficiency

### **Key Format Requirements**
- **ED25519 DER format** - Keys start with `302a300506032b657004`
- **Automatic key detection** and configuration
- **Secure key handling** throughout the registration process

### **Profile Picture Handling**
- **Attempt with picture first** (requires more HBAR for inscription)
- **Fallback without picture** if insufficient funds
- **Cost optimization** for minimal setup requirements

## 💰 HBAR Requirements

### **Minimum Recommended**: 5 HBAR
- **Account creation**: ~1 HBAR
- **Topic creation**: ~1 HBAR per topic (3 topics)
- **Registration transactions**: ~1 HBAR
- **Profile picture inscription**: ~1-2 HBAR (optional)

### **Cost Breakdown**
```
Account Creation         ~1.0 HBAR
Inbound Topic           ~1.0 HBAR  
Outbound Topic          ~1.0 HBAR
Profile Topic           ~1.0 HBAR
Registration Messages   ~0.5 HBAR
Profile Picture         ~1.0 HBAR (optional)
Buffer/Fees            ~0.5 HBAR
-------------------------
Total:                 ~5.0 HBAR
```

## 🚀 Registration Process Flow

### **1. Environment Validation**
```typescript
// Validates required environment variables
HEDERA_ACCOUNT_ID     // Your funding account (ED25519)
HEDERA_PRIVATE_KEY    // Your ED25519 DER-encoded private key  
OPENAI_API_KEY        // AI functionality
```

### **2. StandardsKit Initialization**
```typescript
const kit = new StandardsKit({
  accountId: process.env.HEDERA_ACCOUNT_ID!,
  privateKey: process.env.HEDERA_PRIVATE_KEY!, // ED25519 DER format
  network: 'testnet',
  operationalMode: 'autonomous'
});
```

### **3. Agent Registration**
```typescript
// Attempt registration with profile picture
"Register me as an AI agent named LynxBalancerAgent123456 
 with capabilities DEFI and PORTFOLIO_MANAGEMENT,
 tags 'defi,balancing,automated,trading',
 profile picture URL '...',
 and description '...'"
```

### **4. Fallback Registration** 
```typescript
// If profile picture fails due to insufficient HBAR
"Register me as an AI agent named LynxBalancerAgent123456
 with capabilities DEFI and PORTFOLIO_MANAGEMENT,
 tags 'defi,balancing,automated,trading',
 and description '...'"
```

### **5. Identity Extraction**
```typescript
const stateManager = kit.getStateManager();
const currentAgent = stateManager.getCurrentAgent();
```

## 📋 Generated Environment Variables

After successful registration, add these to your `.env` file:

```env
# Agent Identity (add these after registration)
BALANCER_AGENT_ACCOUNT_ID=0.0.98765432
BALANCER_AGENT_INBOUND_TOPIC=0.0.98765433
BALANCER_AGENT_OUTBOUND_TOPIC=0.0.98765434  
BALANCER_AGENT_PROFILE_TOPIC=0.0.98765435
```

## 🔧 Troubleshooting

### **❌ Insufficient HBAR**
```
Error: INSUFFICIENT_ACCOUNT_BALANCE
```
**Solution**: Fund your account with at least 5 HBAR

### **❌ Invalid ED25519 Private Key**
```
Error: Invalid DER-encoded private key
```
**Solution**: 
- Ensure your ED25519 private key is DER-encoded
- ED25519 DER keys start with `302a300506032b657004`
- Verify key format matches Hedera requirements

### **❌ Network Mismatch** 
```
Error: Account not found on network
```
**Solution**: Ensure `HEDERA_NETWORK` matches your account's network (testnet/mainnet)

### **❌ OpenAI API Issues**
```
Error: Invalid OpenAI API key
```
**Solution**: Verify your OpenAI API key and available credits

### **🔍 Key Format Validation**
To verify your ED25519 DER key format:
```typescript
// ED25519 DER keys should start with this prefix
const ED25519_DER_PREFIX = "302a300506032b657004";
const isValidED25519DER = privateKey.startsWith(ED25519_DER_PREFIX);
```

## 🌐 Agent Discovery Examples

After registration, other agents can find your Lynx Balancer Agent:

### **By Capability**
```typescript
"Find agents with DEFI capability"
"Find agents with PORTFOLIO_MANAGEMENT capability"
```

### **By Tags**
```typescript
"Find agents with defi tag"
"Find agents with balancing tag" 
"Find agents with automated tag"
```

### **By Account ID**
```typescript
"Find agent 0.0.98765432"
```

## 🤝 Next Steps After Registration

1. **Update Environment**: Add generated variables to `.env`
2. **Test Discovery**: Run `npm run hybrid:agent`
3. **Find Other Agents**: Search for `"Find agents with defi tag"`
4. **Establish Connections**: Connect with discovered agents
5. **Start Coordination**: Begin multi-agent workflows

## 🔑 Why ED25519?

### **Performance Benefits**
- **Faster signature generation** than ECDSA
- **Smaller signature size** (64 bytes vs 70+ bytes)
- **Better performance** on modern hardware

### **Security Advantages**
- **Stronger security** against side-channel attacks
- **Deterministic signatures** - no randomness required
- **Mathematically proven** security properties

### **Hedera Optimization**
- **Native support** in Hedera network
- **Lower transaction costs** due to efficiency
- **Recommended by Hedera** for production use

## 🔗 Related Documentation

- [HCS-10 Standards](https://hcs-improvement-proposals.pages.dev/docs/standards)
- [Standards Agent Plugin](https://github.com/hashgraph-online/standards-agent-plugin)
- [Hedera Agent Kit](https://www.npmjs.com/package/hedera-agent-kit)
- [OpenConvAI Documentation](https://hashgraphonline.com/docs/libraries/standards-agent-plugin/)
- [ED25519 Cryptography](https://ed25519.cr.yp.to/)
- [Hedera Cryptography Guide](https://docs.hedera.com/hedera/core-concepts/keys-and-signatures)

---

🦌 **Ready to register your Lynx Balancer Agent with ED25519 security and join the decentralized agent network!** ⚡ 