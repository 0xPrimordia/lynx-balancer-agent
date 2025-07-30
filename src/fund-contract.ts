#!/usr/bin/env node

// Suppress noisy warnings and errors
import './suppress-warnings.js';

import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Client } from '@hashgraph/sdk';
import { HederaLangchainToolkit } from 'hedera-agent-kit';

// Load environment variables
config();

/**
 * Contract Funding Script
 * 
 * This script funds the governance contract with HBAR for testing rebalancing
 */
class ContractFunder {
  private agentExecutor?: AgentExecutor;
  private client?: Client;

  /**
   * Initialize Hedera Agent Kit for HBAR transfers
   */
  async initialize(): Promise<void> {
    console.log("💰 Initializing Contract Funder");
    console.log("===============================");

    const env = process.env;
    
    // Validate required environment variables
    const requiredVars = [
      'HEDERA_ACCOUNT_ID',
      'HEDERA_PRIVATE_KEY', 
      'OPENAI_API_KEY',
      'GOVERNANCE_CONTRACT_ID'
    ];
    
    const missingVars = requiredVars.filter(varName => !env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    try {
      console.log("🔧 Setting up Hedera Agent Kit for HBAR transfers...");

      // Initialize Hedera Client
      this.client = Client.forTestnet();
      this.client.setOperator(env.HEDERA_ACCOUNT_ID!, env.HEDERA_PRIVATE_KEY!);

      // Initialize Hedera Agent Kit
      const hederaAgentToolkit = new HederaLangchainToolkit({
        client: this.client,
        configuration: {}
      });

      // Initialize OpenAI LLM
      const llm = new ChatOpenAI({
        modelName: "gpt-4o",
        temperature: 0,
        apiKey: env.OPENAI_API_KEY,
      });

      // Create simple prompt for HBAR transfers
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', 'You are a treasury manager that transfers HBAR to contracts. Use the HBAR transfer tools to send funds.'],
        ['placeholder', '{chat_history}'],
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
      ]);

      // Get Hedera tools
      const hederaTools = hederaAgentToolkit.getTools();
      
      // Create the tool-calling agent
      const agent = await createToolCallingAgent({
        llm,
        tools: hederaTools,
        prompt
      });
      
      // Create the agent executor
      this.agentExecutor = new AgentExecutor({
        agent,
        tools: hederaTools,
        verbose: false,
        maxIterations: 10
      });

      console.log("✅ Contract funder initialized");
      console.log(`📋 Treasury Account: ${env.HEDERA_ACCOUNT_ID}`);
      console.log(`🏛️  Contract Account: ${env.GOVERNANCE_CONTRACT_ID}`);
      console.log(`🔧 Available tools:`, hederaTools.map(t => t.name));

    } catch (error) {
      console.error("❌ Failed to initialize contract funder:", error);
      throw error;
    }
  }

  /**
   * Check current balances before funding
   */
  async checkBalances(): Promise<void> {
    if (!this.agentExecutor) {
      throw new Error("Agent executor not initialized");
    }

    const env = process.env;
    
    console.log("📊 Checking current balances...");
    
    try {
      // Check treasury balance
      const treasuryResponse = await this.agentExecutor.invoke({
        input: `Get the current HBAR balance for account ${env.HEDERA_ACCOUNT_ID}`
      });
      
      // Check contract balance
      const contractResponse = await this.agentExecutor.invoke({
        input: `Get the current HBAR balance for account ${env.GOVERNANCE_CONTRACT_ID}`
      });
      
      console.log(`💰 Treasury Balance: ${treasuryResponse.output}`);
      console.log(`🏛️  Contract Balance: ${contractResponse.output}`);
      
    } catch (error) {
      console.error(`❌ Failed to check balances:`, error);
      throw error;
    }
  }

  /**
   * Fund the contract with specified HBAR amount
   */
  async fundContract(amount: number): Promise<void> {
    if (!this.agentExecutor) {
      throw new Error("Agent executor not initialized");
    }

    const env = process.env;
    
    console.log(`💸 Funding contract with ${amount} HBAR...`);
    console.log(`   From: ${env.HEDERA_ACCOUNT_ID} (treasury)`);
    console.log(`   To: ${env.GOVERNANCE_CONTRACT_ID} (contract)`);
    
    try {
      const response = await this.agentExecutor.invoke({
        input: `Transfer ${amount} HBAR from account ${env.HEDERA_ACCOUNT_ID} to account ${env.GOVERNANCE_CONTRACT_ID}. Please provide the transaction ID when successful.`
      });
      
      console.log("✅ Contract funding completed");
      console.log(`📤 Response: ${response.output}`);
      
    } catch (error) {
      console.error(`❌ Failed to fund contract:`, error);
      throw error;
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log("💰🦌 Contract Funding Script");
  console.log("============================");

  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const amount = parseFloat(args[1]) || 10;

  const funder = new ContractFunder();

  try {
    await funder.initialize();

    switch (command.toLowerCase()) {
      case 'check':
        await funder.checkBalances();
        break;
      case 'fund':
        await funder.checkBalances();
        console.log("\n" + "=".repeat(50));
        await funder.fundContract(amount);
        console.log("\n" + "=".repeat(50));
        await funder.checkBalances();
        break;
      default:
        console.log("📋 Available commands:");
        console.log("  check        - Check current treasury and contract balances");
        console.log("  fund [amount] - Fund contract with HBAR (default: 10 HBAR)");
        console.log("\n💡 Examples:");
        console.log("   npm run fund-contract check");
        console.log("   npm run fund-contract fund 10");
        console.log("   npm run fund-contract fund 50");
        console.log("\n📊 This will help test rebalancing with meaningful amounts");
        break;
    }

  } catch (error) {
    console.error("❌ Failed to execute funding operation:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 