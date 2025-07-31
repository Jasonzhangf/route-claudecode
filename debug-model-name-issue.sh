#!/bin/bash

# Model Name Debug Issue Resolution Script
# Comprehensive debug infrastructure for tracing model name conversion issues
# in Claude Code Router pipeline

set -e

echo "🔍 Model Name Debug Issue Resolution"
echo "====================================="

# Configuration
SERVER_URL="http://127.0.0.1:3456"
DEBUG_DIR="$HOME/.route-claude-code/database"
LOG_FILE="/tmp/model-name-debug.log"

# Create debug directories
mkdir -p "$DEBUG_DIR"/{captures,reports,replay,test-sessions,problem-isolation}

echo "📁 Debug directories initialized:"
echo "   Data: $DEBUG_DIR"
echo "   Logs: $LOG_FILE"
echo ""

# Step 1: Check server status
echo "🔧 Step 1: Checking server status..."
if curl -s "$SERVER_URL/status" > /dev/null 2>&1; then
    echo "✅ Server is running at $SERVER_URL"
else
    echo "❌ Server is not running at $SERVER_URL"
    echo "   Please start the server with: ./rcc start"
    exit 1
fi
echo ""

# Step 2: Run comprehensive debug test
echo "🧪 Step 2: Running comprehensive model name debug test..."
echo "   This test covers all routing categories and pipeline stages"

if node /Users/fanzhang/Documents/github/claude-code-router/test/debug/test-model-name-pipeline-debug.js; then
    echo "✅ Debug test completed successfully"
    TEST_STATUS="PASSED"
else
    echo "⚠️  Debug test completed with issues"
    TEST_STATUS="FAILED"
fi
echo ""

# Step 3: Analyze results
echo "🔍 Step 3: Analyzing debug results..."
echo "   Debug data location: $DEBUG_DIR/test-sessions/"
echo "   Log file: $LOG_FILE"

LATEST_REPORT=$(find "$DEBUG_DIR/test-sessions" -name "model-name-debug-report-*.json" 2>/dev/null | sort | tail -1)

if [ -n "$LATEST_REPORT" ] && [ -f "$LATEST_REPORT" ]; then
    echo "📊 Latest debug report: $LATEST_REPORT"
    
    # Extract summary from report
    SUCCESS_RATE=$(jq -r '.summary.successRate' "$LATEST_REPORT" 2>/dev/null || echo "Unknown")
    FAILED_TESTS=$(jq -r '.summary.failedTests' "$LATEST_REPORT" 2>/dev/null || echo "Unknown")
    
    echo "   Success Rate: $SUCCESS_RATE"
    echo "   Failed Tests: $FAILED_TESTS"
    
    # Show model name mismatches if any
    MISMATCHES=$(jq -r '.issues.modelNameMismatches[] | "\(.testName): Expected \(.expectedModel), Got \(.actualModel)"' "$LATEST_REPORT" 2>/dev/null || echo "")
    
    if [ -n "$MISMATCHES" ]; then
        echo ""
        echo "❌ Model Name Conversion Issues Detected:"
        echo "$MISMATCHES" | while read -r line; do
            echo "   - $line"
        done
    fi
else
    echo "⚠️  No debug report found - test may not have completed successfully"
fi
echo ""

# Step 4: Provide next steps based on results
echo "🎯 Step 4: Next Steps and Recommendations"
echo "========================================"

if [ "$TEST_STATUS" = "PASSED" ]; then
    echo "✅ All tests passed - model name conversion is working correctly"
    echo ""
    echo "🔧 Debug Infrastructure Available:"
    echo "   - Model name tracer: Activated with --debug flag"
    echo "   - Data capture: $DEBUG_DIR/captures/"
    echo "   - Replay system: Available for problem reproduction"
    echo "   - Problem isolation: Automated issue identification"
    
else
    echo "❌ Issues detected - model name conversion requires attention"
    echo ""
    echo "🔧 Recommended Actions:"
    echo "   1. Review debug log: tail -f $LOG_FILE"
    echo "   2. Check captured data: ls -la $DEBUG_DIR/test-sessions/"
    echo "   3. Run problem isolation (if specific request ID available):"
    echo "      node -e \"require('./src/debug/problem-isolation.js').QuickIsolation.diagnoseModelNameIssue('REQUEST_ID', 'EXPECTED_MODEL')\""
    echo ""
    echo "🎾 Pipeline Replay Options:"
    echo "   - Replay specific request: pipelineReplay.replayCompletePipeline('REQUEST_ID')"
    echo "   - Create isolated test: problemIsolation.createFocusedNodeTest('REQUEST_ID', 'STAGE', 'OBJECTIVE')"
    echo "   - Generate validation script: Available in problem isolation results"
fi

echo ""
echo "📚 Additional Resources:"
echo "   - Debug infrastructure: /src/debug/"
echo "   - Test documentation: /test/debug/test-model-name-pipeline-debug.md"
echo "   - Pipeline hooks: Integrated in server.ts"
echo ""

echo "🔍 Debug Infrastructure Components:"
echo "   ✅ Universal Model Name Tracer (model-name-tracer.ts)"
echo "   ✅ Pipeline Debug Hooks (integrated in server.ts)"
echo "   ✅ Hierarchical Data Capture System"
echo "   ✅ Comprehensive Test Matrix"
echo "   ✅ Pipeline Replay Capabilities (pipeline-replay.ts)"
echo "   ✅ Problem Isolation Framework (problem-isolation.ts)"
echo ""

# Step 5: Show data paths for manual inspection
echo "📂 Debug Data Locations:"
echo "   Captures: $DEBUG_DIR/captures/YYYY-MM-DD/"
echo "   Reports:  $DEBUG_DIR/reports/"
echo "   Replay:   $DEBUG_DIR/replay/"
echo "   Tests:    $DEBUG_DIR/test-sessions/"
echo "   Issues:   $DEBUG_DIR/problem-isolation/"
echo ""

echo "🚀 To enable debug mode in production:"
echo "   1. Start server with --debug flag"
echo "   2. Debug tracer will automatically activate"
echo "   3. All pipeline data will be captured to $DEBUG_DIR"
echo ""

echo "✨ Model Name Debug Infrastructure Setup Complete!"
echo "   Ready to trace, analyze, and resolve model name conversion issues"
echo "   across the entire Claude Code Router pipeline."