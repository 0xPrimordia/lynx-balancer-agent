#!/usr/bin/env tsx

import { StandardsKit } from '@hashgraphonline/standards-agent-plugin';
import dotenv from 'dotenv';

dotenv.config();

async function setupLynxBalancerAgent() {
  console.log('🦌⚡ Setting up Lynx Balancer Agent...\n');
  console.log('🔑 Using ED25519 account with DER-encoded private key\n');
  
  // Validate required environment variables
  const requiredEnvVars = [
    'HEDERA_ACCOUNT_ID',
    'HEDERA_PRIVATE_KEY',
    'OPENAI_API_KEY'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  try {
    console.log('📡 Initializing StandardsKit with ED25519 account...');
    const kit = new StandardsKit({
      accountId: process.env.HEDERA_ACCOUNT_ID!,
      privateKey: process.env.HEDERA_PRIVATE_KEY!,
      network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
      openAIApiKey: process.env.OPENAI_API_KEY!,
      openAIModelName: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
      verbose: false,
      disableLogging: true,
      operationalMode: 'autonomous'
    });

    await kit.initialize();
    console.log('✅ StandardsKit initialized with ED25519 account\n');

    console.log('🤖 Registering NEW Lynx Balancer Agent with ED25519 account...');
    
    const timestamp = Date.now();
    const agentName = `LynxBalancerAgent${timestamp}`;
    
    console.log('🔄 Attempting registration with profile picture...');
    
    let registerResponse;
    let profilePictureIncluded = false;
    
    try {
      // First, try to register with profile picture and multiple capabilities
      registerResponse = await kit.processMessage(
        `Register me as an AI agent named ${agentName} with a random unique alias, capabilities DEFI and PORTFOLIO_MANAGEMENT, tags "defi,balancing,automated,trading", profile picture URL "https://hashgraphonline.com/img/logo.png", and description "Intelligent portfolio balancing agent for Hedera DeFi - automated rebalancing, yield optimization, and multi-agent coordination"`
      );
      
      profilePictureIncluded = true;
      console.log('✅ Registration with profile picture succeeded!');
      
    } catch (error) {
      console.log('⚠️  Registration with profile picture failed, likely due to insufficient HBAR for inscription');
      console.log('🔄 Retrying registration without profile picture...');
      
      // If the first attempt fails, try without profile picture
      registerResponse = await kit.processMessage(
        `Register me as an AI agent named ${agentName} with a random unique alias, capabilities DEFI and PORTFOLIO_MANAGEMENT, tags "defi,balancing,automated,trading", and description "Intelligent portfolio balancing agent for Hedera DeFi - automated rebalancing, yield optimization, and multi-agent coordination"`
      );
      
      profilePictureIncluded = false;
      console.log('✅ Registration without profile picture succeeded!');
    }

    console.log('\n✅ Agent Registration Response:');
    console.log(registerResponse.output || 'Registration completed');
    
    if (registerResponse.transactionId) {
      console.log(`📄 Transaction ID: ${registerResponse.transactionId}`);
    }

    // Get the created agent details
    console.log('\n🔄 Fetching created agent details...');
    const stateManager = kit.getStateManager();
    const currentAgent = stateManager.getCurrentAgent();

    if (currentAgent) {
      console.log('\n🎉 NEW Lynx Balancer Agent Created with ED25519:');
      console.log(`📛 Name: ${currentAgent.name}`);
      console.log(`🆔 Agent Account: ${currentAgent.accountId}`);
      console.log(`📨 Inbound Topic: ${currentAgent.inboundTopicId}`);
      console.log(`📤 Outbound Topic: ${currentAgent.outboundTopicId}`);
      console.log(`👤 Profile Topic: ${currentAgent.profileTopicId || 'Not set'}`);
      console.log(`🖼️  Profile Picture: ${profilePictureIncluded ? 'Included' : 'Not included (insufficient HBAR)'}`);
      console.log(`🏷️  Capabilities: DEFI, PORTFOLIO_MANAGEMENT`);
      console.log(`🔖 Tags: defi, balancing, automated, trading`);
      console.log(`🔑 Key Type: ED25519 (DER-encoded)`);
      
      console.log('\n🔧 Add these to your .env file:');
      console.log(`BALANCER_AGENT_ACCOUNT_ID=${currentAgent.accountId}`);
      console.log(`BALANCER_AGENT_INBOUND_TOPIC=${currentAgent.inboundTopicId}`);
      console.log(`BALANCER_AGENT_OUTBOUND_TOPIC=${currentAgent.outboundTopicId}`);
      if (currentAgent.profileTopicId) {
        console.log(`BALANCER_AGENT_PROFILE_TOPIC=${currentAgent.profileTopicId}`);
      }
      
      if (!profilePictureIncluded) {
        console.log('\n💡 To add a profile picture later:');
        console.log('1. Fund the agent account with more HBAR');
        console.log('2. Use the Standards Agent Kit to update the profile picture');
      }
      
      console.log('\n🎉 SUCCESS! ED25519 DER-encoded key works perfectly for Lynx Balancer Agent registration!');
      
      console.log('\n🌐 Agent Discovery:');
      console.log('Your agent is now discoverable by other agents searching for:');
      console.log('  • Capability: DEFI or PORTFOLIO_MANAGEMENT');
      console.log('  • Tags: defi, balancing, automated, trading');
      console.log('  • Account ID: ' + currentAgent.accountId);
      
      console.log('\n🔐 Key Information:');
      console.log('  • Type: ED25519 (Recommended for Hedera)');
      console.log('  • Format: DER-encoded');
      console.log('  • Security: High-performance elliptic curve cryptography');
      
    } else {
      console.log('\n⚠️  Agent details not immediately available.');
      console.log('📄 Check transaction ID on HashScan for account creation.');
    }

    console.log('\n📝 Next steps for Lynx Balancer Agent:');
    console.log('1. Add the agent environment variables to your .env file');
    console.log('2. Run `npm run hybrid:agent` to test hybrid blockchain + networking');
    console.log('3. Find other DeFi agents: "Find all agents with defi tag"');
    console.log('4. Create portfolio tokens and start balancing operations');
    console.log('5. Coordinate with other agents for advanced DeFi strategies');
    
    console.log('\n🦌 Lynx Balancer Agent Features:');
    console.log('  ⚖️  Automated portfolio rebalancing');
    console.log('  🤝 Multi-agent DeFi coordination');
    console.log('  📊 Real-time balance monitoring');
    console.log('  🎯 Yield optimization strategies');
    console.log('  🔗 Agent network discovery and communication');
    console.log('  🔑 ED25519 cryptographic security');
    
  } catch (error) {
    console.error('\n❌ Lynx Balancer Agent setup failed with ED25519 account:', error);
    console.log('\n🔧 Troubleshooting for ED25519 DER Keys:');
    console.log('1. Ensure your account has sufficient HBAR (≥5 HBAR recommended)');
    console.log('2. Verify your ED25519 private key is DER-encoded');
    console.log('3. Check your network setting (testnet/mainnet) matches your account');
    console.log('4. Ensure OpenAI API key is valid and has credits');
    console.log('5. ED25519 keys should start with "302a300506032b657004" in DER format');
    process.exit(1);
  }
}

setupLynxBalancerAgent().catch(console.error); 