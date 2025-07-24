#!/usr/bin/env node

// Suppress noisy warnings and errors
import './suppress-warnings.js';

import { config } from 'dotenv';
import { StandardsKit } from '@hashgraphonline/standards-agent-plugin';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Client, PrivateKey } from '@hashgraph/sdk';
import { HederaLangchainToolkit, AgentMode } from 'hedera-agent-kit';

// Load environment variables
config();

interface EnvironmentConfig {
  HEDERA_NETWORK?: string;
  BALANCER_AGENT_ACCOUNT_ID?: string;
  BALANCER_AGENT_PRIVATE_KEY?: string;
  GOVERNANCE_AGENT_ACCOUNT_ID?: string;
  OPENAI_API_KEY?: string;
  
  // Token configurations
  CONTRACT_SAUCE_TOKEN?: string;
  CONTRACT_LYNX_TOKEN?: string;
  CONTRACT_WBTC_TOKEN?: string;
  CONTRACT_USDC_TOKEN?: string;
  CONTRACT_JAM_TOKEN?: string;
  CONTRACT_HEADSTART_TOKEN?: string;
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
 * Governance Balance Checker
 * 
 * This script combines HCS-10 messaging with Hedera balance checking:
 * 1. Listens for governance ratio updates via HCS-10
 * 2. Uses Hedera Agent Kit to check current balances
 * 3. Analyzes what changes are needed to achieve target ratios
 * 4. Reports back via HCS-10
 */
class GovernanceBalanceChecker {
  private standardsKit?: StandardsKit;
  private hederaAgentToolkit?: HederaLangchainToolkit;
  private agentExecutor?: AgentExecutor;
  private client?: Client;
  private env: NodeJS.ProcessEnv & EnvironmentConfig;
  private isRunning: boolean = false;

  constructor() {
    this.env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;
  }

  /**
   * Initialize both StandardsKit and Hedera Agent Kit
   */
  async initialize(): Promise<void> {
    console.log("🦌⚡ Initializing Governance Balance Checker");
    console.log("============================================");

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
      this.client = Client.forTestnet().setOperator(
        this.env.BALANCER_AGENT_ACCOUNT_ID!,
        PrivateKey.fromStringDer(this.env.BALANCER_AGENT_PRIVATE_KEY!),
      );

      // Initialize V3 Hedera Agent Kit
      this.hederaAgentToolkit = new HederaLangchainToolkit({
        client: this.client,
        configuration: {
          tools: [], // Load all available tools
          context: {
            mode: AgentMode.RETURN_BYTES,
            accountId: this.env.BALANCER_AGENT_ACCOUNT_ID!,
          },
        },
      });

      // Initialize OpenAI LLM
      const llm = new ChatOpenAI({
        model: 'gpt-4o-mini',
      });

      // Create the agent prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', `You are a governance balance checker that can interact with the Hedera blockchain network.
        You have access to various Hedera tools that allow you to:
        - Query account balances and information
        - Check token balances for specific accounts
        - Transfer HBAR between accounts
        - Create and manage tokens
        - And much more!
        
        When you receive a governance ratio update:
        1. Check current balances for the agent account and configured tokens
        2. Analyze what changes are needed to achieve the target ratios
        3. Provide a clear summary of current state vs target state
        4. Suggest specific actions needed for rebalancing
        
        Current Configuration:
        - Hedera Account: ${this.env.BALANCER_AGENT_ACCOUNT_ID}
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

      // Initialize StandardsKit
      this.standardsKit = new StandardsKit({
        accountId: this.env.BALANCER_AGENT_ACCOUNT_ID,
        privateKey: this.env.BALANCER_AGENT_PRIVATE_KEY,
        network: (this.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
        openAIApiKey: this.env.OPENAI_API_KEY,
        openAIModelName: 'gpt-4o',
        verbose: false,
        disableLogging: true,
        operationalMode: 'autonomous'
      });

      await this.standardsKit.initialize();

      console.log("✅ Both StandardsKit and Hedera Agent Kit initialized");
      console.log(`📋 Account ID: ${this.env.BALANCER_AGENT_ACCOUNT_ID}`);
      console.log(`🔧 Loaded ${hederaTools.length} Hedera tools`);
      console.log(`🌐 Network: ${this.env.HEDERA_NETWORK || 'testnet'}`);

    } catch (error) {
      console.error("❌ Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Start the balance checker
   */
  async start(): Promise<void> {
    console.log("🚀 Starting Governance Balance Checker");
    console.log("======================================");

    if (!this.standardsKit || !this.agentExecutor) {
      throw new Error("Not initialized. Call initialize() first.");
    }

    this.isRunning = true;

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
      this.isRunning = false;
      process.exit(0);
    });

    console.log("✅ Balance checker started");
    console.log("🔗 Ready to receive governance updates via HCS-10");
    console.log("💡 Waiting for messages...");

    // Main loop - check for messages every 5 seconds
    while (this.isRunning) {
      try {
        // Check for new messages
        const messagesResponse = await this.standardsKit.processMessage('Get my latest messages');
        
        if (messagesResponse.output && messagesResponse.output !== 'No new messages') {
          console.log(`📨 Received new message(s):`);
          console.log(`   ${messagesResponse.output}`);
          
          // Check if it's a governance update
          if (messagesResponse.output.includes('GOVERNANCE_RATIO_UPDATE')) {
            await this.handleGovernanceUpdate(messagesResponse.output);
          }
        }
      } catch (error) {
        // Message check failed, continue running
        console.error("⚠️  Message check failed:", error instanceof Error ? error.message : String(error));
      }
      
      await this.sleep(5000);
    }
  }

  /**
   * Handle governance ratio update
   */
  private async handleGovernanceUpdate(messageContent: string): Promise<void> {
    console.log("📊 Processing governance ratio update");
    console.log("=====================================");

    if (!this.standardsKit || !this.agentExecutor) {
      throw new Error("Not initialized.");
    }

    try {
      // Try to parse the governance update
      let update: GovernanceRatioUpdate;
      try {
        // Extract JSON from the message content
        const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          update = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found in message");
        }
      } catch (parseError) {
        console.log("⚠️  Could not parse governance update JSON, treating as general message");
        return;
      }

      console.log("📋 Governance update received:");
      console.log(`   Changed parameter: ${update.changedParameter}`);
      console.log(`   Old value: ${update.changedValue.old}%`);
      console.log(`   New value: ${update.changedValue.new}%`);
      console.log(`   Summary: ${update.changeSummary}`);

      // Use the agent to check balances and analyze the update
      const balanceCheckPrompt = `Check the current balances for:
      1. Account ${this.env.BALANCER_AGENT_ACCOUNT_ID} (HBAR balance)
      2. Token ${this.env.CONTRACT_WBTC_TOKEN || 'WBTC token'} balance for account ${this.env.BALANCER_AGENT_ACCOUNT_ID}
      3. Any other configured tokens in the environment
      
      Then analyze this governance ratio update: ${JSON.stringify(update)}
      
      Report the current balances and what changes would be needed to achieve the target ratios.`;

      const response = await this.agentExecutor.invoke({
        input: balanceCheckPrompt
      });

      console.log("✅ Balance check and governance analysis:");
      console.log(response.output);

      // Send acknowledgment back via HCS-10
      const ackResponse = await this.standardsKit.processMessage(
        `Send acknowledgment to the governance agent that I received the governance update, checked balances, and here's my analysis: ${response.output}`
      );

      console.log("✅ Acknowledgment sent:", ackResponse.output);

    } catch (error) {
      console.error("❌ Failed to handle governance update:", error);
      
      // Send error acknowledgment
      try {
        await this.standardsKit.processMessage(
          `Send error acknowledgment to the governance agent that I failed to process the governance update: ${error instanceof Error ? error.message : String(error)}`
        );
      } catch (ackError) {
        console.error("❌ Failed to send error acknowledgment:", ackError);
      }
    }
  }

  /**
   * Utility function for sleeping
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log("🦌⚡ Governance Balance Checker");
  console.log("===============================");

  const checker = new GovernanceBalanceChecker();

  try {
    await checker.initialize();
    await checker.start();
  } catch (error) {
    console.error("❌ Failed to start balance checker:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 