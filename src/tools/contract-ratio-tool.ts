import { z } from 'zod';
import { Client, ContractCallQuery, ContractId, TokenInfoQuery, TokenId } from '@hashgraph/sdk';
import { StructuredTool } from '@langchain/core/tools';

/**
 * Tool for querying governance contract token ratios
 */
export class ContractRatioTool extends StructuredTool {
  name = 'contract_ratio_query';
  description = 'Query the governance contract for current token weight ratios using the getCurrentRatios function';
  schema = z.object({
    contractId: z.string().describe('The governance contract ID to query')
  });

  private client: Client;

  constructor(client: Client) {
    super();
    this.client = client;
  }

  async _call(input: any): Promise<string> {
    try {
      console.log(`🔍 Querying contract ratios for ${input.contractId}...`);

      // Create contract call query for getCurrentRatios function
      const contractCallQuery = new ContractCallQuery()
        .setContractId(ContractId.fromString(input.contractId))
        .setGas(100000)
        .setFunction('getCurrentRatios');

      // Execute the query
      const response = await contractCallQuery.execute(this.client);
      
      if (!response) {
        throw new Error('No result returned from contract call');
      }

      // Parse the result (6 uint256 values)
      const result = response;
      
      // Extract individual ratios (assuming they're returned in order)
      const hbarRatio = result.getUint256(0);
      const wbtcRatio = result.getUint256(1);
      const sauceRatio = result.getUint256(2);
      const usdcRatio = result.getUint256(3);
      const jamRatio = result.getUint256(4);
      const headstartRatio = result.getUint256(5);

      const ratioData = {
        HBAR: hbarRatio.toString(),
        WBTC: wbtcRatio.toString(),
        SAUCE: sauceRatio.toString(),
        USDC: usdcRatio.toString(),
        JAM: jamRatio.toString(),
        HEADSTART: headstartRatio.toString()
      };

      console.log(`✅ Contract ratios retrieved:`, ratioData);

      return JSON.stringify({
        success: true,
        contractId: input.contractId,
        ratios: ratioData,
        timestamp: new Date().toISOString()
      }, null, 2);

    } catch (error) {
      console.error(`❌ Failed to query contract ratios:`, error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        contractId: input.contractId,
        timestamp: new Date().toISOString()
      }, null, 2);
    }
  }
}

export class TokenSupplyTool extends StructuredTool {
  name = 'token_supply_query';
  description = 'Query the Hedera network for the total supply of a token using the TokenInfoQuery';
  schema = z.object({
    tokenId: z.string().describe('The token ID to query')
  });

  private client: Client;

  constructor(client: Client) {
    super();
    this.client = client;
  }

  async _call(input: any): Promise<string> {
    try {
      console.log(`🔍 Querying token supply for: ${input.tokenId}...`);

      const tokenInfoQuery = new TokenInfoQuery()
        .setTokenId(TokenId.fromString(input.tokenId));

      const response = await tokenInfoQuery.execute(this.client);

      if (!response) {
        throw new Error('No result returned from token info query');
      }

      const totalSupply = response.totalSupply;
      const decimals = response.decimals;
      
      // Convert from raw units to human-readable
      const humanReadableSupply = Number(totalSupply) / Math.pow(10, decimals);

      console.log(`✅ Token supply retrieved: ${humanReadableSupply} (${totalSupply} raw units, ${decimals} decimals)`);

      return JSON.stringify({
        success: true,
        tokenId: input.tokenId,
        totalSupply: totalSupply.toString(),
        humanReadableSupply: humanReadableSupply.toString(),
        decimals: decimals,
        timestamp: new Date().toISOString()
      }, null, 2);

    } catch (error) {
      console.error(`❌ Failed to query token supply:`, error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        tokenId: input.tokenId,
        timestamp: new Date().toISOString()
      }, null, 2);
    }
  }
} 