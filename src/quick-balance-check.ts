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
 * Quick Balance Checker
 * 
 * This script directly triggers a balance check without waiting for HCS-10 messages.
 * It uses Hedera Agent Kit to check current balances and can optionally analyze
 * against target governance ratios.
 */
class QuickBalanceChecker {
  private hederaAgentToolkit?: HederaLangchainToolkit;
  private agentExecutor?: AgentExecutor;
  private client?: Client;
  private env: NodeJS.ProcessEnv & EnvironmentConfig;

  constructor() {
    this.env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;
  }

  /**
   * Initialize Hedera Agent Kit
   */
  async initialize(): Promise<void> {
    console.log("🦌⚡ Initializing Quick Balance Checker");
    console.log("======================================");

    // Validate required environment variables
    const requiredVars = [
      'BALANCER_AGENT_ACCOUNT_ID',
      'BALANCER_AGENT_PRIVATE_KEY',
      'OPENAI_API_KEY'
    ];
    
    const missingVars = requiredVars.filter(varName => !this.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    try {
      // Initialize Hedera Client
      const accountId = this.env.HEDERA_ACCOUNT_ID || this.env.BALANCER_AGENT_ACCOUNT_ID;
      const privateKey = this.env.HEDERA_PRIVATE_KEY || this.env.BALANCER_AGENT_PRIVATE_KEY;
      
      this.client = Client.forTestnet().setOperator(
        accountId!,
        PrivateKey.fromStringDer(privateKey!),
      );

      // Initialize V3 Hedera Agent Kit
      this.hederaAgentToolkit = new HederaLangchainToolkit({
        client: this.client,
        configuration: {
          tools: [], // Load all available tools
          context: {
            accountId: accountId!,
          },
        },
      });

      // Initialize OpenAI LLM
      const llm = new ChatOpenAI({
        model: 'gpt-4o-mini',
      });

      // Create the agent prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', `You are a balance checker that can interact with the Hedera blockchain network.
        You have access to various Hedera tools that allow you to:
        - Query account balances and information
        - Check token balances for specific accounts
        - Transfer HBAR between accounts
        - Create and manage tokens
        - And much more!
        
        When asked to check balances:
        1. Check current balances for the agent account and configured tokens
        2. Provide a clear summary of current state
        3. If target ratios are provided, analyze what changes are needed
        4. Suggest specific actions if rebalancing is needed
        
        Current Configuration:
        - Hedera Account: ${accountId}
        - Network: ${this.env.HEDERA_NETWORK || 'testnet'}
        
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

      // Create the underlying agent
      const agent = createToolCallingAgent({
        llm,
        tools: hederaTools,
        prompt,
      });
      
      // Wrap everything in an executor
      this.agentExecutor = new AgentExecutor({
        agent,
        tools: hederaTools,
        verbose: false,
      });

      console.log("✅ Hedera Agent Kit initialized");
      console.log(`📋 Account ID: ${accountId}`);
      console.log(`🔧 Loaded ${hederaTools.length} Hedera tools`);
      console.log(`🌐 Network: ${this.env.HEDERA_NETWORK || 'testnet'}`);

    } catch (error) {
      console.error("❌ Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Check current balances
   */
  async checkBalances(): Promise<void> {
    console.log("🔍 Checking Current Balances");
    console.log("============================");

    if (!this.agentExecutor) {
      throw new Error("Not initialized. Call initialize() first.");
    }

    try {
      const accountId = this.env.HEDERA_ACCOUNT_ID || this.env.BALANCER_AGENT_ACCOUNT_ID;
      const balanceCheckPrompt = `Check the current balances for:
      1. Account ${accountId} (HBAR balance)
      2. All configured tokens for account ${accountId}:
         - SAUCE token: ${this.env.CONTRACT_SAUCE_TOKEN || 'Not configured'}
         - LYNX token: ${this.env.CONTRACT_LYNX_TOKEN || 'Not configured'}
         - WBTC token: ${this.env.CONTRACT_WBTC_TOKEN || 'Not configured'}
         - USDC token: ${this.env.CONTRACT_USDC_TOKEN || 'Not configured'}
         - JAM token: ${this.env.CONTRACT_JAM_TOKEN || 'Not configured'}
         - HEADSTART token: ${this.env.CONTRACT_HEADSTART_TOKEN || 'Not configured'}
      
      Provide a clear summary of all current balances, including any tokens that have non-zero balances.`;

      const response = await this.agentExecutor.invoke({
        input: balanceCheckPrompt
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
   * Check balances against target ratios
   */
  async checkBalancesWithTargets(targetRatios: Record<string, number>): Promise<void> {
    console.log("⚖️  Checking Balances Against Target Ratios");
    console.log("===========================================");

    if (!this.agentExecutor) {
      throw new Error("Not initialized. Call initialize() first.");
    }

    try {
      const accountId = this.env.HEDERA_ACCOUNT_ID || this.env.BALANCER_AGENT_ACCOUNT_ID;
      const analysisPrompt = `Check the current balances for:
      1. Account ${accountId} (HBAR balance)
      2. All configured tokens for account ${accountId}:
         - SAUCE token: ${this.env.CONTRACT_SAUCE_TOKEN || 'Not configured'}
         - LYNX token: ${this.env.CONTRACT_LYNX_TOKEN || 'Not configured'}
         - WBTC token: ${this.env.CONTRACT_WBTC_TOKEN || 'Not configured'}
         - USDC token: ${this.env.CONTRACT_USDC_TOKEN || 'Not configured'}
         - JAM token: ${this.env.CONTRACT_JAM_TOKEN || 'Not configured'}
         - HEADSTART token: ${this.env.CONTRACT_HEADSTART_TOKEN || 'Not configured'}
      
      Then analyze against these target ratios: ${JSON.stringify(targetRatios)}
      
      Report the current balances and what changes would be needed to achieve the target ratios.`;

      const response = await this.agentExecutor.invoke({
        input: analysisPrompt
      });

      console.log("✅ Balance Analysis Results:");
      console.log("============================");
      console.log(response.output);

    } catch (error) {
      console.error("❌ Failed to analyze balances:", error);
      throw error;
    }
  }

  /**
   * Transfer HBAR to governance contract
   */
  async transferHbarToContract(amount: string): Promise<void> {
    console.log("💰 Transferring HBAR to Governance Contract");
    console.log("===========================================");

    if (!this.agentExecutor) {
      throw new Error("Not initialized. Call initialize() first.");
    }

    const fromAccount = this.env.HEDERA_ACCOUNT_ID || this.env.BALANCER_AGENT_ACCOUNT_ID;
    const toContract = this.env.GOVERNANCE_CONTRACT_ID;

    if (!toContract) {
      console.error("❌ GOVERNANCE_CONTRACT_ID not configured");
      return;
    }

    try {
      const transferPrompt = `Transfer ${amount} HBAR from account ${fromAccount} to contract ${toContract}.
      
      First check the current HBAR balance of both accounts, then perform the transfer, and finally verify the transfer was successful.`;

      const response = await this.agentExecutor.invoke({
        input: transferPrompt
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
   * Transfer tokens to governance contract
   */
  async transferTokensToContract(tokenId: string, amount: string): Promise<void> {
    console.log("🪙 Transferring Tokens to Governance Contract");
    console.log("=============================================");

    if (!this.agentExecutor) {
      throw new Error("Not initialized. Call initialize() first.");
    }

    const fromAccount = this.env.HEDERA_ACCOUNT_ID || this.env.BALANCER_AGENT_ACCOUNT_ID;
    const toContract = this.env.GOVERNANCE_CONTRACT_ID;

    if (!toContract) {
      console.error("❌ GOVERNANCE_CONTRACT_ID not configured");
      return;
    }

    try {
      const transferPrompt = `Transfer ${amount} tokens of token ${tokenId} from account ${fromAccount} to contract ${toContract}.
      
      First check the current token balance of both accounts, then perform the transfer, and finally verify the transfer was successful.`;

      const response = await this.agentExecutor.invoke({
        input: transferPrompt
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
  console.log("🦌⚡ Quick Balance Checker");
  console.log("==========================");

  const args = process.argv.slice(2);
  const command = args[0] || 'check';

  const checker = new QuickBalanceChecker();

  try {
    await checker.initialize();

    switch (command.toLowerCase()) {
      case 'check':
        await checker.checkBalances();
        break;
      case 'analyze':
        // Example target ratios - you can modify these
        const targetRatios = {
          hbar: 30,
          wbtc: 15,
          sauce: 20,
          usdc: 15,
          jam: 12,
          headstart: 8
        };
        await checker.checkBalancesWithTargets(targetRatios);
        break;
      case 'transfer-hbar':
        const hbarAmount = args[1] || '0.1';
        await checker.transferHbarToContract(hbarAmount);
        break;
      case 'transfer-token':
        const tokenId = args[1];
        const tokenAmount = args[2] || '10';
        if (!tokenId) {
          console.error("❌ Token ID required. Usage: npm run quick:balance transfer-token <tokenId> [amount]");
          console.log("💡 Example: npm run quick:balance transfer-token 0.0.6212930 50");
          return;
        }
        await checker.transferTokensToContract(tokenId, tokenAmount);
        break;
      default:
        console.log("📋 Available commands:");
        console.log("  check           - Check current balances");
        console.log("  analyze         - Check balances against target ratios");
        console.log("  transfer-hbar   - Transfer HBAR to governance contract");
        console.log("  transfer-token  - Transfer tokens to governance contract");
        console.log("\n💡 Examples:");
        console.log("   npm run quick:balance check");
        console.log("   npm run quick:balance transfer-hbar 0.5");
        console.log("   npm run quick:balance transfer-token 0.0.6212930 100");
        break;
    }

  } catch (error) {
    console.error("❌ Failed to run balance checker:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 