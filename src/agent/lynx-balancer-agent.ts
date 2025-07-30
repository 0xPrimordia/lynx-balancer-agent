import { config } from 'dotenv';
import { AgentMessaging } from './agent-messaging.js';
import { EnvironmentConfig } from './agent-config.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Client } from '@hashgraph/sdk';
import { HederaLangchainToolkit } from 'hedera-agent-kit';
import { TokenTransferTool } from '../tools/token-transfer-tool.js';
import { HbarWithdrawalTool } from '../tools/hbar-withdrawal-tool.js';
import { TokenWithdrawalTool } from '../tools/token-withdrawal-tool.js';
import { TopicQueryTool } from '../tools/topic-query-tool.js';
import { ContractRatioTool, TokenSupplyTool } from '../tools/contract-ratio-tool.js';

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
  private agentMessaging: AgentMessaging;
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
  
  // Lynx token supply (will be updated from governance contract)
  private lynxTotalSupply: number = 0;
  
  // Cached balance state
  private contractBalances: {
    hbar: number;
    tokens: {[tokenId: string]: number};
    totalValue: number;
    lastUpdated: Date;
  } | null = null;

  // Blockchain tools
  private hederaAgentToolkit?: HederaLangchainToolkit;
  private agentExecutor?: AgentExecutor;
  private client?: Client;

  constructor() {
    this.env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;
    this.agentMessaging = new AgentMessaging(this.env);
  }

  /**
   * Get token configuration by name or ID
   */
  private getTokenConfig(tokenNameOrId: string): any {
    // Try to find by token name first
    for (const [name, config] of Object.entries(this.TOKEN_CONFIG)) {
      if (name === tokenNameOrId || config.tokenId === tokenNameOrId) {
        return config;
      }
    }
    return null;
  }

  /**
   * Calculate required token amount using the minting formula
   * requiredAmount = (lynxAmount * tokenRatio) / divisor
   * This tells us exactly how much of each token should be in the treasury (in human-readable units)
   */
  private calculateRequiredAmount(lynxAmount: number, tokenRatio: number, tokenName: string): number {
    const tokenConfig = this.getTokenConfig(tokenName);
    if (!tokenConfig) {
      throw new Error(`Unknown token: ${tokenName}`);
    }

    const requiredAmount = lynxAmount * (tokenRatio / this.CONTRACT_DIVISOR);
    
    console.log(`🧮 Treasury requirement calculation for ${tokenName}:`);
    console.log(`   Lynx Total Supply: ${lynxAmount}`);
    console.log(`   Token Ratio: ${tokenRatio}`);
    console.log(`   Divisor: ${this.CONTRACT_DIVISOR}`);
    console.log(`   Required Amount: ${requiredAmount} ${tokenName}`);
    
    return requiredAmount;
  }

  /**
   * Get the total supply of Lynx tokens from the governance contract
   */
  private async getLynxTotalSupply(): Promise<number> {
    if (!this.agentExecutor) {
      throw new Error("Agent executor not initialized");
    }

    try {
      console.log("📊 Getting Lynx total supply from governance contract...");
      
      // Query the Hedera network for Lynx token total supply using the dedicated tool
      const response = await this.agentExecutor.invoke({
        input: `Use the token_supply_query tool to get the total supply of Lynx tokens with token ID ${this.env.CONTRACT_LYNX_TOKEN}. Return ONLY the humanReadableSupply value from the JSON response.`
      });
      
      // Parse the response to extract the human-readable total supply
      const supplyMatch = response.output.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
      if (supplyMatch) {
        const totalSupply = parseFloat(supplyMatch[1].replace(/,/g, ''));
        console.log(`📊 Lynx total supply: ${totalSupply}`);
        return totalSupply;
      } else {
        console.error("❌ CRITICAL ERROR: Could not parse Lynx total supply from response");
        console.error("Raw response:", response.output);
        throw new Error("Failed to parse Lynx total supply from contract query response");
      }
    } catch (error) {
      console.error("❌ CRITICAL ERROR: Failed to get Lynx total supply from governance contract");
      console.error("This is required for accurate treasury calculations");
      console.error("Error details:", error);
      throw new Error(`Failed to get Lynx total supply: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate that treasury balances match the contract's expected ratios
   */
  private async validateTreasuryRatios(): Promise<void> {
    if (!this.agentExecutor) {
      throw new Error("Agent executor not initialized");
    }

    try {
      console.log("🔍 Validating treasury ratios against contract settings...");
      
      // Get contract ratios using the agent
      const ratioResponse = await this.agentExecutor.invoke({
        input: `Use the contract_ratio_query tool to get the current token ratios from the governance contract ${this.env.GOVERNANCE_CONTRACT_ID}. Please respond with ONLY the ratios in this exact format:
HBAR: 50
WBTC: 3
SAUCE: 25
USDC: 15
JAM: 5
HEADSTART: 3
(one line per token, no other text)`
      });

      // Parse the ratio response
      let contractRatios: any = {};
      
      // Look for ratio patterns in the text (format: "HBAR: 50")
      const ratioPattern = /(\w+):\s*(\d+)/g;
      const matches = [...ratioResponse.output.matchAll(ratioPattern)];
      
      for (const match of matches) {
        const tokenName = match[1];
        const ratio = match[2];
        if (['HBAR', 'WBTC', 'SAUCE', 'USDC', 'JAM', 'HEADSTART'].includes(tokenName)) {
          contractRatios[tokenName] = ratio;
        }
      }
      
      if (Object.keys(contractRatios).length === 0) {
        console.log("⚠️  No contract ratios found, skipping validation");
        return;
      }

      if (Object.keys(contractRatios).length === 0) {
        console.log("⚠️  No contract ratios found, skipping validation");
        return;
      }

      console.log("📋 Contract ratios:", contractRatios);

      // Get current balances
      const balances = await this.getContractBalances();
      const lynxTotalSupply = await this.getLynxTotalSupply();

      console.log("📊 Validating each token...");

      // Validate each token
      for (const [tokenName, targetWeight] of Object.entries(contractRatios)) {
        const tokenConfig = this.getTokenConfig(tokenName);
        
        // Skip Lynx token - it's the governance token itself
        if (tokenName === 'LYNX' || tokenConfig?.tokenId === this.env.CONTRACT_LYNX_TOKEN) {
          console.log(`⏭️  Skipping ${tokenName} - governance token not held in treasury`);
          continue;
        }
        
        if (!tokenConfig) {
          console.log(`⚠️  No config found for ${tokenName}, skipping`);
          continue;
        }

        // Get current amount
        let currentAmount = 0;
        if (tokenName === 'HBAR') {
          currentAmount = balances.hbar;
        } else {
          currentAmount = balances.tokens[tokenConfig.tokenId] || 0;
        }

        // Calculate required amount (now in human-readable units)
        const requiredAmount = this.calculateRequiredAmount(lynxTotalSupply, parseInt(targetWeight as string), tokenName);

        // Calculate difference
        const difference = requiredAmount - currentAmount;
        const differencePercent = (Math.abs(difference) / requiredAmount) * 100;

        console.log(`📊 ${tokenName}:`);
        console.log(`   Current: ${currentAmount.toFixed(6)}`);
        console.log(`   Required: ${requiredAmount.toFixed(6)}`);
        console.log(`   Difference: ${difference.toFixed(6)} (${differencePercent.toFixed(2)}%)`);

        // Consider tokens balanced if within 5% of target
        const tolerancePercent = 5;
        const toleranceAmount = (requiredAmount * tolerancePercent) / 100;
        
        if (Math.abs(difference) > toleranceAmount) {
          console.log(`   ⚠️  ${tokenName} needs rebalancing`);
          
          // Execute the rebalancing operation
          if (difference > 0) {
            // Need to buy (transfer TO contract)
            console.log(`   🔄 Executing buy operation for ${tokenName}...`);
            try {
              if (tokenName === 'HBAR') {
                await this.executeHbarTransfer(difference);
              } else {
                await this.executeTokenTransfer(tokenConfig.tokenId, difference);
              }
              console.log(`   ✅ Buy operation completed for ${tokenName}`);
            } catch (error) {
              console.error(`   ❌ Buy operation failed for ${tokenName}:`, error);
            }
          } else {
            // Need to sell (withdraw FROM contract)
            console.log(`   🔄 Executing sell operation for ${tokenName}...`);
            try {
              if (tokenName === 'HBAR') {
                await this.executeHbarWithdrawal(Math.abs(difference));
              } else {
                await this.executeTokenWithdrawal(tokenConfig.tokenId, Math.abs(difference));
              }
              console.log(`   ✅ Sell operation completed for ${tokenName}`);
            } catch (error) {
              console.error(`   ❌ Sell operation failed for ${tokenName}:`, error);
            }
          }
        } else {
          console.log(`   ✅ ${tokenName} is balanced`);
        }
      }

      console.log("✅ Treasury ratio validation completed");
      
      // Refresh balances after rebalancing operations
      console.log("📊 Refreshing balances after rebalancing...");
      await this.refreshContractBalances();
      console.log("✅ Balance refresh completed");

    } catch (error) {
      console.error("❌ Failed to validate treasury ratios:", error);
    }
  }

  /**
   * Convert raw token amount to human-readable amount
   */
  private convertRawToHumanAmount(rawAmount: number, tokenName: string): number {
    const tokenConfig = this.getTokenConfig(tokenName);
    if (!tokenConfig) {
      throw new Error(`Unknown token: ${tokenName}`);
    }

    return rawAmount / Math.pow(10, tokenConfig.decimals);
  }

  /**
   * Convert human-readable amount to raw token amount
   */
  private convertHumanToRawAmount(humanAmount: number, tokenName: string): number {
    const tokenConfig = this.getTokenConfig(tokenName);
    if (!tokenConfig) {
      throw new Error(`Unknown token: ${tokenName}`);
    }

    return humanAmount * Math.pow(10, tokenConfig.decimals);
  }

  /**
   * Calculate current weight ratio from actual balances
   * This calculates what weight ratio the current token amount represents
   */
  private calculateCurrentWeightRatio(currentAmount: number, lynxTotalSupply: number, tokenName: string): number {
    const tokenConfig = this.getTokenConfig(tokenName);
    if (!tokenConfig) {
      throw new Error(`Unknown token: ${tokenName}`);
    }

    // Convert current amount to raw units
    const rawCurrentAmount = this.convertHumanToRawAmount(currentAmount, tokenName);
    
    // Calculate weight ratio using the reverse of the minting formula
    // weightRatio = (rawAmount * divisor) / (lynxTotalSupply * 10^decimals)
    const weightRatio = (rawCurrentAmount * this.CONTRACT_DIVISOR) / (lynxTotalSupply * Math.pow(10, tokenConfig.decimals));
    
    return weightRatio;
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

      // Initialize V3 Hedera Agent Kit (following tool-calling-balance-check pattern)
      this.hederaAgentToolkit = new HederaLangchainToolkit({
        client: this.client,
        configuration: {}
      });

      // Initialize OpenAI LLM (following tool-calling-balance-check pattern)
      const llm = new ChatOpenAI({
        modelName: "gpt-4o",
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
        
        Your job is to maintain target portfolio ratios by rebalancing token holdings.
        `],
        ['placeholder', '{chat_history}'],
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
      ]);

      // Get Hedera tools and add custom tools (following tool-calling-balance-check pattern)
      const hederaTools = this.hederaAgentToolkit.getTools();
      const tokenTransferTool = new TokenTransferTool(this.client);
      const hbarWithdrawalTool = new HbarWithdrawalTool(this.client);
      const tokenWithdrawalTool = new TokenWithdrawalTool(this.client);
      const topicQueryTool = new TopicQueryTool(this.client, this.env.BALANCER_ALERT_TOPIC_ID || '0.0.0');
      const contractRatioTool = new ContractRatioTool(this.client);
      const tokenSupplyTool = new TokenSupplyTool(this.client);
      const allTools = [...hederaTools, tokenTransferTool, hbarWithdrawalTool, tokenWithdrawalTool, topicQueryTool, contractRatioTool, tokenSupplyTool];

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
      console.log(`🔧 Loaded ${hederaTools.length + 5} tools (${hederaTools.length} Hedera + 5 custom)`);

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
        // TODO: Re-enable ConversationalAgent message listening when v0.1.205 fixes are confirmed
        // Start message listening
        // await this.agentMessaging.startMessageListening();
        
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
    console.log("🔄 Processing all pending alerts on startup...");

    try {
      // Initialize contract balances on startup
      console.log("📊 Initializing contract balance cache...");
      await this.refreshContractBalances();

      // Validate treasury ratios against contract settings
      await this.validateTreasuryRatios();

      // Get all topic messages once on startup using our custom tool
      const response = await this.agentExecutor.invoke({
        input: `Use the topic_query_tool to get all messages from topic ${this.env.BALANCER_ALERT_TOPIC_ID}. Return the exact JSON output.`
      });

      console.log("🔍 Processing topic messages...");

      // Process all alert messages
      await this.processAllAlerts(response.output);

    } catch (error) {
      console.error("❌ Error processing alerts:", error);
    }

    console.log("✅ Alert processing completed. Agent will now wait for manual restart to process new alerts.");
    console.log("💡 To process new alerts, restart the agent after sending new alert messages.");
  }

  /**
   * Process all alert messages from the topic
   */
  private async processAllAlerts(messagesOutput: string): Promise<void> {
    try {
      console.log("🔍 Processing all alert messages...");

      // Try to parse as JSON first (from our custom tool)
      let alertMessages: any[] = [];
      try {
        // Extract JSON from the formatted response
        const jsonMatch = messagesOutput.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          const jsonResponse = JSON.parse(jsonMatch[1]);
          if (jsonResponse.governanceAlerts && Array.isArray(jsonResponse.governanceAlerts)) {
            console.log(`📋 Found ${jsonResponse.governanceAlerts.length} governance alerts from topic query tool`);
            
            // Use the pre-parsed governance alerts
            alertMessages = jsonResponse.governanceAlerts.map((alert: any) => alert.alertData);
          }
        } else {
          // Try parsing the entire output as JSON
          const jsonResponse = JSON.parse(messagesOutput);
          if (jsonResponse.governanceAlerts && Array.isArray(jsonResponse.governanceAlerts)) {
            console.log(`📋 Found ${jsonResponse.governanceAlerts.length} governance alerts from topic query tool`);
            alertMessages = jsonResponse.governanceAlerts.map((alert: any) => alert.alertData);
          }
        }
      } catch (jsonError) {
        // Fallback to old parsing method if JSON parsing fails
        console.log("⚠️  JSON parsing failed, falling back to text parsing");
        alertMessages = this.parseTopicMessages(messagesOutput);
      }
      
      if (alertMessages.length === 0) {
        console.log("⚠️  No alert messages found in topic");
        return;
      }

      console.log(`📋 Found ${alertMessages.length} alert messages to process`);

      const currentTime = new Date();
      const MAX_AGE_MINUTES = 5; // Skip alerts older than 5 minutes

      // Process each alert message
      for (const alertMessage of alertMessages) {
        // Skip old BALANCING_ALERT messages completely - we only want GOVERNANCE_RATIO_UPDATE
        if (alertMessage.type === 'BALANCING_ALERT') {
          console.log(`⏭️  Skipping old BALANCING_ALERT`);
          continue;
        }
        
        // Time-based filtering for governance alerts
        if (alertMessage.type === 'GOVERNANCE_RATIO_UPDATE' && alertMessage.effectiveTimestamp) {
          const alertTime = new Date(alertMessage.effectiveTimestamp);
          const ageInMinutes = (currentTime.getTime() - alertTime.getTime()) / (1000 * 60);
          
          if (ageInMinutes > MAX_AGE_MINUTES) {
            console.log(`⏭️  Skipping old governance alert (${ageInMinutes.toFixed(1)} minutes old)`);
            continue;
          }
          
          // Skip alerts that don't require immediate rebalancing
          if (!alertMessage.requiresImmediateRebalance) {
            console.log(`⏭️  Skipping governance alert - no immediate rebalance required`);
            continue;
          }
          
          console.log(`✅ Processing governance alert (${ageInMinutes.toFixed(1)} minutes old)`);
        }
        
        await this.processBalancingAlert(alertMessage);
      }

      console.log("✅ All alerts processed");

    } catch (error) {
      console.error("❌ Error processing all alerts:", error);
    }
  }

  /**
   * Parse topic messages from the structured text format
   */
  private parseTopicMessages(messagesOutput: string): any[] {
    const alertMessages: any[] = [];
    
    try {
      // Look for alert patterns in the message content
      const alertPatterns = [
        /HBAR ratio.*target/i,
        /SAUCE ratio.*target/i,
        /USDC ratio.*target/i,
        /GOVERNANCE_RATIO_UPDATE/i,
        /balance_alert/i
      ];

      // Split by sequence numbers to get individual messages
      const messageBlocks = messagesOutput.split(/\d+\.\s+\*\*Sequence Number:\*\*/);
      console.log(`🔍 Found ${messageBlocks.length} message blocks in topic`);
      
      for (let i = 0; i < messageBlocks.length; i++) {
        const block = messageBlocks[i];
        if (!block.trim()) continue;

        // Extract message content
        const contentMatch = block.match(/\*\*Message Content:\*\*\s*(.+?)(?:\n|$)/);
        if (!contentMatch) {
          console.log(`⚠️  No message content found in block ${i}`);
          continue;
        }

        const messageContent = contentMatch[1].trim();
        console.log(`🔍 Message ${i}: ${messageContent.substring(0, 100)}...`);
        
        // Check if this is an alert message (not a completion message)
        const isAlert = alertPatterns.some(pattern => pattern.test(messageContent));
        if (!isAlert) {
          console.log(`⏭️  Message ${i} is not an alert (no pattern match)`);
          continue;
        }

        console.log(`✅ Message ${i} matches alert pattern`);

        // Parse the alert content to create a structured alert object
        const alert = this.parseAlertContent(messageContent);
        if (alert) {
          console.log(`✅ Parsed alert ${i}: type=${alert.type}`);
          alertMessages.push(alert);
        } else {
          console.log(`❌ Failed to parse alert ${i}`);
        }
      }

      console.log(`🔍 Parsed ${alertMessages.length} alert messages from topic`);
      return alertMessages;

    } catch (error) {
      console.error("❌ Error parsing topic messages:", error);
      return [];
    }
  }

  /**
   * Parse alert content into a structured alert object
   */
  private parseAlertContent(messageContent: string): any | null {
    try {
      // Check if this is a JSON alert (new format)
      if (messageContent.startsWith('{') && messageContent.endsWith('}')) {
        try {
          return JSON.parse(messageContent);
        } catch (jsonError) {
          console.log("⚠️  Failed to parse JSON alert, falling back to text parsing");
        }
      }

      // Determine token type from text content
      let token = 'UNKNOWN';
      if (messageContent.includes('HBAR')) token = 'HBAR';
      else if (messageContent.includes('SAUCE')) token = 'SAUCE';
      else if (messageContent.includes('USDC')) token = 'USDC';

      // Create a basic alert structure
      const alert = {
        type: 'BALANCING_ALERT',
        token: token,
        currentRatio: 0, // We'll let the actual balance check determine this
        targetRatio: 40, // Default target ratio
        deviation: 0,
        alertLevel: 'MEDIUM',
        reason: messageContent
      };

      // Try to extract target ratio if mentioned
      const targetMatch = messageContent.match(/(\d+)%?\s*target/i);
      if (targetMatch) {
        alert.targetRatio = parseInt(targetMatch[1]);
      }

      return alert;

    } catch (error) {
      console.error("❌ Error parsing alert content:", messageContent, error);
      return null;
    }
  }

  /**
   * Validate alert accuracy by checking if current weight matches actual balance
   */
  private async validateAlertAccuracy(alert: any): Promise<boolean> {
    try {
      // Skip validation for alerts without currentRatio (let balance check determine)
      if (!alert.currentRatio || alert.currentRatio === 0) {
        return true;
      }

      // Get actual balances
      const balances = await this.getContractBalances();
      
      let actualCurrentWeight = 0;
      if (alert.token === 'HBAR') {
        // Calculate current weight for HBAR
        const currentAmount = balances.hbar;
        const lynxTotalSupply = await this.getLynxTotalSupply();
        actualCurrentWeight = this.calculateCurrentWeightRatio(currentAmount, lynxTotalSupply, 'HBAR');
      } else if (alert.tokenId) {
        // Calculate current weight for token using tokenId
        const tokenValue = this.getTokenValueFromBalances(balances, alert.tokenId);
        const tokenConfig = this.getTokenConfig(alert.tokenId);
        if (tokenConfig) {
          const lynxTotalSupply = await this.getLynxTotalSupply();
          actualCurrentWeight = this.calculateCurrentWeightRatio(tokenValue, lynxTotalSupply, tokenConfig.name);
        }
      } else {
        console.log(`⚠️  No tokenId provided for ${alert.token} alert, skipping validation`);
        return false;
      }

      // Check if alert weight is reasonably close to actual weight (within 5 weight units)
      const weightDifference = Math.abs(actualCurrentWeight - alert.currentRatio);
      const isAccurate = weightDifference <= 5;

      console.log(`🔍 Alert validation for ${alert.token}:`);
      console.log(`   Alert weight: ${alert.currentRatio}`);
      console.log(`   Actual weight: ${actualCurrentWeight.toFixed(1)}`);
      console.log(`   Difference: ${weightDifference.toFixed(1)}`);
      console.log(`   Accurate: ${isAccurate ? '✅' : '❌'}`);

      return isAccurate;

    } catch (error) {
      console.error("❌ Error validating alert accuracy:", error);
      return false;
    }
  }

  /**
   * Get token value from balances by tokenId
   */
  private getTokenValueFromBalances(balances: any, tokenId: string): number {
    return balances.tokens[tokenId] || 0;
  }



  /**
   * Check if an alert already has a completion message
   */
  private async checkForCompletion(alert: any): Promise<boolean> {
    if (!this.agentExecutor) return false;

    try {
      const topicId = this.env.BALANCER_ALERT_TOPIC_ID;
      const response = await this.agentExecutor.invoke({
        input: `Search topic ${topicId} for messages containing "BALANCING_COMPLETE" and check if this alert has already been completed`
      });

      // Check if there's a completion message for this specific alert
      return response.output.includes('BALANCING_COMPLETE') && 
             response.output.includes(alert.token) &&
             response.output.includes(`${alert.currentRatio}`) &&
             response.output.includes(`${alert.targetRatio}`);
    } catch (error) {
      console.error("❌ Error checking for completion:", error);
      return false;
    }
  }

  /**
   * Process a balancing alert and execute rebalancing
   */
  private async processBalancingAlert(alert: any): Promise<void> {
    if (!this.agentExecutor) return;

    try {
      // Handle governance ratio update alerts (weight-based system)
      if (alert.type === 'GOVERNANCE_RATIO_UPDATE') {
        console.log(`⚖️  Processing governance weight update...`);
        console.log(`📋 Updated weights:`, alert.weights);
        console.log(`📋 Changed token:`, alert.changedToken);
        console.log(`📋 Change: ${alert.changedValue.old} → ${alert.changedValue.new} (${alert.changeMagnitude} weight change)`);
        
        // Get current balances
        console.log(`📊 Step 1: Getting contract balances...`);
        const balances = await this.getContractBalances();
        
        // Get the changed token configuration
        const changedTokenName = alert.changedToken;
        const tokenConfig = this.getTokenConfig(changedTokenName);
        if (!tokenConfig) {
          console.log(`⚠️  Unknown token: ${changedTokenName}, skipping rebalancing`);
          return;
        }
        
        console.log(`🔄 Processing ${changedTokenName} rebalancing...`);
        console.log(`📋 Token config:`, tokenConfig);
        
        // Get current amount for the changed token
        let currentAmount = 0;
        if (changedTokenName === 'HBAR') {
          currentAmount = balances.hbar;
        } else {
          currentAmount = balances.tokens[tokenConfig.tokenId] || 0;
        }
        
        console.log(`📊 Current ${changedTokenName} amount: ${currentAmount}`);
        
        // Get Lynx total supply and calculate required amount using the minting formula
        const targetWeight = alert.weights[changedTokenName];
        const lynxTotalSupply = await this.getLynxTotalSupply();
        
        const requiredAmount = this.calculateRequiredAmount(lynxTotalSupply, targetWeight, changedTokenName);
        
        console.log(`📊 Target ${changedTokenName} amount: ${requiredAmount} ${changedTokenName}`);
        
        // Calculate how much we need to transfer
        const amountToTransfer = requiredAmount - currentAmount;
        
        console.log(`📊 Amount to transfer: ${amountToTransfer} ${changedTokenName}`);
        
        // Execute the rebalancing
        if (Math.abs(amountToTransfer) > 0.001) { // Only transfer if difference is significant
          if (amountToTransfer > 0) {
            // Need to buy (transfer TO contract)
            console.log(`✅ Operation: Buying ${changedTokenName} (transferring to contract)`);
            if (changedTokenName === 'HBAR') {
              await this.executeHbarTransfer(amountToTransfer);
            } else {
              await this.executeTokenTransfer(tokenConfig.tokenId, amountToTransfer);
            }
          } else {
            // Need to sell (withdraw FROM contract)
            console.log(`✅ Operation: Selling ${changedTokenName} (withdrawing from contract)`);
            if (changedTokenName === 'HBAR') {
              await this.executeHbarWithdrawal(Math.abs(amountToTransfer));
            } else {
              await this.executeTokenWithdrawal(tokenConfig.tokenId, Math.abs(amountToTransfer));
            }
          }
          
          // Refresh balances after successful operation
          await this.refreshContractBalances();
        } else {
          console.log(`✅ No transfer needed - already at target weight`);
        }
        
        console.log(`✅ Governance weight update processing completed`);
        return;
      }
      
      // Handle legacy balancing alerts (converted to weight-based)
      console.log(`⚖️  Executing rebalancing for ${alert.token}...`);
      
      // Extract key data from alert
      const { token, currentRatio, targetRatio } = alert;
      console.log(`📋 Alert: ${token} is ${currentRatio}%, target is ${targetRatio}%`);
      
      // Check token support
      const tokenConfig = this.getTokenConfig(token);
      if (!tokenConfig) {
        console.log(`⚠️  Token ${token} rebalancing not supported yet.`);
        return;
      }
      
      // Step 1: Get current balances from cache
      console.log(`📊 Step 1: Getting contract balances...`);
      const balances = await this.getContractBalances();
      
      // Convert percentage-based target to weight-based target
      // For legacy alerts, assume targetRatio is percentage, convert to weight
      const targetWeight = targetRatio; // 1:1 conversion for now (40% = weight 40)
      
      // Get current amount for the token
      let currentAmount = 0;
      if (token === 'HBAR') {
        currentAmount = balances.hbar;
      } else {
        currentAmount = balances.tokens[tokenConfig.tokenId] || 0;
      }
      
      console.log(`📊 Current ${token} amount: ${currentAmount}`);
      
      // Get Lynx total supply and calculate required amount using the minting formula
      const lynxTotalSupply = await this.getLynxTotalSupply();
      
      const requiredAmount = this.calculateRequiredAmount(lynxTotalSupply, targetWeight, token);
      
      console.log(`📊 Target ${token} amount: ${requiredAmount} ${token}`);
      
      // Calculate how much we need to transfer
      const amountToTransfer = requiredAmount - currentAmount;
      
      console.log(`📊 Amount to transfer: ${amountToTransfer} ${token}`);
      
      // Execute the rebalancing
      if (Math.abs(amountToTransfer) > 0.001) { // Only transfer if difference is significant
        if (amountToTransfer > 0) {
          // Need to buy (transfer TO contract)
          console.log(`✅ Operation: Buying ${token} (transferring to contract)`);
          if (token === 'HBAR') {
            await this.executeHbarTransfer(amountToTransfer);
          } else {
            await this.executeTokenTransfer(tokenConfig.tokenId, amountToTransfer);
          }
        } else {
          // Need to sell (withdraw FROM contract)
          console.log(`✅ Operation: Selling ${token} (withdrawing from contract)`);
          if (token === 'HBAR') {
            await this.executeHbarWithdrawal(Math.abs(amountToTransfer));
          } else {
            await this.executeTokenWithdrawal(tokenConfig.tokenId, Math.abs(amountToTransfer));
          }
        }
        
        // Refresh balances after successful operation
        await this.refreshContractBalances();
      } else {
        console.log(`✅ No transfer needed - already at target weight`);
      }

      console.log(`✅ Rebalancing completed for ${alert.token}`);

    } catch (error) {
      console.error(`❌ Rebalancing failed:`, error);
      
      // Send error completion message
      await this.sendCompletionMessage(alert, {
        status: 'error',
        summary: `Rebalancing failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * Refresh contract balances from the blockchain and update cache
   */
  private async refreshContractBalances(): Promise<void> {
    if (!this.agentExecutor) throw new Error("Agent executor not initialized");

    try {
      console.log("📊 Refreshing contract balances...");
      
      // Get HBAR balance using the simpler tool
      const hbarResponse = await this.agentExecutor.invoke({
        input: `Use the get-hbar-balance-query tool to get the HBAR balance for account ${this.env.GOVERNANCE_CONTRACT_ID}. Please respond with ONLY the balance in tinybars format like this: "BALANCE: 1234567.89 tinybars"`
      });
      
      // Get token balances using the dedicated tool
      const tokenResponse = await this.agentExecutor.invoke({
        input: `Use the get-account-token-balances-query tool to get all token balances for account ${this.env.GOVERNANCE_CONTRACT_ID}. Please respond with ONLY the token balances in this exact format:
TOKEN: 0.0.1183558 | BALANCE: 9000000 | DECIMALS: 6
TOKEN: 0.0.6200902 | BALANCE: 0 | DECIMALS: 8
(one line per token, no other text)`
      });

      console.log(`📊 HBAR balance response: ${hbarResponse.output}`);
      console.log(`📊 Token balance response: ${tokenResponse.output}`);
      
      // Parse HBAR balance directly
      const hbarBalance = this.parseHbarBalance(hbarResponse.output);
      
      // Parse token balances
      const tokenBalances = this.parseTokenBalances(tokenResponse.output);
      
      // Calculate total value (just sum of all balances for now)
      const totalValue = hbarBalance + Object.values(tokenBalances).reduce((sum: number, value: any) => sum + (value as number), 0);
      
      console.log(`📊 Total portfolio breakdown:`);
      console.log(`   HBAR: ${hbarBalance} HBAR`);
      console.log(`   Tokens: ${Object.values(tokenBalances).reduce((sum: number, value: any) => sum + (value as number), 0)} total units`);
      console.log(`   Total: ${totalValue} total units`);
      
      // Update cached balances
      this.contractBalances = {
        hbar: hbarBalance,
        tokens: tokenBalances,
        totalValue: totalValue,
        lastUpdated: new Date()
      };

      console.log("✅ Contract balances cached:", this.contractBalances);
    } catch (error) {
      console.error("❌ Failed to refresh contract balances:", error);
      throw error;
    }
  }

  /**
   * Get current contract balances (from cache or refresh if needed)
   */
  private async getContractBalances(): Promise<any> {
    // If no cache or cache is older than 1 minute, refresh
    if (!this.contractBalances || 
        (Date.now() - this.contractBalances.lastUpdated.getTime()) > 60000) {
      await this.refreshContractBalances();
    }
    
    return this.contractBalances!;
  }

  /**
   * Parse HBAR balance from the dedicated HBAR balance tool response
   */
  private parseHbarBalance(response: string): number {
    console.log("🔍 Parsing HBAR balance response...");
    
    // Look for the specific format: "BALANCE: 1234567.89 tinybars"
    const match = response.match(/BALANCE:\s*([\d,]+\.?\d*)\s+tinybars/i);
    if (match) {
      const tinybars = parseFloat(match[1].replace(/,/g, ''));
      const hbarBalance = tinybars / 100000000; // Convert tinybars to HBAR
      console.log(`📊 Parsed HBAR balance: ${hbarBalance} HBAR (${tinybars} tinybars)`);
      return hbarBalance;
    }
    
    // Fallback to old format
    const oldMatch = response.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s+tinybars/);
    if (oldMatch) {
      const tinybars = parseFloat(oldMatch[1].replace(/,/g, ''));
      const hbarBalance = tinybars / 100000000; // Convert tinybars to HBAR
      console.log(`📊 Parsed HBAR balance: ${hbarBalance} HBAR (${tinybars} tinybars)`);
      return hbarBalance;
    }
    
    console.log("⚠️  Could not parse HBAR balance, defaulting to 0");
    return 0;
  }

  /**
   * Parse token balances from the token balance query response
   */
  private parseTokenBalances(response: string): {[tokenId: string]: number} {
    console.log("🔍 Parsing token balance response...");
    const tokens: {[tokenId: string]: number} = {};
    
    // Look for the specific format: "TOKEN: 0.0.1183558 | BALANCE: 9000000 | DECIMALS: 6"
    const tokenMatches = response.matchAll(/TOKEN:\s*(0\.0\.\d+)\s*\|\s*BALANCE:\s*([\d,]+)\s*\|\s*DECIMALS:\s*(\d+)/g);
    
    for (const match of tokenMatches) {
      const tokenId = match[1];
      const rawBalance = parseInt(match[2].replace(/,/g, ''));
      const decimals = parseInt(match[3]);
      const actualBalance = rawBalance / Math.pow(10, decimals);
      
      // Store the ACTUAL token amount, not HBAR equivalent
      tokens[tokenId] = actualBalance;
      console.log(`📊 Token ${tokenId}: ${rawBalance} raw = ${actualBalance} actual units`);
    }
    
    // Fallback to old format if no matches found
    if (Object.keys(tokens).length === 0) {
      const oldTokenMatches = response.matchAll(/\*\*Token ID\*\*:\s+(0\.0\.\d+)[\s\S]*?\*\*Balance\*\*:\s+([\d,]+)[\s\S]*?\*\*Decimals\*\*:\s+(\d+)/g);
      
      for (const match of oldTokenMatches) {
        const tokenId = match[1];
        const rawBalance = parseInt(match[2].replace(/,/g, ''));
        const decimals = parseInt(match[3]);
        const actualBalance = rawBalance / Math.pow(10, decimals);
        
        // Store the ACTUAL token amount, not HBAR equivalent
        tokens[tokenId] = actualBalance;
        console.log(`📊 Token ${tokenId}: ${rawBalance} raw = ${actualBalance} actual units`);
      }
    }
    
    return tokens;
  }

  /**
   * Parse balance response to extract structured data (legacy method - keeping for compatibility)
   */
  private parseBalanceResponse(response: string): any {
    console.log("🔍 Parsing actual balance response...");
    
          // Extract HBAR balance - handle multiple formats
      let hbarMatch = response.match(/\*\*HBAR Balance:\*\*\s+([\d.]+)\s+HBAR/);
      if (!hbarMatch) {
        // Try alternative format: "**HBAR Balance**: 6,384,000 tinybars (equivalent to 63.84 HBAR)"
        hbarMatch = response.match(/\*\*HBAR Balance\*\*:\s+[\d,]+\s+tinybars\s+\(equivalent to ([\d.]+) HBAR\)/);
      }
      if (!hbarMatch) {
        // Try format: "**HBAR Balance**: 6,706,211.20 tinybars"
        const tinybarMatch = response.match(/\*\*HBAR Balance\*\*:\s+([\d,.]+)\s+tinybars/);
        if (tinybarMatch) {
          const tinybars = parseFloat(tinybarMatch[1].replace(/,/g, ''));
          hbarMatch = ['', (tinybars / 100000000).toString()]; // Convert tinybars to HBAR
        }
      }
      if (!hbarMatch) {
        // Try simple format: "**HBAR Balance:** 6,384,000 tinybars"
        const tinybarMatch = response.match(/\*\*HBAR Balance:\*\*\s+([\d,]+)\s+tinybars/);
        if (tinybarMatch) {
          const tinybars = parseInt(tinybarMatch[1].replace(/,/g, ''));
          hbarMatch = ['', (tinybars / 100000000).toString()]; // Convert tinybars to HBAR
        }
      }
    const hbarBalance = hbarMatch ? parseFloat(hbarMatch[1]) : 0;
    
    console.log(`📊 Parsed HBAR balance: ${hbarBalance} HBAR`);
    
    // Extract all token balances with their IDs
    const tokenMatches = response.matchAll(/\*\*Token ID\*\*:\s+(0\.0\.\d+)[\s\S]*?\*\*Balance\*\*:\s+([\d,]+)[\s\S]*?\*\*Decimals\*\*:\s+(\d+)/g);
    let totalTokenValueInHbar = 0;
    const tokens: {[key: string]: number} = {};
    
    for (const match of tokenMatches) {
      const tokenId = match[1];
      const rawBalance = parseInt(match[2].replace(/,/g, ''));
      const decimals = parseInt(match[3]);
      const actualBalance = rawBalance / Math.pow(10, decimals);
      
      // For simplicity, assume 1 token unit = 0.01 HBAR (this is a placeholder)
      // TODO: Use real token prices or exchange rates
      const tokenValueInHbar = actualBalance * 0.01;
      totalTokenValueInHbar += tokenValueInHbar;
      
      // Store by token ID
      tokens[tokenId] = tokenValueInHbar;
      
      console.log(`📊 Token ${tokenId}: ${rawBalance} raw (${actualBalance} actual) = ${tokenValueInHbar} HBAR equivalent`);
    }
    
    const totalValue = hbarBalance + totalTokenValueInHbar;
    
    console.log(`📊 Total portfolio breakdown:`);
    console.log(`   HBAR: ${hbarBalance} HBAR`);
    console.log(`   Tokens: ${totalTokenValueInHbar} HBAR equivalent`);
    console.log(`   Total: ${totalValue} HBAR equivalent`);
    
    return {
      hbar: hbarBalance,
      tokens: tokens,
      totalValue: totalValue
    };
  }



  /**
   * Execute HBAR transfer to the governance contract
   */
  private async executeHbarTransfer(amount: number): Promise<string> {
    if (!this.agentExecutor) throw new Error("Agent executor not initialized");

    const contractId = this.env.GOVERNANCE_CONTRACT_ID;
    const treasuryId = this.env.HEDERA_ACCOUNT_ID;

    console.log(`🔄 Transferring ${amount} HBAR from treasury ${treasuryId} to contract ${contractId}`);

    try {
      const response = await this.agentExecutor.invoke({
        input: `Transfer ${amount} HBAR from account ${treasuryId} to contract ${contractId}. Please respond with the transaction ID if successful.`
      });
      
      console.log(`✅ HBAR transfer response: ${response.output}`);
      return `Successfully transferred ${amount} HBAR to governance contract`;
    } catch (error) {
      console.error(`❌ HBAR transfer failed:`, error);
      throw error;
    }
  }

  /**
   * Execute HBAR withdrawal from the governance contract
   */
  private async executeHbarWithdrawal(amount: number): Promise<string> {
    if (!this.agentExecutor) throw new Error("Agent executor not initialized");

    const contractId = this.env.GOVERNANCE_CONTRACT_ID;
    const amountInTinybars = Math.floor(amount * 100000000); // Convert HBAR to tinybars

    console.log(`🔄 Withdrawing ${amount} HBAR (${amountInTinybars} tinybars) from contract ${contractId}`);

    try {
      const response = await this.agentExecutor.invoke({
        input: `Use the hbar_withdrawal tool to withdraw ${amountInTinybars} tinybars from contract ${contractId}. This calls the emergencyWithdrawHbar function.`
      });
      
      console.log(`✅ HBAR withdrawal response: ${response.output}`);
      return `Successfully withdrew ${amount} HBAR from governance contract`;
    } catch (error) {
      console.error(`❌ HBAR withdrawal failed:`, error);
      throw error;
    }
  }

  /**
   * Execute token withdrawal from the governance contract
   */
  private async executeTokenWithdrawal(tokenId: string, amount: number): Promise<string> {
    if (!this.agentExecutor) throw new Error("Agent executor not initialized");

    const contractId = this.env.GOVERNANCE_CONTRACT_ID;
    const tokenConfig = this.getTokenConfig(tokenId);
    const amountInRawUnits = Math.floor(amount * Math.pow(10, tokenConfig?.decimals || 8));

    console.log(`🪙 Withdrawing ${amount} units of token ${tokenId} (${amountInRawUnits} raw units) from contract ${contractId}`);

    try {
      const response = await this.agentExecutor.invoke({
        input: `Use the token_withdrawal tool to withdraw ${amountInRawUnits} raw units of token ${tokenId} from contract ${contractId} with reason "Treasury rebalancing". This calls the adminWithdrawToken function.`
      });
      
      console.log(`✅ Token withdrawal response: ${response.output}`);
      return `Successfully withdrew ${amount} units of token ${tokenId} from governance contract`;
    } catch (error) {
      console.error(`❌ Token withdrawal failed:`, error);
      throw error;
    }
  }





  /**
   * Send completion message to the topic
   */
  private async sendCompletionMessage(alert: any, result: {status: string, summary: string}): Promise<void> {
    if (!this.agentExecutor) return;

    try {
      const topicId = this.env.BALANCER_ALERT_TOPIC_ID;
      const completionMessage = {
        type: 'BALANCING_COMPLETE',
        token: alert.token,
        currentRatio: alert.currentRatio,
        targetRatio: alert.targetRatio,
        status: result.status,
        summary: result.summary,
        timestamp: new Date().toISOString()
      };

      const response = await this.agentExecutor.invoke({
        input: `Submit a message to topic ${topicId} with this JSON content: ${JSON.stringify(completionMessage)}`
      });

      console.log(`📤 Completion message sent for ${alert.token}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Summary: ${result.summary}`);

    } catch (error) {
      console.error(`❌ Failed to send completion message for ${alert.token}:`, error);
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



  /**
   * Execute token transfer to the governance contract
   */
  private async executeTokenTransfer(tokenId: string, amount: number): Promise<string> {
    if (!this.agentExecutor) throw new Error("Agent executor not initialized");

    console.log(`🪙 Transferring ${amount} units of token ${tokenId} to contract`);

    // Use the token transfer tool via agent executor
    const transferPrompt = `Transfer ${amount.toFixed(6)} units of token ${tokenId} from account ${this.env.HEDERA_ACCOUNT_ID} to contract ${this.env.GOVERNANCE_CONTRACT_ID}`;
    
    const result = await this.agentExecutor.invoke({
      input: transferPrompt
    });

    console.log(`✅ Token transfer response: ${result.output}`);
    return result.output;
  }
} 