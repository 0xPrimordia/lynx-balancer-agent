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
import { TopicQueryTool } from '../tools/topic-query-tool.js';

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
      'GOVERNANCE_CONTRACT_ID'
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
      const topicQueryTool = new TopicQueryTool(this.client, this.env.BALANCER_ALERT_TOPIC_ID || '0.0.0');
      const allTools = [...hederaTools, tokenTransferTool, hbarWithdrawalTool, topicQueryTool];

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
      console.log(`🔧 Loaded ${hederaTools.length + 3} tools (${hederaTools.length} Hedera + 3 custom)`);

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

      // Get all topic messages once on startup using our custom tool
      const response = await this.agentExecutor.invoke({
        input: `Use the topic_query_tool to get all messages from topic ${this.env.BALANCER_ALERT_TOPIC_ID}. Return the exact JSON output.`
      });

      console.log("🔍 Raw topic response from tool:");
      console.log(response.output.substring(0, 500) + "...");

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
        console.log(`🚨 Processing alert:`, alertMessage);
        
        // Skip old BALANCING_ALERT messages completely - we only want GOVERNANCE_RATIO_UPDATE
        if (alertMessage.type === 'BALANCING_ALERT') {
          console.log(`⏭️  Skipping old BALANCING_ALERT - only processing GOVERNANCE_RATIO_UPDATE alerts`);
          continue;
        }
        
        // Time-based filtering for governance alerts
        if (alertMessage.type === 'GOVERNANCE_RATIO_UPDATE' && alertMessage.effectiveTimestamp) {
          const alertTime = new Date(alertMessage.effectiveTimestamp);
          const ageInMinutes = (currentTime.getTime() - alertTime.getTime()) / (1000 * 60);
          
          if (ageInMinutes > MAX_AGE_MINUTES) {
            console.log(`⏭️  Skipping old governance alert from ${alertMessage.effectiveTimestamp} (${ageInMinutes.toFixed(1)} minutes old)`);
            continue;
          }
          
          // Skip alerts that don't require immediate rebalancing
          if (!alertMessage.requiresImmediateRebalance) {
            console.log(`⏭️  Skipping governance alert - requiresImmediateRebalance is false`);
            continue;
          }
          
          console.log(`✅ Processing recent governance alert from ${alertMessage.effectiveTimestamp} (${ageInMinutes.toFixed(1)} minutes old)`);
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
   * Validate alert accuracy by checking if current ratio matches actual balance
   */
  private async validateAlertAccuracy(alert: any): Promise<boolean> {
    try {
      // Skip validation for alerts without currentRatio (let balance check determine)
      if (!alert.currentRatio || alert.currentRatio === 0) {
        return true;
      }

      // Get actual balances
      const balances = await this.getContractBalances();
      
      let actualCurrentRatio = 0;
      if (alert.token === 'HBAR') {
        actualCurrentRatio = (balances.hbar / balances.totalValue) * 100;
      } else if (alert.tokenId) {
        // Calculate token ratio using tokenId
        const tokenValue = this.getTokenValueFromBalances(balances, alert.tokenId);
        actualCurrentRatio = (tokenValue / balances.totalValue) * 100;
      } else {
        console.log(`⚠️  No tokenId provided for ${alert.token} alert, skipping validation`);
        return false;
      }

      // Check if alert ratio is reasonably close to actual ratio (within 10%)
      const ratioDifference = Math.abs(actualCurrentRatio - alert.currentRatio);
      const isAccurate = ratioDifference <= 10;

      console.log(`🔍 Alert validation for ${alert.token}:`);
      console.log(`   Alert ratio: ${alert.currentRatio}%`);
      console.log(`   Actual ratio: ${actualCurrentRatio.toFixed(1)}%`);
      console.log(`   Difference: ${ratioDifference.toFixed(1)}%`);
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
      // Handle governance ratio update alerts
      if (alert.type === 'GOVERNANCE_RATIO_UPDATE') {
        console.log(`⚖️  Processing governance ratio update...`);
        console.log(`📋 Updated ratios:`, alert.updatedRatios);
        console.log(`📋 Previous ratios:`, alert.previousRatios);
        
        // Get current balances
        console.log(`📊 Step 1: Getting contract balances...`);
        const balances = await this.getContractBalances();
        
        // Calculate which tokens have changed and by how much
        const tokenChanges: Array<{tokenId: string, previousRatio: number, targetRatio: number, change: number}> = [];
        
        for (const [tokenName, targetRatio] of Object.entries(alert.updatedRatios)) {
          const previousRatio = alert.previousRatios[tokenName] || 0;
          const change = Math.abs((targetRatio as number) - previousRatio);
          
          if (change > 0.1) { // Only process tokens with >0.1% change
            // Map token names to token IDs using the alert's tokenIds mapping
            const tokenId = alert.tokenIds?.[tokenName] || tokenName;
            
            tokenChanges.push({
              tokenId,
              previousRatio,
              targetRatio: targetRatio as number,
              change
            });
          }
        }
        
        // Sort by change magnitude (largest changes first)
        tokenChanges.sort((a, b) => b.change - a.change);
        
        console.log(`📊 Token changes detected:`, tokenChanges.map(t => 
          `${t.tokenId}: ${t.previousRatio}% → ${t.targetRatio}% (${t.change > 0 ? '+' : ''}${t.change.toFixed(1)}%)`
        ));
        
        // Process each token that needs rebalancing
        for (const tokenChange of tokenChanges) {
          const { tokenId, targetRatio }: {tokenId: string, targetRatio: number} = tokenChange;
          console.log(`🔄 Processing ${tokenId} rebalancing to ${targetRatio}%...`);
          
          // Check token support
          if (tokenId !== 'HBAR' && !['0.0.1183558', '0.0.6200902', '0.0.6212930', '0.0.6212931', '0.0.6212932'].includes(tokenId)) {
            console.log(`⚠️  Token ${tokenId} rebalancing not supported yet.`);
            continue;
          }
          
          // Calculate actual current ratio from real balances
          let actualCurrentRatio = 0;
          if (tokenId === 'HBAR') {
            actualCurrentRatio = (balances.hbar / balances.totalValue) * 100;
          } else {
            // For tokens, we need to get the token value from balances
            const tokenValue = this.getTokenValueFromBalances(balances, tokenId);
            actualCurrentRatio = (tokenValue / balances.totalValue) * 100;
          }
          
          // Handle different token types
          if (tokenId === 'HBAR') {
            await this.handleHbarRebalancing(alert, balances, actualCurrentRatio, targetRatio);
          } else {
            await this.handleTokenRebalancing(alert, balances, actualCurrentRatio, targetRatio, tokenId);
          }
        }
        
        console.log(`✅ Governance ratio update processing completed`);
        return;
      }
      
      // Handle legacy balancing alerts
      console.log(`⚖️  Executing rebalancing for ${alert.token}...`);
      
      // Extract key data from alert
      const { token, currentRatio, targetRatio } = alert;
      console.log(`📋 Alert: ${token} is ${currentRatio}%, target is ${targetRatio}%`);
      
      // Check token support
      if (token !== 'HBAR' && token !== 'SAUCE' && token !== 'USDC') {
        console.log(`⚠️  Token ${token} rebalancing not supported yet.`);
        return;
      }
      
      // Step 1: Get current balances from cache
      console.log(`📊 Step 1: Getting contract balances...`);
      const balances = await this.getContractBalances();
      
      // Calculate actual current ratio from real balances
      const actualCurrentRatio = (balances.hbar / balances.totalValue) * 100;
      
      // Handle different token types
      if (token === 'HBAR') {
        await this.handleHbarRebalancing(alert, balances, actualCurrentRatio, targetRatio);
      } else {
        await this.handleTokenRebalancing(alert, balances, actualCurrentRatio, targetRatio, token);
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
      
      // Get HBAR balance with specific format request
      const hbarResponse = await this.agentExecutor.invoke({
        input: `Get the current HBAR balance for account ${this.env.GOVERNANCE_CONTRACT_ID}. Please respond with ONLY the balance in tinybars format like this: "BALANCE: 1234567.89 tinybars"`
      });
      
      // Get token balances with specific format request
      const tokenResponse = await this.agentExecutor.invoke({
        input: `Check all token balances for the governance contract account ${this.env.GOVERNANCE_CONTRACT_ID}. Please respond with ONLY the token balances in this exact format:
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
      
      // Calculate total value
      const totalValue = hbarBalance + Object.values(tokenBalances).reduce((sum: number, value: any) => sum + (value as number), 0);
      
      console.log(`📊 Total portfolio breakdown:`);
      console.log(`   HBAR: ${hbarBalance} HBAR`);
      console.log(`   Tokens: ${Object.values(tokenBalances).reduce((sum: number, value: any) => sum + (value as number), 0)} HBAR equivalent`);
      console.log(`   Total: ${totalValue} HBAR equivalent`);
      
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
      
      // Placeholder conversion rate (1 token unit = 0.01 HBAR)
      const tokenValueInHbar = actualBalance * 0.01;
      
      tokens[tokenId] = tokenValueInHbar;
      console.log(`📊 Token ${tokenId}: ${rawBalance} raw (${actualBalance} actual) = ${tokenValueInHbar} HBAR equivalent`);
    }
    
    // Fallback to old format if no matches found
    if (Object.keys(tokens).length === 0) {
      const oldTokenMatches = response.matchAll(/\*\*Token ID\*\*:\s+(0\.0\.\d+)[\s\S]*?\*\*Balance\*\*:\s+([\d,]+)[\s\S]*?\*\*Decimals\*\*:\s+(\d+)/g);
      
      for (const match of oldTokenMatches) {
        const tokenId = match[1];
        const rawBalance = parseInt(match[2].replace(/,/g, ''));
        const decimals = parseInt(match[3]);
        const actualBalance = rawBalance / Math.pow(10, decimals);
        
        // Placeholder conversion rate (1 token unit = 0.01 HBAR)
        const tokenValueInHbar = actualBalance * 0.01;
        
        tokens[tokenId] = tokenValueInHbar;
        console.log(`📊 Token ${tokenId}: ${rawBalance} raw (${actualBalance} actual) = ${tokenValueInHbar} HBAR equivalent`);
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
   * Calculate the exact HBAR amount to transfer or withdraw to reach target ratio
   */
  private async calculateHbarAmount(balances: any, targetRatio: number): Promise<number> {
    // Use ACTUAL balances to calculate current state (ignore alert's currentRatio)
    const currentHbarAmount = balances.hbar;
    const totalValue = balances.totalValue;
    const actualCurrentRatio = (currentHbarAmount / totalValue) * 100;
    
    // Calculate target HBAR amount
    const targetHbarAmount = (targetRatio / 100) * totalValue;
    
    // Calculate how much HBAR we need to add to reach target
    const hbarToTransfer = targetHbarAmount - currentHbarAmount;
    
    console.log(`📊 HBAR Calculation:`);
    console.log(`   Total portfolio value: ${totalValue} HBAR`);
    console.log(`   Actual current HBAR ratio: ${actualCurrentRatio.toFixed(1)}%`);
    console.log(`   Target HBAR ratio: ${targetRatio}%`);
    console.log(`   Current HBAR amount: ${currentHbarAmount} HBAR`);
    console.log(`   Target HBAR amount: ${targetHbarAmount} HBAR`);
    console.log(`   HBAR to transfer: ${hbarToTransfer} HBAR`);
    
    // Return absolute value - positive means buy, negative means sell
    return Math.abs(hbarToTransfer);
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
   * Handle HBAR rebalancing (supports both buy and sell)
   */
  private async handleHbarRebalancing(alert: any, balances: any, actualCurrentRatio: number, targetRatio: number): Promise<void> {
    // Determine if we need to buy (transfer TO contract) or sell (withdraw FROM contract)
    const needsToBuy = actualCurrentRatio < targetRatio;
    const needsToSell = actualCurrentRatio > targetRatio;
    
    if (needsToBuy) {
      console.log(`✅ Operation: Buying HBAR (transferring to contract)`);
    } else if (needsToSell) {
      console.log(`✅ Operation: Selling HBAR (withdrawing from contract)`);
    } else {
      console.log(`✅ No operation needed - already at target ratio`);
      return;
    }
    
    // Step 2: Calculate exact HBAR amount to transfer/withdraw
    console.log(`🧮 Step 2: Calculating HBAR amount...`);
    const hbarAmount = await this.calculateHbarAmount(balances, targetRatio);
    
    if (hbarAmount <= 0) {
      console.log(`✅ No transfer needed - already at target ratio`);
      return;
    }
    
    // Step 3: Execute the HBAR operation (buy or sell)
    let transferResult: string;
    try {
      if (needsToBuy) {
        console.log(`🔄 Step 3: Transferring ${hbarAmount} HBAR to contract...`);
        transferResult = await this.executeHbarTransfer(hbarAmount);
      } else {
        console.log(`🔄 Step 3: Withdrawing ${hbarAmount} HBAR from contract...`);
        transferResult = await this.executeHbarWithdrawal(hbarAmount);
              }
        
        // Refresh balances after successful transfer
        await this.refreshContractBalances();
        
        console.log(`✅ HBAR rebalancing completed: ${transferResult}`);
      } catch (transferError) {
        console.error(`❌ HBAR operation failed:`, transferError);
        return;
      }
  }

  /**
   * Handle token rebalancing (buy-only for now)
   */
  private async handleTokenRebalancing(alert: any, balances: any, actualCurrentRatio: number, targetRatio: number, tokenId: string): Promise<void> {
    // For tokens, we can only buy (transfer TO contract) - no selling/withdrawal yet
    const needsToBuy = actualCurrentRatio < targetRatio;
    
    if (!needsToBuy) {
      if (actualCurrentRatio > targetRatio) {
        console.log(`⚠️  ${tokenId} ratio is above target (${actualCurrentRatio.toFixed(1)}% > ${targetRatio}%), but token selling not supported yet`);
      } else {
        console.log(`✅ No operation needed - ${tokenId} already at target ratio`);
      }
      return;
    }
    
    console.log(`✅ Operation: Buying ${tokenId} (transferring to contract)`);
    
    // Step 2: Calculate token amount needed
    console.log(`🧮 Step 2: Calculating ${tokenId} amount...`);
    const tokenAmount = await this.calculateTokenAmount(balances, targetRatio, tokenId);
    
    if (tokenAmount <= 0) {
      console.log(`✅ No transfer needed - already at target ratio`);
      return;
    }
    
    // Step 3: Execute the token transfer
    let transferResult: string;
    try {
      console.log(`🔄 Step 3: Transferring ${tokenAmount} ${tokenId} to contract...`);
      transferResult = await this.executeTokenTransfer(tokenId, tokenAmount);
      
      // Refresh balances after successful transfer
      await this.refreshContractBalances();
      
      console.log(`✅ ${tokenId} rebalancing completed: ${transferResult}`);
    } catch (transferError) {
      console.error(`❌ ${tokenId} operation failed:`, transferError);
      return;
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
   * Calculate the exact token amount to transfer to reach target ratio
   */
  private async calculateTokenAmount(balances: any, targetRatio: number, tokenId: string): Promise<number> {
    
    // For simplicity, calculate based on HBAR equivalent value
    // TODO: Implement proper token-specific calculations with real token IDs and decimals
    const totalValue = balances.totalValue;
    const currentTokenValue = balances.tokens[tokenId] || 0; // Use tokenId as key
    const actualCurrentRatio = (currentTokenValue / totalValue) * 100;
    
    // Calculate target token value
    const targetTokenValue = (targetRatio / 100) * totalValue;
    
    // Calculate how much token value we need to add
    const tokenValueToAdd = targetTokenValue - currentTokenValue;
    
    // Convert to token units (placeholder conversion)
    // TODO: Use real token decimals and exchange rates
    const tokenUnitsToAdd = tokenValueToAdd / 0.01; // Assuming 1 token unit = 0.01 HBAR
    
    console.log(`📊 ${tokenId} Calculation:`);
    console.log(`   Total portfolio value: ${totalValue} HBAR equivalent`);
    console.log(`   Current ${tokenId} value: ${currentTokenValue} HBAR equivalent`);
    console.log(`   Actual current ${tokenId} ratio: ${actualCurrentRatio.toFixed(1)}%`);
    console.log(`   Target ${tokenId} ratio: ${targetRatio}%`);
    console.log(`   Target ${tokenId} value: ${targetTokenValue} HBAR equivalent`);
    console.log(`   ${tokenId} value to add: ${tokenValueToAdd} HBAR equivalent`);
    console.log(`   ${tokenId} units to transfer: ${tokenUnitsToAdd}`);
    
    return Math.abs(tokenUnitsToAdd);
  }

  /**
   * Execute token transfer to the governance contract
   */
  private async executeTokenTransfer(tokenId: string, amount: number): Promise<string> {
    if (!this.agentExecutor) throw new Error("Agent executor not initialized");

    console.log(`🪙 Transferring ${amount} units of token ${tokenId} to contract`);

    // Use the token transfer tool via agent executor
    const transferPrompt = `Transfer ${Math.floor(amount)} units of token ${tokenId} from account ${this.env.HEDERA_ACCOUNT_ID} to contract ${this.env.GOVERNANCE_CONTRACT_ID}`;
    
    const result = await this.agentExecutor.invoke({
      input: transferPrompt
    });

    console.log(`✅ Token transfer response: ${result.output}`);
    return result.output;
  }
} 