import { z } from 'zod';
import { Client, ContractExecuteTransaction, ContractId, TokenId, ContractFunctionParameters, Hbar } from '@hashgraph/sdk';
import { StructuredTool } from '@langchain/core/tools';

export class TokenWithdrawalTool extends StructuredTool {
  name = 'token_withdrawal';
  description = 'Withdraw tokens from the governance contract using the adminWithdrawToken function';
  schema = z.object({
    contractId: z.string().describe('The governance contract ID'),
    tokenId: z.string().describe('The token ID to withdraw'),
    amount: z.number().describe('The amount of tokens to withdraw (in raw units)'),
    reason: z.string().describe('Reason for withdrawal')
  });

  private client: Client;

  constructor(client: Client) {
    super();
    this.client = client;
  }

  async _call(input: any): Promise<string> {
    try {
      console.log(`🪙 Withdrawing ${input.amount} raw units of token ${input.tokenId} from contract ${input.contractId}...`);

      // Convert Hedera token ID to EVM address using SDK
      const tokenId = TokenId.fromString(input.tokenId);
      const tokenAddress = tokenId.toSolidityAddress();

      // Create contract execute transaction for adminWithdrawToken(address token, uint256 amount, string reason)
      const functionParameters = new ContractFunctionParameters()
        .addAddress(tokenAddress) // Token address in Ethereum format
        .addUint256(input.amount) // Amount in raw units
        .addString(input.reason || 'Treasury rebalancing'); // Reason for withdrawal

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(input.contractId))
        .setGas(300000) // Adjust gas as needed
        .setFunction('adminWithdrawToken', functionParameters)
        .setMaxTransactionFee(Hbar.fromTinybars(100000000)); // 1 HBAR max fee

      // Sign and execute the transaction
      const txResponse = await contractExecuteTx.execute(this.client);
      console.log(`⏳ Contract call submitted: ${txResponse.transactionId}`);

      // Get the receipt
      const receipt = await txResponse.getReceipt(this.client);
      console.log(`✅ Contract call completed with status: ${receipt.status}`);

      if (receipt.status.toString() === 'SUCCESS') {
        console.log(`✅ Token withdrawal successful: ${input.amount} raw units of ${input.tokenId}`);
        return JSON.stringify({
          success: true,
          transactionId: txResponse.transactionId.toString(),
          status: receipt.status.toString(),
          tokenId: input.tokenId,
          amount: input.amount,
          withdrawnAmount: `${input.amount} raw units of token ${input.tokenId}`
        }, null, 2);
      } else {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

    } catch (error) {
      console.error(`❌ Token withdrawal failed:`, error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        tokenId: input.tokenId,
        amount: input.amount,
        timestamp: new Date().toISOString()
      }, null, 2);
    }
  }
} 