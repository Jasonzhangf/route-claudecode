# 测试系统启动脚本设计

## 1. 启动脚本功能需求

### 1.1 核心功能
1. 启动Claude Code Router和我们的实现
2. 执行预定义测试用例
3. 捕获两方的请求/响应数据
4. 运行对比分析
5. 生成详细报告
6. 支持自动修正功能

### 1.2 脚本参数
- `--test-cases`: 指定测试用例文件路径
- `--output-dir`: 指定输出目录
- `--auto-fix`: 启用自动修正功能
- `--verbose`: 启用详细日志输出
- `--port-claude`: Claude Code Router端口（默认3456）
- `--port-our`: 我们的实现端口（默认5511）
- `--config`: 配置文件路径

## 2. 启动脚本实现

### 2.1 主脚本 (test-runner.ts)

```typescript
#!/usr/bin/env node

// src/scripts/test-runner.ts
import { TestRunner } from '../services/test-runner';
import { TestConfiguration } from '../types/test-types';
import { parseArguments } from '../utils/argument-parser';
import { Logger } from '../utils/logger';

async function main() {
  try {
    // 解析命令行参数
    const args = parseArguments(process.argv.slice(2));
    
    // 初始化日志
    const logger = new Logger(args.verbose);
    
    // 加载配置
    const config: TestConfiguration = {
      claudeCodeRouter: {
        port: args.portClaude || 3456,
        host: 'localhost'
      },
      ourImplementation: {
        port: args.portOur || 5511,
        host: 'localhost'
      },
      testCasesFile: args.testCases || './test/test-cases.json',
      outputDir: args.outputDir || './test-results',
      autoFix: args.autoFix || false,
      verbose: args.verbose || false
    };
    
    logger.info('🚀 启动测试运行器');
    logger.info(`配置: ${JSON.stringify(config, null, 2)}`);
    
    // 创建测试运行器
    const testRunner = new TestRunner(config, logger);
    
    // 运行测试
    const results = await testRunner.runAllTests();
    
    // 输出结果
    logger.info(`✅ 测试完成: ${results.passed}/${results.total} 通过`);
    
    if (results.failed > 0) {
      logger.error(`❌ ${results.failed} 个测试失败`);
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('测试运行器执行失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
```

### 2.2 测试运行器服务

```typescript
// src/services/test-runner.ts
import { TestConfiguration } from '../types/test-types';
import { Logger } from '../utils/logger';
import { TestCase, TestResult } from '../types/test-types';
import { DataCaptureService } from '../services/data-capture-service';
import { TestComparisonService } from '../services/test-comparison-service';
import { ComparisonReport } from '../services/comparison-report-generator';
import { AutoFixService } from '../services/auto-fix-service';

export class TestRunner {
  private dataCaptureService: DataCaptureService;
  private comparisonService: TestComparisonService;
  private autoFixService: AutoFixService;
  
  constructor(
    private config: TestConfiguration,
    private logger: Logger
  ) {
    this.dataCaptureService = new DataCaptureService();
    this.comparisonService = new TestComparisonService();
    this.autoFixService = new AutoFixService();
  }
  
  async runAllTests(): Promise<{ passed: number; failed: number; total: number }> {
    // 1. 启动服务
    await this.startServices();
    
    // 2. 加载测试用例
    const testCases = await this.loadTestCases();
    
    // 3. 执行测试
    const results: TestResult[] = [];
    for (const testCase of testCases) {
      const result = await this.runSingleTest(testCase);
      results.push(result);
    }
    
    // 4. 生成汇总报告
    const summary = this.generateSummary(results);
    
    // 5. 停止服务
    await this.stopServices();
    
    return summary;
  }
  
  private async startServices(): Promise<void> {
    this.logger.info('🔧 启动Claude Code Router...');
    await this.startClaudeCodeRouter();
    
    this.logger.info('🔧 启动我们的实现...');
    await this.startOurImplementation();
    
    // 等待服务启动
    await this.waitForServices();
  }
  
  private async startClaudeCodeRouter(): Promise<void> {
    // 实现启动Claude Code Router的逻辑
    // 可能需要调用系统命令或API
    const { spawn } = require('child_process');
    
    const claudeProcess = spawn('ccr', ['start'], {
      env: {
        ...process.env,
        PORT: this.config.claudeCodeRouter.port.toString()
      }
    });
    
    claudeProcess.stdout.on('data', (data: any) => {
      this.logger.debug(`Claude Code Router stdout: ${data}`);
    });
    
    claudeProcess.stderr.on('data', (data: any) => {
      this.logger.error(`Claude Code Router stderr: ${data}`);
    });
    
    // 保存进程引用以便后续停止
    // this.claudeProcess = claudeProcess;
  }
  
  private async startOurImplementation(): Promise<void> {
    // 实现启动我们实现的逻辑
    const { spawn } = require('child_process');
    
    const ourProcess = spawn('npm', ['run', 'start'], {
      env: {
        ...process.env,
        PORT: this.config.ourImplementation.port.toString()
      }
    });
    
    ourProcess.stdout.on('data', (data: any) => {
      this.logger.debug(`Our Implementation stdout: ${data}`);
    });
    
    ourProcess.stderr.on('data', (data: any) => {
      this.logger.error(`Our Implementation stderr: ${data}`);
    });
    
    // 保存进程引用以便后续停止
    // this.ourProcess = ourProcess;
  }
  
  private async waitForServices(): Promise<void> {
    // 等待服务启动完成
    const maxRetries = 30;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const claudeReady = await this.isServiceReady(
          this.config.claudeCodeRouter.host,
          this.config.claudeCodeRouter.port
        );
        
        const ourReady = await this.isServiceReady(
          this.config.ourImplementation.host,
          this.config.ourImplementation.port
        );
        
        if (claudeReady && ourReady) {
          this.logger.info('✅ 所有服务已就绪');
          return;
        }
      } catch (error) {
        this.logger.warn(`服务检查失败: ${error.message}`);
      }
      
      retries++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('服务启动超时');
  }
  
  private async isServiceReady(host: string, port: number): Promise<boolean> {
    // 检查服务是否就绪
    try {
      const response = await fetch(`http://${host}:${port}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
  
  private async loadTestCases(): Promise<TestCase[]> {
    const fs = require('fs').promises;
    const testCasesContent = await fs.readFile(this.config.testCasesFile, 'utf-8');
    return JSON.parse(testCasesContent);
  }
  
  private async runSingleTest(testCase: TestCase): Promise<TestResult> {
    this.logger.info(`🧪 执行测试: ${testCase.name}`);
    
    try {
      // 1. 启用数据捕获
      await this.dataCaptureService.enableCapture();
      
      // 2. 向Claude Code Router发送请求
      const claudeResponse = await this.sendRequestToClaude(testCase);
      
      // 3. 向我们的实现发送请求
      const ourResponse = await this.sendRequestToOurImplementation(testCase);
      
      // 4. 禁用数据捕获
      await this.dataCaptureService.disableCapture();
      
      // 5. 获取捕获的数据
      const claudeData = await this.dataCaptureService.getCapturedData('claude-code-router');
      const ourData = await this.dataCaptureService.getCapturedData('our-implementation');
      
      // 6. 进行对比分析
      const comparisonResult = await this.comparisonService.compare(
        claudeData,
        ourData
      );
      
      // 7. 生成报告
      const report = await this.comparisonService.generateReport(comparisonResult);
      
      // 8. 保存报告
      await this.saveReport(testCase.name, report);
      
      // 9. 如果启用自动修正且存在差异，执行自动修正
      if (this.config.autoFix && !comparisonResult.isEqual) {
        await this.autoFixService.applyFixes(comparisonResult.differences);
      }
      
      const passed = comparisonResult.isEqual;
      this.logger.info(`✅ 测试 ${testCase.name} ${passed ? '通过' : '失败'}`);
      
      return {
        testCase: testCase.name,
        passed,
        differences: comparisonResult.differences.length,
        report
      };
    } catch (error) {
      this.logger.error(`❌ 测试 ${testCase.name} 执行失败: ${error.message}`);
      return {
        testCase: testCase.name,
        passed: false,
        differences: 0,
        error: error.message
      };
    }
  }
  
  private async sendRequestToClaude(testCase: TestCase): Promise<any> {
    const response = await fetch(
      `http://${this.config.claudeCodeRouter.host}:${this.config.claudeCodeRouter.port}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CLAUDE_API_KEY || 'test'}`
        },
        body: JSON.stringify(testCase.request)
      }
    );
    
    return await response.json();
  }
  
  private async sendRequestToOurImplementation(testCase: TestCase): Promise<any> {
    const response = await fetch(
      `http://${this.config.ourImplementation.host}:${this.config.ourImplementation.port}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OUR_API_KEY || 'test'}`
        },
        body: JSON.stringify(testCase.request)
      }
    );
    
    return await response.json();
  }
  
  private async saveReport(testName: string, report: ComparisonReport): Promise<void> {
    const fs = require('fs').promises;
    const filename = `${this.config.outputDir}/report-${testName}-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
  }
  
  private generateSummary(results: TestResult[]): { passed: number; failed: number; total: number } {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    
    return { passed, failed, total };
  }
  
  private async stopServices(): Promise<void> {
    this.logger.info('🛑 停止服务...');
    
    // 停止Claude Code Router
    // await this.stopClaudeCodeRouter();
    
    // 停止我们的实现
    // await this.stopOurImplementation();
  }
}
```

### 2.3 参数解析器

```typescript
// src/utils/argument-parser.ts
export interface CommandLineArguments {
  testCases?: string;
  outputDir?: string;
  autoFix?: boolean;
  verbose?: boolean;
  portClaude?: number;
  portOur?: number;
  config?: string;
}

export function parseArguments(args: string[]): CommandLineArguments {
  const result: CommandLineArguments = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--test-cases':
        result.testCases = args[++i];
        break;
      case '--output-dir':
        result.outputDir = args[++i];
        break;
      case '--auto-fix':
        result.autoFix = true;
        break;
      case '--verbose':
        result.verbose = true;
        break;
      case '--port-claude':
        result.portClaude = parseInt(args[++i]);
        break;
      case '--port-our':
        result.portOur = parseInt(args[++i]);
        break;
      case '--config':
        result.config = args[++i];
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`未知参数: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }
  
  return result;
}

function printHelp(): void {
  console.log(`
测试运行器使用说明:

选项:
  --test-cases <file>     测试用例文件路径 (默认: ./test/test-cases.json)
  --output-dir <dir>      输出目录 (默认: ./test-results)
  --auto-fix              启用自动修正功能
  --verbose               启用详细日志输出
  --port-claude <port>    Claude Code Router端口 (默认: 3456)
  --port-our <port>       我们的实现端口 (默认: 5511)
  --config <file>         配置文件路径
  -h, --help              显示帮助信息

示例:
  npm run test -- --test-cases ./my-test-cases.json --verbose
  npm run test -- --auto-fix --output-dir ./reports
  `);
}
```

### 2.4 日志工具

```typescript
// src/utils/logger.ts
export class Logger {
  constructor(private verbose: boolean = false) {}
  
  info(message: string): void {
    console.log(`[INFO] ${message}`);
  }
  
  warn(message: string): void {
    console.log(`[WARN] ${message}`);
  }
  
  error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }
  
  debug(message: string): void {
    if (this.verbose) {
      console.log(`[DEBUG] ${message}`);
    }
  }
}
```

## 3. 测试用例格式

### 3.1 测试用例定义

```json
// test/test-cases.json
{
  "testCases": [
    {
      "name": "basic_text_request",
      "description": "基本文本请求测试",
      "request": {
        "model": "claude-3-5-sonnet-20240620",
        "messages": [
          {
            "role": "user",
            "content": "Hello, world!"
          }
        ],
        "max_tokens": 1000,
        "temperature": 0.7
      }
    },
    {
      "name": "tool_call_request",
      "description": "工具调用请求测试",
      "request": {
        "model": "claude-3-5-sonnet-20240620",
        "messages": [
          {
            "role": "user",
            "content": "列出当前目录的文件"
          }
        ],
        "tools": [
          {
            "name": "list_files",
            "description": "列出目录中的文件",
            "input_schema": {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string",
                  "description": "目录路径"
                }
              },
              "required": ["path"]
            }
          }
        ],
        "tool_choice": {
          "type": "tool",
          "name": "list_files"
        }
      }
    },
    {
      "name": "system_message_request",
      "description": "系统消息请求测试",
      "request": {
        "model": "claude-3-5-sonnet-20240620",
        "system": "你是一个 helpful assistant",
        "messages": [
          {
            "role": "user",
            "content": "告诉我今天的天气"
          }
        ]
      }
    }
  ]
}
```

## 4. 包配置和脚本

### 4.1 package.json 脚本

```json
{
  "scripts": {
    "test": "ts-node src/scripts/test-runner.ts",
    "test:verbose": "npm run test -- --verbose",
    "test:auto-fix": "npm run test -- --auto-fix",
    "test:custom": "npm run test --"
  }
}
```

### 4.2 启动脚本权限

```bash
#!/bin/bash
# scripts/setup-test-runner.sh

# 设置测试运行器脚本权限
chmod +x src/scripts/test-runner.ts

# 确保输出目录存在
mkdir -p test-results
mkdir -p test

# 复制示例测试用例
if [ ! -f test/test-cases.json ]; then
  cp test/test-cases.example.json test/test-cases.json
fi

echo "✅ 测试运行器环境设置完成"
```

## 5. 使用示例

### 5.1 基本使用

```bash
# 运行所有测试
npm run test

# 运行测试并显示详细日志
npm run test -- --verbose

# 运行测试并启用自动修正
npm run test -- --auto-fix

# 使用自定义测试用例文件
npm run test -- --test-cases ./my-tests.json
```

### 5.2 高级使用

```bash
# 指定端口和输出目录
npm run test -- --port-claude 3456 --port-our 5511 --output-dir ./reports

# 组合多个选项
npm run test -- --verbose --auto-fix --output-dir ./detailed-reports --test-cases ./advanced-tests.json
```

## 6. 集成到CI/CD

### 6.1 GitHub Actions 工作流

```yaml
# .github/workflows/test.yml
name: 测试对比
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test-comparison:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: 设置Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: 安装依赖
        run: npm install
        
      - name: 构建项目
        run: npm run build
        
      - name: 启动服务
        run: |
          npm run start-claude &
          npm run start-our &
          sleep 10
          
      - name: 运行测试
        run: npm run test -- --verbose
        
      - name: 上传测试报告
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-reports
          path: test-results/
```

这个启动脚本设计提供了完整的测试执行流程，包括服务启动、测试执行、数据捕获、对比分析和报告生成。它支持多种配置选项，可以灵活地适应不同的测试需求。