#!/bin/bash

# This script starts the ModelScope server, runs the key rotation test, and then stops the server.

CONFIG_FILE="/Users/fanzhang/.route-claude-code/config/single-provider/config-openai-modelscope-5507.json"
LOG_FILE="/tmp/modelscope-test.log"

# Function to stop the server
stop_server() {
    echo "🛑 Stopping ModelScope server..."
    node dist/cli.js stop --port 5507 > /dev/null 2>&1
    echo "✅ Server stopped."
}

# Ensure the server is stopped before starting
trap stop_server EXIT

# Start the server in the background
echo "🚀 Starting ModelScope server in background..."
node dist/cli.js start -c "$CONFIG_FILE" > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo "Server PID: $SERVER_PID. Waiting for server to initialize..."
sleep 5

# Check if the server started successfully
if ! curl -s http://localhost:5507/health > /dev/null; then
    echo "❌ Server failed to start. Logs:"
    cat "$LOG_FILE"
    exit 1
fi

echo "✅ Server started. Running the test script..."

# Run the test
node test/functional/test-modelscope-key-rotation.js

echo "
🔍 Server logs from the test run:"

# Grep for the relevant logs showing key selection
grep "API key selected for use" "$LOG_FILE"

echo "
✅ Test complete."