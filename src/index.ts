#!/usr/bin/env node

import { config } from 'dotenv';
import { HederaLangchainToolkit } from 'hedera-agent-kit';
import { Client } from '@hashgraph/sdk';

// Load environment variables
config();

interface EnvironmentConfig {
  HEDERA_ACCOUNT_ID: string;
  HEDERA_PRIVATE_KEY: string;
  HEDERA_NETWORK?: string;
  OPENAI_API_KEY?: string;
}

/**
 * Lynx Balancer Agent - Hybrid Blockchain + Agent Networking Demo
 * 
 * This demonstrates the foundational capabilities that can be extended with:
 * 1. Direct Hedera blockchain operations (HTS, HBAR, HCS)
 * 2. Agent-to-agent networking (via Standards Agent Plugin)
 * 3. Multi-agent coordination and collaboration
 * 4. Advanced DeFi and portfolio management workflows
 */
async function main(): Promise<void> {
  console.log("🦌⚡ Lynx Balancer Agent - Foundation Demo");
  console.log("===============================================");

  try {
    // Validate required environment variables
    const requiredEnvVars: (keyof EnvironmentConfig)[] = ['HEDERA_ACCOUNT_ID', 'HEDERA_PRIVATE_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    const env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;

    // Initialize Hedera Client
    console.log("🔗 Initializing Hedera connection...");
    const client = Client.forTestnet();
    client.setOperator(env.HEDERA_ACCOUNT_ID, env.HEDERA_PRIVATE_KEY);

    // Initialize Hedera Langchain Toolkit
    const hederaKit = new HederaLangchainToolkit({
      client,
      configuration: {}
    });

    console.log("✅ Hedera Agent Kit initialized successfully");
    console.log(`📋 Account ID: ${env.HEDERA_ACCOUNT_ID}`);
    console.log(`🌐 Network: ${env.HEDERA_NETWORK || 'testnet'}`);

    // Demonstrate available foundational tools
    await demonstrateFoundationalTools(hederaKit);

    // Show hybrid capabilities information
    await demonstrateHybridCapabilities(env);

  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Demonstrate foundational blockchain tools
 */
async function demonstrateFoundationalTools(hederaKit: HederaLangchainToolkit): Promise<void> {
  console.log("\n🔧 Foundational Blockchain Tools:");
  console.log("==================================");
  
  try {
    const tools = hederaKit.getTools();
    console.log(`📊 Available tools: ${tools.length}`);
    
    tools.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name}: ${tool.description}`);
    });

    console.log("\n💡 These tools enable:");
    console.log("   🪙 Token creation and management (HTS)");
    console.log("   💸 HBAR transfers and account operations");
    console.log("   📝 Consensus service messaging (HCS)");
    console.log("   🎁 Token airdrops and distributions");
    console.log("   📊 Account balance and information queries");
    console.log("   🔍 Topic message retrieval and analysis");

  } catch (error) {
    console.error("❌ Failed to get tools:", error instanceof Error ? error.message : String(error));
  }
}

/**
 * Demonstrate hybrid capabilities with Standards Agent Plugin
 */
async function demonstrateHybridCapabilities(env: NodeJS.ProcessEnv & EnvironmentConfig): Promise<void> {
  console.log("\n🚀 Hybrid Agent Capabilities:");
  console.log("=============================");

  console.log("🦌 Lynx Balancer Agent supports two integration approaches:");
  
  console.log("\n📦 1. StandardsKit (Convenience Wrapper):");
  console.log("   • Quick setup with pre-configured hybrid agent");
  console.log("   • Automatic integration of blockchain + networking");
  console.log("   • Perfect for rapid prototyping and simple workflows");
  console.log("   • Run: npm run hybrid:agent");

  console.log("\n🔧 2. Manual Integration (Advanced Control):");
  console.log("   • Direct plugin management and configuration");
  console.log("   • Custom state management and system prompts");
  console.log("   • Full control over tool combinations and interactions");
  console.log("   • Run: npm run hybrid:manual");

  console.log("\n🌐 Agent Networking Capabilities (via Standards Plugin):");
  console.log("   ✅ HCS-10 compliant agent registration");
  console.log("   ✅ Agent discovery by capabilities/tags");
  console.log("   ✅ Secure peer-to-peer connections");
  console.log("   ✅ Connection request management");
  console.log("   ✅ Multi-agent message coordination");

  console.log("\n⛓️  Blockchain Operation Capabilities (via Hedera Kit):");
  console.log("   ✅ Fungible and Non-fungible token operations");
  console.log("   ✅ HBAR transfers and account management");
  console.log("   ✅ Consensus service topic creation/messaging");
  console.log("   ✅ Token airdrops and mass distributions");
  console.log("   ✅ Real-time balance and account monitoring");

  if (env.OPENAI_API_KEY) {
    console.log("\n🤖 AI Integration Ready:");
    console.log("   ✅ OpenAI API key detected");
    console.log("   ✅ Natural language blockchain operations");
    console.log("   ✅ Intelligent agent networking decisions");
    console.log("   ✅ Automated multi-agent workflows");
  } else {
    console.log("\n⚠️  AI Integration:");
    console.log("   💡 Add OPENAI_API_KEY to your .env for full AI capabilities");
    console.log("   💡 This enables natural language processing and intelligent automation");
  }

  console.log("\n🎯 Example Use Cases:");
  console.log("   🏦 Automated DeFi portfolio balancing with agent coordination");
  console.log("   🤝 Multi-agent liquidity provision strategies");
  console.log("   📈 Collaborative yield farming optimization");
  console.log("   🎮 Token-based gaming economies with agent NPCs");
  console.log("   🏭 Supply chain coordination with verification agents");
  console.log("   💼 DAO governance with specialized voting agents");

  console.log("\n📚 Next Steps:");
  console.log("   1. Add your Hedera testnet credentials to .env");
  console.log("   2. Add OpenAI API key for AI capabilities");
  console.log("   3. Try: npm run hybrid:agent (quick start)");
  console.log("   4. Try: npm run hybrid:manual (advanced integration)");
  console.log("   5. Explore the examples in src/examples/");
  console.log("   6. Build your own custom agent workflows!");
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main }; 