# 🖥️ VM & Codespace Deployment Guide

This guide covers deploying and running the Lynx Balancer Agent on virtual machines, including GitHub Codespaces, due to ISP websocket restrictions or other network limitations.

## 🚀 Quick VM Setup

### **1. GitHub Codespaces (Recommended)**
```bash
# Create a new codespace from your repository
# Navigate to your repo on GitHub.com
# Click "Code" > "Codespaces" > "Create codespace on main"

# Once in the codespace:
npm install
npm run build
```

### **2. Other Cloud VMs** (AWS, GCP, Azure, DigitalOcean)
```bash
git clone https://github.com/YOUR_USERNAME/lynx-balancer-agent.git
cd lynx-balancer-agent
npm install
npm run build
```

## 🔧 Environment Setup for VMs

### **1. Create Environment File**
```bash
cp env.example .env
nano .env  # or use your preferred editor
```

### **2. Configure .env for VM Use**
```env
# Hedera Network Configuration
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID
# ED25519 DER-encoded private key (recommended for Hedera)
HEDERA_PRIVATE_KEY=302a300506032b657004YOUR_ED25519_KEY_HERE

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional: OpenAI Model Configuration
OPENAI_MODEL_NAME=gpt-4o
```

## 🌐 Network & Websocket Considerations

### **Common ISP Websocket Issues**
Some ISPs block or throttle websocket connections, which can affect:
- Hedera network connectivity
- Real-time consensus service operations
- Agent networking communications

### **VM Benefits**
- ✅ **Clean network environment** - No ISP restrictions
- ✅ **Stable websocket connections** - Datacenter-grade networking
- ✅ **24/7 uptime** - Keep agents running continuously
- ✅ **Better performance** - Dedicated resources for agent operations

## 🤖 Running Agent Registration on VM

### **1. Test Basic Connectivity**
```bash
npm run dev
```
This should show the foundation demo without errors.

### **2. Register Your Agent**
```bash
npm run register-agent
```

**Expected Output:**
```
🦌⚡ Setting up Lynx Balancer Agent...
🔑 Using ED25519 account with DER-encoded private key
📡 Initializing StandardsKit with ED25519 account...
✅ StandardsKit initialized with ED25519 account
🤖 Registering NEW Lynx Balancer Agent with ED25519 account...
```

### **3. Test Hybrid Capabilities**
```bash
npm run hybrid:agent
```

## 🔍 Troubleshooting VM Issues

### **❌ npm install fails**
```bash
# Update npm first
npm install -g npm@latest

# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### **❌ TypeScript build errors**
```bash
# Check Node.js version (should be 20+)
node --version

# Clean and rebuild
npm run clean
npm run build
```

### **❌ Network connectivity issues**
```bash
# Test basic Hedera connectivity
curl -X POST https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.2

# Check if websockets work
npm run dev
```

### **❌ OpenAI API issues**
```bash
# Test API key
curl -H "Authorization: Bearer sk-your-key" https://api.openai.com/v1/models
```

## 🔐 Security Considerations for VMs

### **Environment Variables**
```bash
# Never commit your .env file
echo ".env" >> .gitignore

# Use proper file permissions
chmod 600 .env
```

### **Key Management**
```bash
# Store keys securely
export HEDERA_PRIVATE_KEY="your-key-here"
export OPENAI_API_KEY="your-api-key-here"

# Use the agent without persisting to disk
npm run register-agent
```

### **Firewall Configuration**
```bash
# Allow outbound HTTPS (443)
# Allow outbound Hedera consensus nodes (50211)
# Block unnecessary inbound traffic
```

## ⚡ Performance Optimization for VMs

### **Resource Requirements**
- **CPU**: 1-2 vCPUs minimum
- **RAM**: 2-4 GB minimum  
- **Storage**: 10 GB minimum
- **Network**: Stable internet with websocket support

### **Recommended VM Specs**
```yaml
GitHub Codespaces:
  - Machine: 2-core, 4GB RAM
  - Perfect for development and testing

AWS EC2:
  - Instance: t3.small or larger
  - OS: Ubuntu 22.04 LTS
  
Google Cloud:
  - Instance: e2-small or larger
  - OS: Ubuntu 22.04 LTS

DigitalOcean:
  - Droplet: Basic, 2GB RAM
  - OS: Ubuntu 22.04 LTS
```

### **Keep Agent Running 24/7**
```bash
# Using PM2 (recommended)
npm install -g pm2
pm2 start npm --name "lynx-agent" -- run hybrid:agent
pm2 startup
pm2 save

# Using screen
screen -S lynx-agent
npm run hybrid:agent
# Ctrl+A, D to detach

# Using nohup
nohup npm run hybrid:agent > agent.log 2>&1 &
```

## 📊 Monitoring & Logs

### **Check Agent Status**
```bash
# PM2 monitoring
pm2 status
pm2 logs lynx-agent

# Manual log checking
tail -f agent.log
```

### **Health Checks**
```bash
# Test agent connectivity
npm run dev

# Verify registration
npm run register-agent --dry-run
```

## 🆘 VM-Specific Support

### **Common VM Platforms**

#### **GitHub Codespaces**
- ✅ Pre-configured Node.js environment
- ✅ Built-in VS Code editor
- ✅ Easy GitHub integration
- ✅ Automatic port forwarding

#### **AWS EC2**
```bash
# Ubuntu setup
sudo apt update
sudo apt install nodejs npm git
npm install -g npm@latest
```

#### **Google Cloud Platform**
```bash
# Enable required APIs
gcloud services enable compute.googleapis.com
# SSH into instance and install Node.js
```

#### **DigitalOcean Droplet**
```bash
# Use the Node.js droplet image
# Or manual setup on Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

🦌 **Your Lynx Balancer Agent runs perfectly on VMs with clean network environments!** ⚡

*Escape ISP restrictions and build the future of multi-agent systems in the cloud!* 🚀 