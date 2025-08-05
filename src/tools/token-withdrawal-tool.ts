import { z } from 'zod';
import { Client, ContractExecuteTransaction, ContractId, ContractFunctionParameters, Hbar, TokenId } from '@hashgraph/sdk';
import { StructuredTool } from '@langchain/core/tools';

/**
 * Custom Tool for Token Withdrawal from Governance Contract
 */
class TokenWithdrawalTool extends StructuredTool {
  name = 'token_withdrawal';
  description = 'Withdraw tokens or HBAR from the governance contract using appropriate withdrawal functions';
  schema = z.object({
    contractId: z.string().describe('The governance contract ID (e.g., 0.0.1234567)'),
    tokenId: z.string().describe('The token ID to withdraw (e.g., 0.0.1234567) or "HBAR" for HBAR withdrawal'),
    amount: z.string().describe('Amount to withdraw in smallest units (e.g., "1000000" for 1 token with 6 decimals, or tinybars for HBAR)'),
    reason: z.string().optional().default('Rebalancing').describe('Reason for withdrawal (only used for tokens)')
  });

  constructor(private client: Client) {
    super();
  }

  async _call(input: any): Promise<string> {
    try {
      const { contractId, tokenId, amount, reason = 'Rebalancing' } = input;

      console.log(`🪙 Withdrawing ${amount} units of ${tokenId} from contract ${contractId}`);

      let contractCallTx: ContractExecuteTransaction;
      let functionName: string;

      if (tokenId === 'HBAR') {
        // Handle HBAR withdrawal using emergencyWithdrawHbar(uint256 amount)
        console.log(`💰 HBAR withdrawal - using emergencyWithdrawHbar function`);
        console.log(`📝 Amount: ${amount} tinybars = ${parseInt(amount) / 100000000} HBAR`);

        const functionParameters = new ContractFunctionParameters()
          .addUint256(parseInt(amount)); // amount in tinybars as uint256

        contractCallTx = new ContractExecuteTransaction()
          .setContractId(ContractId.fromString(contractId))
          .setGas(100000) // Set gas limit
          .setFunction('emergencyWithdrawHbar', functionParameters)
          .setMaxTransactionFee(Hbar.fromTinybars(100000000)); // 1 HBAR max fee

        functionName = 'emergencyWithdrawHbar';
      } else {
        // Handle token withdrawal using adminWithdrawToken(address token, uint256 amount, string reason)
        console.log(`🪙 Token withdrawal - using adminWithdrawToken function`);
        console.log(`📝 Reason: ${reason}`);

        // Convert Hedera token ID to Ethereum address for contract call
        const tokenIdObj = TokenId.fromString(tokenId);
        const tokenAddress = tokenIdObj.toSolidityAddress();
        console.log(`🔍 Converting token ID ${tokenId} to Ethereum address: ${tokenAddress}`);

        const functionParameters = new ContractFunctionParameters()
          .addAddress(tokenAddress) // token address as Ethereum address
          .addUint256(parseInt(amount)) // amount in smallest units as uint256
          .addString(reason); // reason for withdrawal

        contractCallTx = new ContractExecuteTransaction()
          .setContractId(ContractId.fromString(contractId))
          .setGas(100000) // Set gas limit
          .setFunction('adminWithdrawToken', functionParameters)
          .setMaxTransactionFee(Hbar.fromTinybars(100000000)); // 1 HBAR max fee

        functionName = 'adminWithdrawToken';
      }

      // Execute the transaction
      const txResponse = await contractCallTx.execute(this.client);
      console.log(`⏳ Contract call submitted: ${txResponse.transactionId}`);

      // Get the receipt
      const receipt = await txResponse.getReceipt(this.client);
      console.log(`✅ Contract call completed with status: ${receipt.status}`);

      return JSON.stringify({
        success: true,
        transactionId: txResponse.transactionId.toString(),
        status: receipt.status.toString(),
        functionName: functionName,
        withdrawnToken: tokenId,
        withdrawnAmount: amount
      }, null, 2);

    } catch (error) {
      console.error('❌ Token withdrawal failed:', error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, null, 2);
    }
  }
}

export { TokenWithdrawalTool }; 