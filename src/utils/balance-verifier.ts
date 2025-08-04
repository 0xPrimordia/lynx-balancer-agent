import { Client, ContractCallQuery, ContractId, TokenInfoQuery, TokenId, AccountInfoQuery, AccountId } from '@hashgraph/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface TokenInfo {
  tokenId: string;
  symbol: string;
  decimals: number;
  rawBalance: string;
  humanBalance: number;
}

interface RatioData {
  HBAR: number;
  WBTC: number;
  SAUCE: number;
  USDC: number;
  JAM: number;
  HEADSTART: number;
}

/**
 * Independent balance verification tool to check agent's calculations
 * Uses direct Hedera SDK calls to verify contract ratios vs actual balances
 */
export class BalanceVerifier {
  private client: Client;
  
  // Token mappings from env
  private tokenMappings = {
    SAUCE: process.env.CONTRACT_SAUCE_TOKEN!,
    LYNX: process.env.CONTRACT_LYNX_TOKEN!,
    WBTC: process.env.CONTRACT_WBTC_TOKEN!,
    USDC: process.env.CONTRACT_USDC_TOKEN!,
    JAM: process.env.CONTRACT_JAM_TOKEN!,
    HEADSTART: process.env.CONTRACT_HEADSTART_TOKEN!
  };

  constructor() {
    // Initialize client based on environment
    const network = process.env.HEDERA_NETWORK || 'testnet';
    
    if (network === 'mainnet') {
      this.client = Client.forMainnet();
    } else {
      this.client = Client.forTestnet();
    }

    // Set operator if credentials are available
    const accountId = process.env.HEDERA_ACCOUNT_ID;
    const privateKey = process.env.HEDERA_PRIVATE_KEY;
    
    if (accountId && privateKey) {
      this.client.setOperator(accountId, privateKey);
    }
  }

  /**
   * Main verification function
   */
  async verifyBalances(contractId: string): Promise<void> {
    try {
      console.log('🔍 Starting Independent Balance Verification');
      console.log('=============================================');
      console.log(`📋 Contract: ${contractId}`);
      console.log('');

      // Step 1: Get contract ratios
      console.log('📊 Step 1: Fetching contract ratios...');
      const ratios = await this.getContractRatios(contractId);
      console.log('✅ Ratios:', ratios);
      console.log('');

      // Step 2: Get LYNX total supply  
      console.log('🔢 Step 2: Fetching LYNX total supply...');
      const lynxSupply = await this.getTokenSupply(this.tokenMappings.LYNX);
      console.log(`✅ LYNX Supply: ${lynxSupply} tokens`);
      console.log('');

      // Step 3: Get contract HBAR balance
      console.log('💰 Step 3: Fetching contract HBAR balance...');
      const hbarBalance = await this.getHbarBalance(contractId);
      console.log(`✅ HBAR Balance: ${hbarBalance} HBAR`);
      console.log('');

      // Step 4: Get contract token balances
      console.log('🪙 Step 4: Fetching contract token balances...');
      const tokenBalances = await this.getTokenBalances(contractId);
      console.log('✅ Token Balances:');
      tokenBalances.forEach(token => {
        console.log(`   ${token.symbol}: ${token.humanBalance} (${token.rawBalance} raw, ${token.decimals} decimals)`);
      });
      console.log('');

      // Step 5: Calculate required balances
      console.log('🧮 Step 5: Calculating required vs actual balances...');
      await this.calculateAndCompareBalances(ratios, lynxSupply, hbarBalance, tokenBalances);

    } catch (error) {
      console.error('❌ Verification failed:', error);
    }
  }

  /**
   * Get current ratios from governance contract
   */
  private async getContractRatios(contractId: string): Promise<RatioData> {
    const contractCallQuery = new ContractCallQuery()
      .setContractId(ContractId.fromString(contractId))
      .setGas(100000)
      .setFunction('getCurrentRatios');

    const response = await contractCallQuery.execute(this.client);
    
    return {
      HBAR: parseInt(response.getUint256(0).toString()),
      WBTC: parseInt(response.getUint256(1).toString()),
      SAUCE: parseInt(response.getUint256(2).toString()),
      USDC: parseInt(response.getUint256(3).toString()),
      JAM: parseInt(response.getUint256(4).toString()),
      HEADSTART: parseInt(response.getUint256(5).toString())
    };
  }

  /**
   * Get token total supply
   */
  private async getTokenSupply(tokenId: string): Promise<number> {
    const tokenInfoQuery = new TokenInfoQuery()
      .setTokenId(TokenId.fromString(tokenId));

    const response = await tokenInfoQuery.execute(this.client);
    const totalSupply = Number(response.totalSupply);
    const decimals = response.decimals;
    
    // Convert to human readable
    return totalSupply / Math.pow(10, decimals);
  }

  /**
   * Get HBAR balance for account
   */
  private async getHbarBalance(accountId: string): Promise<number> {
    const accountInfoQuery = new AccountInfoQuery()
      .setAccountId(AccountId.fromString(accountId));

    const response = await accountInfoQuery.execute(this.client);
    // Convert from tinybars to HBAR
    const balanceInTinybars = response.balance.toString();
    return Number(balanceInTinybars) / 100000000;
  }

  /**
   * Get all token balances for an account
   */
  private async getTokenBalances(accountId: string): Promise<TokenInfo[]> {
    // Note: This is a simplified version. In a real implementation,
    // you might need to use the mirror node API to get all token balances
    // For now, we'll check the specific tokens we care about
    
    const accountInfoQuery = new AccountInfoQuery()
      .setAccountId(AccountId.fromString(accountId));

    const response = await accountInfoQuery.execute(this.client);
    const tokenBalances: TokenInfo[] = [];

    // Get token relationships (this gives us which tokens the account holds)
    const tokenRelationships = response.tokenRelationships;
    
    for (const [tokenId, relationship] of tokenRelationships) {
      // Get token info to get symbol and decimals
      const tokenInfoQuery = new TokenInfoQuery()
        .setTokenId(tokenId);
      
      const tokenInfo = await tokenInfoQuery.execute(this.client);
      const rawBalance = relationship.balance.toString();
      const decimals = tokenInfo.decimals;
      const humanBalance = Number(rawBalance) / Math.pow(10, decimals);
      
      tokenBalances.push({
        tokenId: tokenId.toString(),
        symbol: tokenInfo.symbol,
        decimals: decimals,
        rawBalance: rawBalance,
        humanBalance: humanBalance
      });
    }

    return tokenBalances;
  }

  /**
   * Calculate required balances and compare with actual
   */
  private async calculateAndCompareBalances(
    ratios: RatioData,
    lynxSupply: number,
    actualHbar: number,
    actualTokens: TokenInfo[]
  ): Promise<void> {
    console.log('📈 BALANCE ANALYSIS');
    console.log('===================');
    console.log(`Formula: Required = (LYNX Supply × Ratio) ÷ 10`);
    console.log(`LYNX Supply: ${lynxSupply}`);
    console.log('');

    const tolerance = 0.05; // 5% tolerance
    const outOfBalance: string[] = [];

    // Check HBAR
    const requiredHbar = (lynxSupply * ratios.HBAR) / 10;
    const hbarDiff = Math.abs(actualHbar - requiredHbar);
    const hbarDiffPercent = (hbarDiff / requiredHbar) * 100;
    
    console.log(`🔹 HBAR:`);
    console.log(`   Required: ${requiredHbar.toFixed(2)} HBAR`);
    console.log(`   Actual: ${actualHbar.toFixed(2)} HBAR`);
    console.log(`   Difference: ${hbarDiff.toFixed(2)} HBAR (${hbarDiffPercent.toFixed(2)}%)`);
    console.log(`   Status: ${hbarDiffPercent > tolerance * 100 ? '❌ OUT OF BALANCE' : '✅ BALANCED'}`);
    
    if (hbarDiffPercent > tolerance * 100) {
      outOfBalance.push('HBAR');
    }
    console.log('');

    // Check each token
    const tokenChecks = ['WBTC', 'SAUCE', 'USDC', 'JAM', 'HEADSTART'] as const;
    
    for (const tokenSymbol of tokenChecks) {
      const ratio = ratios[tokenSymbol];
      const requiredAmount = (lynxSupply * ratio) / 10;
      
      // Find actual balance for this token
      const actualToken = actualTokens.find(t => 
        t.tokenId === this.tokenMappings[tokenSymbol] || 
        t.symbol === tokenSymbol
      );
      
      const actualAmount = actualToken ? actualToken.humanBalance : 0;
      const diff = Math.abs(actualAmount - requiredAmount);
      const diffPercent = requiredAmount > 0 ? (diff / requiredAmount) * 100 : 0;
      
      console.log(`🔹 ${tokenSymbol}:`);
      console.log(`   Required: ${requiredAmount.toFixed(2)} tokens`);
      console.log(`   Actual: ${actualAmount.toFixed(2)} tokens`);
      console.log(`   Difference: ${diff.toFixed(2)} tokens (${diffPercent.toFixed(2)}%)`);
      console.log(`   Status: ${diffPercent > tolerance * 100 ? '❌ OUT OF BALANCE' : '✅ BALANCED'}`);
      
      if (diffPercent > tolerance * 100) {
        outOfBalance.push(tokenSymbol);
      }
      console.log('');
    }

    // Final summary
    console.log('📋 SUMMARY');
    console.log('==========');
    if (outOfBalance.length > 0) {
      console.log(`❌ REBALANCE NEEDED: ${outOfBalance.join(', ')}`);
      console.log(`   ${outOfBalance.length} token(s) are more than 5% out of balance`);
    } else {
      console.log('✅ ALL BALANCED - No rebalancing needed');
    }
  }
}

/**
 * CLI runner
 */
async function main() {
  const verifier = new BalanceVerifier();
  const contractId = process.env.LYNX_CONTRACT_ID;
  
  if (!contractId) {
    console.error('❌ LYNX_CONTRACT_ID not found in environment variables');
    process.exit(1);
  }

  await verifier.verifyBalances(contractId);
}

// Run if called directly (ES module version)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}