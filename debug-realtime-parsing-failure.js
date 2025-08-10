#!/usr/bin/env node

/**
 * 实时调试LMStudio解析失败问题
 * 监控用户实际会话中的工具解析失败
 * Project Owner: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

const DEBUG_LOG = '/tmp/realtime-parsing-debug.log';
const SYSTEM_LOG_DIR = '/Users/fanzhang/.route-claude-code/logs/port-5506';

// 清理之前的调试日志
if (fs.existsSync(DEBUG_LOG)) {
    fs.unlinkSync(DEBUG_LOG);
}

function log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    let output = logMessage + '\n';
    if (data) {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        console.log(dataStr);
        output += dataStr + '\n';
    }
    output += '\n';
    
    fs.appendFileSync(DEBUG_LOG, output);
}

function findLatestLogDir() {
    try {
        const dirs = fs.readdirSync(SYSTEM_LOG_DIR)
            .filter(dir => dir.startsWith('2025-'))
            .sort()
            .reverse();
        
        if (dirs.length === 0) return null;
        
        const latestDir = path.join(SYSTEM_LOG_DIR, dirs[0]);
        return latestDir;
    } catch (error) {
        log('查找最新日志目录失败', error.message);
        return null;
    }
}

function checkForParsingFailures(content) {
    const failures = [];
    
    // 检查LMStudio特殊格式未解析
    const lmstudioPattern = /<\|start\|>assistant<\|channel\|>commentary to=functions\.(\w+).*?<\|message\|>(\{[^}]+\})/g;
    let match;
    while ((match = lmstudioPattern.exec(content)) !== null) {
        failures.push({
            type: 'unparsed_lmstudio_format',
            toolName: match[1],
            jsonData: match[2],
            fullMatch: match[0]
        });
    }
    
    // 检查是否有工具解析成功的日志
    const successPattern = /Successfully extracted tool calls/g;
    const hasSuccess = successPattern.test(content);
    
    // 检查是否有解析器调用失败
    const parseFailPattern = /tool call parsing.*failed|parsing.*error|LMStudio.*parser.*failed/gi;
    const parseFailures = content.match(parseFailPattern) || [];
    
    return {
        unparsedFormats: failures,
        hasParsingSuccess: hasSuccess,
        parseFailures: parseFailures,
        totalFailures: failures.length + parseFailures.length
    };
}

function analyzeLatestLogs() {
    const latestLogDir = findLatestLogDir();
    if (!latestLogDir) {
        log('❌ 找不到最新的日志目录');
        return null;
    }
    
    log(`📁 分析最新日志目录: ${latestLogDir}`);
    
    const systemLogFile = path.join(latestLogDir, 'system.log');
    if (!fs.existsSync(systemLogFile)) {
        log('❌ system.log文件不存在');
        return null;
    }
    
    try {
        const logContent = fs.readFileSync(systemLogFile, 'utf8');
        const lines = logContent.split('\n').slice(-100); // 最近100行
        const recentContent = lines.join('\n');
        
        log(`📊 分析最近${lines.length}行日志`);
        
        const analysis = checkForParsingFailures(recentContent);
        
        if (analysis.totalFailures > 0) {
            log('🚨 发现解析问题!', {
                unparsedFormats: analysis.unparsedFormats.length,
                parseFailures: analysis.parseFailures.length,
                hasParsingSuccess: analysis.hasParsingSuccess
            });
            
            // 输出具体的未解析格式
            analysis.unparsedFormats.forEach((failure, index) => {
                log(`🔍 未解析格式 ${index + 1}`, {
                    toolName: failure.toolName,
                    jsonData: failure.jsonData,
                    preview: failure.fullMatch.substring(0, 150) + '...'
                });
            });
            
            if (analysis.parseFailures.length > 0) {
                log('📋 解析失败日志', analysis.parseFailures);
            }
        } else {
            log('✅ 最近日志中没有发现解析失败');
        }
        
        return analysis;
        
    } catch (error) {
        log('❌ 读取日志文件失败', error.message);
        return null;
    }
}

function watchForNewRequests() {
    const latestLogDir = findLatestLogDir();
    if (!latestLogDir) {
        log('❌ 无法监控：找不到日志目录');
        return;
    }
    
    const systemLogFile = path.join(latestLogDir, 'system.log');
    let lastSize = 0;
    
    try {
        const stats = fs.statSync(systemLogFile);
        lastSize = stats.size;
    } catch (error) {
        log('❌ 获取日志文件状态失败', error.message);
        return;
    }
    
    log('🔍 开始实时监控新的请求...');
    log('💡 请在Claude Code中尝试使用grep工具，我会实时捕获解析问题');
    
    const watcher = setInterval(() => {
        try {
            const stats = fs.statSync(systemLogFile);
            if (stats.size > lastSize) {
                // 文件有新内容
                const fd = fs.openSync(systemLogFile, 'r');
                const buffer = Buffer.alloc(stats.size - lastSize);
                fs.readSync(fd, buffer, 0, buffer.length, lastSize);
                fs.closeSync(fd);
                
                const newContent = buffer.toString('utf8');
                lastSize = stats.size;
                
                // 检查新内容中的解析问题
                const analysis = checkForParsingFailures(newContent);
                if (analysis.totalFailures > 0) {
                    log('🚨 实时捕获到解析失败!');
                    
                    analysis.unparsedFormats.forEach((failure, index) => {
                        log(`🔧 需要解析的格式 ${index + 1}`, {
                            toolName: failure.toolName,
                            jsonData: failure.jsonData,
                            timestamp: new Date().toISOString()
                        });
                        
                        // 尝试手动解析这个格式
                        try {
                            const parsedJson = JSON.parse(failure.jsonData);
                            log(`✅ JSON解析成功`, {
                                toolName: failure.toolName,
                                parameters: parsedJson
                            });
                            
                            // 生成修复建议
                            log(`🔧 建议的工具调用格式`, {
                                type: 'tool_use',
                                id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
                                name: failure.toolName.toLowerCase(),
                                input: parsedJson
                            });
                            
                        } catch (parseError) {
                            log(`❌ JSON解析失败`, {
                                error: parseError.message,
                                jsonData: failure.jsonData
                            });
                        }
                    });
                }
                
                // 检查是否有成功的解析
                if (analysis.hasParsingSuccess) {
                    log('✅ 有成功的工具解析记录');
                }
            }
        } catch (error) {
            // 文件可能被轮转或删除，忽略错误继续监控
        }
    }, 1000); // 每秒检查一次
    
    // 设置定时清理
    setTimeout(() => {
        clearInterval(watcher);
        log('⏰ 监控结束（10分钟超时）');
    }, 10 * 60 * 1000); // 10分钟后停止监控
    
    return watcher;
}

async function main() {
    log('🚀 LMStudio实时解析失败调试器启动');
    
    // 先分析现有日志
    log('📊 第一步：分析现有日志中的解析问题');
    const currentAnalysis = analyzeLatestLogs();
    
    if (currentAnalysis && currentAnalysis.totalFailures > 0) {
        log('💡 发现现有问题，建议重启LMStudio服务以应用最新修复');
        log('💡 重启命令示例：');
        log('   pkill -f "rcc start.*5506"');
        log('   rcc start --config ~/.route-claude-code/config/single-provider/config-openai-lmstudio-5506.json --debug');
    }
    
    // 开始实时监控
    log('🔍 第二步：实时监控新请求');
    const watcher = watchForNewRequests();
    
    // 处理中断信号
    process.on('SIGINT', () => {
        log('🛑 收到中断信号，停止监控');
        if (watcher) {
            clearInterval(watcher);
        }
        log(`📋 调试日志已保存到: ${DEBUG_LOG}`);
        process.exit(0);
    });
}

main().catch(error => {
    console.error('❌ 调试器执行失败:', error);
    process.exit(1);
});