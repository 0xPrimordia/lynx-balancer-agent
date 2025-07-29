#!/usr/bin/env node

import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Client } from '@hashgraph/sdk';
import { HederaLangchainToolkit } from 'hedera-agent-kit';

config();

async function checkTopic() {
  const client = Client.forTestnet();
  client.setOperator(process.env.HEDERA_ACCOUNT_ID!, process.env.HEDERA_PRIVATE_KEY!);

  const toolkit = new HederaLangchainToolkit({ client, configuration: {} });
  const llm = new ChatOpenAI({ modelName: 'gpt-4o', temperature: 0, apiKey: process.env.OPENAI_API_KEY });

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', 'You are a topic message inspector. Show all details of topic messages clearly.'],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}']
  ]);

  const agent = await createToolCallingAgent({ llm, tools: toolkit.getTools(), prompt });
  const executor = new AgentExecutor({ agent, tools: toolkit.getTools(), verbose: true, maxIterations: 10 });

  console.log('🔍 Checking topic 0.0.6468240 for messages...');
  
  const response = await executor.invoke({
    input: 'Get all messages from topic 0.0.6468240. For each message, show the sequence number, timestamp, and the exact message content. If there are JSON messages, format them clearly.'
  });

  console.log('\n=== TOPIC MESSAGES RESULT ===');
  console.log(response.output);
}

checkTopic().catch(console.error); 