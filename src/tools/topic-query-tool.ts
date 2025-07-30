import { Tool } from '@langchain/core/tools';
import { Client, TopicMessageQuery } from '@hashgraph/sdk';

/**
 * Custom tool for querying Hedera topic messages directly via SDK
 * Returns clean JSON data without AI formatting
 */
export class TopicQueryTool extends Tool {
  name = 'topic_query_tool';
  description = 'Query messages from a Hedera Consensus Service topic directly using the SDK. Returns clean JSON message data.';
  
  private client: Client;
  private topicId: string;

  constructor(client: Client, topicId: string) {
    super();
    this.client = client;
    this.topicId = topicId;
  }

  protected async _call(input: string): Promise<string> {
    try {
      console.log(`🔍 Querying topic ${this.topicId} for messages...`);
      
      // Parse input to get optional parameters
      const params = this.parseInput(input);
      
      // Create topic message query
      const query = new TopicMessageQuery()
        .setTopicId(this.topicId);
      
      // Set optional parameters
      if (params.startTime) {
        query.setStartTime(params.startTime);
      }
      if (params.endTime) {
        query.setEndTime(params.endTime);
      }
      if (params.limit) {
        query.setLimit(params.limit);
      }
      
      // Execute query and collect messages
      const messages: Array<{
        sequenceNumber: number;
        timestamp: string;
        content: string;
        runningHash: string;
      }> = [];
      
      // Use the mirror node approach for getting messages
      const mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com/api/v1/topics';
      const response = await fetch(`${mirrorNodeUrl}/${this.topicId}/messages?limit=10&order=desc`);
      
      if (!response.ok) {
        throw new Error(`Mirror node request failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      const governanceAlerts: any[] = [];
      
      if (data.messages && Array.isArray(data.messages)) {
        for (const message of data.messages) {
          let content = message.message || '';
          
          // Decode base64 content if it exists
          if (content) {
            try {
              const decodedContent = Buffer.from(content, 'base64').toString('utf-8');
              content = decodedContent;
            } catch (decodeError) {
              // If base64 decoding fails, use original content
              console.log('⚠️  Failed to decode base64 content, using raw content');
            }
          }
          
          // Try to parse as JSON and extract governance alerts
          if (content) {
            try {
              const parsedContent = JSON.parse(content);
              if (parsedContent.data && parsedContent.data.type === 'GOVERNANCE_RATIO_UPDATE') {
                governanceAlerts.push({
                  sequenceNumber: message.sequence_number || 0,
                  timestamp: message.consensus_timestamp || new Date().toISOString(),
                  alertData: parsedContent.data
                });
              }
            } catch (parseError) {
              // Skip messages that aren't valid JSON
              continue;
            }
          }
          
          // Also keep raw messages for debugging
          messages.push({
            sequenceNumber: message.sequence_number || 0,
            timestamp: message.consensus_timestamp || new Date().toISOString(),
            content: content,
            runningHash: message.running_hash || 'unknown'
          });
        }
      }
      
      // Sort by sequence number (newest first)
      messages.sort((a, b) => b.sequenceNumber - a.sequenceNumber);
      
      // Return clean JSON with parsed governance alerts
      return JSON.stringify({
        topicId: this.topicId,
        messageCount: messages.length,
        governanceAlerts: governanceAlerts,
        governanceAlertCount: governanceAlerts.length,
        messages: messages,
        queryParams: params
      }, null, 2);
      
    } catch (error) {
      console.error('❌ Error querying topic:', error);
      return JSON.stringify({
        error: 'Failed to query topic messages',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private parseInput(input: string): {
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  } {
    const params: Record<string, unknown> = {};
    
    // Simple parsing for common parameters
    const limitMatch = input.match(/limit[:\s]+(\d+)/i);
    if (limitMatch) {
      params.limit = parseInt(limitMatch[1]);
    }
    
    // Parse time ranges if specified
    const timeMatch = input.match(/last[:\s]+(\d+)\s*(minutes?|hours?|days?)/i);
    if (timeMatch) {
      const amount = parseInt(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      const now = new Date();
      
      const startTime = new Date();
      if (unit.startsWith('minute')) {
        startTime.setMinutes(now.getMinutes() - amount);
      } else if (unit.startsWith('hour')) {
        startTime.setHours(now.getHours() - amount);
      } else if (unit.startsWith('day')) {
        startTime.setDate(now.getDate() - amount);
      }
      
      params.startTime = startTime;
    }
    
    return params as {
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    };
  }
} 