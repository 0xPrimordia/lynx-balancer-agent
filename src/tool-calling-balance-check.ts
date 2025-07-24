#!/usr/bin/env node

// Suppress noisy warnings and errors
import './suppress-warnings.js';

import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Client, PrivateKey } from '@hashgraph/sdk';
import { HederaLangchainToolkit, AgentMode } from 'hedera-agent-kit';

// Load environment variables
config();

interface EnvironmentConfig {
  HEDERA_NETWORK?: string;
  HEDERA_ACCOUNT_ID?: string;
  HEDERA_PRIVATE_KEY?: string;
  BALANCER_AGENT_ACCOUNT_ID?: string;
  BALANCER_AGENT_PRIVATE_KEY?: string;
  OPENAI_API_KEY?: string;
  
  // Token configurations
  CONTRACT_SAUCE_TOKEN?: string;
  CONTRACT_LYNX_TOKEN?: string;
  CONTRACT_WBTC_TOKEN?: string;
  CONTRACT_USDC_TOKEN?: string;
  CONTRACT_JAM_TOKEN?: string;
  CONTRACT_HEADSTART_TOKEN?: string;
  
  // Contract/treasury configurations
  GOVERNANCE_CONTRACT_ID?: string;
  TREASURY_ACCOUNT_ID?: string;
}

/**
 * Tool Calling Balance Checker
 * 
 * This script uses the Hedera Agent Kit tool-calling agent approach
 * to actually execute balance checks and transfers.
 */
class ToolCallingBalanceChecker {
  private hederaAgentToolkit?: HederaLangchainToolkit;
  private agentExecutor?: AgentExecutor;
  private client?: Client;
  private env: NodeJS.ProcessEnv & EnvironmentConfig;

  constructor() {
    this.env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;
  }

  /**
   * Initialize Hedera Agent Kit with tool-calling agent
   */
  async initialize(): Promise<void> {
    console.log("🦌⚡ Initializing Tool Calling Balance Checker");
    console.log("=============================================");

    // Validate required environment variables
    const requiredVars = [
      'HEDERA_ACCOUNT_ID',
      'HEDERA_PRIVATE_KEY',
      'OPENAI_API_KEY'
    ];
    
    const missingVars = requiredVars.filter(varName => !this.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    try {
      // Initialize Hedera Client (using same approach as working example)
      this.client = Client.forTestnet();
      this.client.setOperator(this.env.HEDERA_ACCOUNT_ID!, this.env.HEDERA_PRIVATE_KEY!);

      // Initialize V3 Hedera Agent Kit (using default configuration like the working example)
      this.hederaAgentToolkit = new HederaLangchainToolkit({
        client: this.client,
        configuration: {}
      });

      // Initialize OpenAI LLM (using same config as working example)
      const llm = new ChatOpenAI({
        modelName: "gpt-4o",
        temperature: 0,
        apiKey: this.env.OPENAI_API_KEY,
      });

      // Create the agent prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', `You are a balance checker and transfer agent that can interact with the Hedera blockchain network.
        You have access to various Hedera tools that allow you to:
        - Query account balances and information
        - Check token balances for specific accounts
        - Transfer HBAR between accounts
        - Transfer tokens between accounts
        - Create and manage tokens
        - And much more!
        
        When asked to perform operations:
        1. Use the appropriate Hedera tools to execute the requested action
        2. Provide clear explanations of what you're doing
        3. Report the actual results from the blockchain
        
        Current Configuration:
        - Hedera Account: ${this.env.HEDERA_ACCOUNT_ID}
        - Network: ${this.env.HEDERA_NETWORK || 'testnet'}
        - Governance Contract: ${this.env.GOVERNANCE_CONTRACT_ID || 'Not configured'}
        
        Token Configuration:
        - SAUCE: ${this.env.CONTRACT_SAUCE_TOKEN || 'Not configured'}
        - LYNX: ${this.env.CONTRACT_LYNX_TOKEN || 'Not configured'}
        - WBTC: ${this.env.CONTRACT_WBTC_TOKEN || 'Not configured'}
        - USDC: ${this.env.CONTRACT_USDC_TOKEN || 'Not configured'}
        - JAM: ${this.env.CONTRACT_JAM_TOKEN || 'Not configured'}
        - HEADSTART: ${this.env.CONTRACT_HEADSTART_TOKEN || 'Not configured'}
        `],
        ['placeholder', '{chat_history}'],
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
      ]);

      // Get Hedera tools
      const hederaTools = this.hederaAgentToolkit.getTools();

      // Create the tool-calling agent (using same approach as working example)
      const agent = await createToolCallingAgent({
        llm,
        tools: hederaTools,
        prompt
      });
      
      // Create the agent executor (using same config as working example)
      this.agentExecutor = new AgentExecutor({
        agent,
        tools: hederaTools,
        verbose: true,
        maxIterations: 10
      });

      console.log("✅ Hedera Agent Kit initialized");
      console.log(`📋 Account ID: ${this.env.HEDERA_ACCOUNT_ID}`);
      console.log(`🔧 Loaded ${hederaTools.length} Hedera tools`);
      console.log(`🌐 Network: ${this.env.HEDERA_NETWORK || 'testnet'}`);

      // List available tools
      console.log("\n📋 Available Tools:");
      hederaTools.forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.name}: ${tool.description}`);
      });

    } catch (error) {
      console.error("❌ Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Check current balances using tool-calling agent
   */
  async checkBalances(): Promise<void> {
    console.log("\n🔍 Checking Current Balances");
    console.log("============================");

    if (!this.agentExecutor) {
      throw new Error("Not initialized. Call initialize() first.");
    }

    try {
      const response = await this.agentExecutor.invoke({
        input: `Check the current HBAR balance and all token balances for account ${this.env.HEDERA_ACCOUNT_ID}. Include balances for these specific tokens if configured: SAUCE (${this.env.CONTRACT_SAUCE_TOKEN || 'Not configured'}), LYNX (${this.env.CONTRACT_LYNX_TOKEN || 'Not configured'}), WBTC (${this.env.CONTRACT_WBTC_TOKEN || 'Not configured'}), USDC (${this.env.CONTRACT_USDC_TOKEN || 'Not configured'}), JAM (${this.env.CONTRACT_JAM_TOKEN || 'Not configured'}), HEADSTART (${this.env.CONTRACT_HEADSTART_TOKEN || 'Not configured'}).`
      });

      console.log("✅ Balance Check Results:");
      console.log("=========================");
      console.log(response.output);

    } catch (error) {
      console.error("❌ Failed to check balances:", error);
      throw error;
    }
  }

  /**
   * Transfer HBAR to governance contract using tool-calling agent
   */
  async transferHbarToContract(amount: string): Promise<void> {
    console.log("\n💰 Transferring HBAR to Governance Contract");
    console.log("===========================================");

    if (!this.agentExecutor) {
      throw new Error("Not initialized. Call initialize() first.");
    }

    const toContract = this.env.GOVERNANCE_CONTRACT_ID;

    if (!toContract) {
      console.error("❌ GOVERNANCE_CONTRACT_ID not configured");
      return;
    }

    try {
      const response = await this.agentExecutor.invoke({
        input: `Transfer ${amount} HBAR from account ${this.env.HEDERA_ACCOUNT_ID} to contract ${toContract}. First check the current HBAR balance of both accounts, then perform the transfer, and finally verify the transfer was successful.`
      });

      console.log("✅ HBAR Transfer Results:");
      console.log("========================");
      console.log(response.output);

    } catch (error) {
      console.error("❌ Failed to transfer HBAR:", error);
      throw error;
    }
  }

  /**
   * Transfer tokens to governance contract using tool-calling agent
   */
  async transferTokensToContract(tokenId: string, amount: string): Promise<void> {
    console.log("\n🪙 Transferring Tokens to Governance Contract");
    console.log("=============================================");

    if (!this.agentExecutor) {
      throw new Error("Not initialized. Call initialize() first.");
    }

    const toContract = this.env.GOVERNANCE_CONTRACT_ID;

    if (!toContract) {
      console.error("❌ GOVERNANCE_CONTRACT_ID not configured");
      return;
    }

    try {
      const response = await this.agentExecutor.invoke({
        input: `Transfer ${amount} tokens of token ${tokenId} from account ${this.env.HEDERA_ACCOUNT_ID} to contract ${toContract}. First check the current token balance of both accounts, then perform the transfer, and finally verify the transfer was successful.`
      });

      console.log("✅ Token Transfer Results:");
      console.log("=========================");
      console.log(response.output);

    } catch (error) {
      console.error("❌ Failed to transfer tokens:", error);
      throw error;
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log("🦌⚡ Tool Calling Balance Checker");
  console.log("=================================");

  const args = process.argv.slice(2);
  const command = args[0] || 'check';

  const checker = new ToolCallingBalanceChecker();

  try {
    await checker.initialize();

    switch (command.toLowerCase()) {
      case 'check':
        await checker.checkBalances();
        break;
      case 'transfer-hbar':
        const hbarAmount = args[1] || '0.1';
        await checker.transferHbarToContract(hbarAmount);
        break;
      case 'transfer-token':
        const tokenId = args[1];
        const tokenAmount = args[2] || '10';
        if (!tokenId) {
          console.error("❌ Token ID required. Usage: npm run tool:balance transfer-token <tokenId> [amount]");
          console.log("💡 Example: npm run tool:balance transfer-token 0.0.6212930 50");
          return;
        }
        await checker.transferTokensToContract(tokenId, tokenAmount);
        break;
      default:
        console.log("📋 Available commands:");
        console.log("  check           - Check current balances");
        console.log("  transfer-hbar   - Transfer HBAR to governance contract");
        console.log("  transfer-token  - Transfer tokens to governance contract");
        console.log("\n💡 Examples:");
        console.log("   npm run tool:balance check");
        console.log("   npm run tool:balance transfer-hbar 0.5");
        console.log("   npm run tool:balance transfer-token 0.0.6212930 100");
        break;
    }

  } catch (error) {
    console.error("❌ Failed to run tool calling balance checker:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 