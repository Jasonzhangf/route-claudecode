#!/bin/bash
# 集成测试运行脚本

set -e

echo "Running integration tests..."
npm run test:integration

echo "Integration tests completed successfully!"