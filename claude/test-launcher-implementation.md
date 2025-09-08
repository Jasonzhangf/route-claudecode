# 测试启动脚本实现

## 1. 启动脚本设计

### 1.1 启动脚本功能需求

启动脚本需要实现以下核心功能：

1. **环境准备** - 启动Claude Code Router和我们的实现
2. **测试执行** - 执行预定义的测试用例
3. **数据收集** - 收集两方的请求/响应数据
4. **对比分析** - 运行对比和分析
5. **报告生成** - 生成详细的对比报告
6. **自动修正** - 根据分析结果自动修正差异（可选）

### 1.2 启动脚本参数设计

```bash
# 启动脚本使用示例
./test-launcher.sh --test-cases test-cases.json --output-dir ./reports --auto-fix --verbose
```

参数说明：
- `--test-cases` - 指定要执行的测试用例文件
- `--output-dir` - 指定输出目录
- `--auto-fix` - 启用自动修正功能
- `--verbose` - 启用详细日志输出
- `--config` - 指定配置文件路径
- `--compare-only` - 仅执行对比，不重新运行测试
- `--report-format` - 指定报告格式（json/text/html）

## 2. 启动脚本实现

### 2.1 主启动脚本 (Bash)

```bash
#!/bin/bash
# test-launcher.sh

# 默认配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_CASES_FILE="$SCRIPT_DIR/config/test-cases.json"
OUTPUT_DIR="$SCRIPT_DIR/reports"
CONFIG_FILE="$SCRIPT_DIR/config/test-config.json"
AUTO_FIX=false
VERBOSE=false
COMPARE_ONLY=false
REPORT_FORMAT="text"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# 显示帮助信息
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo "Test launcher for comparing Claude Code Router with our implementation"
    echo ""
    echo "Options:"
    echo "  --test-cases FILE     Test cases file (default: config/test-cases.json)"
    echo "  --output-dir DIR      Output directory (default: reports)"
    echo "  --config FILE         Configuration file (default: config/test-config.json)"
    echo "  --auto-fix            Enable auto-fix mode"
    echo "  --verbose             Enable verbose output"
    echo "  --compare-only        Only run comparison, don't execute tests"
    echo "  --report-format FMT   Report format: text, json, html (default: text)"
    echo "  --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --test-cases my-tests.json --verbose"
    echo "  $0 --auto-fix --report-format json"
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --test-cases)
                TEST_CASES_FILE="$2"
                shift 2
                ;;
            --output-dir)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            --config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --auto-fix)
                AUTO_FIX=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --compare-only)
                COMPARE_ONLY=true
                shift
                ;;
            --report-format)
                REPORT_FORMAT="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 检查依赖
check_dependencies() {
    log_info "Checking dependencies..."
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi
    
    # 检查npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is required but not installed"
        exit 1
    fi
    
    # 检查Docker（如果需要）
    if ! command -v docker &> /dev/null; then
        log_warn "Docker not found, some features may not work"
    fi
    
    log_success "Dependencies check passed"
}

# 创建输出目录
create_output_dir() {
    log_info "Creating output directory: $OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
    
    if [ $? -ne 0 ]; then
        log_error "Failed to create output directory"
        exit 1
    fi
}

# 启动Claude Code Router
start_claude_code_router() {
    log_info "Starting Claude Code Router..."
    
    # 检查是否已经在运行
    if pgrep -f "ccr.*start" > /dev/null; then
        log_warn "Claude Code Router is already running"
        return 0
    fi
    
    # 启动Claude Code Router
    nohup ccr start > "$OUTPUT_DIR/ccr.log" 2>&1 &
    CCR_PID=$!
    
    # 等待启动
    sleep 5
    
    # 检查是否启动成功
    if ! pgrep -f "ccr.*start" > /dev/null; then
        log_error "Failed to start Claude Code Router"
        cat "$OUTPUT_DIR/ccr.log"
        exit 1
    fi
    
    log_success "Claude Code Router started (PID: $CCR_PID)"
}

# 启动我们的实现
start_our_implementation() {
    log_info "Starting our implementation..."
    
    # 检查是否已经在运行
    if pgrep -f "rcc4.*start" > /dev/null; then
        log_warn "Our implementation is already running"
        return 0
    fi
    
    # 启动我们的实现
    nohup rcc4 start > "$OUTPUT_DIR/rcc4.log" 2>&1 &
    RCC4_PID=$!
    
    # 等待启动
    sleep 5
    
    # 检查是否启动成功
    if ! pgrep -f "rcc4.*start" > /dev/null; then
        log_error "Failed to start our implementation"
        cat "$OUTPUT_DIR/rcc4.log"
        exit 1
    fi
    
    log_success "Our implementation started (PID: $RCC4_PID)"
}

# 停止服务
stop_services() {
    log_info "Stopping services..."
    
    # 停止Claude Code Router
    if pgrep -f "ccr.*start" > /dev/null; then
        ccr stop
        log_success "Claude Code Router stopped"
    fi
    
    # 停止我们的实现
    if pgrep -f "rcc4.*start" > /dev/null; then
        rcc4 stop
        log_success "Our implementation stopped"
    fi
}

# 执行测试用例
execute_test_cases() {
    log_info "Executing test cases from: $TEST_CASES_FILE"
    
    # 检查测试用例文件是否存在
    if [ ! -f "$TEST_CASES_FILE" ]; then
        log_error "Test cases file not found: $TEST_CASES_FILE"
        exit 1
    fi
    
    # 使用Node.js脚本执行测试
    node "$SCRIPT_DIR/lib/test-executor.js" \
        --test-cases "$TEST_CASES_FILE" \
        --output-dir "$OUTPUT_DIR" \
        --config "$CONFIG_FILE" \
        ${VERBOSE:+--verbose}
    
    if [ $? -ne 0 ]; then
        log_error "Test execution failed"
        exit 1
    fi
    
    log_success "Test cases executed successfully"
}

# 执行对比分析
run_comparison() {
    log_info "Running comparison analysis..."
    
    # 使用Node.js脚本执行对比
    node "$SCRIPT_DIR/lib/comparison-runner.js" \
        --output-dir "$OUTPUT_DIR" \
        --report-format "$REPORT_FORMAT" \
        ${VERBOSE:+--verbose}
    
    if [ $? -ne 0 ]; then
        log_error "Comparison analysis failed"
        exit 1
    fi
    
    log_success "Comparison analysis completed"
}

# 执行自动修正
run_auto_fix() {
    if [ "$AUTO_FIX" = true ]; then
        log_info "Running auto-fix..."
        
        # 使用Node.js脚本执行自动修正
        node "$SCRIPT_DIR/lib/auto-fixer.js" \
            --output-dir "$OUTPUT_DIR" \
            --config "$CONFIG_FILE" \
            ${VERBOSE:+--verbose}
        
        if [ $? -ne 0 ]; then
            log_error "Auto-fix failed"
            exit 1
        fi
        
        log_success "Auto-fix completed"
    fi
}

# 生成最终报告
generate_final_report() {
    log_info "Generating final report..."
    
    # 根据格式生成报告
    case "$REPORT_FORMAT" in
        json)
            # JSON格式报告已由comparison-runner生成
            echo "JSON report available at: $OUTPUT_DIR/comparison-report.json"
            ;;
        html)
            # 生成HTML报告
            node "$SCRIPT_DIR/lib/html-report-generator.js" \
                --input "$OUTPUT_DIR/comparison-report.json" \
                --output "$OUTPUT_DIR/report.html"
            echo "HTML report available at: $OUTPUT_DIR/report.html"
            ;;
        *)
            # 文本格式报告已由comparison-runner生成
            echo "Text report available at: $OUTPUT_DIR/comparison-report.txt"
            ;;
    esac
    
    log_success "Final report generated"
}

# 主函数
main() {
    log_info "Test Launcher Started"
    
    # 解析参数
    parse_args "$@"
    
    # 检查依赖
    check_dependencies
    
    # 创建输出目录
    create_output_dir
    
    # 设置信号处理
    trap stop_services EXIT INT TERM
    
    if [ "$COMPARE_ONLY" = false ]; then
        # 启动服务
        start_claude_code_router
        start_our_implementation
        
        # 执行测试用例
        execute_test_cases
    fi
    
    # 执行对比分析
    run_comparison
    
    # 执行自动修正
    run_auto_fix
    
    # 生成最终报告
    generate_final_report
    
    # 停止服务
    stop_services
    
    log_success "Test Launcher Completed Successfully"
}

# 执行主函数
main "$@"
```

### 2.2 测试执行器 (Node.js)

```javascript
// lib/test-executor.js
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');

class TestExecutor {
    constructor(options) {
        this.testCasesFile = options.testCasesFile;
        this.outputDir = options.outputDir;
        this.configFile = options.configFile;
        this.verbose = options.verbose || false;
        
        // 服务配置
        this.ccrConfig = {
            baseUrl: 'http://localhost:3456',
            apiKey: process.env.CCR_API_KEY || 'test-key'
        };
        
        this.rcc4Config = {
            baseUrl: 'http://localhost:5511',
            apiKey: process.env.RCC4_API_KEY || 'test-key'
        };
    }
    
    async execute() {
        try {
            // 读取测试用例
            const testCases = await this.readTestCases();
            
            // 创建输出目录
            await this.createOutputDirectories();
            
            // 执行每个测试用例
            for (const testCase of testCases) {
                await this.executeTestCase(testCase);
            }
            
            console.log('All test cases executed successfully');
        } catch (error) {
            console.error('Test execution failed:', error.message);
            process.exit(1);
        }
    }
    
    async readTestCases() {
        try {
            const content = await fs.readFile(this.testCasesFile, 'utf8');
            const testCases = JSON.parse(content);
            return testCases;
        } catch (error) {
            throw new Error(`Failed to read test cases file: ${error.message}`);
        }
    }
    
    async createOutputDirectories() {
        const dirs = [
            path.join(this.outputDir, 'data', 'ccr'),
            path.join(this.outputDir, 'data', 'rcc4'),
            path.join(this.outputDir, 'results')
        ];
        
        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                throw new Error(`Failed to create directory ${dir}: ${error.message}`);
            }
        }
    }
    
    async executeTestCase(testCase) {
        console.log(`Executing test case: ${testCase.name}`);
        
        try {
            // 向Claude Code Router发送请求
            const ccrResult = await this.sendRequestToCCR(testCase);
            
            // 向我们的实现发送请求
            const rcc4Result = await this.sendRequestToRCC4(testCase);
            
            // 保存结果
            await this.saveResults(testCase, ccrResult, rcc4Result);
            
            console.log(`Test case ${testCase.name} completed successfully`);
        } catch (error) {
            console.error(`Test case ${testCase.name} failed:`, error.message);
            throw error;
        }
    }
    
    async sendRequestToCCR(testCase) {
        const startTime = Date.now();
        
        try {
            const response = await axios.post(
                `${this.ccrConfig.baseUrl}/v1/messages`,
                testCase.request,
                {
                    headers: {
                        'Authorization': `Bearer ${this.ccrConfig.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );
            
            const endTime = Date.now();
            
            return {
                success: true,
                response: response.data,
                statusCode: response.status,
                duration: endTime - startTime,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            const endTime = Date.now();
            
            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status,
                duration: endTime - startTime,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async sendRequestToRCC4(testCase) {
        const startTime = Date.now();
        
        try {
            const response = await axios.post(
                `${this.rcc4Config.baseUrl}/v1/messages`,
                testCase.request,
                {
                    headers: {
                        'Authorization': `Bearer ${this.rcc4Config.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );
            
            const endTime = Date.now();
            
            return {
                success: true,
                response: response.data,
                statusCode: response.status,
                duration: endTime - startTime,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            const endTime = Date.now();
            
            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status,
                duration: endTime - startTime,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async saveResults(testCase, ccrResult, rcc4Result) {
        const testCaseDir = path.join(this.outputDir, 'results', testCase.name);
        await fs.mkdir(testCaseDir, { recursive: true });
        
        // 保存Claude Code Router结果
        await fs.writeFile(
            path.join(testCaseDir, 'ccr-result.json'),
            JSON.stringify(ccrResult, null, 2)
        );
        
        // 保存我们的实现结果
        await fs.writeFile(
            path.join(testCaseDir, 'rcc4-result.json'),
            JSON.stringify(rcc4Result, null, 2)
        );
        
        // 保存原始请求
        await fs.writeFile(
            path.join(testCaseDir, 'request.json'),
            JSON.stringify(testCase.request, null, 2)
        );
    }
}

// 命令行参数解析
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--test-cases':
                options.testCasesFile = args[++i];
                break;
            case '--output-dir':
                options.outputDir = args[++i];
                break;
            case '--config':
                options.configFile = args[++i];
                break;
            case '--verbose':
                options.verbose = true;
                break;
        }
    }
    
    return options;
}

// 主执行逻辑
async function main() {
    const options = parseArgs();
    
    // 设置默认值
    options.testCasesFile = options.testCasesFile || './config/test-cases.json';
    options.outputDir = options.outputDir || './reports';
    options.configFile = options.configFile || './config/test-config.json';
    
    const executor = new TestExecutor(options);
    await executor.execute();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = TestExecutor;
```

### 2.3 对比运行器 (Node.js)

```javascript
// lib/comparison-runner.js
const fs = require('fs').promises;
const path = require('path');
const { JSONComparisonEngine } = require('./json-comparison-engine');
const { ComparisonReportGenerator } = require('./comparison-report-generator');

class ComparisonRunner {
    constructor(options) {
        this.outputDir = options.outputDir;
        this.reportFormat = options.reportFormat || 'text';
        this.verbose = options.verbose || false;
    }
    
    async run() {
        try {
            // 读取测试结果
            const testResults = await this.readTestResults();
            
            // 对每个测试用例进行对比
            const comparisonResults = [];
            for (const testCase of testResults) {
                const result = await this.compareTestCase(testCase);
                comparisonResults.push(result);
            }
            
            // 生成综合报告
            await this.generateReport(comparisonResults);
            
            console.log('Comparison analysis completed successfully');
        } catch (error) {
            console.error('Comparison analysis failed:', error.message);
            process.exit(1);
        }
    }
    
    async readTestResults() {
        const resultsDir = path.join(this.outputDir, 'results');
        const testCases = [];
        
        try {
            const testCaseDirs = await fs.readdir(resultsDir);
            
            for (const testCaseDir of testCaseDirs) {
                const testCasePath = path.join(resultsDir, testCaseDir);
                const stats = await fs.stat(testCasePath);
                
                if (stats.isDirectory()) {
                    const testCase = await this.readTestCaseData(testCasePath, testCaseDir);
                    if (testCase) {
                        testCases.push(testCase);
                    }
                }
            }
        } catch (error) {
            throw new Error(`Failed to read test results: ${error.message}`);
        }
        
        return testCases;
    }
    
    async readTestCaseData(testCasePath, testCaseName) {
        try {
            // 读取Claude Code Router结果
            const ccrResultPath = path.join(testCasePath, 'ccr-result.json');
            const ccrResultContent = await fs.readFile(ccrResultPath, 'utf8');
            const ccrResult = JSON.parse(ccrResultContent);
            
            // 读取我们的实现结果
            const rcc4ResultPath = path.join(testCasePath, 'rcc4-result.json');
            const rcc4ResultContent = await fs.readFile(rcc4ResultPath, 'utf8');
            const rcc4Result = JSON.parse(rcc4ResultContent);
            
            // 读取原始请求
            const requestPath = path.join(testCasePath, 'request.json');
            const requestContent = await fs.readFile(requestPath, 'utf8');
            const request = JSON.parse(requestContent);
            
            return {
                name: testCaseName,
                request,
                ccrResult,
                rcc4Result
            };
        } catch (error) {
            console.error(`Failed to read test case data for ${testCaseName}:`, error.message);
            return null;
        }
    }
    
    async compareTestCase(testCase) {
        console.log(`Comparing test case: ${testCase.name}`);
        
        try {
            const comparisonEngine = new JSONComparisonEngine();
            
            // 对比响应数据
            const comparisonResult = await comparisonEngine.compare(
                testCase.ccrResult.response,
                testCase.rcc4Result.response
            );
            
            return {
                testCase: testCase.name,
                request: testCase.request,
                ccrResult: testCase.ccrResult,
                rcc4Result: testCase.rcc4Result,
                comparison: comparisonResult
            };
        } catch (error) {
            console.error(`Comparison failed for ${testCase.name}:`, error.message);
            throw error;
        }
    }
    
    async generateReport(comparisonResults) {
        const reportGenerator = new ComparisonReportGenerator();
        const report = reportGenerator.generateReport(comparisonResults);
        
        // 根据格式保存报告
        switch (this.reportFormat) {
            case 'json':
                await this.saveJsonReport(report);
                break;
            case 'html':
                await this.saveHtmlReport(report);
                break;
            default:
                await this.saveTextReport(report);
                break;
        }
    }
    
    async saveJsonReport(report) {
        const reportPath = path.join(this.outputDir, 'comparison-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`JSON report saved to: ${reportPath}`);
    }
    
    async saveTextReport(report) {
        const reportPath = path.join(this.outputDir, 'comparison-report.txt');
        const content = this.formatTextReport(report);
        await fs.writeFile(reportPath, content);
        console.log(`Text report saved to: ${reportPath}`);
    }
    
    async saveHtmlReport(report) {
        const reportPath = path.join(this.outputDir, 'comparison-report.html');
        const content = this.formatHtmlReport(report);
        await fs.writeFile(reportPath, content);
        console.log(`HTML report saved to: ${reportPath}`);
    }
    
    formatTextReport(report) {
        let content = `# Comparison Report\n\n`;
        content += `Generated at: ${report.timestamp}\n\n`;
        
        content += `## Summary\n`;
        content += `Total test cases: ${report.summary.totalTestCases}\n`;
        content += `Passed: ${report.summary.passed}\n`;
        content += `Failed: ${report.summary.failed}\n`;
        content += `Equal results: ${report.summary.equalResults}\n\n`;
        
        content += `## Detailed Results\n`;
        for (const result of report.results) {
            content += `\n### Test Case: ${result.testCase}\n`;
            content += `Status: ${result.comparison.isEqual ? 'PASS' : 'FAIL'}\n`;
            content += `Differences: ${result.comparison.summary.totalDifferences}\n`;
            content += `Critical: ${result.comparison.summary.criticalDifferences}\n`;
            content += `Warning: ${result.comparison.summary.warningDifferences}\n`;
        }
        
        return content;
    }
    
    formatHtmlReport(report) {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .test-case { border: 1px solid #ddd; margin: 10px 0; padding: 15px; }
        .pass { color: green; }
        .fail { color: red; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Comparison Report</h1>
    <p>Generated at: ${report.timestamp}</p>
    
    <div class="summary">
        <h2>Summary</h2>
        <p>Total test cases: ${report.summary.totalTestCases}</p>
        <p>Passed: ${report.summary.passed}</p>
        <p>Failed: ${report.summary.failed}</p>
        <p>Equal results: ${report.summary.equalResults}</p>
    </div>
    
    <h2>Detailed Results</h2>
    ${report.results.map(result => `
        <div class="test-case">
            <h3>Test Case: ${result.testCase}</h3>
            <p>Status: <span class="${result.comparison.isEqual ? 'pass' : 'fail'}">
                ${result.comparison.isEqual ? 'PASS' : 'FAIL'}
            </span></p>
            <p>Differences: ${result.comparison.summary.totalDifferences}</p>
            <p>Critical: ${result.comparison.summary.criticalDifferences}</p>
            <p>Warning: ${result.comparison.summary.warningDifferences}</p>
        </div>
    `).join('')}
</body>
</html>
        `;
    }
}

// 命令行参数解析
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--output-dir':
                options.outputDir = args[++i];
                break;
            case '--report-format':
                options.reportFormat = args[++i];
                break;
            case '--verbose':
                options.verbose = true;
                break;
        }
    }
    
    return options;
}

// 主执行逻辑
async function main() {
    const options = parseArgs();
    
    // 设置默认值
    options.outputDir = options.outputDir || './reports';
    options.reportFormat = options.reportFormat || 'text';
    
    const runner = new ComparisonRunner(options);
    await runner.run();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ComparisonRunner;
```

## 3. 配置文件设计

### 3.1 测试配置文件

```json
// config/test-config.json
{
  "services": {
    "claudeCodeRouter": {
      "baseUrl": "http://localhost:3456",
      "apiKey": "test-key",
      "timeout": 30000,
      "maxRetries": 3
    },
    "ourImplementation": {
      "baseUrl": "http://localhost:5511",
      "apiKey": "test-key",
      "timeout": 30000,
      "maxRetries": 3
    }
  },
  "comparison": {
    "ignoreFields": [
      "id",
      "timestamp",
      "created",
      "request_id"
    ],
    "tolerance": {
      "numeric": 0.01,
      "string": "exact"
    },
    "criticalFields": [
      "model",
      "messages",
      "tools",
      "content",
      "role",
      "tool_calls",
      "function.name",
      "function.arguments"
    ]
  },
  "output": {
    "directory": "./reports",
    "formats": ["text", "json", "html"],
    "keepHistory": true,
    "maxHistoryFiles": 10
  },
  "autoFix": {
    "enabled": false,
    "maxIterations": 5,
    "fieldMappingUpdates": true,
    "valueConversionUpdates": true,
    "structureAdjustments": true
  }
}
```

### 3.2 测试用例文件

```json
// config/test-cases.json
{
  "testCases": [
    {
      "name": "basic_text_request",
      "description": "Basic text request without tools",
      "request": {
        "model": "claude-3-5-sonnet-20240620",
        "messages": [
          {
            "role": "user",
            "content": "Hello, how are you?"
          }
        ],
        "max_tokens": 1000,
        "temperature": 0.7
      }
    },
    {
      "name": "tool_call_request",
      "description": "Request with tool calls",
      "request": {
        "model": "claude-3-5-sonnet-20240620",
        "messages": [
          {
            "role": "user",
            "content": "List all files in the current directory"
          }
        ],
        "tools": [
          {
            "name": "list_files",
            "description": "List files in a directory",
            "input_schema": {
              "type": "object",
              "properties": {
                "path": {
                  "type": "string",
                  "description": "Directory path"
                }
              },
              "required": ["path"]
            }
          }
        ],
        "tool_choice": "auto"
      }
    },
    {
      "name": "system_message_request",
      "description": "Request with system message",
      "request": {
        "model": "claude-3-5-sonnet-20240620",
        "system": "You are a helpful assistant.",
        "messages": [
          {
            "role": "user",
            "content": "What is the capital of France?"
          }
        ]
      }
    }
  ]
}
```

## 4. 使用示例

### 4.1 基本使用

```bash
# 给脚本执行权限
chmod +x test-launcher.sh

# 执行基本测试
./test-launcher.sh

# 执行测试并生成详细报告
./test-launcher.sh --verbose --report-format html

# 仅执行对比分析（不重新运行测试）
./test-launcher.sh --compare-only --report-format json
```

### 4.2 自动修正模式

```bash
# 启用自动修正
./test-launcher.sh --auto-fix --verbose

# 指定自定义测试用例
./test-launcher.sh --test-cases ./my-test-cases.json --auto-fix
```

### 4.3 集成到CI/CD

```yaml
# .github/workflows/test-comparison.yml
name: Test Comparison
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
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Start services
        run: |
          ccr start &
          rcc4 start &
          sleep 10
          
      - name: Run test comparison
        run: ./test-launcher.sh --report-format json --output-dir ./test-results
        
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: ./test-results/
          
      - name: Stop services
        if: always()
        run: |
          ccr stop || true
          rcc4 stop || true
```

这个启动脚本实现提供了一个完整的测试执行和对比分析框架，可以自动化地执行测试用例、收集数据、进行对比分析并生成报告。