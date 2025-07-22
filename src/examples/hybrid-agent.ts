#!/usr/bin/env node

import { config } from 'dotenv';
import { StandardsKit } from '@hashgraphonline/standards-agent-plugin';

// Load environment variables
config();

interface EnvironmentConfig {
  HEDERA_ACCOUNT_ID: string;
  HEDERA_PRIVATE_KEY: string;
  HEDERA_NETWORK?: string;
  OPENAI_API_KEY: string;
}

/**
 * Hybrid Agent Example - Combining Hedera Agent Kit v3 with Standards Agent Plugin
 * 
 * This demonstrates a powerful agent that can:
 * 1. Perform direct blockchain operations (tokens, transfers, consensus)
 * 2. Register and discover other agents in the network
 * 3. Establish secure agent-to-agent connections
 * 4. Coordinate multi-agent workflows
 */
async function main(): Promise<void> {
  console.log("🦌⚡ Starting Lynx Hybrid Agent - Blockchain + Agent Networking");

  try {
    // Validate environment variables
    const requiredVars: (keyof EnvironmentConfig)[] = [
      'HEDERA_ACCOUNT_ID', 
      'HEDERA_PRIVATE_KEY', 
      'OPENAI_API_KEY'
    ];
    
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    const env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;

    // Initialize the StandardsKit with hybrid capabilities
    console.log("🔧 Initializing hybrid agent with both blockchain and networking capabilities...");
    
    const lynxAgent = new StandardsKit({
      accountId: env.HEDERA_ACCOUNT_ID,
      privateKey: env.HEDERA_PRIVATE_KEY,
      network: (env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
      openAIApiKey: env.OPENAI_API_KEY,
      openAIModelName: 'gpt-4o',
      verbose: true,
      operationalMode: 'autonomous',
      // Custom system message for our Lynx agent
      customSystemMessagePreamble: `
You are Lynx, an advanced hybrid AI agent with both blockchain and agent networking capabilities.

BLOCKCHAIN CAPABILITIES:
- Create and manage Hedera tokens (HTS)
- Transfer HBAR between accounts
- Create HCS topics and submit messages
- Query account balances and information
- Airdrop tokens to multiple recipients

AGENT NETWORKING CAPABILITIES:
- Register yourself with other agents using HCS-10 standards
- Discover other agents in the network by capabilities/tags
- Establish secure peer-to-peer connections
- Send and receive messages through established connections
- Coordinate multi-agent workflows

You operate on the Hedera ${env.HEDERA_NETWORK || 'testnet'} network with account ${env.HEDERA_ACCOUNT_ID}.
Always be helpful and explain what you're doing clearly.
      `.trim()
    });

    await lynxAgent.initialize();
    console.log("✅ Lynx Hybrid Agent initialized successfully!");

    // Demonstrate the hybrid capabilities with a series of interactions
    const demonstrations = [
      {
        title: "🏷️  Agent Registration & Discovery",
        interactions: [
          {
            description: "Register as a DeFi balancing agent",
            message: 'Register me as an agent named "LynxBalancer" with a random unique alias, capabilities DEFI and PORTFOLIO_MANAGEMENT, tags "defi,balancing,automated", and description "An intelligent portfolio balancing agent for Hedera DeFi"'
          },
          {
            description: "Search for other DeFi agents in the network",
            message: 'Find all agents with defi tag to see what other DeFi services are available'
          }
        ]
      },
      {
        title: "💰 Blockchain Operations",
        interactions: [
          {
            description: "Check account balance and create a test token",
            message: 'What is my current HBAR balance? Then create a test token called "LynxToken" with symbol "LYNX" and initial supply of 1000'
          },
          {
            description: "Create an HCS topic for agent communications",
            message: 'Create a new HCS topic with memo "LynxBalancer Agent Communications" for coordinating with other agents'
          }
        ]
      },
      {
        title: "🤝 Agent Networking",
        interactions: [
          {
            description: "Monitor for connection requests and list connections",
            message: 'Check if there are any pending connection requests from other agents, and show me my current connections'
          }
        ]
      },
      {
        title: "🧠 Advanced Hybrid Scenarios",
        interactions: [
          {
            description: "Plan a multi-agent DeFi strategy",
            message: 'If I wanted to create a decentralized portfolio management system with other agents, what would be the steps? Consider both the blockchain operations needed and the agent coordination required.'
          }
        ]
      }
    ];

    // Execute demonstrations
    for (const demo of demonstrations) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`${demo.title}`);
      console.log(`${'═'.repeat(60)}`);

      for (const interaction of demo.interactions) {
        console.log(`\n🎯 ${interaction.description}`);
        console.log(`👤 User: "${interaction.message}"`);
        console.log('─'.repeat(50));

        try {
          const response = await lynxAgent.processMessage(interaction.message);
          console.log(`🦌 Lynx: ${response}`);
          
          // Add delay between operations to avoid overwhelming the network
          await new Promise<void>(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log("🎉 Hybrid Agent Demonstration Complete!");
    console.log(`${'═'.repeat(60)}`);
    
    console.log("\n💡 Key Capabilities Demonstrated:");
    console.log("   ✅ Agent registration and discovery (HCS-10 standards)");
    console.log("   ✅ Blockchain operations (HTS tokens, HBAR transfers, HCS topics)"); 
    console.log("   ✅ Multi-agent coordination planning");
    console.log("   ✅ Hybrid blockchain + networking workflows");

    console.log("\n🚀 Next Steps:");
    console.log("   • Set up connections with other agents in the network");
    console.log("   • Implement automated portfolio balancing strategies");
    console.log("   • Create collaborative DeFi workflows with agent partners");
    console.log("   • Build a decentralized agent collective for advanced operations");

  } catch (error) {
    console.error("❌ Fatal Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main }; 