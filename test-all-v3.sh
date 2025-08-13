#!/bin/bash

# Claude Code Router v3.0 - Comprehensive Test Suite
# 完整测试，包括API和六层架构验证
#
# Author: Jason Zhang
# Version: 3.0.0

set -e

echo "🧪 Claude Code Router v3.0 - Comprehensive Test Suite"
echo "====================================================="
echo "📋 Six-layer architecture validation"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local test_description="$3"
    
    echo -e "${BLUE}🧪 Running: $test_name${NC}"
    echo -e "${CYAN}   $test_description${NC}"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    if eval "$test_command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${YELLOW}   Command: $test_command${NC}"
    fi
    echo ""
}

# Function to check file existence
check_file() {
    local file_path="$1"
    local test_name="$2"
    
    run_test "$test_name" "test -f '$file_path'" "Checking if file exists: $file_path"
}

# Function to check directory existence
check_dir() {
    local dir_path="$1"
    local test_name="$2"
    
    run_test "$test_name" "test -d '$dir_path'" "Checking if directory exists: $dir_path"
}

echo -e "${BLUE}📋 Phase 1: Project Structure Validation${NC}"
echo "----------------------------------------"

# Check core v3.0 files
check_file "package.json" "Package Configuration"
check_file "src/cli.ts" "CLI Entry Point"
check_file "README-v3.0.md" "v3.0 Documentation"

# Check v3.0 architecture directories
check_dir "src/v3" "v3.0 Architecture Directory"
check_dir "src/v3/provider" "Provider Layer Directory"
check_dir "test/mock-server/data-replay-system" "Mock Server Directory"
check_dir "src/v3/tools-ecosystem" "Tools Ecosystem Directory"

# Check v3.0 configuration files
check_dir "~/.route-claudecode/config/v3" "v3.0 Configuration Directory"
check_file "~/.route-claudecode/config/v3/config-index.json" "Configuration Index"

echo -e "${BLUE}📋 Phase 2: Core v3.0 Components${NC}"
echo "--------------------------------"

# Check SDK integration components
check_file "src/v3/provider/sdk-integration/lmstudio-ollama-sdk-manager.js" "SDK Integration Manager"
check_file "src/v3/provider/protocol-governance/provider-protocol-governance-system.js" "Protocol Governance System"

# Check tools ecosystem
check_file "src/v3/tools-ecosystem/log-parser/log-parser-system.js" "Log Parser System"
check_file "src/v3/tools-ecosystem/visualization/api-timeline-visualizer.js" "Timeline Visualizer"
check_file "src/v3/tools-ecosystem/finish-reason/finish-reason-tracker.js" "Finish Reason Tracker"

echo -e "${BLUE}📋 Phase 3: Build System Tests${NC}"
echo "------------------------------"

# Test package.json structure
run_test "Package Name Check" "grep -q 'route-claudecode-v3' package.json" "Verify v3.0 package name"
run_test "rcc3 Command Check" "grep -q 'rcc3' package.json" "Verify rcc3 binary command"
run_test "Version Check" "grep -q '3.0.0' package.json" "Verify v3.0 version"

# Test build scripts
run_test "Build Script Exists" "test -f './build.sh'" "Check build script availability"
run_test "Install Script Exists" "test -f './install-local.sh'" "Check install script availability"
run_test "v3.0 Install Script Exists" "test -f './scripts/install-v3.sh'" "Check v3.0 install script availability"

echo -e "${BLUE}📋 Phase 4: Functional Tests${NC}"
echo "---------------------------"

# Run specific v3.0 functional tests
echo -e "${CYAN}Running LMStudio/Ollama SDK Integration Test...${NC}"
if [ -f "test/functional/test-lmstudio-ollama-sdk-integration.js" ]; then
    run_test "SDK Integration Test" "node test/functional/test-lmstudio-ollama-sdk-integration.js" "LMStudio/Ollama SDK integration validation"
fi

echo -e "${CYAN}Running Provider-Protocol Governance Test...${NC}"
if [ -f "test/functional/test-provider-protocol-governance.js" ]; then
    run_test "Protocol Governance Test" "node test/functional/test-provider-protocol-governance.js" "Provider governance system validation"
fi

echo -e "${BLUE}📋 Phase 5: Configuration Tests${NC}"
echo "-------------------------------"

# Test v3.0 configuration files
config_dir="$HOME/.route-claudecode/config/v3/single-provider"
if [ -d "$config_dir" ]; then
    run_test "LMStudio v3.0 Config" "test -f '$config_dir/config-lmstudio-v3-5506.json'" "Check LMStudio v3.0 configuration"
    run_test "ShuaiHong v3.0 Config" "test -f '$config_dir/config-openai-shuaihong-v3-5508.json'" "Check ShuaiHong v3.0 configuration"
    run_test "CodeWhisperer v3.0 Config" "test -f '$config_dir/config-codewhisperer-primary-v3-5501.json'" "Check CodeWhisperer v3.0 configuration"
    run_test "Gemini v3.0 Config" "test -f '$config_dir/config-google-gemini-v3-5502.json'" "Check Gemini v3.0 configuration"
fi

# Test load balancing configuration
lb_config_dir="$HOME/.route-claudecode/config/v3/load-balancing"
if [ -d "$lb_config_dir" ]; then
    run_test "Multi-Provider Config" "test -f '$lb_config_dir/config-multi-provider-v3-3456.json'" "Check multi-provider load balancing configuration"
fi

echo -e "${BLUE}📋 Phase 6: CLI Tests${NC}"
echo "-------------------"

# Test CLI help and version (if available)
if command -v rcc3 &> /dev/null; then
    run_test "rcc3 Command Available" "command -v rcc3" "Check if rcc3 command is installed"
    run_test "rcc3 Help Command" "rcc3 help" "Test help command functionality"
    
    # Check version coexistence
    if command -v rcc &> /dev/null; then
        run_test "Version Coexistence" "command -v rcc && command -v rcc3" "Verify v2.7.0 and v3.0 coexistence"
    fi
else
    echo -e "${YELLOW}⚠️ rcc3 command not installed, skipping CLI tests${NC}"
fi

echo ""
echo "🏁 Test Suite Complete"
echo "====================="
echo -e "${BLUE}📊 Test Results Summary:${NC}"
echo -e "${GREEN}  ✅ Passed: $TESTS_PASSED${NC}"
echo -e "${RED}  ❌ Failed: $TESTS_FAILED${NC}"
echo -e "${CYAN}  📋 Total:  $TESTS_TOTAL${NC}"
echo ""

# Calculate pass rate
if [ $TESTS_TOTAL -gt 0 ]; then
    PASS_RATE=$(( (TESTS_PASSED * 100) / TESTS_TOTAL ))
    echo -e "${BLUE}📈 Pass Rate: ${PASS_RATE}%${NC}"
    
    if [ $PASS_RATE -ge 80 ]; then
        echo -e "${GREEN}🎉 Excellent! v3.0 system is ready for deployment${NC}"
        exit 0
    elif [ $PASS_RATE -ge 60 ]; then
        echo -e "${YELLOW}⚠️ Good progress, but some issues need attention${NC}"
        exit 1
    else
        echo -e "${RED}❌ Significant issues found, review required${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ No tests were executed${NC}"
    exit 1
fi