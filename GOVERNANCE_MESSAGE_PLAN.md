# Governance Message Processing Plan

## Current Message Structure Analysis

### **Observed Messages:**
From the logs, we're currently receiving:
- `"Agent action complete."` - Simple completion notifications
- `"GOVERNANCE_RATIO_UPDATE"` - Expected governance updates (not yet seen in logs)

### **Expected Governance Update Structure:**
Based on the `GovernanceRatioUpdate` interface in our code:

```typescript
interface GovernanceRatioUpdate {
  type: 'GOVERNANCE_RATIO_UPDATE';
  updatedRatios: Record<string, number>;  // e.g., { hbar: 30, wbtc: 15, sauce: 20 }
  previousRatios: Record<string, number>; // e.g., { hbar: 25, wbtc: 15, sauce: 20 }
  changedParameter: string;               // e.g., 'hbar_ratio'
  changedValue: { old: number; new: number }; // e.g., { old: 25, new: 30 }
  effectiveTimestamp: string;             // ISO timestamp
  transactionId: string;                  // Hedera transaction ID
  changeSummary: string;                  // Human readable summary
  reason: string;                         // Reason for the change
}
```

## Tools We've Created

### **1. BalanceTools** (`src/tools/balance-tools.ts`)
- ✅ Check HBAR balances
- ✅ Check token balances  
- ✅ Get comprehensive account balances
- 🔄 TODO: Get all token balances for an account

### **2. ContractTools** (`src/tools/contract-tools.ts`)
- ✅ `emergencyWithdrawHbar()` - Withdraw HBAR from contract
- ✅ `adminWithdrawToken()` - Withdraw tokens from contract
- ✅ Generic contract function caller
- ✅ Error handling and transaction status

### **3. TransferTools** (`src/tools/transfer-tools.ts`)
- ✅ Transfer HBAR between accounts
- ✅ Transfer tokens between accounts
- ✅ Transfer HBAR to contract
- ✅ Transfer tokens to contract

## Message Processing Plan

### **Phase 1: Message Parsing**
```typescript
// TODO: Implement in agent-messaging.ts
private async parseGovernanceUpdate(messageContent: string): Promise<GovernanceRatioUpdate | null> {
  // 1. Extract JSON from message content
  // 2. Validate against GovernanceRatioUpdate interface
  // 3. Return parsed object or null if invalid
}
```

### **Phase 2: Current State Analysis**
```typescript
// TODO: Implement rebalancing logic
private async analyzeCurrentState(governanceUpdate: GovernanceRatioUpdate): Promise<{
  currentBalances: Record<string, number>;
  targetBalances: Record<string, number>;
  requiredChanges: Record<string, number>;
}> {
  // 1. Get current balances using BalanceTools
  // 2. Calculate target balances based on new ratios
  // 3. Determine required changes (positive = add, negative = remove)
}
```

### **Phase 3: Rebalancing Execution**
```typescript
// TODO: Implement rebalancing execution
private async executeRebalancing(requiredChanges: Record<string, number>): Promise<{
  success: boolean;
  transactions: Array<{ type: string; transactionId: string; status: string }>;
  errors: string[];
}> {
  // 1. For each token that needs adjustment:
  //    - If positive: Transfer tokens to contract using TransferTools
  //    - If negative: Withdraw tokens from contract using ContractTools
  // 2. For HBAR adjustments:
  //    - If positive: Transfer HBAR to contract using TransferTools
  //    - If negative: Withdraw HBAR from contract using ContractTools
  // 3. Track all transactions and status
}
```

### **Phase 4: Status Reporting**
```typescript
// TODO: Implement status reporting back to governance agent
private async sendStatusUpdate(status: RebalanceStatusMessage): Promise<void> {
  // 1. Create status message with current progress
  // 2. Send via StandardsKit to governance agent
  // 3. Include transaction IDs, balances, errors, etc.
}
```

## Implementation Steps

### **Step 1: Integrate Tools into Agent**
- [ ] Add BalanceTools, ContractTools, TransferTools to LynxBalancerAgent
- [ ] Initialize tools in agent constructor
- [ ] Test tool integration

### **Step 2: Implement Message Parsing**
- [ ] Create `parseGovernanceUpdate()` method
- [ ] Add JSON extraction and validation
- [ ] Test with sample governance update messages

### **Step 3: Implement State Analysis**
- [ ] Create `analyzeCurrentState()` method
- [ ] Integrate with BalanceTools for current balances
- [ ] Calculate required changes based on target ratios

### **Step 4: Implement Rebalancing Logic**
- [ ] Create `executeRebalancing()` method
- [ ] Integrate with TransferTools and ContractTools
- [ ] Add transaction tracking and error handling

### **Step 5: Implement Status Reporting**
- [ ] Create `sendStatusUpdate()` method
- [ ] Integrate with StandardsKit for messaging
- [ ] Add progress tracking and completion notifications

## Testing Strategy

### **Unit Tests:**
- [ ] Test message parsing with various formats
- [ ] Test balance calculations
- [ ] Test rebalancing logic with mock data

### **Integration Tests:**
- [ ] Test full rebalancing workflow
- [ ] Test error handling and recovery
- [ ] Test status reporting

### **End-to-End Tests:**
- [ ] Test with real governance agent messages
- [ ] Test with real blockchain transactions
- [ ] Test complete rebalancing cycle

## Next Actions

1. **Integrate tools into the main agent**
2. **Implement message parsing logic**
3. **Test with governance agent messages**
4. **Implement rebalancing execution**
5. **Add status reporting back to governance agent**

## Questions to Resolve

1. **Message Format:** What is the exact JSON structure of governance updates?
2. **Token Mapping:** How do we map token symbols (e.g., 'sauce') to token IDs?
3. **Error Handling:** What should we do if a rebalancing transaction fails?
4. **Status Updates:** How frequently should we send status updates?
5. **Recovery:** How do we handle partial rebalancing failures? 