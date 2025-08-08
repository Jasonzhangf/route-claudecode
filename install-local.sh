#!/bin/bash

# Local installation script
# 构建+打包+全局安装

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}📦 Route Claude Code - Local Installation${NC}"
echo -e "${CYAN}=======================================${NC}"

# Step 1: Clean and build
echo -e "${BLUE}🧹 Step 1: Cleaning and building...${NC}"
./build.sh

# Step 2: Create package
echo -e "${BLUE}📦 Step 2: Creating package...${NC}"
PACKAGE_FILE=$(npm pack)
echo -e "${GREEN}✅ Package created: $PACKAGE_FILE${NC}"

# Step 3: Check if already installed globally
echo -e "${BLUE}🔍 Step 3: Checking existing installation...${NC}"
if npm list -g route-claudecode &>/dev/null; then
    echo -e "${YELLOW}⚠️  route-claudecode already installed globally${NC}"
    echo -e "${BLUE}📦 Updating existing installation...${NC}"
else
    echo -e "${GREEN}✅ No existing installation found${NC}"
fi

# Step 4: Install globally from local package
echo -e "${BLUE}🌍 Step 4: Installing globally...${NC}"
npm install -g "$PACKAGE_FILE"
echo -e "${GREEN}✅ Global installation completed${NC}"

# Step 5: Verify installation
echo -e "${BLUE}🔍 Step 5: Verifying installation...${NC}"
if command -v rcc &> /dev/null; then
    echo -e "${GREEN}✅ rcc command is available${NC}"
    echo -e "${BLUE}📋 Version info:${NC}"
    rcc --version
else
    echo -e "${RED}❌ rcc command not found${NC}"
    exit 1
fi

# Step 6: Test basic functionality
echo -e "${BLUE}🧪 Step 6: Testing basic functionality...${NC}"
if rcc --help > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Help command works${NC}"
else
    echo -e "${RED}❌ Help command failed${NC}"
    exit 1
fi

# Step 7: Cleanup
echo -e "${BLUE}🧹 Step 7: Cleaning up...${NC}"
rm -f "$PACKAGE_FILE"
echo -e "${GREEN}✅ Cleanup completed${NC}"

echo ""
echo -e "${CYAN}🎉 Installation completed successfully!${NC}"
echo -e "${CYAN}====================================${NC}"
echo -e "${GREEN}🚀 You can now use: rcc start${NC}"
echo -e "${GREEN}📋 For help: rcc --help${NC}"
echo -e "${GREEN}🔧 Configuration: rcc config --show${NC}"
echo ""
echo -e "${BLUE}💡 Quick start:${NC}"
echo -e "${YELLOW}   rcc start --debug${NC}"
echo -e "${YELLOW}   export ANTHROPIC_BASE_URL=http://127.0.0.1:3456${NC}"
echo -e "${YELLOW}   export ANTHROPIC_API_KEY=any-string-is-ok${NC}"