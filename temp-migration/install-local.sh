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

echo -e "${CYAN}🚀 Claude Code Router v3.0 - Local Installation${NC}"
echo -e "${CYAN}===============================================${NC}"
echo -e "${BLUE}📋 Six-layer architecture with SDK integration${NC}"
echo -e "${BLUE}🔄 Installs as 'rcc3' command (coexists with v2.7.0)${NC}"
echo ""

# Step 1: Clean and build
echo -e "${BLUE}🧹 Step 1: Cleaning and building...${NC}"
./build.sh

# Step 2: Create package
echo -e "${BLUE}📦 Step 2: Creating package...${NC}"
PACKAGE_FILE=$(npm pack)
echo -e "${GREEN}✅ Package created: $PACKAGE_FILE${NC}"

# Step 3: Uninstall existing v3.0 version (keep v2.7.0 if exists)
echo -e "${BLUE}🗑️  Step 3: Removing existing v3.0 installation...${NC}"
npm uninstall -g route-claudecode-v3 2>/dev/null || true
echo -e "${GREEN}✅ Existing v3.0 installation removed${NC}"

# Check if v2.7.0 still exists
if command -v rcc &> /dev/null; then
    echo -e "${GREEN}ℹ️  v2.7.0 (rcc) remains installed - good for coexistence${NC}"
fi

# Step 4: Install globally from local package
echo -e "${BLUE}🌍 Step 4: Installing globally...${NC}"
npm install -g "$PACKAGE_FILE"
echo -e "${GREEN}✅ Global installation completed${NC}"

# Step 5: Verify installation
echo -e "${BLUE}🔍 Step 5: Verifying installation...${NC}"
if command -v rcc3 &> /dev/null; then
    echo -e "${GREEN}✅ rcc3 command is available${NC}"
    echo -e "${BLUE}📋 Version info:${NC}"
    rcc3 version || echo -e "${YELLOW}⚠️ Version command not fully implemented yet${NC}"
else
    echo -e "${RED}❌ rcc3 command not found${NC}"
    exit 1
fi

# Check version coexistence
echo -e "${BLUE}🔄 Checking version coexistence:${NC}"
if command -v rcc &> /dev/null; then
    echo -e "${GREEN}  ✅ rcc (v2.7.0) - available${NC}"
fi
if command -v rcc3 &> /dev/null; then
    echo -e "${GREEN}  ✅ rcc3 (v3.0) - available${NC}"
fi

# Step 6: Test basic functionality
echo -e "${BLUE}🧪 Step 6: Testing basic functionality...${NC}"
if rcc3 help > /dev/null 2>&1; then
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
echo -e "${CYAN}🎉 v3.0 Installation completed successfully!${NC}"
echo -e "${CYAN}=========================================${NC}"
echo -e "${GREEN}🚀 You can now use: rcc3 start${NC}"
echo -e "${GREEN}📋 For help: rcc3 help${NC}"
echo -e "${GREEN}🔧 Configuration: rcc3 config list-v3${NC}"
echo ""
echo -e "${BLUE}🔄 Version Coexistence:${NC}"
if command -v rcc &> /dev/null; then
    echo -e "${GREEN}  • rcc  - v2.7.0 four-layer architecture${NC}"
fi
echo -e "${GREEN}  • rcc3 - v3.0 six-layer architecture${NC}"
echo ""
echo -e "${BLUE}💡 Quick start with v3.0:${NC}"
echo -e "${YELLOW}   # List v3.0 configurations${NC}"
echo -e "${YELLOW}   rcc3 config list-v3${NC}"
echo ""
echo -e "${YELLOW}   # Start LM Studio v3.0 service${NC}"
echo -e "${YELLOW}   rcc3 start ~/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json --debug${NC}"
echo ""
echo -e "${YELLOW}   # Connect Claude Code client${NC}"
echo -e "${YELLOW}   rcc3 code --port 5506${NC}"
echo ""
echo -e "${YELLOW}   # Check SDK availability${NC}"
echo -e "${YELLOW}   rcc3 sdk detect${NC}"