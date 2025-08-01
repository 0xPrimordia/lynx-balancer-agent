import { config } from 'dotenv';
import { EnvironmentConfig } from './agent-config.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Client, TopicMessageQuery, Timestamp } from '@hashgraph/sdk';
import { HederaLangchainToolkit, AgentMode, coreHTSPlugin, coreAccountPlugin, coreConsensusPlugin, coreQueriesPlugin } from 'hedera-agent-kit';
import { TokenTransferTool } from '../tools/token-transfer-tool.js';
import { HbarWithdrawalTool } from '../tools/hbar-withdrawal-tool.js';
import { TokenWithdrawalTool } from '../tools/token-withdrawal-tool.js';

import { ContractRatioTool, TokenSupplyTool } from '../tools/contract-ratio-tool.js';

// No plugin needed - let the agent use existing tools directly!

// Load environment variables
config();

/**
 * Lynx Balancer Agent - Main Agent Class
 * 
 * This agent combines HCS-10 messaging with blockchain operations:
 * 1. Listens for governance ratio updates via HCS-10
 * 2. Processes updates and executes rebalancing operations
 * 3. Reports status back to governance agent
 */
export class LynxBalancerAgent {
  private env: EnvironmentConfig;
  private isRunning: boolean = false;
  
  // Token configuration for weight-based system
  private readonly TOKEN_CONFIG = {
    HBAR: {
      tokenId: 'HBAR',
      decimals: 8,
      name: 'HBAR'
    },
    SAUCE: {
      tokenId: '0.0.1183558',
      decimals: 6,
      name: 'SAUCE'
    },
    USDC: {
      tokenId: '0.0.6212931',
      decimals: 6,
      name: 'USDC'
    },
    WBTC: {
      tokenId: '0.0.6212930',
      decimals: 8,
      name: 'WBTC'
    },
    JAM: {
      tokenId: '0.0.6212932',
      decimals: 8,
      name: 'JAM'
    },
    HEADSTART: {
      tokenId: '0.0.6212933',
      decimals: 8,
      name: 'HEADSTART'
    }
  };

  // Contract divisor (currently hardcoded to 10, will be DAO parameter in future)
  private readonly CONTRACT_DIVISOR = 10;

  // Blockchain tools
  private hederaAgentToolkit?: HederaLangchainToolkit;
  private agentExecutor?: AgentExecutor;
  private client?: Client;

  constructor() {
    this.env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;
  }





  /**
   * Execute full rebalancing based on current contract ratios
   * This is the main rebalancing function that can be called from startup or alerts
   */
  async executeRebalancing(): Promise<void> {
    console.log("⚖️  Executing portfolio rebalancing...");
    console.log("🔄 Starting treasury ratio validation...");
    await this.validateTreasuryRatios();
    console.log("✅ Treasury ratio validation completed");
  }

  /**
   * Validate that treasury balances match the contract's expected ratios
   * Pure agent approach - no parsing, no plugins, just agent intelligence!
   */
  private async validateTreasuryRatios(): Promise<void> {
    if (!this.agentExecutor) {
      throw new Error("Agent executor not initialized");
    }

    try {
      console.log("🔍 Validating treasury ratios using pure agent approach...");
      
      // Let the agent handle EVERYTHING with detailed reporting at each step
      const rebalancingResponse = await this.agentExecutor.invoke({
        input: `I need you to rebalance the treasury portfolio with detailed reporting. Please do the following step by step:

**STEP 1: GET CONTRACT RATIOS**
Use the contract_ratio_query tool to get current ratios from governance contract ${this.env.GOVERNANCE_CONTRACT_ID}
Show me the exact ratios you received.

**STEP 2: GET LYNX TOTAL SUPPLY** 
Use the token_supply_query tool to get total supply of LYNX token ${this.env.CONTRACT_LYNX_TOKEN}
Show me the exact supply number you received.

**STEP 3: GET CURRENT HBAR BALANCE**
Use the get_hbar_balance_query tool to get current HBAR balance for contract ${this.env.GOVERNANCE_CONTRACT_ID}
Show me the current HBAR balance.

**STEP 4: GET CURRENT TOKEN BALANCES**
Use the get_account_token_balances_query tool to get current token balances for contract ${this.env.GOVERNANCE_CONTRACT_ID}
Show me all current token balances.

**STEP 5: CALCULATE REQUIRED BALANCES**
For each token in the ratios, calculate required balances using: Required = (LYNX Supply × Ratio) ÷ 10
Show me the calculation for each token like this:
- HBAR: Required = (38 × 40) ÷ 10 = 152 HBAR | Current = XXX HBAR | Difference = XXX
- SAUCE: Required = (38 × 25) ÷ 10 = 95 tokens | Current = XXX tokens | Difference = XXX
(etc for each token)

**STEP 6: CHECK TOLERANCE**
For each token, check if the difference is within 5% tolerance.
Show me which tokens are OUT OF BALANCE.

**STEP 7: EXECUTE TRANSFERS**
For any tokens outside tolerance, execute the transfers:
- Use transfer_hbar tool to send HBAR TO the contract (if need more HBAR)
- Use token_transfer_tool to send tokens TO the contract (if need more tokens)  
- Use hbar_withdrawal_tool to withdraw HBAR FROM contract (if have too much HBAR)
- Use token_withdrawal_tool to withdraw tokens FROM contract (if have too much tokens)

**STEP 8: VERIFY FINAL BALANCES**
After all transfers, check balances again to confirm they're now within tolerance.

Skip the LYNX token itself since it's the governance token.

Please report each step clearly so I can verify your calculations!`
      });

      console.log("📄 Agent Response:", rebalancingResponse.output);
      console.log("✅ Agent completed treasury rebalancing");

    } catch (error) {
      console.error("❌ Failed to validate treasury ratios:", error);
    }
  }


  /**
   * Initialize the balancer agent
   */
  async initialize(): Promise<void> {
    console.log("🦌⚡ Initializing Lynx Balancer Agent");
    console.log("=====================================");

    // Validate required environment variables
    const requiredVars = [
      'BALANCER_AGENT_ACCOUNT_ID',
      'BALANCER_AGENT_PRIVATE_KEY',
      'OPENAI_API_KEY',
      'HEDERA_ACCOUNT_ID',
      'HEDERA_PRIVATE_KEY',
      'GOVERNANCE_CONTRACT_ID',
      'CONTRACT_LYNX_TOKEN'
      // Note: BALANCER_ALERT_TOPIC_ID is checked later when starting topic monitoring
    ];
    
    const missingVars = requiredVars.filter(varName => !this.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    try {
      // TODO: Re-enable ConversationalAgent when v0.1.205 fixes are confirmed working
      // Initialize HCS-10 messaging
      // await this.agentMessaging.initialize();
      
      // Activate the agent (no profile creation needed)  
      // await this.agentMessaging.activateAgent();

      // Initialize blockchain tools
      await this.initializeBlockchainTools();

      console.log("✅ Lynx Balancer Agent initialized successfully");
      console.log(`📋 Account ID: ${this.env.BALANCER_AGENT_ACCOUNT_ID}`);
      console.log(`🤖 Governance Agent: ${this.env.GOVERNANCE_AGENT_ACCOUNT_ID || 'Not configured'}`);
      console.log(`🌐 Network: ${this.env.HEDERA_NETWORK || 'testnet'}`);

    } catch (error) {
      console.error("❌ Failed to initialize balancer agent:", error);
      throw error;
    }
  }

  /**
   * Initialize blockchain tools for rebalancing operations
   */
  private async initializeBlockchainTools(): Promise<void> {
    console.log("🔧 Initializing blockchain tools for rebalancing...");

    try {
      // Initialize Hedera Client (following tool-calling-balance-check pattern)
      this.client = Client.forTestnet();
      this.client.setOperator(this.env.HEDERA_ACCOUNT_ID!, this.env.HEDERA_PRIVATE_KEY!);

      // Initialize V3 Hedera Agent Kit with plugins
      this.hederaAgentToolkit = new HederaLangchainToolkit({
        client: this.client,
        configuration: {
          tools: [], // empty array loads all tools
          context: {
            mode: AgentMode.AUTONOMOUS,
          },
          plugins: [coreHTSPlugin, coreAccountPlugin, coreConsensusPlugin, coreQueriesPlugin],
        }
      });

      // Initialize OpenAI LLM (following tool-calling-balance-check pattern)
      const llm = new ChatOpenAI({
        modelName: "gpt-4o-mini",
        temperature: 0,
        apiKey: this.env.OPENAI_API_KEY,
      });

      // Create the agent prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', `You are a treasury balancing agent for the Lynx DAO.
          You have access to Hedera blockchain tools that allow you to:
          - Query account balances and information
          - Check token balances for specific accounts
          - Transfer HBAR between accounts
          - Transfer tokens between accounts
          - Call contract functions for withdrawals

          Current Configuration:
          - Operator Account: ${this.env.HEDERA_ACCOUNT_ID}
          - Governance Contract: ${this.env.GOVERNANCE_CONTRACT_ID}
          - Network: ${this.env.HEDERA_NETWORK || 'testnet'}

          Your job is to maintain target portfolio ratios by rebalancing token holdings.`],
        ['user', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
      ]);

      // Get Hedera tools and add custom tools (following tool-calling-balance-check pattern)
      const hederaTools = this.hederaAgentToolkit.getTools();
      const tokenTransferTool = new TokenTransferTool(this.client);
      const hbarWithdrawalTool = new HbarWithdrawalTool(this.client);
      const tokenWithdrawalTool = new TokenWithdrawalTool(this.client);
      const contractRatioTool = new ContractRatioTool(this.client);
      const tokenSupplyTool = new TokenSupplyTool(this.client);
      // Using built-in get-topic-messages-query instead of custom topic query tool
      const allTools = [...hederaTools, tokenTransferTool, hbarWithdrawalTool, tokenWithdrawalTool, contractRatioTool, tokenSupplyTool];

      // Create the tool-calling agent (following tool-calling-balance-check pattern)
      const agent = await createToolCallingAgent({
        llm,
        tools: allTools,
        prompt
      });
      
      // Create the agent executor (following tool-calling-balance-check pattern)
      this.agentExecutor = new AgentExecutor({
        agent,
        tools: allTools,
        verbose: false,
        maxIterations: 10
      });

      console.log("✅ Blockchain tools initialized");
      console.log(`📋 Operator Account: ${this.env.HEDERA_ACCOUNT_ID}`);
      console.log(`🏛️  Governance Contract: ${this.env.GOVERNANCE_CONTRACT_ID}`);

    } catch (error) {
      console.error("❌ Failed to initialize blockchain tools:", error);
      throw error;
    }
  }

  /**
   * Start the balancer agent
   */
  async start(): Promise<void> {
    console.log("🚀 Starting Lynx Balancer Agent");
    console.log("=================================");

    if (!this.isRunning) {
      this.isRunning = true;
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
        await this.stop();
        process.exit(0);
      });

      try {
        // Start topic monitoring for balancer alerts
        await this.startTopicMonitoring();
      } catch (error) {
        console.error("❌ Error in agent main loop:", error);
        await this.stop();
        throw error;
      }
    }
  }

  /**
   * Start monitoring the balancer alerts topic
   */
  private async startTopicMonitoring(): Promise<void> {
    if (!this.agentExecutor) {
      throw new Error("Agent executor not initialized");
    }

    const topicId = this.env.BALANCER_ALERT_TOPIC_ID;
    if (!topicId || topicId.trim() === '') {
      console.log("⚠️  BALANCER_ALERT_TOPIC_ID is not configured or empty");
      console.log("🔧 Please run 'npm run test:alert hbar' first to create the topic");
      console.log("📋 Then add the topic ID to your .env file: BALANCER_ALERT_TOPIC_ID=0.0.XXXXXX");
      console.log("🔄 Waiting for topic configuration...");
      
      // Wait and check periodically for topic ID to be configured
      while (this.isRunning && (!this.env.BALANCER_ALERT_TOPIC_ID || this.env.BALANCER_ALERT_TOPIC_ID.trim() === '')) {
        await this.sleep(10000);
        // Reload environment (in case .env file was updated)
        const newTopicId = process.env.BALANCER_ALERT_TOPIC_ID;
        if (newTopicId && newTopicId.trim() !== '') {
          this.env.BALANCER_ALERT_TOPIC_ID = newTopicId;
          break;
        }
      }
      
      if (!this.isRunning) return;
    }

    const finalTopicId = this.env.BALANCER_ALERT_TOPIC_ID!;
    console.log("📡 Starting topic monitoring...");
    console.log(`🎯 Monitoring topic: ${finalTopicId}`);

    try {
      // Execute initial rebalancing on startup
      await this.executeRebalancing();

      // Subscribe to topic messages using TopicMessageQuery
      const subscriptionStartTime = new Date();
      console.log("🔄 Starting real-time topic subscription...");
      console.log(`⏰ Subscription start time: ${subscriptionStartTime.toISOString()}`);
      console.log("📝 Only new messages from this point forward will be processed");
      
      new TopicMessageQuery()
        .setTopicId(finalTopicId)
        .setStartTime(Timestamp.fromDate(subscriptionStartTime))
        .subscribe(
          this.client!,
          (message, error) => {
            if (error) {
              console.error("❌ Topic subscription error:", error);
              return;
            }
          },
          async (message) => {
            if (!this.isRunning || !message) return; // Skip processing if agent is stopped or message is null
            
            try {
              console.log("🚨 New topic message received!");
              console.log(`📨 Message: ${Buffer.from(message.contents).toString("utf8")}`);
              console.log(`🕒 Timestamp: ${new Date(message.consensusTimestamp.toDate())}`);
              
              // Execute rebalancing in response to the alert
              console.log("🚨 Alert detected - executing rebalancing...");
              await this.executeRebalancing();
              console.log("✅ Rebalancing completed in response to topic alert");
              
            } catch (error) {
              console.error("❌ Error processing topic message:", error);
            }
          }
        );

      console.log("✅ Topic subscription active - waiting for messages...");
      console.log("💡 The agent will now process alerts in real-time as they arrive");

    } catch (error) {
      console.error("❌ Error setting up topic monitoring:", error);
      throw error;
    }
  }

  /**
   * Utility function for sleeping
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop the balancer agent
   */
  async stop(): Promise<void> {
    console.log("🛑 Stopping Lynx Balancer Agent...");
    
    this.isRunning = false;
    // TODO: Re-enable when ConversationalAgent is working
    // await this.agentMessaging.stop();
    
    console.log("✅ Lynx Balancer Agent stopped");
  }
} 