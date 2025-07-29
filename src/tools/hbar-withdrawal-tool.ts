import { z } from 'zod';
import { Client, ContractExecuteTransaction, AccountId, Hbar, ContractId, ContractFunctionParameters } from '@hashgraph/sdk';
import { StructuredTool } from '@langchain/core/tools';

/**
 * Custom Tool for HBAR Withdrawal from Governance Contract
 */
class HbarWithdrawalTool extends StructuredTool {
  name = 'hbar_withdrawal';
  description = 'Withdraw HBAR from the governance contract using emergencyWithdrawHbar function';
  schema = z.object({
    contractId: z.string().describe('The governance contract ID (e.g., 0.0.1234567)'),
    amount: z.string().describe('Amount of HBAR to withdraw in tinybars (1 HBAR = 100,000,000 tinybars)')
  });

  constructor(private client: Client) {
    super();
  }

  async _call(input: any): Promise<string> {
    try {
      const { contractId, amount } = input;

      console.log(`💰 Withdrawing ${amount} tinybars HBAR from contract ${contractId}`);
      console.log(`💰 Converting: ${amount} tinybars = ${parseInt(amount) / 100000000} HBAR`);

      // Create the contract call transaction for emergencyWithdrawHbar(uint256 amount)
      const functionParameters = new ContractFunctionParameters()
        .addUint256(parseInt(amount)); // amount in tinybars as uint256

      const contractCallTx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(contractId))
        .setGas(100000) // Set gas limit
        .setFunction('emergencyWithdrawHbar', functionParameters)
        .setMaxTransactionFee(Hbar.fromTinybars(100000000)); // 1 HBAR max fee

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
        withdrawnAmount: `${parseInt(amount) / 100000000} HBAR (${amount} tinybars)`
      }, null, 2);

    } catch (error) {
      console.error('❌ HBAR withdrawal failed:', error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, null, 2);
    }
  }
}

export { HbarWithdrawalTool }; 