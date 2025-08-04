import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';

// take the given token, balance on contract and its ratio on the contract as vars
// use our formula as defined on the contract to determin if the balance weight matches the ratio
// return the result

export class TokenRatioTool extends StructuredTool {
  name = 'token_ratio_tool';
  description = 'Analyze if a specific token balance matches its required ratio using the contract formula: Required = (LYNX Supply × Ratio) ÷ 10';
  schema = z.object({
    tokenSymbol: z.string().describe('Token symbol (e.g., HBAR, WBTC, SAUCE, USDC, JAM, HEADSTART)'),
    currentBalance: z.number().describe('Current balance of the token on the contract'),
    targetRatio: z.number().describe('Target ratio for this token from the contract'),
    lynxTotalSupply: z.number().describe('Total supply of LYNX tokens'),
    tolerancePercent: z.number().optional().default(5).describe('Tolerance percentage for balance check (default 5%)')
  });

  async _call(input: {
    tokenSymbol: string;
    currentBalance: number;
    targetRatio: number;
    lynxTotalSupply: number;
    tolerancePercent?: number;
  }): Promise<string> {
    try {
      const tolerance = (input.tolerancePercent || 5) / 100; // Convert to decimal
      
      // Use the contract formula: Required = (LYNX Supply × Ratio) ÷ 10
      const requiredBalance = (input.lynxTotalSupply * input.targetRatio) / 10;
      
      // Calculate difference and percentage
      const difference = Math.abs(input.currentBalance - requiredBalance);
      const diffPercent = requiredBalance > 0 ? (difference / requiredBalance) * 100 : 0;
      
      // Determine if rebalancing is needed
      const needsRebalancing = diffPercent > (tolerance * 100);
      const status = needsRebalancing ? 'OUT_OF_BALANCE' : 'BALANCED';
      
      // Determine if we have excess or deficit
      let balanceStatus = 'BALANCED';
      if (needsRebalancing) {
        balanceStatus = input.currentBalance > requiredBalance ? 'EXCESS' : 'DEFICIT';
      }

      const result = {
        tokenSymbol: input.tokenSymbol,
        status: status,
        balanceStatus: balanceStatus,
        currentBalance: input.currentBalance,
        requiredBalance: Number(requiredBalance.toFixed(4)),
        difference: Number(difference.toFixed(4)),
        diffPercent: Number(diffPercent.toFixed(2)),
        tolerancePercent: input.tolerancePercent || 5,
        needsRebalancing: needsRebalancing,
        analysis: `${input.tokenSymbol}: Current=${input.currentBalance}, Required=${requiredBalance.toFixed(2)}, Diff=${diffPercent.toFixed(1)}% (${needsRebalancing ? 'REBALANCE NEEDED' : 'OK'})`
      };

      console.log(`🔍 ${input.tokenSymbol} Analysis: ${result.analysis}`);

      return JSON.stringify(result, null, 2);

    } catch (error) {
      console.error(`❌ Failed to analyze ${input.tokenSymbol}:`, error);
      return JSON.stringify({
        tokenSymbol: input.tokenSymbol,
        status: 'ERROR',
        error: error instanceof Error ? error.message : String(error),
        needsRebalancing: false
      }, null, 2);
    }
  }
}