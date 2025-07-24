#!/usr/bin/env node

import { config } from 'dotenv';
import { StandardsKit } from '@hashgraphonline/standards-agent-plugin';

// Load environment variables
config();

interface EnvironmentConfig {
  HEDERA_NETWORK?: string;
  BALANCER_AGENT_ACCOUNT_ID?: string;
  BALANCER_AGENT_PRIVATE_KEY?: string;
  GOVERNANCE_AGENT_ACCOUNT_ID?: string;
  OPENAI_API_KEY?: string;
}

/**
 * Simple connection test that uses minimal API calls
 */
async function testBasicConnection(): Promise<void> {
  console.log("🔍 Simple Connection Test - Minimal API Usage");
  console.log("==============================================");

  const env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;

  if (!env.BALANCER_AGENT_ACCOUNT_ID || !env.BALANCER_AGENT_PRIVATE_KEY || !env.OPENAI_API_KEY) {
    console.log("❌ Missing required environment variables");
    return;
  }

  try {
    console.log("🔧 Initializing minimal StandardsKit instance...");
    
    const balancerKit = new StandardsKit({
      accountId: env.BALANCER_AGENT_ACCOUNT_ID!,
      privateKey: env.BALANCER_AGENT_PRIVATE_KEY!,
      network: (env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
      openAIApiKey: env.OPENAI_API_KEY!,
    });

    await balancerKit.initialize();
    console.log("✅ StandardsKit initialized");

    console.log("\n📋 Agent Configuration:");
    console.log(`   Balancer Agent: ${env.BALANCER_AGENT_ACCOUNT_ID}`);
    console.log(`   Governance Agent: ${env.GOVERNANCE_AGENT_ACCOUNT_ID || 'Not configured'}`);
    console.log(`   Network: ${env.HEDERA_NETWORK || 'testnet'}`);

    // Simple test - just check if agent can respond without complex operations
    console.log("\n🔍 Testing basic agent response (minimal API usage)...");
    
    try {
      const testResult = await balancerKit.processMessage("What is my account ID?");
      console.log("🤖 Agent response:");
      const resultStr = typeof testResult === 'string' ? testResult : 
                       (testResult?.output || testResult?.message || JSON.stringify(testResult, null, 2));
      
      if (typeof testResult === 'object' && testResult?.error) {
        console.log("❌ Error:", testResult.error);
      } else {
        console.log("✅", resultStr.substring(0, 200) + (resultStr.length > 200 ? "..." : ""));
      }
    } catch (testError) {
      console.log("❌ Basic test failed");
      
      if (testError instanceof Error) {
        if (testError.message.includes('429') || testError.message.includes('Rate limit')) {
          console.log("⚠️  Rate limit hit during simple test");
        } else {
          console.log("Error:", testError.message);
        }
      }
    }

    console.log("\n💡 Next Steps:");
    console.log("1. If you see connection errors, this means the balancer agent needs proper registration");
    console.log("2. Wait for OpenAI rate limits to reset (2-3 minutes)"); 
    console.log("3. Try the full persistent agent: npm run balancer:agent");
    console.log("4. Then connect from governance agent: npm run demo:hcs10 demo");

  } catch (error) {
    console.error("❌ Test failed:", error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && error.message.includes('429')) {
      console.log("\n⏳ OpenAI rate limits exhausted. Please wait 2-3 minutes and try again.");
      console.log("💡 You can also try upgrading your OpenAI plan for higher rate limits.");
    }
  }
}

// Run the test
testBasicConnection().catch(console.error); 