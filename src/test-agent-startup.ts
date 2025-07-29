#!/usr/bin/env node

// Suppress noisy warnings and errors
import './suppress-warnings.js';

import { config } from 'dotenv';
import { LynxBalancerAgent } from './agent/lynx-balancer-agent.js';

// Load environment variables
config();

/**
 * Test script to verify agent startup
 */
async function testAgentStartup(): Promise<void> {
  console.log("🧪 Testing Lynx Balancer Agent Startup");
  console.log("======================================");

  try {
    // Create the agent
    const agent = new LynxBalancerAgent();
    console.log("✅ Agent instance created");
    
    // Try to initialize (this will fail if env vars are missing, which is expected)
    console.log("🔧 Attempting to initialize agent...");
    await agent.initialize();
    
    console.log("✅ Agent initialized successfully!");
    console.log("🎉 Agent startup test passed!");
    
  } catch (error) {
    console.log("⚠️  Agent initialization failed (expected if env vars not set):");
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
    console.log("\n💡 To run the agent properly, set these environment variables:");
    console.log("   - BALANCER_AGENT_ACCOUNT_ID");
    console.log("   - BALANCER_AGENT_PRIVATE_KEY");
    console.log("   - OPENAI_API_KEY");
    console.log("   - GOVERNANCE_AGENT_ACCOUNT_ID (optional)");
  }
}

// Run the test
testAgentStartup().catch(console.error); 