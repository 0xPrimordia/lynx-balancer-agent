import { ConversationalAgent } from '@hashgraphonline/conversational-agent';
import { EnvironmentConfig, GovernanceRatioUpdate, RebalanceStatusMessage } from './agent-config.js';



export class AgentMessaging {
  private agent?: ConversationalAgent;
  private env: EnvironmentConfig;
  private isRunning: boolean = false;
  private messageCount: number = 0;
  


  constructor(env: EnvironmentConfig) {
    this.env = env;
  }

  /**
   * Initialize ConversationalAgent for HCS-10 messaging
   */
  async initialize(): Promise<void> {
    console.log("🔧 Initializing ConversationalAgent for HCS-10 messaging...");

    if (!this.env.BALANCER_AGENT_ACCOUNT_ID || !this.env.BALANCER_AGENT_PRIVATE_KEY) {
      throw new Error("Missing required environment variables: BALANCER_AGENT_ACCOUNT_ID, BALANCER_AGENT_PRIVATE_KEY");
    }

    if (!this.env.OPENAI_API_KEY) {
      throw new Error("Missing required environment variable: OPENAI_API_KEY");
    }

    try {
      // Initialize ConversationalAgent with HCS-10 capabilities (following governance agent pattern)
      this.agent = ConversationalAgent.withHCS10({
        accountId: this.env.BALANCER_AGENT_ACCOUNT_ID,
        privateKey: this.env.BALANCER_AGENT_PRIVATE_KEY,
        network: (this.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
        openAIApiKey: this.env.OPENAI_API_KEY,
        openAIModelName: 'gpt-4o',
        verbose: false,
        operationalMode: 'autonomous',
        disableLogging: true
      });

      await this.agent.initialize();
      console.log("✅ ConversationalAgent initialized successfully");
      console.log(`📋 Account ID: ${this.env.BALANCER_AGENT_ACCOUNT_ID}`);
      console.log(`🌐 Network: ${this.env.HEDERA_NETWORK || 'testnet'}`);



    } catch (error) {
      console.error("❌ Failed to initialize ConversationalAgent:", error);
      throw error;
    }
  }



  /**
   * Activate the agent for HCS-10 messaging
   */
  async activateAgent(): Promise<void> {
    if (!this.agent) {
      throw new Error("ConversationalAgent not initialized. Call initialize() first.");
    }

    console.log("🔗 Activating agent for HCS-10 messaging...");
    
    // Check if agent is already registered, if not register it
    try {
      console.log("📋 Checking agent registration status...");
      const statusResponse = await this.agent.processMessage("What is my agent status?");
      console.log("🔍 Agent status:", statusResponse.output);
      
      // If agent is not registered, register it
      if (statusResponse.output && statusResponse.output.includes('not registered')) {
        console.log("📝 Registering agent for HCS-10 operations...");
        const registerResponse = await this.agent.processMessage(
          "Register me as an AI agent named 'Lynx Balancer Agent' with description 'Autonomous balancing agent for Lynx DAO treasury management' and balancer tag"
        );
        console.log("✅ Agent registration:", registerResponse.output);
      }
    } catch (error) {
      console.log("⚠️  Agent registration check failed:", error instanceof Error ? error.message : String(error));
    }
    
    console.log("💡 Agent is ready to receive messages from governance agent");
    console.log("📋 No connection establishment needed - governance agent will connect to us");
  }

  /**
   * Start message listening loop (following governance agent pattern)
   */
  async startMessageListening(): Promise<void> {
    if (!this.agent) {
      throw new Error("ConversationalAgent not initialized. Call initialize() first.");
    }

    console.log("🔗 Starting HCS-10 message listening...");
    console.log("💡 Waiting for governance agent to connect and send updates...");

    // Check for active connections
    try {
      console.log("📋 Checking for active connections...");
      const connectionsResponse = await this.agent.processMessage('List my active connections');
      console.log("🔍 Active connections:", connectionsResponse.output);
      
      // Try to clear all active connections
      if (connectionsResponse.output && connectionsResponse.output.includes('Active Connections')) {
        console.log("🧹 Attempting to clear all active connections...");
        const clearResponse = await this.agent.processMessage('Clear my active connections');
        console.log("🔄 Clear result:", clearResponse.output);
      }
    } catch (error) {
      console.log("⚠️  Failed to list active connections:", error instanceof Error ? error.message : String(error));
    }
    
    console.log("📋 Agent is ready - monitoring for messages from active connections");

    this.isRunning = true;

    // Keep the agent running and check for messages and connection requests periodically
    let connectionCheckCounter = 0;
    while (this.isRunning) {
      try {
        // Check for new messages using simple command from documentation
        const messagesResponse = await this.agent.processMessage(
          'Check my messages'
        );
        
        const responseStr = messagesResponse.output || messagesResponse.message || '';
        
        if (responseStr && 
            responseStr !== 'No new messages' && 
            !responseStr.includes('No responses') &&
            !responseStr.includes('no messages') &&
            !responseStr.includes('No recent messages') &&
            !responseStr.includes('Sorry, I encountered an error processing your request') &&
            !responseStr.includes('Error processing request') &&
            !responseStr.includes('Invalid connection topic ID format') &&
            !responseStr.includes('encountered issues retrieving messages') &&
            !responseStr.includes('no active agent to list connection requests')) {
          
          this.messageCount++;
          console.log(`📨 Received new message(s) [${this.messageCount}]:`);
          console.log(`   ${responseStr}`);
          
          // Process the message
          await this.processIncomingMessage(responseStr);
        }
        
        // Periodically check active connections (every 10 cycles = 30 seconds)
        connectionCheckCounter++;
        if (connectionCheckCounter >= 10) {
          try {
            console.log("🔍 Checking active connections status...");
            const connectionsResponse = await this.agent.processMessage('List my active connections');
            console.log("📋 Active connections:", connectionsResponse.output);
          } catch (error) {
            console.log("⚠️  Connection status check failed:", error instanceof Error ? error.message : String(error));
          }
          connectionCheckCounter = 0; // Reset counter
        }
      } catch (error) {
        // Message check failed, continue running
        console.log("⚠️  Message check failed:", error instanceof Error ? error.message : String(error));
      }
      
      // Wait 3 seconds between checks (same as governance agent)
      await this.sleep(3000);
    }
  }

  /**
   * Process incoming message
   */
  private async processIncomingMessage(messageContent: string): Promise<void> {
    console.log("🔄 Processing incoming message...");
    console.log(`📝 Message content: "${messageContent}"`);

    try {
      // Try to extract JSON from the message content
      const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[0]);
          console.log("📊 Extracted JSON data:", JSON.stringify(jsonData, null, 2));
          
          // Handle structured JSON messages
          if (jsonData.type === 'BALANCING_ALERT') {
            await this.handleBalancingAlert(jsonData);
            return;
          } else if (jsonData.type === 'GOVERNANCE_RATIO_UPDATE') {
            await this.handleGovernanceUpdate(jsonData);
            return;
          }
        } catch (jsonError) {
          console.log("⚠️  Failed to parse JSON, treating as text message");
        }
      }

      // Handle text-based messages
      if (messageContent.includes('BALANCING_ALERT') || messageContent.includes('REBALANCE_REQUIRED')) {
        await this.handleBalancingAlert(messageContent);
      } else if (messageContent.includes('GOVERNANCE_RATIO_UPDATE')) {
        await this.handleGovernanceUpdate(messageContent);
      } else if (messageContent.includes('Agent action complete') || messageContent.includes('ACKNOWLEDGMENT')) {
        await this.handleAgentActionComplete(messageContent);
      } else if (messageContent.includes('Sorry, I encountered an error processing your request') ||
                 messageContent.includes('Error processing request') || 
                 messageContent.includes('Invalid connection topic ID format') ||
                 messageContent.includes('encountered issues retrieving messages') ||
                 messageContent.includes('no active agent to list connection requests')) {
        console.log("⚠️  Received error message, skipping processing");
        return;
      } else {
        await this.handleGenericMessage(messageContent);
      }
    } catch (error) {
      console.error("❌ Failed to process incoming message:", error);
    }
  }

  /**
   * Handle balancing alert messages
   */
  private async handleBalancingAlert(messageContent: string | any): Promise<void> {
    console.log('🚨 Processing balancing alert...');
    
    let alertData: any;
    
    if (typeof messageContent === 'string') {
      // Try to parse JSON from string
      try {
        const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          alertData = JSON.parse(jsonMatch[0]);
        } else {
          console.log('⚠️  No JSON found in message, treating as text');
          alertData = { type: 'BALANCING_ALERT', message: messageContent };
        }
      } catch (error) {
        console.log('⚠️  Failed to parse JSON, treating as text');
        alertData = { type: 'BALANCING_ALERT', message: messageContent };
      }
    } else {
      // Already parsed JSON object
      alertData = messageContent;
    }
    
    console.log('📊 Alert Data:', JSON.stringify(alertData, null, 2));
    
    // Extract alert information
    const token = alertData.token || 'UNKNOWN';
    const currentRatio = alertData.currentRatio || 0;
    const targetRatio = alertData.targetRatio || 0;
    const deviation = alertData.deviation || 0;
    const alertLevel = alertData.alertLevel || 'MEDIUM';
    const reason = alertData.reason || 'No reason provided';
    
    console.log(`🔧 Alert Details:`);
    console.log(`   Token: ${token}`);
    console.log(`   Current Ratio: ${currentRatio}%`);
    console.log(`   Target Ratio: ${targetRatio}%`);
    console.log(`   Deviation: ${deviation}%`);
    console.log(`   Alert Level: ${alertLevel}`);
    console.log(`   Reason: ${reason}`);
    
    // Send immediate acknowledgment (following governance agent pattern)
    const ackMessage = `REBALANCE_ACKNOWLEDGMENT: Balancing alert received for ${token}. Current: ${currentRatio}%, Target: ${targetRatio}%, Deviation: ${deviation}%. Processing initiated.`;
    await this.sendResponse(ackMessage);
    
    // TODO: Execute rebalancing operations via main agent
    console.log('📋 TODO: Forward rebalancing request to main balancer agent');
    console.log('⚠️  Blockchain operations should be handled by main agent, not messaging layer');
    
    const todoMessage = `REBALANCE_ACKNOWLEDGED: Alert received and will be processed by main balancer agent`;
    await this.sendResponse(todoMessage);
  }

  /**
   * Handle governance ratio update messages
   */
  private async handleGovernanceUpdate(messageContent: string): Promise<void> {
    console.log('🔄 Processing governance ratio update...');
    console.log('📊 TODO: Parse governance update structure');
    console.log('🔧 TODO: Integrate with blockchain tools for rebalancing');
    console.log('📤 TODO: Send status updates back to governance agent');
    
    // TODO: Parse the governance update JSON structure
    // TODO: Extract target ratios and current state
    // TODO: Call blockchain tools to execute rebalancing
    // TODO: Send progress updates back to governance agent
  }

  /**
   * Handle agent action complete messages
   */
  private async handleAgentActionComplete(messageContent: string): Promise<void> {
    console.log('✅ Received agent action completion notification');
    console.log('📊 TODO: Process completion and update status');
    
    // TODO: Update internal status tracking
    // TODO: Prepare for next governance update
  }

  /**
   * Handle generic messages
   */
  private async handleGenericMessage(messageContent: string): Promise<void> {
    console.log('📨 Received generic message');
    console.log('💡 TODO: Implement message parsing and response logic');
    
    // TODO: Parse message structure
    // TODO: Determine appropriate response
    // TODO: Send acknowledgment if needed
  }

  /**
   * Send response back to governance agent (following governance agent pattern)
   */
  async sendResponse(message: string): Promise<void> {
    if (!this.agent) {
      throw new Error("ConversationalAgent not initialized. Call initialize() first.");
    }

    if (!this.env.GOVERNANCE_AGENT_ACCOUNT_ID) {
      console.log("⚠️  No governance agent configured, cannot send response");
      return;
    }

    try {
      console.log(`📤 Sending response to governance agent ${this.env.GOVERNANCE_AGENT_ACCOUNT_ID}...`);
      const response = await this.agent.processMessage(
        `Send '${message}' to agent ${this.env.GOVERNANCE_AGENT_ACCOUNT_ID}`
      );
      console.log("✅ Response sent successfully");
      console.log(`   Response: ${response.output}`);
    } catch (error) {
      console.error("❌ Failed to send response:", error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Stop message listening
   */
  async stop(): Promise<void> {
    console.log("🛑 Stopping message listening...");
    this.isRunning = false;
  }

  /**
   * Utility function for sleeping
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 