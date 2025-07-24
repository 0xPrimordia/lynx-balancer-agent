import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Client, PrivateKey, TransferTransaction, TokenId, AccountId, Hbar, AccountInfoQuery, AccountBalanceQuery } from '@hashgraph/sdk';

/**
 * Treasury Transfer Tool for V3 Hedera Agent Kit
 * Handles HBAR and token transfers for portfolio rebalancing using the agent account as DEX
 */
export class TreasuryTransferTool extends StructuredTool {
  name = 'treasury_transfer_tool';
  description = 'Transfer HBAR or tokens between accounts for treasury rebalancing operations. Uses the agent account as a simulated DEX for swaps.';
  schema = z.object({
    action: z.enum(['transfer_hbar', 'transfer_token', 'swap_token']),
    fromAccount: z.string().optional().describe('Source account ID (e.g., 0.0.123456)'),
    toAccount: z.string().optional().describe('Destination account ID (e.g., 0.0.789012)'),
    amount: z.string().optional().describe('Amount to transfer (in smallest units)'),
    tokenId: z.string().optional().describe('Token ID for token transfers (e.g., 0.0.123456)'),
    tokenIn: z.string().optional().describe('Token ID to swap from'),
    tokenOut: z.string().optional().describe('Token ID to swap to'),
    swapAmount: z.string().optional().describe('Amount to swap')
  });

  private client: Client;
  private operatorAccountId: string;
  private dexAccountId: string;

  constructor(client: Client, operatorAccountId: string) {
    super();
    this.client = client;
    this.operatorAccountId = operatorAccountId;
    this.dexAccountId = operatorAccountId; // Use the same account as DEX
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      switch (input.action) {
        case 'transfer_hbar':
          return await this.transferHbar(input);
        case 'transfer_token':
          return await this.transferToken(input);
        case 'swap_token':
          return await this.swapToken(input);
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  private async transferHbar(input: any): Promise<string> {
    if (!input.fromAccount || !input.toAccount || !input.amount) {
      throw new Error('fromAccount, toAccount, and amount are required for HBAR transfers');
    }

    try {
      const transferTx = new TransferTransaction()
        .addHbarTransfer(input.fromAccount, -parseInt(input.amount))
        .addHbarTransfer(input.toAccount, parseInt(input.amount))
        .setMaxTransactionFee(new Hbar(2));

      const response = await transferTx.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      return JSON.stringify({
        success: true,
        action: 'transfer_hbar',
        fromAccount: input.fromAccount,
        toAccount: input.toAccount,
        amount: input.amount,
        transactionId: response.transactionId.toString(),
        status: receipt.status.toString()
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        action: 'transfer_hbar',
        error: error instanceof Error ? error.message : 'Transfer failed'
      });
    }
  }

  private async transferToken(input: any): Promise<string> {
    if (!input.fromAccount || !input.toAccount || !input.amount || !input.tokenId) {
      throw new Error('fromAccount, toAccount, amount, and tokenId are required for token transfers');
    }

    try {
      const tokenId = TokenId.fromString(input.tokenId);
      const fromAccount = AccountId.fromString(input.fromAccount);
      const toAccount = AccountId.fromString(input.toAccount);

      const transferTx = new TransferTransaction()
        .addTokenTransfer(tokenId, fromAccount, -parseInt(input.amount))
        .addTokenTransfer(tokenId, toAccount, parseInt(input.amount))
        .setMaxTransactionFee(new Hbar(2));

      const response = await transferTx.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      return JSON.stringify({
        success: true,
        action: 'transfer_token',
        tokenId: input.tokenId,
        fromAccount: input.fromAccount,
        toAccount: input.toAccount,
        amount: input.amount,
        transactionId: response.transactionId.toString(),
        status: receipt.status.toString()
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        action: 'transfer_token',
        error: error instanceof Error ? error.message : 'Token transfer failed'
      });
    }
  }



  private async swapToken(input: any): Promise<string> {
    if (!input.tokenIn || !input.tokenOut || !input.swapAmount) {
      throw new Error('tokenIn, tokenOut, and swapAmount are required for token swaps');
    }

    try {
      // Simulate a swap by transferring tokens to/from the DEX account
      // In a real implementation, this would involve actual DEX contract calls
      
      // Step 1: Transfer tokenIn from user to DEX
      const transferInTx = new TransferTransaction()
        .addTokenTransfer(TokenId.fromString(input.tokenIn), AccountId.fromString(this.operatorAccountId), -parseInt(input.swapAmount))
        .addTokenTransfer(TokenId.fromString(input.tokenIn), AccountId.fromString(this.dexAccountId), parseInt(input.swapAmount))
        .setMaxTransactionFee(new Hbar(2));

      const transferInResponse = await transferInTx.execute(this.client);
      const transferInReceipt = await transferInResponse.getReceipt(this.client);

      // Step 2: Calculate swap output (simplified - in reality this would be based on DEX pricing)
      const swapOutput = Math.floor(parseInt(input.swapAmount) * 0.95); // 5% fee simulation

      // Step 3: Transfer tokenOut from DEX to user
      const transferOutTx = new TransferTransaction()
        .addTokenTransfer(TokenId.fromString(input.tokenOut), AccountId.fromString(this.dexAccountId), -swapOutput)
        .addTokenTransfer(TokenId.fromString(input.tokenOut), AccountId.fromString(this.operatorAccountId), swapOutput)
        .setMaxTransactionFee(new Hbar(2));

      const transferOutResponse = await transferOutTx.execute(this.client);
      const transferOutReceipt = await transferOutResponse.getReceipt(this.client);

      return JSON.stringify({
        success: true,
        action: 'swap_token',
        tokenIn: input.tokenIn,
        tokenOut: input.tokenOut,
        amountIn: input.swapAmount,
        amountOut: swapOutput.toString(),
        dexAccount: this.dexAccountId,
        transferInTxId: transferInResponse.transactionId.toString(),
        transferOutTxId: transferOutResponse.transactionId.toString(),
        note: 'This is a simulated swap using direct transfers to/from DEX account'
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        action: 'swap_token',
        error: error instanceof Error ? error.message : 'Token swap failed'
      });
    }
  }


}

/**
 * Treasury Rebalancing Tool
 * Calculates and executes portfolio rebalancing operations
 */
export class TreasuryRebalancingTool extends StructuredTool {
  name = 'treasury_rebalancing_tool';
  description = 'Calculate and execute portfolio rebalancing operations based on target allocations.';
  schema = z.object({
    action: z.enum(['calculate_rebalancing', 'execute_rebalancing', 'get_portfolio_status']),
    targetAllocation: z.record(z.number()).optional().describe('Target allocation percentages (e.g., {"hbar": 40, "wbtc": 20})'),
    currentBalances: z.record(z.string()).optional().describe('Current token balances'),
    portfolioValue: z.string().optional().describe('Total portfolio value in HBAR'),
    execute: z.boolean().optional().describe('Whether to execute the rebalancing (default: false)')
  });

  private transferTool: TreasuryTransferTool;

  constructor(transferTool: TreasuryTransferTool) {
    super();
    this.transferTool = transferTool;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      switch (input.action) {
        case 'calculate_rebalancing':
          return await this.calculateRebalancing(input);
        case 'execute_rebalancing':
          return await this.executeRebalancing(input);
        case 'get_portfolio_status':
          return await this.getPortfolioStatus(input);
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  private async calculateRebalancing(input: any): Promise<string> {
    if (!input.targetAllocation || !input.currentBalances || !input.portfolioValue) {
      throw new Error('targetAllocation, currentBalances, and portfolioValue are required for rebalancing calculation');
    }

    // This is a simplified calculation - in practice, you'd want more sophisticated logic
    const portfolioValue = parseFloat(input.portfolioValue);
    const targetAllocation = input.targetAllocation;
    const currentBalances = input.currentBalances;

    const rebalancingActions: Array<{
      token: string;
      currentValue: number;
      targetValue: number;
      difference: number;
      action: string;
      amount: number;
    }> = [];
    let totalValue = 0;

    // Calculate current values and required changes
    for (const [token, balance] of Object.entries(currentBalances)) {
      const currentValue = parseFloat(balance as string) * (token === 'hbar' ? 1 : 0.1); // Simplified pricing
      totalValue += currentValue;
      
      const targetValue = portfolioValue * (targetAllocation[token] || 0) / 100;
      const difference = targetValue - currentValue;
      
      if (Math.abs(difference) > 0.01) { // Minimum threshold
        rebalancingActions.push({
          token: token,
          currentValue: currentValue,
          targetValue: targetValue,
          difference: difference,
          action: difference > 0 ? 'buy' : 'sell',
          amount: Math.abs(difference)
        });
      }
    }

    return JSON.stringify({
      success: true,
      action: 'calculate_rebalancing',
      portfolioValue: portfolioValue,
      currentTotalValue: totalValue,
      rebalancingActions: rebalancingActions,
      summary: {
        totalActions: rebalancingActions.length,
        estimatedCost: rebalancingActions.reduce((sum, action) => sum + action.amount, 0)
      }
    });
  }

  private async executeRebalancing(input: any): Promise<string> {
    // This would execute the actual transfers based on calculated rebalancing
    // For now, return a simulation
    return JSON.stringify({
      success: true,
      action: 'execute_rebalancing',
      message: 'Rebalancing execution simulated - implement actual transfer logic here',
      note: 'This would execute the transfers calculated by calculate_rebalancing'
    });
  }

  private async getPortfolioStatus(input: any): Promise<string> {
    // This would get current portfolio status
    return JSON.stringify({
      success: true,
      action: 'get_portfolio_status',
      message: 'Portfolio status check simulated - implement actual balance checking here',
      note: 'This would check all token balances and calculate current allocation'
    });
  }
} 