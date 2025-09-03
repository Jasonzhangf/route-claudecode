# CI/CD测试流程集成

## 概述

本文档描述了如何将RCC测试框架集成到CI/CD流程中，实现自动化测试、持续集成和持续部署。

## GitHub Actions工作流

### 主要工作流文件

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    - cron: '0 2 * * 1'  # 每周一凌晨2点执行

jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci

  unit-tests:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Run unit tests
        run: npm run test:unit
      - name: Upload coverage reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: unit-test-coverage
          path: coverage/

  integration-tests:
    needs: setup
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7
        ports:
          - 6379:6379
      mongodb:
        image: mongo:6
        ports:
          - 27017:27017
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Run integration tests
        run: npm run test:integration
        env:
          REDIS_URL: redis://localhost:6379
          MONGODB_URL: mongodb://localhost:27017/test
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: integration-test-results
          path: test-results/

  e2e-tests:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Start test services
        run: |
          npm run start:test &
          sleep 10
      - name: Run end-to-end tests
        run: npm run test:e2e
      - name: Stop test services
        if: always()
        run: pkill -f "npm run start:test" || true
      - name: Upload e2e test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: e2e-test-results
          path: test-results/

  performance-tests:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Run performance tests
        run: npm run test:performance
      - name: Upload performance results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: performance-test-results
          path: test-results/

  code-quality:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Run linting
        run: npm run lint
      - name: Run type checking
        run: npm run typecheck
      - name: Run security audit
        run: npm audit --audit-level high

  build-and-deploy:
    needs: [unit-tests, integration-tests, e2e-tests, code-quality]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Build application
        run: npm run build
      - name: Run comprehensive tests
        run: npm run test:all
      - name: Generate test reports
        run: npm run test:report
      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment"
          # 部署到预发布环境的命令
      - name: Run smoke tests
        run: npm run test:smoke
      - name: Deploy to production
        if: success()
        run: |
          echo "Deploying to production environment"
          # 部署到生产环境的命令

  notification:
    needs: [unit-tests, integration-tests, e2e-tests, code-quality, build-and-deploy]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Send notification
        uses: dawidd6/action-send-mail@v3
        if: failure()
        with:
          server_address: smtp.gmail.com
          server_port: 465
          username: ${{ secrets.EMAIL_USERNAME }}
          password: ${{ secrets.EMAIL_PASSWORD }}
          subject: CI/CD Pipeline Status - ${{ github.repository }}
          body: |
            Build status: ${{ job.status }}
            Repository: ${{ github.repository }}
            Commit: ${{ github.sha }}
            Branch: ${{ github.ref }}
          to: team@example.com
          from: ci@example.com
```

## 测试调度配置

### 定时测试配置

```json
{
  "schedules": [
    {
      "name": "daily-regression",
      "cron": "0 1 * * *",
      "tests": ["unit", "integration"],
      "environment": "staging",
      "notifications": ["email", "slack"]
    },
    {
      "name": "weekly-performance",
      "cron": "0 2 * * 1",
      "tests": ["performance", "e2e"],
      "environment": "performance",
      "notifications": ["email", "slack"]
    },
    {
      "name": "monthly-full-suite",
      "cron": "0 3 1 * *",
      "tests": ["unit", "integration", "e2e", "performance"],
      "environment": "staging",
      "notifications": ["email"]
    }
  ]
}
```

### 并行测试配置

```json
{
  "parallel": {
    "maxConcurrency": 10,
    "testGroups": [
      {
        "name": "client-module-tests",
        "modules": ["client"],
        "concurrency": 3
      },
      {
        "name": "router-module-tests",
        "modules": ["router"],
        "concurrency": 2
      },
      {
        "name": "pipeline-module-tests",
        "modules": ["pipeline"],
        "concurrency": 5
      }
    ]
  }
}
```

## 环境配置

### 开发环境

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  test-runner:
    build: .
    environment:
      - NODE_ENV=development
      - TEST_ENV=development
      - BASE_URL=http://localhost:5506
    volumes:
      - ./test-results:/app/test-results
      - ./coverage:/app/coverage
    depends_on:
      - redis
      - mongodb

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
```

### 测试环境

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  test-runner:
    build: .
    environment:
      - NODE_ENV=test
      - TEST_ENV=ci
      - BASE_URL=http://test-service:5506
    volumes:
      - ./test-results:/app/test-results
      - ./coverage:/app/coverage
    depends_on:
      - test-service
      - redis
      - mongodb

  test-service:
    build: .
    command: npm run start:test
    environment:
      - NODE_ENV=test
    ports:
      - "5506:5506"

  redis:
    image: redis:7

  mongodb:
    image: mongo:6
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
```

## 测试报告集成

### Slack通知模板

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "CI/CD Test Results"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Repository:*\n${{ github.repository }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Branch:*\n${{ github.ref }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Commit:*\n${{ github.sha }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Status:*\n${{ job.status }}"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Test Summary:*\n• Unit Tests: ${{ steps.unit-tests.outcome }}\n• Integration Tests: ${{ steps.integration-tests.outcome }}\n• E2E Tests: ${{ steps.e2e-tests.outcome }}\n• Code Quality: ${{ steps.code-quality.outcome }}"
      }
    }
  ]
}
```

### 邮件通知模板

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .card { background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 15px; text-align: center; }
        .card.passed { border-left: 4px solid #28a745; }
        .card.failed { border-left: 4px solid #dc3545; }
        .card.running { border-left: 4px solid #007bff; }
        .number { font-size: 1.5em; font-weight: bold; margin: 10px 0; }
        .label { color: #6c757d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CI/CD Pipeline Status</h1>
        <p>Repository: ${{ github.repository }}</p>
        <p>Branch: ${{ github.ref }}</p>
        <p>Commit: ${{ github.sha }}</p>
        <p>Status: ${{ job.status }}</p>
    </div>
    
    <div class="summary">
        <div class="card ${{ steps.unit-tests.outcome }}">
            <div class="number">${{ steps.unit-tests.result.total || 0 }}</div>
            <div class="label">Unit Tests</div>
            <div>${{ steps.unit-tests.outcome }}</div>
        </div>
        <div class="card ${{ steps.integration-tests.outcome }}">
            <div class="number">${{ steps.integration-tests.result.total || 0 }}</div>
            <div class="label">Integration Tests</div>
            <div>${{ steps.integration-tests.outcome }}</div>
        </div>
        <div class="card ${{ steps.e2e-tests.outcome }}">
            <div class="number">${{ steps.e2e-tests.result.total || 0 }}</div>
            <div class="label">E2E Tests</div>
            <div>${{ steps.e2e-tests.outcome }}</div>
        </div>
        <div class="card ${{ steps.code-quality.outcome }}">
            <div class="number">-</div>
            <div class="label">Code Quality</div>
            <div>${{ steps.code-quality.outcome }}</div>
        </div>
    </div>
    
    <div>
        <h2>Test Results</h2>
        <p><strong>Passed:</strong> ${{ steps.test-summary.outputs.passed || 0 }}</p>
        <p><strong>Failed:</strong> ${{ steps.test-summary.outputs.failed || 0 }}</p>
        <p><strong>Total:</strong> ${{ steps.test-summary.outputs.total || 0 }}</p>
        <p><strong>Pass Rate:</strong> ${{ steps.test-summary.outputs.passRate || 0 }}%</p>
    </div>
</body>
</html>
```

## 监控和告警

### Prometheus指标配置

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'rcc-tests'
    static_configs:
      - targets: ['test-runner:9090']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'rcc-performance'
    static_configs:
      - targets: ['performance-monitor:9090']
    metrics_path: '/metrics'
    scrape_interval: 60s
```

### Grafana仪表板配置

```json
{
  "dashboard": {
    "title": "RCC Test Metrics",
    "panels": [
      {
        "title": "Test Execution Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(test_executions_total[5m])",
            "legendFormat": "{{test_type}}"
          }
        ]
      },
      {
        "title": "Test Success Rate",
        "type": "gauge",
        "targets": [
          {
            "expr": "test_success_rate",
            "legendFormat": "Success Rate"
          }
        ]
      },
      {
        "title": "Average Test Duration",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(test_duration_seconds)",
            "legendFormat": "Average Duration"
          }
        ]
      }
    ]
  }
}
```

## 安全考虑

### 密钥管理

```yaml
# GitHub Secrets配置
secrets:
  - name: TEST_API_TOKEN
    description: "API token for test environment"
    required: true
  
  - name: SLACK_WEBHOOK_URL
    description: "Slack webhook URL for notifications"
    required: false
  
  - name: EMAIL_USERNAME
    description: "Email username for notifications"
    required: false
  
  - name: EMAIL_PASSWORD
    description: "Email password for notifications"
    required: false
```

### 环境隔离

```yaml
# 环境变量配置
environments:
  development:
    BASE_URL: "http://localhost:5506"
    TEST_TIMEOUT: 5000
    LOG_LEVEL: "debug"
  
  staging:
    BASE_URL: "https://staging.example.com"
    TEST_TIMEOUT: 10000
    LOG_LEVEL: "info"
  
  production:
    BASE_URL: "https://api.example.com"
    TEST_TIMEOUT: 30000
    LOG_LEVEL: "error"
```

这个CI/CD测试流程集成方案提供了完整的自动化测试解决方案，包括持续集成、定时测试、并行执行、报告生成和通知机制。