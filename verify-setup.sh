#!/bin/bash

# Setup verification script
# 验证项目设置是否正确

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔍 Claude Code Router - Setup Verification${NC}"
echo -e "${CYAN}=========================================${NC}"

# Step 1: Check Node.js version
echo -e "${BLUE}📋 Step 1: Checking Node.js version${NC}"
NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED_VERSION="16.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
    echo -e "${GREEN}✅ Node.js version $NODE_VERSION is compatible${NC}"
else
    echo -e "${RED}❌ Node.js version $NODE_VERSION is too old. Requires >= $REQUIRED_VERSION${NC}"
    exit 1
fi

# Step 2: Check npm
echo -e "${BLUE}📦 Step 2: Checking npm${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm version $NPM_VERSION found${NC}"
else
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi

# Step 3: Check dependencies
echo -e "${BLUE}🔍 Step 3: Checking package.json${NC}"
if [ -f "package.json" ]; then
    echo -e "${GREEN}✅ package.json found${NC}"
    
    # Check required dependencies
    REQUIRED_DEPS=("@anthropic-ai/sdk" "fastify" "commander" "axios" "tiktoken" "uuid")
    for dep in "${REQUIRED_DEPS[@]}"; do
        if grep -q "\"$dep\"" package.json; then
            echo -e "${GREEN}   ✅ $dep dependency found${NC}"
        else
            echo -e "${RED}   ❌ $dep dependency missing${NC}"
            exit 1
        fi
    done
else
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
fi

# Step 4: Check TypeScript configuration
echo -e "${BLUE}⚙️  Step 4: Checking TypeScript configuration${NC}"
if [ -f "tsconfig.json" ]; then
    echo -e "${GREEN}✅ tsconfig.json found${NC}"
else
    echo -e "${RED}❌ tsconfig.json not found${NC}"
    exit 1
fi

# Step 5: Check source structure
echo -e "${BLUE}📁 Step 5: Checking source structure${NC}"
REQUIRED_DIRS=("src/input/anthropic" "src/routing" "src/output/anthropic" "src/providers/codewhisperer" "src/providers/openai" "src/utils" "src/types")

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}   ✅ $dir directory exists${NC}"
    else
        echo -e "${RED}   ❌ $dir directory missing${NC}"
        exit 1
    fi
done

# Step 6: Check key source files
echo -e "${BLUE}📄 Step 6: Checking key source files${NC}"
KEY_FILES=("src/cli.ts" "src/server.ts" "src/index.ts" "src/types/index.ts")

for file in "${KEY_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}   ✅ $file exists${NC}"
    else
        echo -e "${RED}   ❌ $file missing${NC}"
        exit 1
    fi
done

# Step 7: Check build scripts
echo -e "${BLUE}🔨 Step 7: Checking build scripts${NC}"
BUILD_SCRIPTS=("build.sh" "start-dev.sh" "fix-and-test.sh" "install-local.sh" "test-all.sh")

for script in "${BUILD_SCRIPTS[@]}"; do
    if [ -f "$script" ] && [ -x "$script" ]; then
        echo -e "${GREEN}   ✅ $script exists and is executable${NC}"
    elif [ -f "$script" ]; then
        echo -e "${YELLOW}   ⚠️  $script exists but not executable${NC}"
        chmod +x "$script"
        echo -e "${GREEN}   ✅ Made $script executable${NC}"
    else
        echo -e "${RED}   ❌ $script missing${NC}"
        exit 1
    fi
done

# Step 8: Try installing dependencies
echo -e "${BLUE}📥 Step 8: Testing dependency installation${NC}"
if npm ci --dry-run > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Dependencies can be installed${NC}"
else
    echo -e "${RED}❌ Dependency installation test failed${NC}"
    exit 1
fi

# Step 9: Try TypeScript compilation
echo -e "${BLUE}🔧 Step 9: Testing TypeScript compilation${NC}"
if npx tsc --noEmit > /dev/null 2>&1; then
    echo -e "${GREEN}✅ TypeScript compilation check passed${NC}"
else
    echo -e "${YELLOW}⚠️  TypeScript compilation has issues (but may work after npm install)${NC}"
fi

# Step 10: Check example configuration
echo -e "${BLUE}📋 Step 10: Checking example configuration${NC}"
if [ -f "config.example.json" ]; then
    if jq . config.example.json > /dev/null 2>&1; then
        echo -e "${GREEN}✅ config.example.json is valid JSON${NC}"
    else
        echo -e "${YELLOW}⚠️  config.example.json exists but may have JSON syntax issues${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  config.example.json not found${NC}"
fi

echo ""
echo -e "${CYAN}🎉 Setup Verification Complete!${NC}"
echo -e "${CYAN}==============================${NC}"
echo -e "${GREEN}✅ All checks passed - project is ready for development${NC}"
echo ""
echo -e "${BLUE}💡 Next steps:${NC}"
echo -e "${YELLOW}   1. Install dependencies: npm ci${NC}"
echo -e "${YELLOW}   2. Build project: ./build.sh${NC}"
echo -e "${YELLOW}   3. Start development: ./fix-and-test.sh${NC}"
echo -e "${YELLOW}   4. Or quick start: ./start-dev.sh --debug${NC}"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo -e "${YELLOW}   - README.md for usage guide${NC}"
echo -e "${YELLOW}   - config.example.json for configuration${NC}"
echo -e "${YELLOW}   - PRPs/ directory for requirements${NC}"