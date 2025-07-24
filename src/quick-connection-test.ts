#!/usr/bin/env node

import { config } from 'dotenv';
import { LynxBalancerAgent } from './balancer-agent.js';

// Load environment variables
config();

/**
 * Quick connection test - starts balancer agent briefly to test connections
 */
async function quickConnectionTest(): Promise<void> {
  console.log("⚡ Quick Connection Test");
  console.log("======================");
  console.log("This will start the balancer agent for 2 minutes to test connections");
  console.log("Run your governance agent demo during this window!");
  console.log("");

  const agent = new LynxBalancerAgent();

  try {
    // Initialize the agent
    console.log("🔧 Initializing balancer agent...");
    await agent.initialize();
    
    // Skip registration to avoid creating new agents
    console.log("✅ Using existing agent account");
    
    // Start connection monitoring
    console.log("🔍 Starting connection monitoring...");
    await agent.startConnectionMonitoring();
    
    // Run for 2 minutes to give time for connection testing
    console.log("\n" + "=".repeat(60));
    console.log("🔗 BALANCER AGENT READY FOR CONNECTIONS (2 MINUTE WINDOW)");
    console.log("=".repeat(60));
    console.log("💡 From your governance project, run: npm run demo:hcs10 demo");
    console.log("⏰ This test will automatically stop in 2 minutes...");
    console.log("=".repeat(60) + "\n");

    // Wait 2 minutes
    const testDuration = 120000; // 2 minutes
    const checkInterval = 10000; // Check every 10 seconds
    let elapsed = 0;

    while (elapsed < testDuration) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;
      
      const remaining = Math.round((testDuration - elapsed) / 1000);
      console.log(`⏰ Test running... ${remaining} seconds remaining`);
    }

    console.log("\n⏰ 2 minute test window completed!");
    console.log("🛑 Stopping test agent...");

  } catch (error) {
    console.error("❌ Test failed:", error instanceof Error ? error.message : String(error));
  } finally {
    await agent.stop();
    console.log("✅ Quick connection test completed");
    console.log("\n💡 If connection worked:");
    console.log("   - Start persistent agent: npm run balancer:agent");
    console.log("   - Test from governance agent: npm run demo:hcs10 demo");
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

// Run the test
quickConnectionTest().catch(console.error); 