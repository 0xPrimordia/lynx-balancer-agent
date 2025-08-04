import { z } from 'zod';
import { Client, TransferTransaction, TokenId, AccountId, Hbar, TokenInfoQuery } from '@hashgraph/sdk';
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
    amount: z.string().describe('Amount to transfer - accepts both decimal (e.g., "34.199932") and raw units (e.g., "34199932000000")'),
    isRawUnits: z.boolean().optional().default(false).describe('Whether amount is already in raw units (true) or decimal units (false, default)')
  });

  constructor(private client: Client) {
    super();
  }

  async _call(input: any): Promise<string> {
    try {
      const { tokenId, fromAccountId, toAccountId, amount, isRawUnits = false } = input;

      console.log(`🪙 Transferring ${amount} units of token ${tokenId}`);
      console.log(`📤 From: ${fromAccountId}`);
      console.log(`📥 To: ${toAccountId}`);

      // Handle HBAR vs Token transfers differently
      if (tokenId === 'HBAR') {
        console.log(`🔍 HBAR transfer - using native currency handling`);
        
        // Convert HBAR to tinybars
        const humanAmount = parseFloat(amount);
        const tinybars = isRawUnits ? Math.round(humanAmount) : Math.round(humanAmount * 100000000); // 1 HBAR = 100,000,000 tinybars
        
        if (isRawUnits) {
          console.log(`🔄 Using ${humanAmount} as raw tinybars`);
        } else {
          console.log(`🔄 Converting ${humanAmount} HBAR to ${tinybars} tinybars`);
        }

        // Create HBAR transfer transaction
        const transferTx = new TransferTransaction()
          .addHbarTransfer(AccountId.fromString(fromAccountId), Hbar.fromTinybars(-tinybars))
          .addHbarTransfer(AccountId.fromString(toAccountId), Hbar.fromTinybars(tinybars))
          .setMaxTransactionFee(Hbar.fromTinybars(100000000)); // 1 HBAR max fee

        // Execute the transaction
        const txResponse = await transferTx.execute(this.client);
        console.log(`⏳ Transaction submitted: ${txResponse.transactionId}`);

        // Get the receipt
        const receipt = await txResponse.getReceipt(this.client);
        console.log(`✅ Transaction completed with status: ${receipt.status}`);

        return `The transfer of ${humanAmount} HBAR from account ${fromAccountId} to contract ${toAccountId} was successful. The transaction ID is **${txResponse.transactionId}**.`;
      } else {
        // Handle token transfers
        console.log(`🔍 Token transfer for ${tokenId}`);
        
        // Get token info to determine decimals
        const tokenInfoQuery = new TokenInfoQuery()
          .setTokenId(TokenId.fromString(tokenId));
        
        const tokenInfo = await tokenInfoQuery.execute(this.client);
        const decimals = tokenInfo.decimals;
        
        console.log(`🔍 Token ${tokenId} has ${decimals} decimals`);

        // Convert to smallest units if needed
        const humanAmount = parseFloat(amount);
        const smallestUnits = isRawUnits ? Math.round(humanAmount) : Math.round(humanAmount * Math.pow(10, decimals));
        
        if (isRawUnits) {
          console.log(`🔄 Using ${humanAmount} as raw units`);
        } else {
          console.log(`🔄 Converting ${humanAmount} to ${smallestUnits} smallest units`);
        }

        // Create the transfer transaction
        const transferTx = new TransferTransaction()
          .addTokenTransfer(
            TokenId.fromString(tokenId),
            AccountId.fromString(fromAccountId),
            -smallestUnits
          )
          .addTokenTransfer(
            TokenId.fromString(tokenId),
            AccountId.fromString(toAccountId),
            smallestUnits
          )
          .setMaxTransactionFee(Hbar.fromTinybars(100000000)); // 1 HBAR max fee

        // Execute the transaction
        const txResponse = await transferTx.execute(this.client);
        console.log(`⏳ Transaction submitted: ${txResponse.transactionId}`);

        // Get the receipt
        const receipt = await txResponse.getReceipt(this.client);
        console.log(`✅ Transaction completed with status: ${receipt.status}`);

        return `The transfer of ${humanAmount} units of token ${tokenId} from account ${fromAccountId} to contract ${toAccountId} was successful.`;
      }



    } catch (error) {
      console.error('❌ Token transfer failed:', error);
      return `Token transfer failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

export { TokenTransferTool }; 