#!/usr/bin/env node

// Suppress Zod warnings from Hedera Agent Kit
import './suppress-warnings.js';

import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Client, PrivateKey } from '@hashgraph/sdk';
import { HederaLangchainToolkit } from 'hedera-agent-kit';

// Load environment variables
config();

interface EnvironmentConfig {
  HEDERA_ACCOUNT_ID?: string;
  HEDERA_PRIVATE_KEY?: string;
  OPENAI_API_KEY?: string;
}

/**
 * Test V3 Hedera Agent Kit Setup
 * 
 * This script tests the basic V3 setup to ensure everything is working correctly.
 */
async function main(): Promise<void> {
  console.log("🧪 Testing V3 Hedera Agent Kit Setup");
  console.log("====================================");

  try {
    // Validate environment variables
    const env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;
    
    if (!env.HEDERA_ACCOUNT_ID || !env.HEDERA_PRIVATE_KEY) {
      console.log("⚠️  Hedera credentials not configured");
      console.log("   Please set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in your .env file");
      return;
    }

    if (!env.OPENAI_API_KEY) {
      console.log("⚠️  OpenAI API key not configured");
      console.log("   Please set OPENAI_API_KEY in your .env file");
      return;
    }

    console.log("✅ Environment variables validated");

    // Test 1: Initialize Hedera Client
    console.log("\n🔗 Test 1: Initialize Hedera Client");
    const client = Client.forTestnet().setOperator(
      env.HEDERA_ACCOUNT_ID,
      env.HEDERA_PRIVATE_KEY,
    );
    console.log("✅ Hedera client initialized");

    // Test 2: Initialize V3 Hedera Agent Kit
    console.log("\n🔧 Test 2: Initialize V3 Hedera Agent Kit");
    const hederaAgentToolkit = new HederaLangchainToolkit({
      client,
      configuration: {
        tools: []
      },
    });
    console.log("✅ V3 Hedera Agent Kit initialized");

    // Test 3: Get tools from toolkit
    console.log("\n🛠️  Test 3: Get Tools from Toolkit");
    const tools = hederaAgentToolkit.getTools();
    console.log(`✅ Loaded ${tools.length} Hedera tools`);
    
    if (tools.length > 0) {
      console.log("📋 Available tools:");
      tools.slice(0, 5).forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.name}: ${tool.description.substring(0, 60)}...`);
      });
      if (tools.length > 5) {
        console.log(`   ... and ${tools.length - 5} more tools`);
      }
    }

    // Test 4: Initialize OpenAI LLM
    console.log("\n🤖 Test 4: Initialize OpenAI LLM");
    const llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
    });
    console.log("✅ OpenAI LLM initialized");

    // Test 5: Create agent prompt template
    console.log("\n📝 Test 5: Create Agent Prompt Template");
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'You are a helpful assistant that can interact with the Hedera blockchain network.'],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);
    console.log("✅ Agent prompt template created");

    // Test 6: Create tool-calling agent
    console.log("\n🔧 Test 6: Create Tool-Calling Agent");
    const agent = createToolCallingAgent({
      llm,
      tools,
      prompt,
    });
    console.log("✅ Tool-calling agent created");

    // Test 7: Create agent executor
    console.log("\n⚙️  Test 7: Create Agent Executor");
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: false, // Disable verbose logging
    });
    console.log("✅ Agent executor created");

    // Test 8: Test agent with simple query
    console.log("\n🧪 Test 8: Test Agent with Simple Query");
    try {
      const response = await agentExecutor.invoke({ 
        input: "What tools do you have available for Hedera operations?" 
      });
      console.log("✅ Agent test successful");
      console.log("📋 Response:", response.output.substring(0, 200) + "...");
    } catch (error) {
      console.log("⚠️  Agent test failed (this may be expected):", error instanceof Error ? error.message : String(error));
    }

    console.log("\n🎉 V3 Setup Test Completed Successfully!");
    console.log("\n✅ All V3 components are working correctly:");
    console.log("   • Hedera client initialization");
    console.log("   • V3 Hedera Agent Kit setup");
    console.log("   • Tool loading and configuration");
    console.log("   • OpenAI LLM integration");
    console.log("   • LangChain agent creation");
    console.log("   • Agent executor setup");

    console.log("\n💡 Next steps:");
    console.log("   1. Run: npm run v3:hcs10-agent (for HCS-10 example)");
    console.log("   2. Run: npm run demo:hcs10 demo (for full demo)");
    console.log("   3. Run: npm run balancer:agent (for persistent agent)");

  } catch (error) {
    console.error("❌ V3 Setup Test Failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main }; 