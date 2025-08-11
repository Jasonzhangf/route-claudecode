# 🔧 测试工具开发指南 (Testing Tools Development Guide)

## 🎯 概览 (Overview)

本文档为Claude Code Router项目的测试工具开发提供详细指导，确保所有工具符合项目规范并与现有系统完美集成。

## 📋 开发前准备 (Pre-development Setup)

### 环境要求
- **Node.js**: 18.0.0+
- **操作系统**: macOS/Linux (Windows WSL2)
- **内存**: 最小2GB可用内存
- **磁盘空间**: 最小1GB可用空间

### 必读规范
开发前必须查阅以下规则文件：
- [📄 测试工具规则](./.claude/rules/testing-tools-rules.md)
- [📄 核心编程规范](./.claude/rules/programming-rules.md)
- [📄 测试框架规范](./.claude/rules/testing-system-rules.md)

## 🏗️ 工具开发标准 (Tool Development Standards)

### 目录结构规范
每个工具必须按以下结构组织：
```
tools/[category]/[tool-name]/
├── index.js                # 主程序入口 (必需)
├── config.json            # 工具配置文件 (必需)
├── README.md              # 工具说明文档 (必需)
├── CHANGELOG.md           # 版本更新记录 (必需)
├── package.json           # 依赖管理文件 (可选)
├── lib/                   # 核心库文件 (可选)
│   ├── parser.js         # 解析逻辑
│   ├── formatter.js      # 格式化逻辑
│   └── validator.js      # 验证逻辑
├── templates/             # 模板文件 (可选)
├── assets/               # 静态资源 (可选)
└── tests/                # 单元测试 (推荐)
    ├── unit/
    ├── integration/
    └── fixtures/
```

### 主程序入口规范 (`index.js`)

#### 标准模板
```javascript
#!/usr/bin/env node

/**
 * Project: claude-code-router
 * Tool: [工具名称]
 * Owner: Jason Zhang
 * Created: [创建日期]
 * Version: 1.0.0
 * Description: [工具描述]
 */

const fs = require('fs').promises;
const path = require('path');

// 全局配置
const GLOBAL_CONFIG_PATH = path.join(__dirname, '../../config.json');
const TOOL_CONFIG_PATH = path.join(__dirname, 'config.json');

class ToolName {
    constructor() {
        this.config = {};
        this.globalConfig = {};
        this.version = '1.0.0';
    }

    async loadConfig() {
        try {
            // 加载全局配置
            const globalConfigContent = await fs.readFile(GLOBAL_CONFIG_PATH, 'utf8');
            this.globalConfig = JSON.parse(globalConfigContent);
            
            // 加载工具特定配置
            const toolConfigContent = await fs.readFile(TOOL_CONFIG_PATH, 'utf8');
            this.config = { ...this.globalConfig, ...JSON.parse(toolConfigContent) };
            
        } catch (error) {
            console.error(`配置加载失败: ${error.message}`);
            process.exit(1);
        }
    }

    showHelp() {
        console.log(`
[工具名称] v${this.version}
描述: [工具描述]

用法:
  ./tools/[category]/[tool-name] [options]

选项:
  --help, -h       显示帮助信息
  --version, -v    显示版本信息
  --config, -c     指定配置文件
  --verbose        详细输出模式
  --dry-run        预演模式
  --input, -i      输入路径
  --output, -o     输出路径

示例:
  ./tools/[category]/[tool-name] --input /path/to/input --output /path/to/output
        `);
    }

    showVersion() {
        console.log(`${this.constructor.name} v${this.version}`);
    }

    async run(args) {
        try {
            // 解析参数
            const options = this.parseArgs(args);
            
            // 执行核心逻辑
            await this.execute(options);
            
        } catch (error) {
            console.error(`执行错误: ${error.message}`);
            if (options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    parseArgs(args) {
        const options = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            switch (arg) {
                case '--verbose':
                    options.verbose = true;
                    break;
                case '--dry-run':
                    options.dryRun = true;
                    break;
                case '--input':
                case '-i':
                    options.input = args[++i];
                    break;
                case '--output':
                case '-o':
                    options.output = args[++i];
                    break;
                case '--config':
                case '-c':
                    options.configFile = args[++i];
                    break;
            }
        }
        return options;
    }

    async execute(options) {
        // 核心工具逻辑实现
        console.log('工具执行中...');
        
        // 性能监控
        const startTime = Date.now();
        const startMemory = process.memoryUsage();
        
        try {
            // 具体实现逻辑
            await this.processData(options);
            
        } finally {
            // 性能统计
            const endTime = Date.now();
            const endMemory = process.memoryUsage();
            
            if (options.verbose) {
                console.log(`执行时间: ${endTime - startTime}ms`);
                console.log(`内存使用: ${Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)}MB`);
            }
        }
    }

    async processData(options) {
        // 具体的数据处理逻辑
        throw new Error('processData方法需要在子类中实现');
    }
}

// 主程序入口
async function main() {
    const args = process.argv.slice(2);
    
    // 处理帮助和版本参数
    if (args.includes('--help') || args.includes('-h')) {
        const tool = new ToolName();
        tool.showHelp();
        process.exit(0);
    }
    
    if (args.includes('--version') || args.includes('-v')) {
        const tool = new ToolName();
        tool.showVersion();
        process.exit(0);
    }
    
    // 执行工具
    const tool = new ToolName();
    await tool.loadConfig();
    await tool.run(args);
}

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('未捕获异常:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
    process.exit(1);
});

// 执行主程序
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ToolName;
```

### 配置文件规范 (`config.json`)

#### 标准配置格式
```json
{
  "tool": {
    "name": "[工具名称]",
    "version": "1.0.0",
    "description": "[工具描述]",
    "author": "Jason Zhang",
    "category": "[工具分类]"
  },
  "settings": {
    "inputPath": "~/.route-claude-code/logs/",
    "outputPath": "~/.route-claude-code/providers/",
    "tempDir": "/tmp/ccr-tools/",
    "maxMemory": "512MB",
    "timeout": 30000,
    "logLevel": "info"
  },
  "processing": {
    "batchSize": 1000,
    "parallelLimit": 3,
    "retryAttempts": 3,
    "retryDelay": 1000
  },
  "validation": {
    "requiredFields": ["sessionId", "requestId", "provider"],
    "allowedProviders": ["anthropic", "codewhisperer", "openai", "gemini"],
    "timeFormat": "ISO8601"
  }
}
```

## 🔧 具体工具开发指南 (Specific Tool Development)

### 1. 日志解析工具开发

#### 核心功能要求
```javascript
class LogParserTool extends BaseTool {
    async parseLogFile(filePath) {
        // 解析日志文件
        const logContent = await fs.readFile(filePath, 'utf8');
        const lines = logContent.split('\n');
        
        const sessions = [];
        let currentSession = null;
        
        for (const line of lines) {
            // 解析请求开始
            const requestMatch = line.match(/\[REQUEST\].*requestId:\s*(\S+)/);
            if (requestMatch) {
                currentSession = {
                    requestId: requestMatch[1],
                    timestamp: this.extractTimestamp(line),
                    request: this.parseRequest(line)
                };
            }
            
            // 解析响应结束
            const responseMatch = line.match(/\[RESPONSE\].*requestId:\s*(\S+)/);
            if (responseMatch && currentSession) {
                currentSession.response = this.parseResponse(line);
                sessions.push(currentSession);
                currentSession = null;
            }
        }
        
        return sessions;
    }

    classifyResponse(response) {
        const contentLength = JSON.stringify(response.body).length;
        const hasToolCalls = /tool_calls|function_call/.test(JSON.stringify(response.body));
        
        if (hasToolCalls) return 'tool-calls';
        if (contentLength > 2000) return 'long-text';
        return 'normal-text';
    }

    async saveData(provider, category, data) {
        const outputDir = path.join(
            this.config.settings.outputPath,
            provider,
            category,
            new Date().toISOString().split('T')[0]
        );
        
        await fs.mkdir(outputDir, { recursive: true });
        
        const filename = `session-${Date.now()}.json`;
        const filepath = path.join(outputDir, filename);
        
        await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    }
}
```

### 2. 可视化工具开发

#### HTML时序图生成器
```javascript
class SequenceDiagramGenerator extends BaseTool {
    generateHTML(sequenceData) {
        const template = `
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code Router - Request Sequence Diagram</title>
    <meta charset="utf-8">
    <style>
        .timeline { width: 100%; height: 600px; }
        .request-line { stroke-width: 2; }
        .error-request { stroke: #FF0000; }
        .success-request { stroke: #00AA00; }
        .tooltip { 
            position: absolute;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
        }
    </style>
    <script src="https://d3js.org/d3.v7.min.js"></script>
</head>
<body>
    <div id="diagram-container">
        <h1>请求时序图</h1>
        <div id="timeline" class="timeline"></div>
        <div id="tooltip" class="tooltip" style="display: none;"></div>
    </div>
    <script>
        const data = ${JSON.stringify(sequenceData)};
        
        // 渲染时序图逻辑
        function renderDiagram(data) {
            const svg = d3.select("#timeline")
                .append("svg")
                .attr("width", "100%")
                .attr("height", "100%");
            
            // 时间轴
            const timeScale = d3.scaleTime()
                .domain(d3.extent(data, d => new Date(d.timestamp)))
                .range([50, 950]);
            
            // 绘制请求线条
            data.forEach((d, i) => {
                const color = this.getColorForRequestId(d.requestId);
                const y = 50 + i * 20;
                
                svg.append("line")
                    .attr("x1", timeScale(new Date(d.startTime)))
                    .attr("x2", timeScale(new Date(d.endTime)))
                    .attr("y1", y)
                    .attr("y2", y)
                    .attr("stroke", color)
                    .attr("class", d.success ? "success-request" : "error-request")
                    .on("mouseover", (event) => showTooltip(event, d))
                    .on("mouseout", hideTooltip);
            });
        }
        
        function showTooltip(event, data) {
            const tooltip = d3.select("#tooltip");
            tooltip.style("display", "block")
                .style("left", event.pageX + "px")
                .style("top", event.pageY + "px")
                .html(\`
                    <strong>Request ID:</strong> \${data.requestId}<br>
                    <strong>Provider:</strong> \${data.provider}<br>
                    <strong>Duration:</strong> \${data.duration}ms<br>
                    <strong>Status:</strong> \${data.success ? 'Success' : 'Failed'}
                \`);
        }
        
        function hideTooltip() {
            d3.select("#tooltip").style("display", "none");
        }
        
        renderDiagram(data);
    </script>
</body>
</html>`;
        return template;
    }

    getColorForRequestId(requestId) {
        // 为requestID生成一致的颜色
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'
        ];
        let hash = 0;
        for (let i = 0; i < requestId.length; i++) {
            hash = ((hash << 5) - hash + requestId.charCodeAt(i)) & 0xffffffff;
        }
        return colors[Math.abs(hash) % colors.length];
    }
}
```

## 📋 文档编写规范 (Documentation Standards)

### README.md 模板
```markdown
# [工具名称]

## 📋 概览
[工具描述和用途]

## 🚀 快速开始
\`\`\`bash
# 安装依赖
npm install

# 查看帮助
./index.js --help

# 基本使用
./index.js --input /path/to/input --output /path/to/output
\`\`\`

## ⚙️ 配置选项
[详细的配置说明]

## 📊 输出格式
[输出数据的格式说明]

## 🔍 使用示例
[具体的使用示例]

## 🚨 注意事项
[重要的使用注意事项]

## 📈 性能指标
- **处理速度**: [每秒处理记录数]
- **内存使用**: [峰值内存使用量]
- **支持文件大小**: [最大支持的文件大小]

---
**版本**: 1.0.0  
**维护者**: Jason Zhang  
**最后更新**: [更新日期]
```

### CHANGELOG.md 模板
```markdown
# Changelog

All notable changes to this tool will be documented in this file.

## [1.0.0] - 2025-08-07
### Added
- 初始版本发布
- 核心功能实现
- 基本配置支持
- 单元测试覆盖

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A
```

## 🧪 测试开发规范 (Testing Standards)

### 单元测试示例
```javascript
const assert = require('assert');
const ToolName = require('../index.js');

describe('ToolName', () => {
    let tool;
    
    beforeEach(() => {
        tool = new ToolName();
    });

    describe('配置加载', () => {
        it('应该正确加载全局配置', async () => {
            await tool.loadConfig();
            assert(tool.globalConfig);
            assert(tool.config);
        });
    });

    describe('数据处理', () => {
        it('应该正确处理输入数据', async () => {
            const testData = { /* 测试数据 */ };
            const result = await tool.processData({ input: testData });
            assert(result);
            // 更多断言...
        });
    });

    describe('错误处理', () => {
        it('应该正确处理无效输入', async () => {
            try {
                await tool.processData({ input: null });
                assert.fail('应该抛出错误');
            } catch (error) {
                assert(error.message.includes('无效输入'));
            }
        });
    });
});
```

## 🔄 集成测试规范 (Integration Testing)

### 与STD-8-STEP-PIPELINE集成
```javascript
// 集成测试示例
const { exec } = require('child_process');
const path = require('path');

describe('STD-8-STEP-PIPELINE 集成', () => {
    it('应该与Step5 API响应捕获集成', async () => {
        // 运行Step5测试
        const step5Result = await runStep5Test();
        
        // 使用工具处理Step5输出
        const toolPath = path.join(__dirname, '../index.js');
        const result = await execTool(toolPath, [
            '--input', step5Result.outputPath,
            '--output', '/tmp/test-output'
        ]);
        
        // 验证集成结果
        assert(result.success);
        assert(result.outputFiles.length > 0);
    });
});
```

## 🚀 发布和部署 (Release and Deployment)

### 版本发布检查清单
- [ ] 完成所有功能开发
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 集成测试通过
- [ ] 文档完整且准确
- [ ] 性能指标符合要求
- [ ] 与现有工具无冲突
- [ ] 配置文件验证
- [ ] 错误处理完善

### 发布流程
1. **代码审查**: 提交Pull Request
2. **自动化测试**: CI/CD流水线验证
3. **性能测试**: 在真实数据上测试
4. **文档更新**: 更新相关文档
5. **版本标记**: 创建版本标签
6. **发布通知**: 更新项目README

## 📞 支持和维护 (Support and Maintenance)

### 问题报告
- **Bug报告**: 使用GitHub Issues
- **功能请求**: 通过项目讨论区
- **性能问题**: 包含详细的性能数据

### 维护计划
- **定期更新**: 每月检查依赖更新
- **性能监控**: 持续监控工具性能
- **用户反馈**: 定期收集用户使用反馈
- **文档维护**: 保持文档与代码同步

---
**开发指南版本**: v1.0.0  
**适用工具版本**: v1.0.0+  
**维护者**: Jason Zhang  
**最后更新**: 2025-08-07