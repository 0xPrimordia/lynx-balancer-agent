#!/usr/bin/env node

// Suppress Zod warnings from Hedera Agent Kit
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
  BALANCER_INBOUND_TOPIC_ID?: string;
  BALANCER_OUTBOUND_TOPIC_ID?: string;
  BALANCER_PROFILE_TOPIC_ID?: string;
  GOVERNANCE_AGENT_ACCOUNT_ID?: string;
  OPENAI_API_KEY?: string;
  AGENT_NAME?: string;
  AGENT_DESCRIPTION?: string;
  AGENT_CAPABILITIES?: string;
  AGENT_TAGS?: string;

  GOVERNANCE_CONTRACT_ID?: string;
  CONTRACT_SAUCE_TOKEN?: string;
  CONTRACT_LYNX_TOKEN?: string;
  CONTRACT_WBTC_TOKEN?: string;
  CONTRACT_USDC_TOKEN?: string;
  CONTRACT_JAM_TOKEN?: string;
  CONTRACT_HEADSTART_TOKEN?: string;
  TREASURY_ACCOUNT_ID?: string;
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

interface RebalanceStatusMessage {
  type: 'REBALANCE_STATUS';
  version: '1.0';
  timestamp: number;
  originalRequestId: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed' | 'paused';
  payload: {
    completedSwaps: number;
    totalSwaps: number;
    progressPercentage: number;
    totalValueRebalanced: number;
    totalSlippageIncurred: number;
    totalFeesSpent: number;
    currentBalances?: Record<string, number>;
    error?: {
      code: string;
      message: string;
      failedSwap?: string;
      recoveryAction?: string;
    };
  };
}

/**
 * Lynx Treasury Balancer Agent (V3)
 * 
 * This agent handles automated treasury rebalancing using V3 Hedera Agent Kit:
 * 1. Listening for governance ratio updates from the governance agent
 * 2. Analyzing current portfolio vs target allocations
 * 3. Calculating required token swaps for rebalancing
 * 4. Executing swaps through DEX integrations
 * 5. Reporting status back to governance agent
 */
export class LynxBalancerAgent {
  private agentExecutor?: AgentExecutor;
  private hederaAgentToolkit?: HederaLangchainToolkit;
  private client?: Client;
  private env: NodeJS.ProcessEnv & EnvironmentConfig;
  private isRunning: boolean = false;
  private backoffMultiplier: number = 1;
  private maxBackoff: number = 300000; // 5 minutes max backoff

  constructor() {
    this.env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;
  }

  /**
   * Initialize the balancer agent with V3 Hedera Agent Kit
   */
  async initialize(): Promise<void> {
    console.log("🦌⚡ Initializing Lynx Treasury Balancer Agent (V3)");
    console.log("==================================================");

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
        ['system', `You are a treasury balancer agent that can interact with the Hedera blockchain network.
        You have access to various Hedera tools that allow you to:
        - Query account balances and information
        - Create and manage HCS (Hedera Consensus Service) topics
        - Submit and retrieve messages from topics
        - Transfer HBAR between accounts
        - Create and manage tokens
        - And much more!
        
        For portfolio rebalancing:
        1. Use Hedera tools to check current balances (account and token balances)
        2. Calculate required changes based on governance ratios
        3. Execute transfers between accounts as needed
        4. Report status and results
        
        When users ask you to perform blockchain operations, use the appropriate tools to complete their requests.
        Always provide clear explanations of what you're doing and the results.
        
        Current Configuration:
        - Hedera Account: ${this.env.BALANCER_AGENT_ACCOUNT_ID}
        - Network: ${this.env.HEDERA_NETWORK || 'testnet'}
        - DEX Account: ${this.env.BALANCER_AGENT_ACCOUNT_ID} (same as agent account)
        - Governance Contract: ${this.env.GOVERNANCE_CONTRACT_ID || 'Not configured'}
        - Treasury Account: ${this.env.TREASURY_ACCOUNT_ID || 'Not configured'}
        
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

      // Fetch tools from toolkit
      const hederaTools = this.hederaAgentToolkit.getTools();
      const allTools = hederaTools;

      // Create the underlying agent
      const agent = createToolCallingAgent({
        llm,
        tools: allTools,
        prompt,
      });
      
      // Wrap everything in an executor that will maintain memory
      this.agentExecutor = new AgentExecutor({
        agent,
        tools: allTools,
        verbose: false, // Disable verbose logging
      });

      console.log("✅ V3 Hedera Agent Kit initialized");
      console.log(`📋 Account ID: ${this.env.BALANCER_AGENT_ACCOUNT_ID}`);
      console.log(`🔧 Loaded ${allTools.length} tools (${hederaTools.length} Hedera + 2 Treasury)`);
    console.log(`🌐 Network: ${this.env.HEDERA_NETWORK || 'testnet'}`);
      console.log(`🏦 DEX Account: ${this.env.BALANCER_AGENT_ACCOUNT_ID} (same as agent account)`);

    } catch (error) {
      console.error("❌ Failed to initialize V3 Hedera Agent Kit:", error);
      throw error;
    }
  }

  /**
   * Register agent (now handled by V3 Hedera Agent Kit)
   */
  async registerAgent(): Promise<void> {
    console.log("🔐 Agent registration (handled by V3 Hedera Agent Kit)");
    
    if (!this.agentExecutor) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    try {
      // Test the agent with a simple query to ensure it's working
      const response = await this.agentExecutor.invoke({ 
        input: "What's my account balance?" 
      });
      
      console.log("✅ Agent registration test successful");
      console.log("📊 Balance query result:", response.output);
      
    } catch (error) {
      console.error("❌ Agent registration test failed:", error);
      throw error;
    }
  }

  /**
   * Start connection monitoring (now handled by V3 Hedera Agent Kit)
   */
  async startConnectionMonitoring(): Promise<void> {
    console.log("🔍 Connection monitoring (handled by V3 Hedera Agent Kit)");
    
    if (!this.agentExecutor) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    console.log("✅ Connection monitoring ready");
    console.log("💡 The agent is now ready to handle blockchain operations");
  }

  /**
   * Start the agent main loop
   */
  async startAgent(): Promise<void> {
    console.log("🚀 Starting Lynx Balancer Agent (V3)");
    console.log("=====================================");

    if (!this.agentExecutor) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    this.isRunning = true;
    console.log("✅ Agent started successfully");
    console.log("🤖 Agent is ready for interactions!");
    console.log("\n💡 Try asking:");
    console.log("   • 'What's my account balance?'");
    console.log("   • 'Create a new topic for governance updates'");
    console.log("   • 'Submit a message to topic 0.0.123456'");
    console.log("   • 'Get the latest messages from my topic'");
    console.log("   • 'Process a governance ratio update'");

    // Keep the agent running
    while (this.isRunning) {
      try {
        // The agent is now ready to handle requests
        // In a real implementation, you might want to add a message queue or webhook endpoint
        await this.sleep(1000);
      } catch (error) {
        console.error("❌ Error in agent main loop:", error);
        await this.handleError(error);
      }
    }
  }

  /**
   * Process a governance ratio update
   */
  async processGovernanceUpdate(update: GovernanceRatioUpdate): Promise<void> {
    console.log("📊 Processing governance ratio update");
    console.log("=====================================");

    if (!this.agentExecutor) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    try {
      // Create a status message
      const statusMessage: RebalanceStatusMessage = {
        type: 'REBALANCE_STATUS',
        version: '1.0',
        timestamp: Date.now(),
        originalRequestId: update.transactionId,
        status: 'started',
        payload: {
          completedSwaps: 0,
          totalSwaps: 0,
          progressPercentage: 0,
          totalValueRebalanced: 0,
          totalSlippageIncurred: 0,
          totalFeesSpent: 0,
        }
      };

      console.log("📋 Governance update received:");
      console.log(`   Changed parameter: ${update.changedParameter}`);
      console.log(`   Old value: ${update.changedValue.old}%`);
      console.log(`   New value: ${update.changedValue.new}%`);
      console.log(`   Summary: ${update.changeSummary}`);

      // Use the agent to analyze the update
      const analysisResponse = await this.agentExecutor.invoke({
        input: `Analyze this governance ratio update and determine what actions are needed: ${JSON.stringify(update)}`
      });

      console.log("🤖 Agent analysis:", analysisResponse.output);

      // Simulate rebalancing process
      await this.simulateRebalancing(update, statusMessage);

      } catch (error) {
      console.error("❌ Failed to process governance update:", error);
      throw error;
    }
  }

  /**
   * Handle incoming message using V3 Hedera Agent Kit
   */
  private async handleIncomingMessage(messageContent: string): Promise<void> {
    console.log("📨 Processing incoming message");
    console.log("==============================");

    if (!this.agentExecutor) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    try {
      // Try to parse as governance update
      try {
        const update: GovernanceRatioUpdate = JSON.parse(messageContent);
        if (update.type === 'GOVERNANCE_RATIO_UPDATE') {
          await this.handleGovernanceRatioUpdate(update);
          return;
        }
      } catch (parseError) {
        // Not a JSON governance update, treat as general message
      }

      // Handle as general message
      await this.handleGeneralMessage(messageContent);

    } catch (error) {
      console.error("❌ Failed to handle incoming message:", error);
      throw error;
    }
  }

  /**
   * Handle governance ratio update
   */
  private async handleGovernanceRatioUpdate(update: GovernanceRatioUpdate): Promise<void> {
    console.log("📊 Processing governance ratio update");
    console.log("=====================================");

    if (!this.agentExecutor) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    try {
      // First, check current balances using Hedera tools
      const balanceCheckPrompt = `Check the current balances for:
      1. Account ${this.env.BALANCER_AGENT_ACCOUNT_ID} (HBAR balance)
      2. Token ${this.env.CONTRACT_WBTC_TOKEN || 'WBTC token'} balance for account ${this.env.BALANCER_AGENT_ACCOUNT_ID}
      3. Any other configured tokens in the environment
      
      Then analyze this governance ratio update: ${JSON.stringify(update)}
      
      Report the current balances and what changes would be needed to achieve the target ratios.`;

      const response = await this.agentExecutor.invoke({
        input: balanceCheckPrompt
      });

      console.log("✅ Balance check and governance analysis:", response.output);

      // Create initial status message
      const initialStatus: RebalanceStatusMessage = {
      type: 'REBALANCE_STATUS',
      version: '1.0',
      timestamp: Date.now(),
      originalRequestId: update.transactionId,
      status: 'started',
      payload: {
        completedSwaps: 0,
        totalSwaps: 0,
        progressPercentage: 0,
        totalValueRebalanced: 0,
        totalSlippageIncurred: 0,
          totalFeesSpent: 0,
        }
      };

      // Send initial status
      await this.sendStatusUpdate(initialStatus);

    } catch (error) {
      console.error("❌ Failed to handle governance ratio update:", error);
      throw error;
    }
  }

  /**
   * Handle general message
   */
  private async handleGeneralMessage(message: string): Promise<void> {
    console.log("💬 Processing general message");
    console.log("=============================");

    if (!this.agentExecutor) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    try {
      // Use the agent to process the general message
      const response = await this.agentExecutor.invoke({
        input: `Process this message: ${message}`
      });

      console.log("✅ General message processed:", response.output);

      } catch (error) {
      console.error("❌ Failed to handle general message:", error);
      throw error;
    }
  }

  /**
   * Simulate rebalancing process
   */
  private async simulateRebalancing(
    update: GovernanceRatioUpdate, 
    initialStatus: RebalanceStatusMessage
  ): Promise<void> {
    console.log("⚖️  Simulating rebalancing process");
    console.log("==================================");

    if (!this.agentExecutor) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    try {
      // Send initial status
    await this.sendStatusUpdate(initialStatus);

      // Simulate progress updates
      const progressSteps = [
        { status: 'in_progress' as const, progress: 25, completedSwaps: 2, totalSwaps: 8 },
        { status: 'in_progress' as const, progress: 50, completedSwaps: 4, totalSwaps: 8 },
        { status: 'in_progress' as const, progress: 75, completedSwaps: 6, totalSwaps: 8 },
        { status: 'completed' as const, progress: 100, completedSwaps: 8, totalSwaps: 8 }
      ];

      for (const step of progressSteps) {
        await this.sleep(2000); // Simulate processing time

        const statusUpdate: RebalanceStatusMessage = {
          ...initialStatus,
          timestamp: Date.now(),
          status: step.status,
          payload: {
            ...initialStatus.payload,
            completedSwaps: step.completedSwaps,
            totalSwaps: step.totalSwaps,
            progressPercentage: step.progress,
            totalValueRebalanced: step.progress * 1000, // Simulate value
            totalSlippageIncurred: step.progress * 5, // Simulate slippage
            totalFeesSpent: step.progress * 2, // Simulate fees
          }
        };

        await this.sendStatusUpdate(statusUpdate);
      }

      console.log("✅ Rebalancing simulation completed");

    } catch (error) {
      console.error("❌ Failed to simulate rebalancing:", error);
      throw error;
    }
  }

  /**
   * Send status update using V3 Hedera Agent Kit
   */
  private async sendStatusUpdate(status: RebalanceStatusMessage): Promise<void> {
    console.log("📤 Sending status update");
    console.log("========================");

    if (!this.agentExecutor) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    try {
      // Use the agent to send the status update
      const response = await this.agentExecutor.invoke({
        input: `Send this status update: ${JSON.stringify(status)}`
      });

      console.log("✅ Status update sent:", response.output);

    } catch (error) {
      console.error("❌ Failed to send status update:", error);
      throw error;
    }
  }

  /**
   * Send response to last connection
   */
  private async sendResponseToLastConnection(response: string): Promise<void> {
    console.log("📤 Sending response to connection");
    console.log("==================================");

    if (!this.agentExecutor) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    try {
      // Use the agent to send the response
      const agentResponse = await this.agentExecutor.invoke({
        input: `Send this response: ${response}`
      });

      console.log("✅ Response sent:", agentResponse.output);

    } catch (error) {
      console.error("❌ Failed to send response:", error);
      throw error;
    }
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    console.log("🛑 Stopping Lynx Balancer Agent");
    this.isRunning = false;
    console.log("✅ Agent stopped");
  }

  /**
   * Utility function for sleeping
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle errors with exponential backoff
   */
  private async handleError(error: unknown): Promise<void> {
    console.error("❌ Error occurred:", error);
    
    const backoffTime = Math.min(1000 * this.backoffMultiplier, this.maxBackoff);
    console.log(`⏳ Waiting ${backoffTime}ms before retrying...`);
    
    await this.sleep(backoffTime);
    this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, 60); // Cap at 60x
  }

  /**
   * Safe API call wrapper
   */
  private async safeApiCall<T>(operation: () => Promise<T>, operationName: string, fallbackMessage?: string): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      console.error(`❌ ${operationName} failed:`, error);
      if (fallbackMessage) {
        console.log(`💡 ${fallbackMessage}`);
      }
      return null;
    }
  }
}

/**
 * Main function for running the balancer agent
 */
async function main(): Promise<void> {
  console.log("🦌⚡ Lynx Treasury Balancer Agent (V3)");
  console.log("======================================");

  const agent = new LynxBalancerAgent();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
    await agent.stop();
    process.exit(0);
  });

  try {
    await agent.initialize();
    await agent.registerAgent();
    await agent.startConnectionMonitoring();
    await agent.startAgent();
  } catch (error) {
    console.error("❌ Failed to start balancer agent:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}