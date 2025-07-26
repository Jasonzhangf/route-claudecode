#!/bin/bash

# Complete development flow script
# 构建+启动+测试一体化

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PORT=3456
DEBUG=false
RUN_TESTS=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--port)
      PORT="$2"
      shift 2
      ;;
    -d|--debug)
      DEBUG=true
      shift
      ;;
    --no-tests)
      RUN_TESTS=false
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -p, --port PORT    Server port (default: 3456)"
      echo "  -d, --debug        Enable debug mode"
      echo "  --no-tests         Skip running tests"
      echo "  -h, --help         Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${CYAN}🎯 Claude Code Router - Complete Development Flow${NC}"
echo -e "${CYAN}=================================================${NC}"

# Step 1: Clean and prepare
echo -e "${BLUE}📋 Step 1: Cleanup and preparation${NC}"
rm -rf dist/ node_modules/.cache/ || true
echo -e "${GREEN}✅ Cleanup completed${NC}"

# Step 2: Install dependencies
echo -e "${BLUE}📦 Step 2: Installing dependencies${NC}"
npm ci
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 3: Build project
echo -e "${BLUE}🔨 Step 3: Building project${NC}"
npm run build
echo -e "${GREEN}✅ Build completed${NC}"

# Step 4: Run tests (if enabled)
if [ "$RUN_TESTS" = true ]; then
    echo -e "${BLUE}🧪 Step 4: Running tests${NC}"
    if npm test; then
        echo -e "${GREEN}✅ All tests passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Some tests failed, but continuing...${NC}"
    fi
else
    echo -e "${YELLOW}⏭️  Step 4: Skipping tests${NC}"
fi

# Step 5: Kill existing processes on port
echo -e "${BLUE}🔍 Step 5: Checking port availability${NC}"
if lsof -i :$PORT > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port $PORT is in use, killing existing process...${NC}"
    lsof -ti :$PORT | xargs kill -9 2>/dev/null || true
    sleep 2
    echo -e "${GREEN}✅ Port cleared${NC}"
else
    echo -e "${GREEN}✅ Port $PORT is available${NC}"
fi

# Step 6: Start server
echo -e "${BLUE}🚀 Step 6: Starting server${NC}"

# Prepare start command
START_CMD="node dist/cli.js start --port $PORT"
if [ "$DEBUG" = true ]; then
    START_CMD="$START_CMD --debug"
fi

# Start server in background
LOG_FILE="/tmp/ccr-dev-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG_FILE")"

if [ "$DEBUG" = true ]; then
    echo -e "${YELLOW}🔍 Debug mode enabled - server will run in foreground${NC}"
    echo -e "${CYAN}📋 Log file: $LOG_FILE${NC}"
    echo -e "${GREEN}🌐 Server starting at: http://127.0.0.1:$PORT${NC}"
    echo ""
    $START_CMD 2>&1 | tee "$LOG_FILE"
else
    $START_CMD > "$LOG_FILE" 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to start
    echo -e "${YELLOW}⏳ Waiting for server to start...${NC}"
    sleep 5
    
    # Check if server is running
    if kill -0 $SERVER_PID 2>/dev/null; then
        echo -e "${GREEN}✅ Server started successfully (PID: $SERVER_PID)${NC}"
        echo -e "${GREEN}🌐 Available at: http://127.0.0.1:$PORT${NC}"
        echo -e "${CYAN}📋 Log file: $LOG_FILE${NC}"
        
        # Step 7: Basic health check
        echo -e "${BLUE}🏥 Step 7: Health check${NC}"
        sleep 2
        
        if curl -s "http://127.0.0.1:$PORT/health" > /dev/null; then
            echo -e "${GREEN}✅ Health check passed${NC}"
        else
            echo -e "${YELLOW}⚠️  Health check failed, but server is running${NC}"
        fi
        
        # Step 8: Show status
        echo -e "${BLUE}📊 Step 8: Server status${NC}"
        if curl -s "http://127.0.0.1:$PORT/status" | jq . > /dev/null 2>&1; then
            curl -s "http://127.0.0.1:$PORT/status" | jq .
        else
            echo -e "${YELLOW}⚠️  Status endpoint not available or jq not installed${NC}"
        fi
        
        echo ""
        echo -e "${CYAN}🎉 Development environment ready!${NC}"
        echo -e "${CYAN}=================================${NC}"
        echo -e "${GREEN}🌐 Server: http://127.0.0.1:$PORT${NC}"
        echo -e "${GREEN}📋 Logs: $LOG_FILE${NC}"
        echo -e "${GREEN}🔧 Environment variables:${NC}"
        echo -e "${YELLOW}   export ANTHROPIC_BASE_URL=http://127.0.0.1:$PORT${NC}"
        echo -e "${YELLOW}   export ANTHROPIC_API_KEY=any-string-is-ok${NC}"
        echo ""
        echo -e "${BLUE}📊 Monitor logs with: tail -f $LOG_FILE${NC}"
        echo -e "${BLUE}🛑 Stop server with: kill $SERVER_PID${NC}"
        
    else
        echo -e "${RED}❌ Server failed to start${NC}"
        echo -e "${RED}📋 Check logs: $LOG_FILE${NC}"
        cat "$LOG_FILE"
        exit 1
    fi
fi