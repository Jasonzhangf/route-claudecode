#!/bin/bash

# LMStudio Complete Testing Suite
# Executes all LMStudio tests including preprocessing, E2E, and complete pipeline
# Author: Jason Zhang
# Version: v3.0

set -e  # Exit on any error

echo "🚀 Starting LMStudio Complete Testing Suite..."
echo "📅 Start time: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    local test_description="$3"
    
    echo -e "${BLUE}📋 Running: $test_name${NC}"
    echo "   Description: $test_description"
    echo "   Command: $test_command"
    echo ""
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command"; then
        echo -e "${GREEN}   ✅ $test_name PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}   ❌ $test_name FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
    echo "----------------------------------------"
    echo ""
}

# Pre-flight checks
echo "🔍 Pre-flight Checks..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed or not in PATH${NC}"
    exit 1
fi

echo "   ✅ Node.js version: $(node --version)"

# Check if npm packages are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️ Node modules not found, installing...${NC}"
    npm install
fi

# Check if LMStudio server is running
echo "   🔍 Checking LMStudio server availability..."
if curl -s -f http://localhost:1234/v1/models > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ LMStudio server is running on port 1234${NC}"
else
    echo -e "${YELLOW}   ⚠️ LMStudio server not detected on port 1234${NC}"
    echo "   Please ensure LMStudio is running before proceeding"
    echo "   Some tests may fail without LMStudio server"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting..."
        exit 1
    fi
fi

# Check if required test files exist
required_files=(
    "test/functional/test-lmstudio-enhanced-preprocessing.js"
    "test-lmstudio-e2e-file-redirection.js"
    "test-lmstudio-complete-pipeline.js"
    "src/v3/preprocessor/lmstudio-format-parser.ts"
)

echo "   🔍 Checking required test files..."
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "     ✅ $file"
    else
        echo -e "${RED}     ❌ $file (missing)${NC}"
        echo -e "${RED}❌ Required test files are missing. Please run the setup first.${NC}"
        exit 1
    fi
done

echo ""
echo "🎯 All pre-flight checks passed!"
echo ""
echo "=========================================="
echo ""

# Test 1: Enhanced Preprocessing Test
run_test \
    "Enhanced Preprocessing Test" \
    "node test/functional/test-lmstudio-enhanced-preprocessing.js" \
    "Tests automatic data packet capture and preprocessing issue resolution"

# Test 2: E2E File Redirection Test
run_test \
    "E2E File Redirection Test" \
    "node test-lmstudio-e2e-file-redirection.js" \
    "Tests complete end-to-end workflow with file output redirection"

# Test 3: Complete Pipeline Test
run_test \
    "Complete Pipeline Test" \
    "node test-lmstudio-complete-pipeline.js" \
    "Runs the complete testing pipeline with all stages"

# Test 4: Architecture Summary Generation Test
run_test \
    "Architecture Summary Generation" \
    "node generate-architecture-summary.js" \
    "Tests the architecture summary generation functionality"

# Test 5: Existing LMStudio Preprocessor Test (if available)
if [ -f "test-lmstudio-preprocessor.js" ]; then
    run_test \
        "Legacy Preprocessor Test" \
        "node test-lmstudio-preprocessor.js" \
        "Tests the legacy LMStudio preprocessor functionality"
fi

# Test 6: Tool Call Fix Replay Test (if available)
if [ -f "test-lmstudio-toolcall-fix-replay.js" ]; then
    run_test \
        "Tool Call Fix Replay Test" \
        "node test-lmstudio-toolcall-fix-replay.js" \
        "Tests the tool call fix replay functionality"
fi

# Test 7: Simple SDK Integration Test (if available)
if [ -f "test/functional/test-lmstudio-sdk-simple.js" ]; then
    run_test \
        "Simple SDK Integration Test" \
        "node test/functional/test-lmstudio-sdk-simple.js" \
        "Tests basic SDK integration functionality"
fi

# Generate final report
echo "=========================================="
echo ""
echo "🎯 LMStudio Testing Suite Results"
echo "📅 End time: $(date)"
echo ""
echo "📊 Test Summary:"
echo "   Total Tests: $TOTAL_TESTS"
echo -e "   Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "   Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests PASSED! LMStudio integration is working correctly.${NC}"
    echo ""
    echo "✅ Key Achievements:"
    echo "   - Automatic data packet capture working"
    echo "   - Preprocessing issue resolution functional"
    echo "   - End-to-end file redirection operational"
    echo "   - Complete pipeline validation successful"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Deploy LMStudio preprocessing parser to production"
    echo "   2. Enable LMStudio provider in production configuration"
    echo "   3. Set up monitoring for LMStudio integration"
    echo "   4. Document LMStudio-specific configuration requirements"
    
    exit 0
else
    echo ""
    echo -e "${RED}❌ $FAILED_TESTS test(s) FAILED. Please review the output above.${NC}"
    echo ""
    echo "🔧 Troubleshooting Steps:"
    echo "   1. Ensure LMStudio server is running on port 1234"
    echo "   2. Check that all required dependencies are installed"
    echo "   3. Verify that the project structure is correct"
    echo "   4. Review error messages in the test output"
    echo "   5. Check network connectivity to LMStudio server"
    echo ""
    echo "📚 For more help:"
    echo "   - Check the project documentation"
    echo "   - Review LMStudio server logs"
    echo "   - Verify configuration files"
    
    exit 1
fi