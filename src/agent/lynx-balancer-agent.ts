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
   * Execute full rebalancing based on current contract ratios
   * This is the main rebalancing function that can be called from startup or alerts
   */
  async executeRebalancing(): Promise<void> {
    console.log("⚖️  Executing portfolio rebalancing...");
    await this.validateTreasuryRatios();
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

      // Execute initial rebalancing on startup
      await this.executeRebalancing();

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
   * Check for recent alerts and trigger rebalancing if found
   * Simplified: Any message within 5 minutes triggers full rebalancing
   */
  private async processAllAlerts(messagesOutput: string): Promise<void> {
    try {
      console.log("🔍 Checking for recent alert messages...");

      // Simple approach: check if there are any recent messages at all
      const currentTime = new Date();
      const MAX_AGE_MINUTES = 5;
      let hasRecentAlert = false;

      // Parse basic message info from topic query tool response
      try {
        const jsonMatch = messagesOutput.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          const jsonResponse = JSON.parse(jsonMatch[1]);
          if (jsonResponse.governanceAlerts && Array.isArray(jsonResponse.governanceAlerts)) {
            console.log(`📋 Found ${jsonResponse.governanceAlerts.length} messages in topic`);
            
            // Just check timestamps - don't parse content
            for (const alert of jsonResponse.governanceAlerts) {
              if (alert.alertData && alert.alertData.effectiveTimestamp) {
                const alertTime = new Date(alert.alertData.effectiveTimestamp);
                const ageInMinutes = (currentTime.getTime() - alertTime.getTime()) / (1000 * 60);
                
                if (ageInMinutes <= MAX_AGE_MINUTES) {
                  console.log(`✅ Found recent alert from ${alert.alertData.effectiveTimestamp} (${ageInMinutes.toFixed(1)} minutes old)`);
                  hasRecentAlert = true;
                  break;
                } else {
                  console.log(`⏭️  Skipping old alert from ${alert.alertData.effectiveTimestamp} (${ageInMinutes.toFixed(1)} minutes old)`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.log("⚠️  Could not parse topic messages, assuming no recent alerts");
      }

      // If we found any recent alert, execute full rebalancing
      if (hasRecentAlert) {
        console.log("🚨 Recent alert detected - executing full rebalancing...");
        await this.executeRebalancing();
        console.log("✅ Rebalancing completed in response to alert");
      } else {
        console.log("⏭️  No recent alerts found - no rebalancing needed");
      }

      console.log("✅ Alert check completed");

    } catch (error) {
      console.error("❌ Error checking alerts:", error);
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