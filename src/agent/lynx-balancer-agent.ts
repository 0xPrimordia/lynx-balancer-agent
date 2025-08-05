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
import { TokenRatioTool } from '../tools/token-ratio-tool.js';
import { ContractStateManager, ContractState } from '../utils/contract-state-manager.js';

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

  // Blockchain tools
  private hederaAgentToolkit?: HederaLangchainToolkit;
  private agentExecutor?: AgentExecutor;
  private client?: Client;
  
  // Flow control
  private isRebalancingInProgress: boolean = false;

  constructor() {
    this.env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;
  }


  /**
   * Execute full rebalancing based on current contract ratios
   * This is the main rebalancing function that can be called from startup or alerts
   */
  async executeRebalancing(): Promise<void> {
    // Prevent concurrent rebalancing operations
    if (this.isRebalancingInProgress) {
      console.log("⚠️  Rebalancing already in progress - ignoring this request");
      return;
    }
    
    try {
      this.isRebalancingInProgress = true;
      console.log("🔒 Rebalancing lock acquired");
      
      console.log("⚖️  Executing portfolio rebalancing...");
      console.log("🔄 Starting treasury ratio validation...");
      await this.validateTreasuryRatios();
      console.log("✅ Treasury ratio validation completed");
      
    } finally {
      this.isRebalancingInProgress = false;
      console.log("🔓 Rebalancing lock released");
    }
  }

  /**
   * Validate treasury balances and rebalance each token individually
   */
  private async validateTreasuryRatios(): Promise<void> {
    if (!this.agentExecutor) {
      throw new Error("Agent executor not initialized");
    }

    try {
      console.log("🔍 Starting treasury validation with sequential token processing...");
      
      // Get clean contract state using our utility
      const stateManager = new ContractStateManager();
      const contractState = await stateManager.fetchContractState();
      stateManager.close();

      // Track if any transfers were made
      let transfersMade = false;

      // Process each token individually
      const tokens = ['HBAR', 'WBTC', 'SAUCE', 'USDC', 'JAM', 'HEADSTART'] as const;
      
      for (const tokenSymbol of tokens) {
        console.log(`\n🔍 Processing ${tokenSymbol}...`);
        
        // Get current balance and target ratio for this token
        const currentBalance = tokenSymbol === 'HBAR' 
          ? contractState.contractBalance.hbar
          : contractState.contractBalance.tokens[tokenSymbol as keyof typeof contractState.contractBalance.tokens];
        
        const targetRatio = contractState.ratios[tokenSymbol];
        const lynxSupply = contractState.lynxTotalSupply;

        // Check this token's ratio using our tool
        const tokenRatioTool = new TokenRatioTool();
        const analysisResult = await tokenRatioTool._call({
          tokenSymbol,
          currentBalance,
          targetRatio,
          lynxTotalSupply: lynxSupply
        });

        const analysis = JSON.parse(analysisResult);
        console.log(`📊 ${tokenSymbol} Analysis:`, analysis.analysis);

        // If this token needs rebalancing, handle it immediately
        if (analysis.needsRebalancing && analysis.transferParams) {
          console.log(`⚖️  ${tokenSymbol} needs rebalancing - executing transfer...`);
          
          const { action, amount, tool } = analysis.transferParams;
          const tokenConfig = this.TOKEN_CONFIG[tokenSymbol as keyof typeof this.TOKEN_CONFIG];
          
          let transferInstructions = '';
          if (action === 'withdraw') {
            if (tokenSymbol === 'HBAR') {
              transferInstructions = `Use ${tool} with:
- contractId: ${this.env.LYNX_CONTRACT_ID}
- amount: ${amount * 100000000} (${amount} HBAR in tinybars)`;
            } else {
              transferInstructions = `Use ${tool} with:
- contractId: ${this.env.LYNX_CONTRACT_ID}
- tokenId: ${tokenConfig?.tokenId}
- amount: ${amount * Math.pow(10, tokenConfig?.decimals || 0)} (${amount} ${tokenSymbol} in smallest units)`;
            }
          } else if (action === 'deposit') {
            transferInstructions = `Use ${tool} to transfer ${amount} ${tokenSymbol} FROM operator TO contract`;
          }
          
          const transferResponse = await this.agentExecutor.invoke({
            input: `${tokenSymbol} is out of balance. Current: ${currentBalance}, Required: ${analysis.requiredBalance}, Status: ${analysis.balanceStatus}.

${transferInstructions}

Fix ${tokenSymbol} balance now.`
          });
          
          console.log(`📄 ${tokenSymbol} Transfer:`, transferResponse.output);
          transfersMade = true; // Mark that a transfer was made
        } else {
          console.log(`✅ ${tokenSymbol} is balanced`);
        }
      }

      console.log("\n✅ Sequential token processing completed");

      // If any transfers were made, refresh contract state and notify dashboard
      if (transfersMade) {
        console.log("🔄 Transfers were made - refreshing contract state...");
        const refreshStateManager = new ContractStateManager();
        const updatedState = await refreshStateManager.fetchContractState();
        refreshStateManager.close();
        
        console.log("📊 Updated State Summary:");
        console.log(`   Ratios: ${Object.entries(updatedState.ratios).map(([k,v]) => `${k}=${v}`).join(', ')}`);
        console.log(`   LYNX Supply: ${updatedState.lynxTotalSupply}`);
        console.log(`   HBAR Balance: ${updatedState.contractBalance.hbar}`);
        console.log(`   Token Balances: ${Object.entries(updatedState.contractBalance.tokens).map(([k,v]) => `${k}=${v}`).join(', ')}`);
        console.log("✅ Contract state refreshed after transfers");
        
        // Send notification to dashboard
        await this.sendDashboardNotification(updatedState);
      }

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
      'OPENAI_API_KEY',
      'HEDERA_ACCOUNT_ID',
      'HEDERA_PRIVATE_KEY',
      'LYNX_CONTRACT_ID',
      'CONTRACT_LYNX_TOKEN',
      'BALANCER_ALERT_TOPIC',
      'DASHBOARD_ALERT_TOPIC'
    ];
    
    const missingVars = requiredVars.filter(varName => !this.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    try {
      // Initialize blockchain tools
      await this.initializeBlockchainTools();

      console.log("✅ Lynx Balancer Agent initialized successfully");
      console.log(`📋 Account ID: ${this.env.HEDERA_ACCOUNT_ID}`);
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

      const llm = new ChatOpenAI({
        modelName: "gpt-4o-mini",           // or "gpt-4o", "gpt-3.5-turbo", etc.
        temperature: 0,                     // 0 = deterministic, 1 = creative
        configuration: {
            baseURL: "https://ai-gateway.vercel.sh/v1",  // Vercel AI Gateway
        },
        apiKey: process.env.AI_GATEWAY_API_KEY!,         // Your Vercel AI Gateway key
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
          - Governance Contract: ${this.env.LYNX_CONTRACT_ID}
          - Network: ${this.env.HEDERA_NETWORK || 'testnet'}

          Token Mappings:
          ${Object.entries(this.TOKEN_CONFIG).map(([symbol, config]) => `- ${config.tokenId} = ${symbol} (${config.decimals} decimals)`).join('\n          ')}

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
      const tokenRatioTool = new TokenRatioTool();
      // Using built-in get-topic-messages-query instead of custom topic query tool
      const allTools = [...hederaTools, tokenTransferTool, hbarWithdrawalTool, tokenWithdrawalTool, contractRatioTool, tokenSupplyTool, tokenRatioTool];

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
      console.log(`🏛️  Governance Contract: ${this.env.LYNX_CONTRACT_ID}`);

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

    const topicId = this.env.BALANCER_ALERT_TOPIC;
    if (!topicId || topicId.trim() === '') {
      console.log("⚠️  BALANCER_ALERT_TOPIC is not configured or empty");
      console.log("🔧 Please run 'npm run test:alert hbar' first to create the topic");
      console.log("📋 Then add the topic ID to your .env file: BALANCER_ALERT_TOPIC_ID=0.0.XXXXXX");
      console.log("🔄 Waiting for topic configuration...");
      
      // Wait and check periodically for topic ID to be configured
      while (this.isRunning && (!this.env.BALANCER_ALERT_TOPIC || this.env.BALANCER_ALERT_TOPIC.trim() === '')) {
        await this.sleep(10000);
        // Reload environment (in case .env file was updated)
        const newTopicId = process.env.BALANCER_ALERT_TOPIC_ID;
        if (newTopicId && newTopicId.trim() !== '') {
          this.env.BALANCER_ALERT_TOPIC = newTopicId;
          break;
        }
      }
      
      if (!this.isRunning) return;
    }

    const finalTopicId = this.env.BALANCER_ALERT_TOPIC!;
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
              
              // Check if rebalancing is already in progress
              if (this.isRebalancingInProgress) {
                console.log("⚠️  Rebalancing already in progress - ignoring this alert");
                return;
              }
              
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
   * Send notification to dashboard topic when rebalancing is completed
   */
  private async sendDashboardNotification(contractState: ContractState): Promise<void> {
    try {
      if (!this.agentExecutor || !this.env.DASHBOARD_ALERT_TOPIC) {
        console.log("⚠️  Dashboard notification skipped - missing agent executor or topic ID");
        return;
      }

      console.log("📡 Sending rebalancing notification to dashboard...");
      
      const notificationMessage = `Rebalancing completed at ${new Date().toISOString()}. 
Contract state updated:
- LYNX Supply: ${contractState.lynxTotalSupply}
- HBAR Balance: ${contractState.contractBalance.hbar}
- Token Balances: ${Object.entries(contractState.contractBalance.tokens).map(([k,v]) => `${k}=${v}`).join(', ')}`;

      const response = await this.agentExecutor.invoke({
        input: `Send this rebalancing notification to the dashboard topic (${this.env.DASHBOARD_ALERT_TOPIC}): ${notificationMessage}`
      });

      console.log("✅ Dashboard notification sent successfully");
      console.log(`📄 Response: ${response.output}`);

    } catch (error) {
      console.error("❌ Failed to send dashboard notification:", error);
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