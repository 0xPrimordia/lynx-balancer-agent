#!/usr/bin/env node

// Suppress noisy warnings and errors
import './suppress-warnings.js';

import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Client } from '@hashgraph/sdk';
import { HederaLangchainToolkit, coreConsensusPlugin } from 'hedera-agent-kit';

// Load environment variables
config();

// Simple alert messages - content doesn't matter, only that a message is received

/**
 * Simple Alert Sender
 * 
 * Sends simple test messages to trigger balancer agent rebalancing.
 * Content doesn't matter - any message triggers rebalancing.
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

      // Initialize Hedera Agent Kit with consensus plugin
      const hederaAgentToolkit = new HederaLangchainToolkit({
        client: this.client,
        configuration: {
          plugins: [coreConsensusPlugin]
        }
      });

      // Initialize OpenAI LLM
      const llm = new ChatOpenAI({
        modelName: "gpt-4o",
        temperature: 0,
        apiKey: env.OPENAI_API_KEY,
      });

      // Create simple prompt for topic messaging
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', 'You are a simple alert sender. Use the topic messaging tools to submit messages to HCS topics. Always use the submit-message-to-topic tool when asked to submit a message.'],
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
   * Send a simple test alert to trigger rebalancing
   */
  async sendAlert(alertType: string): Promise<void> {
    if (!this.agentExecutor || !this.topicId) {
      throw new Error("Agent executor or topic ID not initialized");
    }

    // Simple messages - content doesn't matter, only that a message is received
    const alerts: Record<string, string> = {
      hbar: "GOVERNANCE UPDATE: HBAR ratio changed - rebalancing required",
      sauce: "GOVERNANCE UPDATE: SAUCE ratio changed - rebalancing required", 
      usdc: "GOVERNANCE UPDATE: USDC ratio changed - rebalancing required",
      test: "TEST ALERT: Triggering rebalancing cycle"
    };

    const message = alerts[alertType];
    if (!message) {
      throw new Error(`Unknown alert type: ${alertType}. Available: ${Object.keys(alerts).join(', ')}`);
    }

    console.log(`🚨 Sending ${alertType.toUpperCase()} alert to topic ${this.topicId}...`);
    console.log(`📨 Message: "${message}"`);
    
    try {
      const response = await this.agentExecutor.invoke({
        input: `Submit the message "${message}" to topic ${this.topicId}`
      });
      
      console.log("✅ Alert sent successfully!");
      console.log(`📤 Response: ${response.output}`);
      
    } catch (error) {
      console.error(`❌ Failed to send ${alertType} alert:`, error);
      throw error;
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log("🦌⚡ Simple Alert Sender");
  console.log("=======================");

  const args = process.argv.slice(2);
  const command = args[0] || 'test';

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
      case 'test':
        await sender.sendAlert('test');
        break;
      default:
        console.log("📋 Available alert commands:");
        console.log("  test    - Send simple test alert to trigger rebalancing");
        console.log("  hbar    - Send HBAR governance update alert");
        console.log("  sauce   - Send SAUCE governance update alert");
        console.log("  usdc    - Send USDC governance update alert");
        console.log("\n💡 Examples:");
        console.log("   npm run test:alert test");
        console.log("   npm run test:alert hbar");
        console.log("   npm run test:alert sauce");
        console.log("\n📊 Note: The balancer agent now triggers rebalancing on ANY message");
        console.log("   - Message content doesn't matter");
        console.log("   - Agent uses real-time topic subscription");
        console.log("   - Any message will trigger immediate rebalancing");
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