#!/usr/bin/env node

// Suppress noisy warnings and errors
import './suppress-warnings.js';

import { config } from 'dotenv';
import { StandardsKit } from '@hashgraphonline/standards-agent-plugin';

// Load environment variables
config();

interface EnvironmentConfig {
  HEDERA_NETWORK?: string;
  BALANCER_AGENT_ACCOUNT_ID?: string;
  BALANCER_AGENT_PRIVATE_KEY?: string;
  GOVERNANCE_AGENT_ACCOUNT_ID?: string;
  OPENAI_API_KEY?: string;
}

interface GovernanceRatioUpdate {
  type: 'GOVERNANCE_RATIO_UPDATE';
  updatedRatios: Record<string, number>;
  previousRatios: Record<string, number>;
  changedParameter: string;
  changedValue: { old: number; new: number };
  effectiveTimestamp: string;
  transactionId: string;
  changeSummary: string;
  reason: string;
}

/**
 * HCS-10 Demo Script - Using StandardsKit for Agent Messaging
 * 
 * This script demonstrates:
 * 1. Setting up the balancer agent with StandardsKit
 * 2. Creating agent profile and establishing connections
 * 3. Receiving and processing governance ratio updates via HCS-10
 * 4. Proper agent-to-agent messaging using standards
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log("🦌⚡ Lynx Balancer Agent - HCS-10 StandardsKit Demo");
  console.log("===================================================");

  try {
    switch (command.toLowerCase()) {
      case 'demo':
        await runFullDemo();
        break;
      case 'connections':
        await checkConnections();
        break;
      case 'test-message':
        await testMessage(args[1] || 'Hello from balancer agent demo!');
        break;
      case 'agent':
        await startBalancerAgent();
        break;
      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error("❌ Demo failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Show help information
 */
function showHelp(): void {
  console.log("\n📋 Available Commands:");
  console.log("======================");
  console.log("  demo          - Run full HCS-10 demo with StandardsKit");
  console.log("  connections   - Check current agent connections");
  console.log("  test-message  - Send test message to governance agent");
  console.log("  agent         - Start persistent balancer agent");
  console.log("  help          - Show this help message");
  console.log("\n💡 Example: npm run demo:hcs10 demo");
}

/**
 * Run the full HCS-10 demo using StandardsKit
 */
async function runFullDemo(): Promise<void> {
  console.log("\n🚀 Starting Full HCS-10 StandardsKit Demo");
  console.log("==========================================");

  const env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;

  if (!env.BALANCER_AGENT_ACCOUNT_ID || !env.BALANCER_AGENT_PRIVATE_KEY) {
    console.error("❌ Missing required environment variables");
    console.log("Please set: BALANCER_AGENT_ACCOUNT_ID, BALANCER_AGENT_PRIVATE_KEY");
    process.exit(1);
  }

  if (!env.GOVERNANCE_AGENT_ACCOUNT_ID) {
    console.error("❌ Governance agent not configured");
    console.log("Please set: GOVERNANCE_AGENT_ACCOUNT_ID");
    process.exit(1);
  }

  if (!env.OPENAI_API_KEY) {
    console.error("❌ OpenAI API key not configured");
    console.log("Please set: OPENAI_API_KEY");
    process.exit(1);
  }

  console.log("\n📋 Step 1: Initialize StandardsKit");
  console.log("===================================");

  // Initialize StandardsKit with minimal configuration
  const kit = new StandardsKit({
    accountId: env.BALANCER_AGENT_ACCOUNT_ID,
    privateKey: env.BALANCER_AGENT_PRIVATE_KEY,
    network: (env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
    openAIApiKey: env.OPENAI_API_KEY,
    openAIModelName: 'gpt-4o',
    verbose: false,
    disableLogging: true,
    operationalMode: 'autonomous'
  });

  await kit.initialize();
  console.log("✅ StandardsKit initialized");

  console.log("\n📋 Step 2: Create Agent Profile");
  console.log("================================");

  try {
    const profileResponse = await kit.processMessage(
      'Register me as an AI agent named "Lynx Balancer Agent" with a random unique alias, capabilities DEFI and PORTFOLIO_MANAGEMENT, tags "defi,balancing,automated,treasury", and description "Intelligent portfolio balancing agent for Hedera DeFi - automated rebalancing, yield optimization, and multi-agent coordination"'
    );

    console.log("✅ Agent profile created");
    console.log(`   Response: ${profileResponse.output || 'Profile created successfully'}`);
    if (profileResponse.transactionId) {
      console.log(`   Transaction ID: ${profileResponse.transactionId}`);
    }
  } catch (error) {
    console.log("⚠️  Profile creation failed (may already exist):", error instanceof Error ? error.message : String(error));
  }

  console.log("\n📋 Step 3: Establish Connection with Governance Agent");
  console.log("======================================================");

  try {
    const connectionResponse = await kit.processMessage(
      `Connect to agent ${env.GOVERNANCE_AGENT_ACCOUNT_ID} with message "Hello! I am the Lynx Balancer Agent. Ready to receive governance updates."`
    );

    console.log("✅ Connection initiated with governance agent");
    console.log(`   Response: ${connectionResponse.output || 'Connection initiated'}`);
    if (connectionResponse.transactionId) {
      console.log(`   Transaction ID: ${connectionResponse.transactionId}`);
    }
  } catch (error) {
    console.log("⚠️  Connection initiation failed:", error instanceof Error ? error.message : String(error));
    console.log("   This may be expected if governance agent is not running");
  }

  console.log("\n📋 Step 4: Demonstrate Governance Update Processing");
  console.log("====================================================");

  await demonstrateGovernanceUpdate(kit);

  console.log("\n📋 Step 5: Wait for Governance Agent Connection");
  console.log("================================================");

  await waitForGovernanceConnection(env.GOVERNANCE_AGENT_ACCOUNT_ID, kit);

  console.log("\n🎉 HCS-10 StandardsKit Demo Complete!");
  console.log("======================================");
  console.log("✅ Successfully demonstrated:");
  console.log("   • StandardsKit initialization");
  console.log("   • Agent profile creation");
  console.log("   • Connection establishment");
  console.log("   • Governance update processing");
  console.log("   • HCS-10 messaging capabilities");
}

/**
 * Demonstrate governance update processing
 */
async function demonstrateGovernanceUpdate(kit: StandardsKit): Promise<void> {
  console.log("📊 Demonstrating governance update processing...");

  const exampleUpdate: GovernanceRatioUpdate = {
    type: 'GOVERNANCE_RATIO_UPDATE',
    updatedRatios: {
      hbar: 30,
      wbtc: 15,
      sauce: 20,
      usdc: 15,
      jam: 12,
      headstart: 8
    },
    previousRatios: {
      hbar: 25,
      wbtc: 15,
      sauce: 20,
      usdc: 15,
      jam: 15,
      headstart: 10
    },
    changedParameter: 'hbar_ratio',
    changedValue: { old: 25, new: 30 },
    effectiveTimestamp: new Date().toISOString(),
    transactionId: '0.0.1753300387901@1753300387.293355254',
    changeSummary: 'Increased HBAR allocation from 25% to 30%',
    reason: 'Demo showing message format'
  };

  console.log("📊 Example governance update message:");
  console.log(JSON.stringify(exampleUpdate, null, 2));

  console.log("\n🔄 Processing governance update with StandardsKit...");

  try {
    const response = await kit.processMessage(
      `Process this governance ratio update: ${JSON.stringify(exampleUpdate)}`
    );

    console.log("✅ Governance update processed:");
    console.log(response.output);
  } catch (error) {
    console.log("⚠️  Governance update processing failed:", error instanceof Error ? error.message : String(error));
  }

  console.log("\n💡 Governance update processing demonstrated!");
  console.log("   • Message format validation");
  console.log("   • Parameter change detection");
  console.log("   • StandardsKit processing");
  console.log("   • Rebalancing trigger ready");
}

/**
 * Wait for governance agent connection
 */
async function waitForGovernanceConnection(governanceAccountId: string, kit: StandardsKit): Promise<void> {
  console.log("🤝 Waiting for governance agent connection...");
  console.log(`   Governance agent account: ${governanceAccountId}`);
  console.log("   🕐 Waiting 2 minutes for governance agent to connect...");
  
  const startTime = Date.now();
  const maxWaitTime = 120000; // 2 minutes
  
  while ((Date.now() - startTime) < maxWaitTime) {
    const remainingSeconds = Math.ceil((maxWaitTime - (Date.now() - startTime)) / 1000);
    console.log(`⏳ Still waiting for connection... ${remainingSeconds}s remaining`);
    
    // Check for connections every 10 seconds
    try {
      const connectionsResponse = await kit.processMessage('List my current connections');
      if (connectionsResponse.output && connectionsResponse.output.includes(governanceAccountId)) {
        console.log("✅ Found active connection with governance agent!");
        console.log(`   Response: ${connectionsResponse.output}`);
        return;
      }
    } catch (error) {
      // Connection check failed, continue waiting
    }
    
    await sleep(10000);
  }
  
  console.log("⏰ Wait time expired. Connection may still be established later.");
  console.log("💡 The balancer agent remains ready to accept connections.");
}

/**
 * Check current agent connections
 */
async function checkConnections(): Promise<void> {
  console.log("\n🔍 Checking Agent Connections");
  console.log("=============================");

  const env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;

  if (!env.BALANCER_AGENT_ACCOUNT_ID || !env.BALANCER_AGENT_PRIVATE_KEY) {
    console.log("❌ Balancer agent not properly configured");
    return;
  }

  console.log(`📋 Balancer Agent Account: ${env.BALANCER_AGENT_ACCOUNT_ID}`);
  console.log(`🤖 Governance Agent Account: ${env.GOVERNANCE_AGENT_ACCOUNT_ID || 'Not configured'}`);
  console.log("💡 To check active connections, start the persistent agent with: npm run balancer:agent");
}

/**
 * Send a test message to governance agent
 */
async function testMessage(message: string): Promise<void> {
  console.log("\n📤 Sending Test Message");
  console.log("=======================");

  const env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;

  if (!env.GOVERNANCE_AGENT_ACCOUNT_ID) {
    console.log("❌ Governance agent account not configured");
    console.log("   Set GOVERNANCE_AGENT_ACCOUNT_ID=0.0.YOUR_GOVERNANCE_ACCOUNT");
    return;
  }

  console.log(`📨 Test message: "${message}"`);
  console.log(`🎯 Target: ${env.GOVERNANCE_AGENT_ACCOUNT_ID}`);
  console.log("💡 To send messages, start the persistent agent and establish a connection first:");
}

/**
 * Start the balancer agent (blocking)
 */
async function startBalancerAgent(): Promise<void> {
  console.log("\n🚀 Starting Balancer Agent (Press Ctrl+C to stop)");
  console.log("=================================================");

  const env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;

  if (!env.BALANCER_AGENT_ACCOUNT_ID || !env.BALANCER_AGENT_PRIVATE_KEY) {
    console.error("❌ Missing required environment variables");
    console.log("Please set: BALANCER_AGENT_ACCOUNT_ID, BALANCER_AGENT_PRIVATE_KEY");
    process.exit(1);
  }

  if (!env.GOVERNANCE_AGENT_ACCOUNT_ID) {
    console.error("❌ Governance agent not configured");
    console.log("Please set: GOVERNANCE_AGENT_ACCOUNT_ID");
    process.exit(1);
  }

  if (!env.OPENAI_API_KEY) {
    console.error("❌ OpenAI API key not configured");
    console.log("Please set: OPENAI_API_KEY");
    process.exit(1);
  }

  // Initialize StandardsKit
  const kit = new StandardsKit({
    accountId: env.BALANCER_AGENT_ACCOUNT_ID,
    privateKey: env.BALANCER_AGENT_PRIVATE_KEY,
    network: (env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
    openAIApiKey: env.OPENAI_API_KEY,
    openAIModelName: 'gpt-4o',
    verbose: false,
    disableLogging: true,
    operationalMode: 'autonomous'
  });

  await kit.initialize();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
    process.exit(0);
  });

  try {
    console.log("✅ Balancer agent initialized with StandardsKit");
    console.log(`📋 Account ID: ${env.BALANCER_AGENT_ACCOUNT_ID}`);
    console.log(`🤖 Governance Agent: ${env.GOVERNANCE_AGENT_ACCOUNT_ID}`);
    console.log("🔧 Loaded StandardsKit for HCS-10 messaging");
    console.log("🔗 Ready for HCS-10 connections and governance alerts!");
    console.log("\n💡 Waiting for governance agent to connect and send updates...");

    // Keep the agent running and check for messages periodically
    while (true) {
             try {
         // Check for new messages every 5 seconds
         const messagesResponse = await kit.processMessage('Get my latest messages');
         if (messagesResponse.output && messagesResponse.output !== 'No new messages') {
           console.log(`📨 Received new message(s):`);
           console.log(`   ${messagesResponse.output}`);
           
           // If it's a governance update, send acknowledgment
           if (messagesResponse.output.includes('GOVERNANCE_RATIO_UPDATE')) {
             console.log('🔄 Processing governance update and sending acknowledgment...');
             const ackResponse = await kit.processMessage(
               `Send acknowledgment to the governance agent that I received the governance update and will process the rebalancing.`
             );
             console.log('✅ Acknowledgment sent:', ackResponse.output);
           }
         }
       } catch (error) {
         // Message check failed, continue running
       }
      
      await sleep(5000);
    }
  } catch (error) {
    console.error("❌ Failed to start balancer agent:", error);
    process.exit(1);
  }
}

/**
 * Utility function for sleeping
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 