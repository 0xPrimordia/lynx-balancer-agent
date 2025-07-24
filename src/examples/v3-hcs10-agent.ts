#!/usr/bin/env node

// Suppress Zod warnings from Hedera Agent Kit
import '../suppress-warnings.js';

import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Client, PrivateKey } from '@hashgraph/sdk';
import { HederaLangchainToolkit } from 'hedera-agent-kit';

// Load environment variables
config();

interface EnvironmentConfig {
  HEDERA_ACCOUNT_ID: string;
  HEDERA_PRIVATE_KEY: string;
  HEDERA_NETWORK?: string;
  OPENAI_API_KEY: string;
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
 * V3 HCS-10 Agent Example
 * 
 * This example demonstrates how to create an AI agent using V3 Hedera Agent Kit
 * that can handle HCS-10 messaging and governance updates.
 */
async function main(): Promise<void> {
  console.log("🤖 Starting V3 HCS-10 Agent Example");
  console.log("====================================");

  try {
    // Validate environment variables
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for this example");
    }

    if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
      throw new Error("HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY are required");
    }

    const env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;

    // Initialize Hedera Client
    const client = Client.forTestnet();
    client.setOperator(env.HEDERA_ACCOUNT_ID, env.HEDERA_PRIVATE_KEY);

    // Initialize V3 Hedera Agent Kit
    const hederaAgentToolkit = new HederaLangchainToolkit({
      client,
      configuration: {
        tools: [] // Load all available tools
      },
    });

    // Initialize OpenAI Chat Model
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
      apiKey: env.OPENAI_API_KEY,
    });

    // Get Hedera tools from the toolkit
    const hederaTools = hederaAgentToolkit.getTools();

    console.log(`🔧 Loaded ${hederaTools.length} Hedera tools:`);
    hederaTools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });

    // Create the agent prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `You are a helpful AI assistant that can interact with the Hedera blockchain network and handle HCS-10 messaging.
      You have access to various Hedera tools that allow you to:
      - Query account balances and information
      - Create and manage HCS (Hedera Consensus Service) topics
      - Submit and retrieve messages from topics
      - Transfer HBAR between accounts
      - Create and manage tokens
      - And much more!
      
      You can also process governance ratio updates and handle HCS-10 messaging for agent-to-agent communication.
      
      When users ask you to perform blockchain operations, use the appropriate tools to complete their requests.
      Always provide clear explanations of what you're doing and the results.
      
      Current Hedera Account: ${env.HEDERA_ACCOUNT_ID}
      Network: ${env.HEDERA_NETWORK || 'testnet'}
      `],
      ["placeholder", "{chat_history}"],
      ["human", "{input}"],
      ["placeholder", "{agent_scratchpad}"]
    ]);

    // Create the tool-calling agent
    const agent = await createToolCallingAgent({
      llm,
      tools: hederaTools,
      prompt
    });

    // Create the agent executor
    const agentExecutor = new AgentExecutor({
      agent,
      tools: hederaTools,
      verbose: false, // Disable verbose logging
      maxIterations: 10
    });

    console.log("\n🎯 V3 HCS-10 Agent ready! Here are some example queries you can try:");
    console.log("   • 'What is my account balance?'");
    console.log("   • 'Create a new HCS topic called Governance Updates'");
    console.log("   • 'Submit a message to topic 0.0.123456'");
    console.log("   • 'Get the latest messages from my topic'");
    console.log("   • 'Process this governance ratio update: {JSON}'");
    console.log("   • 'Set up HCS-10 messaging for agent communication'");

    // Example interactions
    const examples: string[] = [
      "What tools do I have available for Hedera operations?",
      "Can you help me understand how to create an HCS topic for agent messaging?",
      "How would I set up HCS-10 messaging between agents?"
    ];

    for (const example of examples) {
      console.log(`\n🧪 Testing: "${example}"`);
      console.log("─".repeat(50));
      
      try {
        const result = await agentExecutor.invoke({
          input: example
        });
        
        console.log("✅ Result:", result.output);
      } catch (error) {
        console.error("❌ Error:", error instanceof Error ? error.message : String(error));
      }
    }

    // Demonstrate HCS-10 messaging capabilities
    await demonstrateHCS10Capabilities(agentExecutor, env);

    console.log("\n🎉 V3 HCS-10 agent demo completed!");

  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Demonstrate HCS-10 messaging capabilities
 */
async function demonstrateHCS10Capabilities(agentExecutor: AgentExecutor, env: NodeJS.ProcessEnv & EnvironmentConfig): Promise<void> {
  console.log("\n📨 Demonstrating HCS-10 Messaging Capabilities");
  console.log("===============================================");

  // Example governance update message
  const sampleUpdate: GovernanceRatioUpdate = {
    type: 'GOVERNANCE_RATIO_UPDATE',
    updatedRatios: { hbar: 30, wbtc: 15, sauce: 20, usdc: 15, jam: 12, headstart: 8 },
    previousRatios: { hbar: 25, wbtc: 15, sauce: 20, usdc: 15, jam: 15, headstart: 10 },
    changedParameter: 'hbar_ratio',
    changedValue: { old: 25, new: 30 },
    effectiveTimestamp: new Date().toISOString(),
    transactionId: `0.0.${Date.now()}@${Math.floor(Date.now() / 1000)}.${Math.floor(Math.random() * 1000000000)}`,
    changeSummary: 'Increased HBAR allocation from 25% to 30%',
    reason: 'Demo showing HCS-10 message format'
  };

  console.log("\n📊 Example governance update message:");
  console.log(JSON.stringify(sampleUpdate, null, 2));

  // Test creating a topic for HCS-10 messaging
  try {
    console.log("\n🔧 Testing topic creation for HCS-10 messaging...");
    const topicResponse = await agentExecutor.invoke({ 
      input: "Create a new HCS topic called 'Governance Updates' for receiving ratio updates" 
    });
    console.log("✅ Topic creation test:", topicResponse.output);
  } catch (error) {
    console.log("⚠️  Topic creation test failed (this is expected in demo mode):", error);
  }

  // Test message submission
  try {
    console.log("\n📤 Testing message submission...");
    const messageResponse = await agentExecutor.invoke({ 
      input: "Submit a test message to topic 0.0.123456 with content 'Test governance update'" 
    });
    console.log("✅ Message submission test:", messageResponse.output);
  } catch (error) {
    console.log("⚠️  Message submission test failed (this is expected in demo mode):", error);
  }

  // Test governance update processing
  try {
    console.log("\n📊 Testing governance update processing...");
    const governanceResponse = await agentExecutor.invoke({ 
      input: `Process this governance ratio update: ${JSON.stringify(sampleUpdate)}` 
    });
    console.log("✅ Governance update processing test:", governanceResponse.output);
  } catch (error) {
    console.log("⚠️  Governance update processing test failed (this is expected in demo mode):", error);
  }

  console.log("\n💡 HCS-10 messaging capabilities demonstrated!");
  console.log("   • Topic creation for agent communication");
  console.log("   • Message submission and retrieval");
  console.log("   • Structured governance update format");
  console.log("   • Agent-to-agent coordination ready");
  console.log("   • V3 Hedera Agent Kit integration complete");
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main }; 