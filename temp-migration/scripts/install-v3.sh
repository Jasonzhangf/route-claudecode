#!/bin/bash

# Claude Code Router v3.0 Installation Script
# Creates rcc3 command to coexist with v2.7.0 rcc command
#
# Author: Jason Zhang
# Version: 3.0.0

set -e

echo "🚀 Claude Code Router v3.0 Installation Script"
echo "================================================"
echo "📋 Installing as 'rcc3' command (coexists with v2.7.0 'rcc')"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root directory.${NC}"
    exit 1
fi

# Check if this is the v3.0 project
if ! grep -q "route-claudecode-v3" package.json; then
    echo -e "${RED}❌ Error: This doesn't appear to be the v3.0 project. Expected 'route-claudecode-v3' in package.json.${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Step 1: Checking existing installations${NC}"

# Check for existing v2.7.0 installation
if command -v rcc &> /dev/null; then
    echo -e "${GREEN}✅ Found existing rcc (v2.7.0) - will coexist peacefully${NC}"
    rcc version || echo -e "${YELLOW}⚠️ Could not get rcc version, but command exists${NC}"
else
    echo -e "${YELLOW}ℹ️ No existing rcc command found${NC}"
fi

# Check for existing v3.0 installation
if command -v rcc3 &> /dev/null; then
    echo -e "${YELLOW}⚠️ Found existing rcc3 command - will overwrite${NC}"
    rcc3 version || echo -e "${YELLOW}⚠️ Could not get rcc3 version, but command exists${NC}"
else
    echo -e "${GREEN}✅ No existing rcc3 command - clean installation${NC}"
fi

echo ""
echo -e "${BLUE}📋 Step 2: Building v3.0 project${NC}"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Ensure CLI wrapper is executable
if [ -f "bin/rcc3.js" ]; then
    chmod +x bin/rcc3.js
    echo -e "${GREEN}✅ CLI wrapper executable permissions set${NC}"
else
    echo -e "${RED}❌ bin/rcc3.js not found${NC}"
    exit 1
fi

# Optional: Try to build TypeScript (don't fail if it doesn't work)
echo "🔨 Attempting TypeScript build (optional)..."
if npm run build >/dev/null 2>&1; then
    echo -e "${GREEN}✅ TypeScript build completed successfully${NC}"
    if [ -f "dist/cli.js" ]; then
        chmod +x dist/cli.js
        echo -e "${GREEN}✅ Compiled CLI also available${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ TypeScript build failed, using JavaScript wrapper fallback${NC}"
    echo -e "${CYAN}ℹ️  This is normal for development installations${NC}"
fi

echo ""
echo -e "${BLUE}📋 Step 3: Installing rcc3 globally${NC}"

# Create npm package and install globally
echo "📦 Creating npm package..."
npm pack

# Find the created package
PACKAGE_FILE=$(ls route-claudecode-v3-*.tgz | head -n1)

if [ -z "$PACKAGE_FILE" ]; then
    echo -e "${RED}❌ Error: Could not find created package file${NC}"
    exit 1
fi

echo "📦 Installing package globally: $PACKAGE_FILE"
npm install -g "$PACKAGE_FILE"

# Clean up package file
rm "$PACKAGE_FILE"

echo ""
echo -e "${BLUE}📋 Step 4: Verifying installation${NC}"

# Verify rcc3 command
if command -v rcc3 &> /dev/null; then
    echo -e "${GREEN}✅ rcc3 command installed successfully${NC}"
    
    # Test the command
    echo "🧪 Testing rcc3 command..."
    if rcc3 version &> /dev/null; then
        echo -e "${GREEN}✅ rcc3 version command works${NC}"
    else
        echo -e "${YELLOW}⚠️ rcc3 command installed but version check failed${NC}"
    fi
    
    # Show help
    echo ""
    echo -e "${BLUE}📋 rcc3 help output:${NC}"
    rcc3 help
else
    echo -e "${RED}❌ Error: rcc3 command not found after installation${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Installation Complete!${NC}"
echo "================================================"
echo -e "${GREEN}✅ Claude Code Router v3.0 installed as 'rcc3'${NC}"
echo ""
echo -e "${BLUE}📋 Available commands:${NC}"
echo "  🔄 Version coexistence:"
if command -v rcc &> /dev/null; then
    echo -e "    • ${GREEN}rcc${NC}  - v2.7.0 four-layer architecture"
fi
echo -e "    • ${GREEN}rcc3${NC} - v3.0 six-layer architecture"
echo ""
echo -e "${BLUE}📋 Quick start with v3.0:${NC}"
echo "  1. List v3.0 configurations:"
echo -e "     ${YELLOW}rcc3 config list-v3${NC}"
echo ""
echo "  2. Start LM Studio v3.0 service:"
echo -e "     ${YELLOW}rcc3 start ~/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json --debug${NC}"
echo ""
echo "  3. Connect Claude Code client:"
echo -e "     ${YELLOW}rcc3 code --port 5506${NC}"
echo ""
echo "  4. Check SDK availability:"
echo -e "     ${YELLOW}rcc3 sdk detect${NC}"
echo ""
echo -e "${GREEN}🚀 Ready to use Claude Code Router v3.0!${NC}"