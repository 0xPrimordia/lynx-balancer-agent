#!/usr/bin/env node

import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createStructuredChatAgent } from 'langchain/agents';
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

interface ConversationExample {
  input: string;
  context: string;
}

/**
 * Structured Chat Agent with Hedera Integration
 * This example shows how to create a conversational AI agent for Hedera operations
 */
async function main(): Promise<void> {
  console.log("💬 Starting Hedera Structured Chat Agent");

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
      temperature: 0.7,
      apiKey: env.OPENAI_API_KEY,
    });

    // Get Hedera tools from the toolkit
    const hederaTools = hederaKit.getTools();

    // Create a conversational prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `You are Lynx, a friendly and knowledgeable AI assistant specialized in Hedera blockchain operations.
      You can help users with various Hedera network tasks including:
      
      💰 Account Management:
      - Check account balances
      - Get account information
      - Transfer HBAR between accounts
      
      📝 Consensus Service (HCS):
      - Create new topics for messaging
      - Submit messages to topics
      - Retrieve messages from topics
      
      🪙 Token Operations:
      - Create new tokens
      - Transfer tokens
      - Query token information
      
      🔍 Network Queries:
      - Query transaction records
      - Get network information
      - Check transaction status
      
      Always be helpful, explain what you're doing, and provide clear results.
      If something goes wrong, explain the error in simple terms and suggest solutions.
      
      Current Configuration:
      - Account: ${env.HEDERA_ACCOUNT_ID}
      - Network: ${env.HEDERA_NETWORK || 'testnet'}
      
      Available tools: {tool_names}
      Tool descriptions: {tools}`],
      ["placeholder", "{chat_history}"],
      ["human", "{input}"],
      ["placeholder", "{agent_scratchpad}"]
    ]);

    // Create the structured chat agent
    const agent = await createStructuredChatAgent({
      llm,
      tools: hederaTools,
      prompt
    });

    // Create the agent executor
    const agentExecutor = new AgentExecutor({
      agent,
      tools: hederaTools,
      verbose: false,
      maxIterations: 5
    });

    console.log("\n🎯 Lynx Agent initialized successfully!");
    console.log(`🔧 Available tools: ${hederaTools.length}`);

    // Simulate a conversation
    const conversationExamples: ConversationExample[] = [
      {
        input: "Hi! Can you tell me about the tools you have available?",
        context: "User wants to know about available functionality"
      },
      {
        input: "What can you help me do with Hedera?",
        context: "User wants to understand capabilities"
      },
      {
        input: "How do I get started with HCS topics?",
        context: "User wants guidance on HCS usage"
      }
    ];

    console.log("\n💬 Starting conversation simulation...");
    console.log("═".repeat(60));

    for (const example of conversationExamples) {
      console.log(`\n👤 User: ${example.input}`);
      console.log("─".repeat(40));
      
      try {
        const result = await agentExecutor.invoke({
          input: example.input
        });
        
        console.log(`🤖 Lynx: ${result.output}`);
        
        // Add a small delay to simulate natural conversation
        await new Promise<void>(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`🤖 Lynx: I'm sorry, I encountered an error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log("\n═".repeat(60));
    console.log("🎉 Conversation simulation completed!");
    console.log("\n💡 To run an interactive version:");
    console.log("   Modify this script to add user input handling");
    console.log("   Consider using readline or a web interface");

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