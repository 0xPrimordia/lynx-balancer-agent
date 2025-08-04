import { Client, ContractCallQuery, ContractId, TokenInfoQuery, TokenId, AccountInfoQuery, AccountId } from '@hashgraph/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Token configuration for mapping IDs to symbols and decimals
 */
const TOKEN_CONFIG = {
  HBAR: {
    tokenId: 'HBAR',
    decimals: 8,
    name: 'HBAR'
  },
  SAUCE: {
    tokenId: '0.0.1183558',
    decimals: 6,
    name: 'SAUCE'
  },
  WBTC: {
    tokenId: '0.0.6212930',
    decimals: 8,
    name: 'WBTC'
  },
  USDC: {
    tokenId: '0.0.6212931',
    decimals: 6,
    name: 'USDC'
  },
  JAM: {
    tokenId: '0.0.6212932',
    decimals: 8,
    name: 'JAM'
  },
  HEADSTART: {
    tokenId: '0.0.6212933',
    decimals: 8,
    name: 'HEADSTART'
  }
};

/**
 * Contract state data structure
 */
export interface ContractState {
  ratios: {
    HBAR: number;
    WBTC: number;
    SAUCE: number;
    USDC: number;
    JAM: number;
    HEADSTART: number;
  };
  lynxTotalSupply: number;
  contractBalance: {
    hbar: number;
    tokens: {
      SAUCE: number;
      WBTC: number;
      USDC: number;
      JAM: number;
      HEADSTART: number;
    };
  };
  lastUpdated: Date;
}

/**
 * Contract State Manager
 * Handles fetching and parsing all contract-related data
 */
export class ContractStateManager {
  private client: Client;
  private contractId: string;
  private lynxTokenId: string;

  constructor() {
    // Initialize Hedera client
    const network = process.env.HEDERA_NETWORK || 'testnet';
    this.client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
    
    // Set operator if credentials are available
    const accountId = process.env.HEDERA_ACCOUNT_ID;
    const privateKey = process.env.HEDERA_PRIVATE_KEY;
    if (accountId && privateKey) {
      this.client.setOperator(accountId, privateKey);
    }

    this.contractId = process.env.LYNX_CONTRACT_ID!;
    this.lynxTokenId = process.env.CONTRACT_LYNX_TOKEN!;

    if (!this.contractId || !this.lynxTokenId) {
      throw new Error('Missing required environment variables: LYNX_CONTRACT_ID, CONTRACT_LYNX_TOKEN');
    }
  }

  /**
   * Fetch current contract ratios from governance contract
   */
  async fetchContractRatios(): Promise<ContractState['ratios']> {
    console.log('🔍 Fetching contract ratios...');
    
    const contractCallQuery = new ContractCallQuery()
      .setContractId(ContractId.fromString(this.contractId))
      .setGas(100000)
      .setFunction('getCurrentRatios');

    const response = await contractCallQuery.execute(this.client);
    
    const ratios = {
      HBAR: parseInt(response.getUint256(0).toString()),
      WBTC: parseInt(response.getUint256(1).toString()),
      SAUCE: parseInt(response.getUint256(2).toString()),
      USDC: parseInt(response.getUint256(3).toString()),
      JAM: parseInt(response.getUint256(4).toString()),
      HEADSTART: parseInt(response.getUint256(5).toString())
    };

    console.log('✅ Contract ratios:', ratios);
    return ratios;
  }

  /**
   * Fetch LYNX token total supply
   */
  async fetchLynxTotalSupply(): Promise<number> {
    console.log('🔍 Fetching LYNX total supply...');
    
    const tokenInfoQuery = new TokenInfoQuery()
      .setTokenId(TokenId.fromString(this.lynxTokenId));

    const response = await tokenInfoQuery.execute(this.client);
    const totalSupply = Number(response.totalSupply);
    const decimals = response.decimals;
    
    // Convert to human readable
    const humanReadableSupply = totalSupply / Math.pow(10, decimals);
    
    console.log(`✅ LYNX total supply: ${humanReadableSupply} tokens`);
    return humanReadableSupply;
  }

  /**
   * Fetch contract HBAR balance
   */
  async fetchContractHbarBalance(): Promise<number> {
    console.log('🔍 Fetching contract HBAR balance...');
    
    const accountInfoQuery = new AccountInfoQuery()
      .setAccountId(AccountId.fromString(this.contractId));

    const response = await accountInfoQuery.execute(this.client);
    
    // Handle BigNumber properly
    const balanceInTinybars = response.balance;
    const hbarBalance = Number(balanceInTinybars.toString()) / 100000000; // Convert tinybars to HBAR
    
    console.log(`✅ Contract HBAR balance: ${hbarBalance} HBAR`);
    return hbarBalance;
  }

  /**
   * Fetch contract token balances
   */
  async fetchContractTokenBalances(): Promise<ContractState['contractBalance']['tokens']> {
    console.log('🔍 Fetching contract token balances...');
    
    const accountInfoQuery = new AccountInfoQuery()
      .setAccountId(AccountId.fromString(this.contractId));

    const response = await accountInfoQuery.execute(this.client);
    const tokenRelationships = response.tokenRelationships;
    
    const tokenBalances: ContractState['contractBalance']['tokens'] = {
      SAUCE: 0,
      WBTC: 0,
      USDC: 0,
      JAM: 0,
      HEADSTART: 0
    };

    // Map token IDs to symbols and convert raw balances
    const tokenIdToSymbol: Record<string, keyof typeof tokenBalances> = {
      '0.0.1183558': 'SAUCE',
      '0.0.6212930': 'WBTC',
      '0.0.6212931': 'USDC',
      '0.0.6212932': 'JAM',
      '0.0.6212933': 'HEADSTART'
    };

    for (const [tokenId, relationship] of tokenRelationships) {
      const tokenIdStr = tokenId.toString();
      const symbol = tokenIdToSymbol[tokenIdStr];
      
      if (symbol) {
        const rawBalance = Number(relationship.balance.toString());
        const config = TOKEN_CONFIG[symbol];
        const humanBalance = rawBalance / Math.pow(10, config.decimals);
        
        tokenBalances[symbol] = humanBalance;
        console.log(`   ${symbol}: ${humanBalance} tokens (${rawBalance} raw, ${config.decimals} decimals)`);
      }
    }

    console.log('✅ Contract token balances fetched');
    return tokenBalances;
  }

  /**
   * Fetch all contract state data
   */
  async fetchContractState(): Promise<ContractState> {
    console.log('🔄 Fetching complete contract state...');
    
    try {
      // Fetch all data in parallel for efficiency
      const [ratios, lynxTotalSupply, hbarBalance, tokenBalances] = await Promise.all([
        this.fetchContractRatios(),
        this.fetchLynxTotalSupply(),
        this.fetchContractHbarBalance(),
        this.fetchContractTokenBalances()
      ]);

      const contractState: ContractState = {
        ratios,
        lynxTotalSupply,
        contractBalance: {
          hbar: hbarBalance,
          tokens: tokenBalances
        },
        lastUpdated: new Date()
      };

      console.log('✅ Contract state fetched successfully');
      console.log('📊 State Summary:');
      console.log(`   Ratios: HBAR=${ratios.HBAR}, WBTC=${ratios.WBTC}, SAUCE=${ratios.SAUCE}, USDC=${ratios.USDC}, JAM=${ratios.JAM}, HEADSTART=${ratios.HEADSTART}`);
      console.log(`   LYNX Supply: ${lynxTotalSupply}`);
      console.log(`   HBAR Balance: ${hbarBalance}`);
      console.log(`   Token Balances: SAUCE=${tokenBalances.SAUCE}, WBTC=${tokenBalances.WBTC}, USDC=${tokenBalances.USDC}, JAM=${tokenBalances.JAM}, HEADSTART=${tokenBalances.HEADSTART}`);

      return contractState;
      
    } catch (error) {
      console.error('❌ Failed to fetch contract state:', error);
      throw error;
    }
  }

  /**
   * Close the Hedera client connection
   */
  close(): void {
    this.client.close();
  }
}