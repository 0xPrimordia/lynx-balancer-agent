#!/usr/bin/env node

import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Manual Hybrid Agent Example - Currently Not Available
 * 
 * This example would demonstrate manual integration of Hedera Agent Kit
 * with the Standards Agent Plugin, but the required classes 
 * (HederaConversationalAgent, ServerSigner, getAllHederaCorePlugins)
 * are not available in the current version of hedera-agent-kit.
 * 
 * For hybrid capabilities, please use:
 * - npm run hybrid:agent (StandardsKit approach)
 * 
 * Or contribute to extending the hedera-agent-kit with these classes!
 */
async function main(): Promise<void> {
  console.log("⚠️  Manual Hybrid Integration Currently Not Available");
  console.log("====================================================");

  console.log("\nThe manual integration approach requires classes that are not");
  console.log("available in the current hedera-agent-kit v3.0.4:");
  console.log("  - HederaConversationalAgent");
  console.log("  - ServerSigner");  
  console.log("  - getAllHederaCorePlugins");

  console.log("\n✅ Available Alternative:");
  console.log("Use the StandardsKit for hybrid capabilities:");
  console.log("  npm run hybrid:agent");

  console.log("\n🔮 Future Enhancement:");
  console.log("These classes may be added in future versions of hedera-agent-kit");
  console.log("or can be implemented as part of the agent evolution.");

  console.log("\n📚 Current Working Examples:");
  console.log("  • npm run dev                    - Foundation demo");
  console.log("  • npm run hybrid:agent           - Hybrid agent with StandardsKit");
  console.log("  • npm run langchain:tool-calling-agent  - Basic LangChain integration");
  console.log("  • npm run langchain:structured-chat-agent - Conversational agent");

  return Promise.resolve();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main }; 