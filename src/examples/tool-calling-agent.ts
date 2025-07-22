#!/usr/bin/env node

import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HederaLangchainToolkit } from 'hedera-agent-kit';
import { Client } from '@hashgraph/sdk';

// Load environment variables
config();

interface EnvironmentConfig {
  OPENAI_API_KEY: string;
  HEDERA_ACCOUNT_ID: string;
  HEDERA_PRIVATE_KEY: string;
  HEDERA_NETWORK?: string;
}

/**
 * Advanced Hedera Agent with LangChain Tool-Calling
 * This example shows how to create an AI agent that can interact with Hedera using natural language
 */
async function main(): Promise<void> {
  console.log("🤖 Starting Advanced Hedera Tool-Calling Agent");

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

    // Initialize Hedera Langchain Toolkit
    const hederaKit = new HederaLangchainToolkit({
      client,
      configuration: {}
    });

    // Initialize OpenAI Chat Model
    const llm = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0,
      apiKey: env.OPENAI_API_KEY,
    });

    // Get Hedera tools from the toolkit
    const hederaTools = hederaKit.getTools();

    console.log(`🔧 Loaded ${hederaTools.length} Hedera tools:`);
    hederaTools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });

    // Create the agent prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `You are a helpful AI assistant that can interact with the Hedera blockchain network. 
      You have access to various Hedera tools that allow you to:
      - Query account balances and information
      - Create and manage HCS (Hedera Consensus Service) topics
      - Submit and retrieve messages from topics
      - Transfer HBAR between accounts
      - Create and manage tokens
      - And much more!
      
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
      verbose: true,
      maxIterations: 10
    });

    console.log("\n🎯 Agent ready! Here are some example queries you can try:");
    console.log("   • 'What is my account balance?'");
    console.log("   • 'Create a new topic called Test Topic'");
    console.log("   • 'Submit a message to topic 0.0.123456'");
    console.log("   • 'Get the latest messages from my topic'");
    console.log("   • 'Transfer 1 HBAR to account 0.0.123456'");

    // Example interactions
    const examples: string[] = [
      "What tools do I have available for Hedera operations?",
      "Can you help me understand how to create an HCS topic?"
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

    console.log("\n🎉 Tool-calling agent demo completed!");

  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main }; 