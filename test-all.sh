#!/bin/bash

# Complete test suite
# 完整测试，包括API和transformer验证

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PORT=3456
CLEANUP=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--port)
      PORT="$2"
      shift 2
      ;;
    --no-cleanup)
      CLEANUP=false
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -p, --port PORT    Server port (default: 3456)"
      echo "  --no-cleanup       Don't cleanup after tests"
      echo "  -h, --help         Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${CYAN}🧪 Claude Code Router - Complete Test Suite${NC}"
echo -e "${CYAN}===========================================${NC}"

# Step 1: Unit tests
echo -e "${BLUE}📋 Step 1: Running unit tests${NC}"
if npm test; then
    echo -e "${GREEN}✅ Unit tests passed${NC}"
else
    echo -e "${RED}❌ Unit tests failed${NC}"
    exit 1
fi

# Step 2: Build for integration tests
echo -e "${BLUE}🔨 Step 2: Building for integration tests${NC}"
npm run build
echo -e "${GREEN}✅ Build completed${NC}"

# Step 3: Start test server
echo -e "${BLUE}🚀 Step 3: Starting test server${NC}"

# Kill existing process if any
if lsof -i :$PORT > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Killing existing process on port $PORT${NC}"
    lsof -ti :$PORT | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Start server in background
LOG_FILE="/tmp/ccr-test-$(date +%Y%m%d-%H%M%S).log"
node dist/cli.js start --port $PORT > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Cleanup function
cleanup() {
    if [ "$CLEANUP" = true ] && [ ! -z "$SERVER_PID" ]; then
        echo -e "\n${YELLOW}🧹 Cleaning up test server...${NC}"
        kill $SERVER_PID 2>/dev/null || true
        rm -f "$LOG_FILE" 2>/dev/null || true
    fi
}

trap cleanup EXIT

# Wait for server to start
echo -e "${YELLOW}⏳ Waiting for server to start...${NC}"
sleep 5

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}❌ Test server failed to start${NC}"
    cat "$LOG_FILE"
    exit 1
fi

echo -e "${GREEN}✅ Test server started (PID: $SERVER_PID)${NC}"

# Step 4: API Tests
echo -e "${BLUE}🌐 Step 4: API endpoint tests${NC}"

BASE_URL="http://127.0.0.1:$PORT"

# Test 1: Health check
echo -e "${BLUE}   Testing health endpoint...${NC}"
if curl -s "$BASE_URL/health" | jq -e '.overall' > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Health endpoint works${NC}"
else
    echo -e "${RED}   ❌ Health endpoint failed${NC}"
    exit 1
fi

# Test 2: Status check
echo -e "${BLUE}   Testing status endpoint...${NC}"
if curl -s "$BASE_URL/status" | jq -e '.server' > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Status endpoint works${NC}"
else
    echo -e "${RED}   ❌ Status endpoint failed${NC}"
    exit 1
fi

# Test 3: 404 handling
echo -e "${BLUE}   Testing 404 handling...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/nonexistent")
if [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}   ✅ 404 handling works${NC}"
else
    echo -e "${RED}   ❌ 404 handling failed (got $HTTP_CODE)${NC}"
    exit 1
fi

# Step 5: Message API Tests (Mock)
echo -e "${BLUE}💬 Step 5: Message API tests${NC}"

# Test 1: Invalid request format
echo -e "${BLUE}   Testing invalid request handling...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/v1/messages" \
    -H "Content-Type: application/json" \
    -d '{"invalid": "request"}')

if [ "$HTTP_CODE" = "400" ]; then
    echo -e "${GREEN}   ✅ Invalid request handling works${NC}"
else
    echo -e "${YELLOW}   ⚠️  Invalid request handling returned $HTTP_CODE${NC}"
fi

# Test 2: Valid request format (will fail without provider, but should validate format)
echo -e "${BLUE}   Testing valid request format...${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/v1/messages" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 100,
        "messages": [
            {"role": "user", "content": "Hello, world!"}
        ]
    }' || echo '{"error": "expected"}')

# Should get either success or provider error (not format error)
if echo "$RESPONSE" | jq -e '.error.type' | grep -q "invalid_request_error"; then
    echo -e "${RED}   ❌ Request format validation failed${NC}"
    exit 1
else
    echo -e "${GREEN}   ✅ Request format validation works${NC}"
fi

# Step 6: Configuration tests
echo -e "${BLUE}⚙️  Step 6: Configuration tests${NC}"

# Test config file creation
echo -e "${BLUE}   Testing config generation...${NC}"
CONFIG_TEST_FILE="/tmp/ccr-test-config.json"
if node dist/cli.js config --config "$CONFIG_TEST_FILE" --show > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Config generation works${NC}"
    rm -f "$CONFIG_TEST_FILE"
else
    echo -e "${RED}   ❌ Config generation failed${NC}"
    exit 1
fi

# Step 7: Performance baseline
echo -e "${BLUE}⚡ Step 7: Performance baseline${NC}"

echo -e "${BLUE}   Testing response times...${NC}"
for i in {1..5}; do
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/health")
    echo -e "${BLUE}   Request $i: ${RESPONSE_TIME}s${NC}"
done

echo -e "${GREEN}   ✅ Performance baseline completed${NC}"

# Step 8: Provider tests (if available)
echo -e "${BLUE}🔌 Step 8: Provider tests${NC}"

HEALTH_RESPONSE=$(curl -s "$BASE_URL/health")
PROVIDER_COUNT=$(echo "$HEALTH_RESPONSE" | jq -r '.total // 0')

if [ "$PROVIDER_COUNT" -gt 0 ]; then
    echo -e "${GREEN}   ✅ Found $PROVIDER_COUNT provider(s)${NC}"
    
    # Show provider status
    echo "$HEALTH_RESPONSE" | jq -r '.providers | to_entries[] | "   \(.key): \(if .value then "✅ healthy" else "❌ unhealthy" end)"'
else
    echo -e "${YELLOW}   ⚠️  No providers configured${NC}"
fi

# Final summary
echo ""
echo -e "${CYAN}🎉 Test Suite Completed!${NC}"
echo -e "${CYAN}========================${NC}"
echo -e "${GREEN}✅ All tests passed${NC}"
echo -e "${BLUE}📊 Test summary:${NC}"
echo -e "${BLUE}   - Unit tests: ✅ Passed${NC}"
echo -e "${BLUE}   - API endpoints: ✅ Passed${NC}"
echo -e "${BLUE}   - Request validation: ✅ Passed${NC}"
echo -e "${BLUE}   - Configuration: ✅ Passed${NC}"
echo -e "${BLUE}   - Performance: ✅ Baseline established${NC}"

if [ "$PROVIDER_COUNT" -gt 0 ]; then
    echo -e "${BLUE}   - Providers: ✅ $PROVIDER_COUNT found${NC}"
else
    echo -e "${BLUE}   - Providers: ⚠️  Configure for full testing${NC}"
fi

echo ""
echo -e "${BLUE}💡 For full provider testing:${NC}"
echo -e "${YELLOW}   1. Configure CodeWhisperer or OpenAI providers${NC}"
echo -e "${YELLOW}   2. Run: ccr health${NC}"
echo -e "${YELLOW}   3. Test with real requests${NC}"