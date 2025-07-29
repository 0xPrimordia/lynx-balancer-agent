import { z } from 'zod';
import { Client, TransferTransaction, TokenId, AccountId, Hbar } from '@hashgraph/sdk';
import { StructuredTool } from '@langchain/core/tools';

/**
 * Custom Tool for Token Transfers
 */
class TokenTransferTool extends StructuredTool {
  name = 'token_transfer';
  description = 'Transfer fungible tokens from one account to another (including contracts)';
  schema = z.object({
    tokenId: z.string().describe('The token ID to transfer (e.g., 0.0.1234567)'),
    fromAccountId: z.string().describe('The source account ID'),
    toAccountId: z.string().describe('The destination account ID (can be contract)'),
    amount: z.string().describe('Amount to transfer in smallest units')
  });

  constructor(private client: Client) {
    super();
  }

  async _call(input: any): Promise<string> {
    try {
      const { tokenId, fromAccountId, toAccountId, amount } = input;

      console.log(`🪙 Transferring ${amount} units of token ${tokenId}`);
      console.log(`📤 From: ${fromAccountId}`);
      console.log(`📥 To: ${toAccountId}`);

      // Create the transfer transaction
      const transferTx = new TransferTransaction()
        .addTokenTransfer(
          TokenId.fromString(tokenId),
          AccountId.fromString(fromAccountId),
          -parseInt(amount)
        )
        .addTokenTransfer(
          TokenId.fromString(tokenId),
          AccountId.fromString(toAccountId),
          parseInt(amount)
        )
        .setMaxTransactionFee(Hbar.fromTinybars(100000000)); // 1 HBAR max fee

      // Execute the transaction
      const txResponse = await transferTx.execute(this.client);
      console.log(`⏳ Transaction submitted: ${txResponse.transactionId}`);

      // Get the receipt
      const receipt = await txResponse.getReceipt(this.client);
      console.log(`✅ Transaction completed with status: ${receipt.status}`);

      return JSON.stringify({
        success: true,
        transactionId: txResponse.transactionId.toString(),
        status: receipt.status.toString()
      }, null, 2);

    } catch (error) {
      console.error('❌ Token transfer failed:', error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, null, 2);
    }
  }
}

export { TokenTransferTool }; 