#!/bin/bash
# 完整测试套件运行脚本

set -e

echo "Running full test suite..."

echo "1. Running unit tests..."
npm run test:unit

echo "2. Running integration tests..."
npm run test:integration

echo "3. Running coverage check..."
npm run test:coverage

echo "Full test suite completed successfully!"