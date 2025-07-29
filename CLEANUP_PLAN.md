# Lynx Balancer Agent - Cleanup Plan

## Current State Analysis

### 🚨 **The Mess We Have:**

#### **Multiple Conflicting Agents:**
- `src/index.ts` - Basic demo agent (165 lines)
- `src/balancer-agent.ts` - Main balancer agent (628 lines) 
- `src/tool-calling-balance-check.ts` - Test agent (393 lines)
- `src/quick-balance-check.ts` - Another test agent (384 lines)
- `src/governance-balance-checker.ts` - Yet another test agent (332 lines)

#### **Scattered Tools:**
- `src/tools/contract-transfer-tool.ts` - Contract function calls
- `src/tools/treasury-transfer-tool.ts` - Treasury operations (294 lines)

#### **Test/Example Clutter:**
- `src/examples/` - 5 example files (1.2KB total)
- `src/demo-hcs10.ts` - Demo file (410 lines)
- `src/test-v3-setup.ts` - Test setup (154 lines)
- `src/quick-connection-test.ts` - Connection test (75 lines)
- `src/simple-connection-test.ts` - Another connection test (92 lines)

#### **Package.json Scripts Mess:**
- 15+ different npm scripts for various test agents
- No clear entry point
- Confusing naming conventions

---

## 🎯 **What We Actually Need:**

### **Single Cohesive Agent Architecture:**

```
src/
├── index.ts                    # Main entry point - starts the agent
├── agent/
│   ├── lynx-balancer-agent.ts  # Main agent class
│   ├── agent-config.ts         # Configuration and types
│   └── agent-messaging.ts      # HCS-10 messaging logic
├── tools/
│   ├── balance-tools.ts        # Balance checking tools
│   ├── transfer-tools.ts       # Token/HBAR transfer tools
│   └── contract-tools.ts       # Contract function call tools
├── utils/
│   ├── hedera-client.ts        # Hedera client setup
│   ├── suppress-warnings.ts    # Warning suppression
│   └── helpers.ts              # Utility functions
└── types/
    └── index.ts                # TypeScript type definitions
```

---

## 🧹 **Cleanup Strategy:**

### **Phase 1: Consolidate Core Agent**
1. **Keep:** `src/balancer-agent.ts` as the main agent (it has the most complete functionality)
2. **Merge:** All useful functionality from other agent files into `src/balancer-agent.ts`
3. **Delete:** All other agent files (`index.ts`, `tool-calling-balance-check.ts`, `quick-balance-check.ts`, `governance-balance-checker.ts`)

### **Phase 2: Organize Tools**
1. **Consolidate:** Merge `contract-transfer-tool.ts` and `treasury-transfer-tool.ts` into `src/tools/transfer-tools.ts`
2. **Create:** `src/tools/balance-tools.ts` for all balance checking functionality
3. **Create:** `src/tools/contract-tools.ts` for contract-specific operations

### **Phase 3: Clean Up Examples and Tests**
1. **Move:** `src/examples/` → `examples/` (outside src)
2. **Delete:** All test files (`demo-hcs10.ts`, `test-v3-setup.ts`, `quick-connection-test.ts`, `simple-connection-test.ts`)
3. **Keep:** Only essential utilities (`suppress-warnings.ts`)

### **Phase 4: Simplify Package.json**
1. **Keep:** `npm start` - starts the main agent
2. **Keep:** `npm run dev` - development mode
3. **Keep:** `npm run build` - build the project
4. **Delete:** All test-specific scripts

---

## 🏗️ **Proposed Final Structure:**

```
src/
├── index.ts                    # Entry point - starts LynxBalancerAgent
├── agent/
│   ├── lynx-balancer-agent.ts  # Main agent class (consolidated)
│   ├── agent-config.ts         # Environment config, types, interfaces
│   └── agent-messaging.ts      # HCS-10 message handling
├── tools/
│   ├── balance-tools.ts        # Account/token balance queries
│   ├── transfer-tools.ts       # HBAR/token transfers
│   └── contract-tools.ts       # Contract function calls
├── utils/
│   ├── hedera-client.ts        # Client initialization
│   └── suppress-warnings.ts    # Warning suppression
└── types/
    └── index.ts                # TypeScript definitions
```

---

## 🔧 **Key Consolidation Points:**

### **Agent Consolidation:**
- **Main Agent:** `LynxBalancerAgent` from `balancer-agent.ts`
- **Core Functionality:** 
  - HCS-10 message listening
  - Governance ratio update processing
  - Balance checking and transfers
  - Contract function calls
  - Status reporting

### **Tool Consolidation:**
- **Balance Tools:** Account queries, token balance checks
- **Transfer Tools:** HBAR transfers, token transfers, contract transfers
- **Contract Tools:** `emergencyWithdrawHbar`, `adminWithdrawToken`, etc.

### **Configuration Consolidation:**
- **Single Config:** All environment variables in one place
- **Type Safety:** Proper TypeScript interfaces
- **Validation:** Environment variable validation

---

## 📋 **Implementation Steps:**

1. **Create new directory structure**
2. **Move and consolidate `balancer-agent.ts` → `agent/lynx-balancer-agent.ts`**
3. **Extract tools into separate files**
4. **Create clean entry point (`index.ts`)**
5. **Update package.json scripts**
6. **Delete all test/example files**
7. **Update imports and references**
8. **Test the consolidated agent**

---

## 🎯 **End Goal:**

**One cohesive agent that:**
- Listens for governance messages
- Can check balances
- Can transfer tokens/HBAR to/from contracts
- Can call contract functions
- Reports status back to governance agent
- Has clean, maintainable code structure

**No more:**
- Multiple conflicting agents
- Scattered tools
- Test file clutter
- Confusing npm scripts
- Boilerplate garbage 