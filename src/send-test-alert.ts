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
  operator_id: string;            // Format: "{governance_topic}@{agent_account}"
  m: string;                      // Human-readable message
  
  // Alert Data
  data: {
    type: 'GOVERNANCE_RATIO_UPDATE';
    alertLevel: 'HIGH' | 'NORMAL';
    weights: Record<string, number>;  // Weight multipliers by token name
    changedToken: string;         // Name of the token that changed
    changedValue: {
      old: number;
      new: number;
    };
    changeMagnitude: number;       // Absolute difference between old/new
    effectiveTimestamp: string;    // ISO timestamp
    transactionId: string;         // Contract update transaction ID
    reason: string;                // "Governance vote executed - contract ratios updated"
    requiresImmediateRebalance: boolean;  // true if change > 5%
  };
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
   * Send a test balance alert to the balancer agent topic using HCS-10 protocol
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
          m: 'Balance Alert: HBAR weight changed from 50 to 40 (10 weight change)',
          data: {
            type: 'GOVERNANCE_RATIO_UPDATE',
            alertLevel: 'HIGH',
            weights: {
              HBAR: 40,
              WBTC: 4,
              SAUCE: 30,
              USDC: 30,
              JAM: 30,
              HEADSTART: 20
            },
            changedToken: 'HBAR',
            changedValue: {
              old: 50,
              new: 40
            },
            changeMagnitude: 10,
            effectiveTimestamp: new Date().toISOString(),
            transactionId: `${env.HEDERA_ACCOUNT_ID}@${Date.now()}.${Math.floor(Math.random() * 1000000)}`,
            reason: 'Governance vote executed - contract ratios updated',
            requiresImmediateRebalance: true
          }
        },
              sauce: {
          p: 'hcs-10',
          op: 'balance_alert',
          operator_id: operatorId,
          m: 'Balance Alert: SAUCE weight changed from 25 to 30 (5 weight change)',
          data: {
            type: 'GOVERNANCE_RATIO_UPDATE',
            alertLevel: 'NORMAL',
            weights: {
              HBAR: 50,
              WBTC: 4,
              SAUCE: 30,
              USDC: 30,
              JAM: 30,
              HEADSTART: 20
            },
            changedToken: 'SAUCE',
            changedValue: {
              old: 25,
              new: 30
            },
            changeMagnitude: 5,
            effectiveTimestamp: new Date().toISOString(),
            transactionId: `${env.HEDERA_ACCOUNT_ID}@${Date.now()}.${Math.floor(Math.random() * 1000000)}`,
            reason: 'Governance vote executed - contract ratios updated',
            requiresImmediateRebalance: false
          }
        },
              usdc: {
          p: 'hcs-10',
          op: 'balance_alert',
          operator_id: operatorId,
          m: 'Balance Alert: USDC weight changed from 15 to 20 (5 weight change)',
          data: {
            type: 'GOVERNANCE_RATIO_UPDATE',
            alertLevel: 'NORMAL',
            weights: {
              HBAR: 50,
              WBTC: 4,
              SAUCE: 30,
              USDC: 20,
              JAM: 30,
              HEADSTART: 20
            },
            changedToken: 'USDC',
            changedValue: {
              old: 15,
              new: 20
            },
            changeMagnitude: 5,
            effectiveTimestamp: new Date().toISOString(),
            transactionId: `${env.HEDERA_ACCOUNT_ID}@${Date.now()}.${Math.floor(Math.random() * 1000000)}`,
            reason: 'Governance vote executed - contract ratios updated',
            requiresImmediateRebalance: false
          }
        }
    };

    const alertData = alerts[alertType];
    if (!alertData) {
      throw new Error(`Unknown alert type: ${alertType}`);
    }

    console.log(`🚨 Sending ${alertType.toUpperCase()} balance alert to topic...`);
    console.log(`📊 Alert data:`, JSON.stringify(alertData, null, 2));
    
    try {
      const response = await this.agentExecutor.invoke({
        input: `Submit a message to topic ${this.topicId} with this JSON content: ${JSON.stringify(alertData)}`
      });
      
      console.log("✅ Balance alert sent successfully");
      console.log(`📤 Response: ${response.output}`);
      
    } catch (error) {
      console.error(`❌ Failed to send ${alertType} balance alert:`, error);
      throw error;
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log("🦌⚡ Balance Alert Sender Test");
  console.log("=============================");

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
        console.log("📋 Available balance alert commands:");
        console.log("  hbar    - Send HBAR weight change alert (50 → 40, 10 weight change)");
        console.log("  sauce   - Send SAUCE weight change alert (25 → 30, 5 weight change)");
        console.log("  usdc    - Send USDC weight change alert (15 → 20, 5 weight change)");
        console.log("\n💡 Examples:");
        console.log("   npm run test:alert hbar");
        console.log("   npm run test:alert sauce");
        console.log("   npm run test:alert usdc");
        console.log("\n📊 These alerts use the HCS-10 protocol with:");
        console.log("   - Token weight multipliers for governance updates");
        console.log("   - Alert levels (HIGH/NORMAL) based on change magnitude");
        console.log("   - Complete weight state for all tokens");
        console.log("   - Transaction IDs and timestamps");
        console.log("   - Immediate rebalance flags for significant changes");
        break;
    }

  } catch (error) {
    console.error("❌ Failed to send balance alert:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 