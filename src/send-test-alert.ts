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
 * Governance Agent Balance Alert Message Schema
 */
interface BalanceAlertMessage {
  p: 'hcs-10';                    // Protocol identifier
  op: 'balance_alert';            // Operation type
  operator_id: string;            // Format: "{inboundTopicId}@{accountId}"
  data: {
    type: 'GOVERNANCE_RATIO_UPDATE';
    alertLevel: 'NORMAL' | 'HIGH';  // Based on change magnitude (>5% = HIGH)
    updatedRatios: Record<string, number>;  // New target ratios by token name
    previousRatios: Record<string, number>; // Old ratios for comparison
    tokenIds: Record<string, string>;       // Token ID mapping (name -> ID)
    changedParameter: string;      // e.g., "treasury.weights.HBAR"
    changedValue: {
      old: number;
      new: number;
    };
    changeMagnitude: number;       // Absolute difference between old/new
    effectiveTimestamp: string;    // ISO timestamp
    transactionId: string;         // Contract update transaction ID
    changeSummary: string;         // Human-readable summary
    reason: string;                // "Governance vote executed - contract ratios updated"
    requiresImmediateRebalance: boolean;  // true if change > 5%
  };
  m: string;                      // Human-readable message
}

/**
 * Simple Alert Sender
 * 
 * This script ONLY sends HCS-10 alerts to the balancer agent
 */
class SimpleAlertSender {
  private agentExecutor?: AgentExecutor;
  private client?: Client;
  private topicId?: string;

  /**
   * Initialize Hedera Agent Kit for sending topic messages
   */
  async initialize(): Promise<void> {
    console.log("🔧 Initializing Simple Alert Sender");
    console.log("===================================");

    const env = process.env;
    
    // Validate required environment variables
    const requiredVars = [
      'HEDERA_ACCOUNT_ID',
      'HEDERA_PRIVATE_KEY', 
      'OPENAI_API_KEY'
    ];
    
    const missingVars = requiredVars.filter(varName => !env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    try {
      console.log("🔧 Setting up Hedera Agent Kit for topic messaging...");

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

      // Create simple prompt for topic messaging
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', 'You are a governance agent that sends balancing alerts via HCS topics. Use the topic messaging tools to send structured alerts.'],
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

      // Create topic if BALANCER_ALERT_TOPIC_ID is empty
      let topicId = env.BALANCER_ALERT_TOPIC_ID;
      if (!topicId || topicId.trim() === '') {
        console.log("🔧 BALANCER_ALERT_TOPIC_ID is empty, creating new topic...");
        
        const createTopicResponse = await this.agentExecutor.invoke({
          input: `Create a new HCS topic for balancer alerts with memo "Lynx DAO Balancer Alerts Topic"`
        });
        
        console.log("📡 Topic creation response:", createTopicResponse.output);
        
        // Extract topic ID from response (you'll need to update your .env file with this)
        const topicMatch = createTopicResponse.output.match(/0\.0\.\d+/);
        if (topicMatch) {
          topicId = topicMatch[0];
          console.log(`✅ Created new topic: ${topicId}`);
          console.log(`🔧 Please add this to your .env file: BALANCER_ALERT_TOPIC_ID=${topicId}`);
        } else {
          throw new Error("Failed to extract topic ID from creation response");
        }
      } else {
        console.log(`📡 Using existing topic: ${topicId}`);
      }

      // Store topic ID for use in sendAlert
      this.topicId = topicId;

      console.log("✅ Alert sender initialized");
      console.log(`📋 Operator Account: ${env.HEDERA_ACCOUNT_ID}`);
      console.log(`📡 Alert Topic: ${topicId}`);
      console.log(`🔧 Available tools:`, hederaTools.map(t => t.name));

    } catch (error) {
      console.error("❌ Failed to initialize alert sender:", error);
      throw error;
    }
  }

  /**
   * Send a test alert to the balancer agent topic using governance agent schema
   */
  async sendAlert(alertType: string): Promise<void> {
    if (!this.agentExecutor || !this.topicId) {
      throw new Error("Agent executor or topic ID not initialized");
    }

    const env = process.env;
    const operatorId = `${env.BALANCER_INBOUND_TOPIC_ID || '0.0.123456'}@${env.HEDERA_ACCOUNT_ID}`;

    const alerts: Record<string, BalanceAlertMessage> = {
      hbar: {
        p: 'hcs-10',
        op: 'balance_alert',
        operator_id: operatorId,
        data: {
          type: 'GOVERNANCE_RATIO_UPDATE',
          alertLevel: 'HIGH',
          updatedRatios: {
            HBAR: 40,
            USDC: 20
          },
          previousRatios: {
            HBAR: 50,
            USDC: 15
          },
          tokenIds: {
            HBAR: 'HBAR', // HBAR doesn't have a token ID
            USDC: '0.0.6212931'
          },
          changedParameter: 'treasury.weights.HBAR',
          changedValue: {
            old: 50,
            new: 40
          },
          changeMagnitude: 10,
          effectiveTimestamp: new Date().toISOString(),
          transactionId: `${env.HEDERA_ACCOUNT_ID}@${Date.now()}.${Math.floor(Math.random() * 1000000)}`,
          changeSummary: 'HBAR: 50% ↓ 40% (-10%), USDC: 15% ↑ 20% (+5%)',
          reason: 'Governance vote executed - contract ratios updated',
          requiresImmediateRebalance: true
        },
        m: 'Balance Alert: treasury.weights.HBAR changed from 50% to 40% (10% change)'
      },
      sauce: {
        p: 'hcs-10',
        op: 'balance_alert',
        operator_id: operatorId,
        data: {
          type: 'GOVERNANCE_RATIO_UPDATE',
          alertLevel: 'HIGH',
          updatedRatios: {
            SAUCE: 30,
            WBTC: 5
          },
          previousRatios: {
            SAUCE: 25,
            WBTC: 3
          },
          tokenIds: {
            SAUCE: '0.0.1183558',
            WBTC: '0.0.6212930'
          },
          changedParameter: 'treasury.weights.SAUCE',
          changedValue: {
            old: 25,
            new: 30
          },
          changeMagnitude: 5,
          effectiveTimestamp: new Date().toISOString(),
          transactionId: `${env.HEDERA_ACCOUNT_ID}@${Date.now()}.${Math.floor(Math.random() * 1000000)}`,
          changeSummary: 'SAUCE: 25% ↑ 30% (+5%), WBTC: 3% ↑ 5% (+2%)',
          reason: 'Governance vote executed - contract ratios updated',
          requiresImmediateRebalance: true
        },
        m: 'Balance Alert: treasury.weights.SAUCE changed from 25% to 30% (5% change)'
      },
      usdc: {
        p: 'hcs-10',
        op: 'balance_alert',
        operator_id: operatorId,
        data: {
          type: 'GOVERNANCE_RATIO_UPDATE',
          alertLevel: 'HIGH',
          updatedRatios: {
            USDC: 20,
            JAM: 8
          },
          previousRatios: {
            USDC: 15,
            JAM: 5
          },
          tokenIds: {
            USDC: '0.0.6200902',
            JAM: '0.0.6212931'
          },
          changedParameter: 'treasury.weights.USDC',
          changedValue: {
            old: 15,
            new: 20
          },
          changeMagnitude: 5,
          effectiveTimestamp: new Date().toISOString(),
          transactionId: `${env.HEDERA_ACCOUNT_ID}@${Date.now()}.${Math.floor(Math.random() * 1000000)}`,
          changeSummary: 'USDC: 15% ↑ 20% (+5%), JAM: 5% ↑ 8% (+3%)',
          reason: 'Governance vote executed - contract ratios updated',
          requiresImmediateRebalance: true
        },
        m: 'Balance Alert: treasury.weights.USDC changed from 15% to 20% (5% change)'
      }
    };

    const alertData = alerts[alertType];
    if (!alertData) {
      throw new Error(`Unknown alert type: ${alertType}`);
    }

    console.log(`🚨 Sending ${alertType.toUpperCase()} governance alert to topic...`);
    console.log(`📊 Alert data:`, JSON.stringify(alertData, null, 2));
    
    try {
      const response = await this.agentExecutor.invoke({
        input: `Submit a message to topic ${this.topicId} with this JSON content: ${JSON.stringify(alertData)}`
      });
      
      console.log("✅ Governance alert sent successfully");
      console.log(`📤 Response: ${response.output}`);
      
    } catch (error) {
      console.error(`❌ Failed to send ${alertType} governance alert:`, error);
      throw error;
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log("🦌⚡ Simple Alert Sender Test");
  console.log("============================");

  const args = process.argv.slice(2);
  const command = args[0] || 'hbar';

  const sender = new SimpleAlertSender();

  try {
    await sender.initialize();

    switch (command.toLowerCase()) {
      case 'hbar':
        await sender.sendAlert('hbar');
        break;
      case 'sauce':
        await sender.sendAlert('sauce');
        break;
      case 'usdc':
        await sender.sendAlert('usdc');
        break;
      default:
        console.log("📋 Available governance alert commands:");
        console.log("  hbar    - Send HBAR governance ratio update (50% → 40%, USDC 15% → 20%)");
        console.log("  sauce   - Send SAUCE governance ratio update (25% → 30%, WBTC 3% → 5%)");
        console.log("  usdc    - Send USDC governance ratio update (15% → 20%, JAM 5% → 8%)");
        console.log("\n💡 Examples:");
        console.log("   npm run test:alert hbar");
        console.log("   npm run test:alert sauce");
        console.log("   npm run test:alert usdc");
        console.log("\n📊 These alerts use the governance agent schema with:");
        console.log("   - Updated target ratios for affected tokens only");
        console.log("   - Token ID mappings for precise identification");
        console.log("   - Change magnitude and alert levels");
        console.log("   - Transaction IDs and timestamps");
        console.log("   - All alerts set to requiresImmediateRebalance: true");
        break;
    }

  } catch (error) {
    console.error("❌ Failed to send alert:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 