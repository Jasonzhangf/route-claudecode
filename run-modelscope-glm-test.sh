#!/bin/bash

# Configuration
PORT=5509
CONFIG_FILE="config-openai-modelscope-glm-5509.json"
TEST_SCRIPT="test/functional/test-modelscope-glm-rotation.js"
LOG_FILE="/tmp/modelscope-glm-test.log"

# Function to stop the server
stop_server() {
  if [ ! -z "$SERVER_PID" ]; then
    echo "🛑 Stopping ModelScope GLM server..."
    if kill $SERVER_PID > /dev/null 2>&1; then
        # Wait for process to terminate
        wait $SERVER_PID 2>/dev/null
        echo "✅ Server stopped."
    else
        echo "⚠️ Server process not found or already stopped."
    fi
  fi
}

# Trap EXIT signal to ensure server is stopped
trap stop_server EXIT

# Kill any existing process on the port
echo "🔄 Checking for existing process on port $PORT..."
lsof -ti tcp:$PORT | xargs -r kill -9
sleep 1

# Start the server in the background
echo "🚀 Starting ModelScope GLM server in background..."
echo "🔨 Building project before starting server..." > "$LOG_FILE"
npm run build >> "$LOG_FILE" 2>&1

node dist/cli.js start --port $PORT --config "$CONFIG_FILE" >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo "Server PID: $SERVER_PID. Waiting for server to initialize..."
sleep 5 # Wait for server to start

# Run the test script
echo "✅ Server started. Running the test script..."
node $TEST_SCRIPT

# Test finished, the EXIT trap will handle cleanup.
echo ""
echo "🔍 Server logs from the test run:"
echo "-------------------------------------"
cat "$LOG_FILE"
echo "-------------------------------------"
echo "✅ Test complete."
