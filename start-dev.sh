#!/bin/bash

# Development startup script
# 自动构建+启动服务+日志记录

set -e  # Exit on any error

# Signal handler for clean shutdown
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down server...${NC}"
    if [ ! -z "$SERVER_PID" ] && kill -0 $SERVER_PID 2>/dev/null; then
        kill $SERVER_PID
        wait $SERVER_PID 2>/dev/null || true
        echo -e "${GREEN}✅ Server stopped gracefully${NC}"
    fi
    if [ ! -z "$TAIL_PID" ] && kill -0 $TAIL_PID 2>/dev/null; then
        kill $TAIL_PID 2>/dev/null || true
    fi
    exit 0
}

# Trap signals for clean shutdown
trap cleanup SIGINT SIGTERM

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PORT=3456
DEBUG=false
LOG_FILE="/Users/fanzhang/.claude-code-router/logs/ccr-dev-$(date +%Y%m%d-%H%M%S).log"

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
    -l|--log)
      LOG_FILE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -p, --port PORT    Server port (default: 3456)"
      echo "  -d, --debug        Enable debug mode"
      echo "  -l, --log FILE     Log file path (default: ~/.claude-code-router/logs/ccr-dev-TIMESTAMP.log)"
      echo "  -h, --help         Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}🚀 Route Claude Code - Development Mode${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if port is in use and kill if necessary
if lsof -i :$PORT > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port $PORT is in use, killing existing process...${NC}"
    lsof -ti :$PORT | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Build the project
echo -e "${BLUE}🔨 Building project...${NC}"
npm run build

# Start the server
echo -e "${GREEN}🌟 Starting Route Claude Code on port $PORT${NC}"
echo -e "${GREEN}📋 Log file: $LOG_FILE${NC}"
echo ""
echo -e "${GREEN}🎯 Multi-Provider Routing Features:${NC}"
echo -e "${GREEN}   ✅ Primary/backup routing${NC}"
echo -e "${GREEN}   ✅ Multi-provider load balancing${NC}" 
echo -e "${GREEN}   ✅ Error priority fallback${NC}"
echo -e "${GREEN}   ✅ Provider health monitoring${NC}"
echo ""

# Prepare start command
START_CMD="node dist/cli.js start --port $PORT"
if [ "$DEBUG" = true ]; then
    START_CMD="$START_CMD --debug"
fi

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Start server with logging
if [ "$DEBUG" = true ]; then
    echo -e "${YELLOW}🔍 Debug mode enabled${NC}"
    $START_CMD 2>&1 | tee "$LOG_FILE"
else
    $START_CMD > "$LOG_FILE" 2>&1 &
    SERVER_PID=$!
    
    # Wait a moment to check if server started successfully
    sleep 3
    
    if kill -0 $SERVER_PID 2>/dev/null; then
        echo -e "${GREEN}✅ Server started successfully (PID: $SERVER_PID)${NC}"
        echo -e "${GREEN}🌐 Available at: http://127.0.0.1:$PORT${NC}"
        echo ""
        echo -e "${BLUE}📊 Monitoring logs (Ctrl+C to stop):${NC}"
        tail -f "$LOG_FILE" &
        TAIL_PID=$!
        
        # Wait for interrupt signal
        wait $TAIL_PID 2>/dev/null || true
    else
        echo -e "${RED}❌ Server failed to start${NC}"
        echo -e "${RED}📋 Check logs: $LOG_FILE${NC}"
        exit 1
    fi
fi