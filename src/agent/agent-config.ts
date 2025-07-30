export interface EnvironmentConfig {
  HEDERA_NETWORK?: string;
  HEDERA_ACCOUNT_ID?: string;
  HEDERA_PRIVATE_KEY?: string;
  BALANCER_AGENT_ACCOUNT_ID?: string;
  BALANCER_AGENT_PRIVATE_KEY?: string;
  BALANCER_INBOUND_TOPIC_ID?: string;
  BALANCER_OUTBOUND_TOPIC_ID?: string;
  BALANCER_PROFILE_TOPIC_ID?: string;
  BALANCER_ALERT_TOPIC_ID?: string;
  GOVERNANCE_AGENT_ACCOUNT_ID?: string;
  OPENAI_API_KEY?: string;
  AGENT_NAME?: string;
  AGENT_DESCRIPTION?: string;
  AGENT_CAPABILITIES?: string;
  AGENT_TAGS?: string;

  GOVERNANCE_CONTRACT_ID?: string;
  CONTRACT_SAUCE_TOKEN?: string;
  CONTRACT_LYNX_TOKEN?: string;
  CONTRACT_WBTC_TOKEN?: string;
  CONTRACT_USDC_TOKEN?: string;
  CONTRACT_JAM_TOKEN?: string;
  CONTRACT_HEADSTART_TOKEN?: string;
  TREASURY_ACCOUNT_ID?: string;
  SNAPSHOT_REGISTRY_TOPIC_ID?: string;
}

export interface GovernanceRatioUpdate {
  type: 'GOVERNANCE_RATIO_UPDATE';
  updatedRatios: Record<string, number>;
  previousRatios: Record<string, number>;
  changedParameter: string;
  changedValue: { old: number; new: number };
  effectiveTimestamp: string;
  transactionId: string;
  changeSummary: string;
  reason: string;
}

export interface RebalanceStatusMessage {
  type: 'REBALANCE_STATUS';
  version: '1.0';
  timestamp: number;
  originalRequestId: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed' | 'paused';
  payload: {
    completedSwaps: number;
    totalSwaps: number;
    progressPercentage: number;
    totalValueRebalanced: number;
    totalSlippageIncurred: number;
    totalFeesSpent: number;
    currentBalances?: Record<string, number>;
    error?: {
      code: string;
      message: string;
      failedSwap?: string;
      recoveryAction?: string;
    };
  };
} 