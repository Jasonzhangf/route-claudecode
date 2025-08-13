#!/usr/bin/env node

/**
 * LM Studio工具解析逻辑分析测试
 * 根据捕获的数据分析工具解析问题并提供修复方案
 * @author Jason Zhang
 * @version v3.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LMStudioToolParsingAnalysis {
  constructor() {
    this.testResults = {
      sessionId: `lmstudio-tool-parsing-analysis-${Date.now()}`,
      timestamp: new Date().toISOString(),
      testType: 'lmstudio-tool-parsing-analysis',
      results: [],
      summary: {}
    };
    
    // LM Studio相关的路径
    this.capturePaths = [
      '/Users/fanzhang/.route-claudecode/database/captures/openai-protocol/lmstudio',
      '/Users/fanzhang/.route-claude-code/database/captures/openai'
    ];
  }

  /**
   * 主分析流程
   */
  async runAnalysis() {
    console.log('🔧 LM Studio工具解析逻辑分析测试');
    console.log('=============================================');
    console.log(`Session ID: ${this.testResults.sessionId}\n`);

    try {
      // 测试1: 分析捕获的数据文件
      await this.analyzeCapturedData();

      // 测试2: 检查工具调用模式识别
      await this.checkToolCallPatterns();

      // 测试3: 验证解析逻辑的有效性
      await this.validateParsingLogic();

      // 测试4: 生成问题修复建议
      await this.generateFixRecommendations();

      // 生成总结
      this.generateSummary();

      // 保存结果
      await this.saveResults();

      console.log('\n✅ LM Studio工具解析分析完成!');
      console.log(`📊 发现问题: ${this.testResults.summary.issuesFound || 0}`);
      console.log(`🔧 修复建议: ${this.testResults.summary.recommendations || 0}`);

    } catch (error) {
      console.error('\n❌ 分析失败:', error);
      process.exit(1);
    }
  }

  /**
   * 测试1: 分析捕获的数据文件
   */
  async analyzeCapturedData() {
    console.log('📁 测试1: 分析LM Studio捕获的数据文件...');

    const analysisResults = {
      filesFound: 0,
      toolCallFiles: 0,
      parsingIssues: [],
      patterns: new Set(),
      modelTypes: new Set()
    };

    for (const capturePath of this.capturePaths) {
      try {
        const stats = await fs.stat(capturePath);
        if (stats.isDirectory()) {
          const files = await this.findCaptureFiles(capturePath);
          
          for (const file of files) {
            analysisResults.filesFound++;
            
            const analysis = await this.analyzeFile(file);
            if (analysis.hasToolCalls || analysis.hasToolCallPatterns) {
              analysisResults.toolCallFiles++;
              
              if (analysis.hasParsingIssues) {
                analysisResults.parsingIssues.push({
                  file: path.basename(file),
                  issues: analysis.issues,
                  patterns: analysis.patterns
                });
              }
              
              analysis.patterns.forEach(pattern => analysisResults.patterns.add(pattern));
              if (analysis.model) analysisResults.modelTypes.add(analysis.model);
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️ 路径不存在或无法访问: ${capturePath}`);
      }
    }

    this.testResults.results.push({
      test: 'captured-data-analysis',
      status: analysisResults.filesFound > 0 ? 'completed' : 'no-data',
      details: {
        totalFiles: analysisResults.filesFound,
        toolCallFiles: analysisResults.toolCallFiles,
        parsingIssues: analysisResults.parsingIssues.length,
        uniquePatterns: Array.from(analysisResults.patterns),
        models: Array.from(analysisResults.modelTypes)
      }
    });

    console.log(`   📊 分析完成: ${analysisResults.filesFound}个文件, ${analysisResults.toolCallFiles}个包含工具调用`);
    console.log(`   ❌ 发现问题: ${analysisResults.parsingIssues.length}个解析问题`);
    console.log(`   🔍 模式类型: ${Array.from(analysisResults.patterns).join(', ')}`);
  }

  /**
   * 查找捕获文件
   */
  async findCaptureFiles(dirPath) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // 递归搜索子目录
          const subFiles = await this.findCaptureFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.json') && 
                   (entry.name.includes('openai') || entry.name.includes('lmstudio'))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // 忽略读取错误
    }
    
    // 只返回最近的20个文件进行分析
    return files.slice(-20);
  }

  /**
   * 分析单个文件
   */
  async analyzeFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      const analysis = {
        hasToolCalls: false,
        hasToolCallPatterns: false,
        hasParsingIssues: false,
        issues: [],
        patterns: [],
        model: null
      };

      // 检查请求中的工具
      if (data.request?.tools && data.request.tools.length > 0) {
        analysis.hasToolCalls = true;
      }

      // 检查响应中的模型信息
      if (data.response?.model) {
        analysis.model = data.response.model;
      } else if (data.model) {
        analysis.model = data.model;
      }

      // 检查响应文本中的工具调用模式
      const responseText = this.extractResponseText(data.response);
      if (responseText) {
        const patterns = this.detectToolCallPatterns(responseText);
        if (patterns.length > 0) {
          analysis.hasToolCallPatterns = true;
          analysis.patterns = patterns;
          
          // 如果有工具调用模式但没有正确的tool_calls结构，说明有解析问题
          if (!this.hasProperToolCallsStructure(data.response)) {
            analysis.hasParsingIssues = true;
            analysis.issues.push('tool_calls_as_text');
          }
        }
      }

      // 检查其他解析问题
      if (analysis.hasToolCalls && !analysis.hasToolCallPatterns && 
          !this.hasProperToolCallsStructure(data.response)) {
        analysis.hasParsingIssues = true;
        analysis.issues.push('missing_tool_call_response');
      }

      return analysis;
      
    } catch (error) {
      return {
        hasToolCalls: false,
        hasToolCallPatterns: false,
        hasParsingIssues: true,
        issues: ['file_parse_error'],
        patterns: [],
        model: null
      };
    }
  }

  /**
   * 提取响应文本
   */
  extractResponseText(response) {
    if (!response) return '';
    
    try {
      // OpenAI格式
      if (response.choices?.[0]?.message?.content) {
        return response.choices[0].message.content;
      }
      
      // 流式响应
      if (response.events) {
        return response.events
          .filter(e => e.choices?.[0]?.delta?.content)
          .map(e => e.choices[0].delta.content)
          .join('');
      }
      
      // Anthropic格式
      if (response.content) {
        return response.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('');
      }
      
      // 直接文本格式
      if (typeof response === 'string') {
        return response;
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  /**
   * 检测工具调用模式
   */
  detectToolCallPatterns(text) {
    const patterns = [];
    
    // 各种工具调用模式
    const toolCallRegexes = [
      { name: 'standard', regex: /Tool call:\s*(\w+)\((.*?)\)/g },
      { name: 'prefix', regex: /(?:⏺\s*)?Tool call:\s*(\w+)\((.*?)\)/g },
      { name: 'function', regex: /function_call\s*=\s*(\w+)\((.*?)\)/g },
      { name: 'json', regex: /"tool_call":\s*\{[^}]*"name":\s*"([^"]+)"/g },
      { name: 'brackets', regex: /\[(\w+)\((.*?)\)\]/g }
    ];
    
    for (const { name, regex } of toolCallRegexes) {
      const matches = [...text.matchAll(regex)];
      if (matches.length > 0) {
        patterns.push(name);
      }
    }
    
    return patterns;
  }

  /**
   * 检查是否有正确的工具调用结构
   */
  hasProperToolCallsStructure(response) {
    if (!response) return false;
    
    // 检查OpenAI格式的tool_calls
    if (response.choices?.[0]?.message?.tool_calls) {
      return true;
    }
    
    // 检查流式响应中的tool_calls
    if (response.events) {
      return response.events.some(e => e.choices?.[0]?.delta?.tool_calls);
    }
    
    // 检查Anthropic格式的tool_use
    if (response.content) {
      return response.content.some(c => c.type === 'tool_use');
    }
    
    return false;
  }

  /**
   * 测试2: 检查工具调用模式识别
   */
  async checkToolCallPatterns() {
    console.log('\n🔍 测试2: 检查工具调用模式识别...');

    const testCases = [
      {
        name: 'standard-pattern',
        text: 'Tool call: bash(echo "hello world")',
        expectedPattern: 'standard'
      },
      {
        name: 'prefix-pattern',
        text: '⏺ Tool call: file_read(/path/to/file)',
        expectedPattern: 'prefix'
      },
      {
        name: 'function-pattern',
        text: 'function_call = write_file("test.txt", "content")',
        expectedPattern: 'function'
      },
      {
        name: 'json-pattern',
        text: '{"tool_call": {"name": "calculator", "arguments": {"operation": "add"}}}',
        expectedPattern: 'json'
      },
      {
        name: 'complex-multiline',
        text: `Here's the result:
Tool call: bash(ls -la)
And then we use:
Tool call: file_read(output.txt)`,
        expectedPattern: 'standard'
      }
    ];

    const results = [];
    
    for (const testCase of testCases) {
      const detectedPatterns = this.detectToolCallPatterns(testCase.text);
      const success = detectedPatterns.includes(testCase.expectedPattern);
      
      results.push({
        name: testCase.name,
        success,
        expected: testCase.expectedPattern,
        detected: detectedPatterns
      });
      
      console.log(`   ${success ? '✅' : '❌'} ${testCase.name}: ${detectedPatterns.join(', ')}`);
    }

    this.testResults.results.push({
      test: 'pattern-recognition',
      status: results.every(r => r.success) ? 'passed' : 'failed',
      details: {
        totalTests: results.length,
        passed: results.filter(r => r.success).length,
        results
      }
    });
  }

  /**
   * 测试3: 验证解析逻辑的有效性
   */
  async validateParsingLogic() {
    console.log('\n⚙️ 测试3: 验证解析逻辑的有效性...');

    const mockOpenAIResponse = {
      choices: [{
        delta: {
          content: `I'll help you with that task.

Tool call: bash(echo "Starting analysis")

Let me analyze the system:

Tool call: file_read(/proc/cpuinfo)

Based on the analysis, I'll create a summary:

Tool call: file_write(summary.txt, "System analysis complete")`
        }
      }]
    };

    const extractedText = this.extractResponseText(mockOpenAIResponse);
    const patterns = this.detectToolCallPatterns(extractedText);
    const hasProperStructure = this.hasProperToolCallsStructure(mockOpenAIResponse);

    console.log(`   📝 提取的文本长度: ${extractedText.length}字符`);
    console.log(`   🔍 检测到的模式: ${patterns.join(', ')}`);
    console.log(`   🏗️ 正确的结构: ${hasProperStructure}`);

    // 模拟工具调用提取
    const extractedToolCalls = this.extractToolCallsFromText(extractedText);
    console.log(`   🔧 提取的工具调用: ${extractedToolCalls.length}个`);
    
    for (const toolCall of extractedToolCalls) {
      console.log(`      - ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
    }

    this.testResults.results.push({
      test: 'parsing-logic-validation',
      status: extractedToolCalls.length > 0 ? 'passed' : 'failed',
      details: {
        textLength: extractedText.length,
        patternsDetected: patterns,
        hasProperStructure,
        extractedToolCalls: extractedToolCalls.length,
        toolCalls: extractedToolCalls
      }
    });
  }

  /**
   * 从文本中提取工具调用
   */
  extractToolCallsFromText(text) {
    const toolCalls = [];
    const regex = /Tool call:\s*(\w+)\((.*?)\)/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const [, toolName, argsString] = match;
      
      let args = {};
      try {
        // 尝试解析参数
        if (argsString.trim()) {
          if (argsString.includes('=') || argsString.includes(':')) {
            // 键值对格式
            args = { command: argsString };
          } else if (argsString.startsWith('{') && argsString.endsWith('}')) {
            // JSON格式
            args = JSON.parse(argsString);
          } else {
            // 单个参数
            args = { input: argsString };
          }
        }
      } catch (e) {
        args = { command: argsString };
      }
      
      toolCalls.push({
        id: `tool_${Date.now()}_${toolCalls.length}`,
        name: toolName,
        arguments: args
      });
    }
    
    return toolCalls;
  }

  /**
   * 测试4: 生成问题修复建议
   */
  async generateFixRecommendations() {
    console.log('\n🔧 测试4: 生成问题修复建议...');

    const recommendations = [];
    
    // 基于之前测试的结果生成建议
    const captureAnalysis = this.testResults.results.find(r => r.test === 'captured-data-analysis');
    const patternTest = this.testResults.results.find(r => r.test === 'pattern-recognition');
    const parsingTest = this.testResults.results.find(r => r.test === 'parsing-logic-validation');

    if (captureAnalysis?.details.parsingIssues > 0) {
      recommendations.push({
        priority: 'high',
        category: 'parsing-issues',
        title: '修复工具调用解析问题',
        description: `发现${captureAnalysis.details.parsingIssues}个解析问题，工具调用被错误处理为文本`,
        solution: '实现缓冲式处理：完整收集响应后再进行工具调用解析，避免分段处理导致的错误',
        implementation: 'src/providers/openai/buffered-processor.ts'
      });
    }

    if (captureAnalysis?.details.uniquePatterns.length > 1) {
      recommendations.push({
        priority: 'medium',
        category: 'pattern-diversity',
        title: '支持多种工具调用模式',
        description: `检测到${captureAnalysis.details.uniquePatterns.length}种不同的工具调用模式`,
        solution: '增强模式识别器以支持所有检测到的模式格式',
        implementation: 'src/providers/openai/tool-call-analyzer.ts'
      });
    }

    if (patternTest?.status === 'failed') {
      recommendations.push({
        priority: 'high',
        category: 'pattern-recognition',
        title: '改进模式识别准确性',
        description: '模式识别测试未完全通过',
        solution: '更新正则表达式以提高识别准确性，增加边界条件处理',
        implementation: 'pattern recognition logic'
      });
    }

    if (parsingTest?.details.extractedToolCalls === 0) {
      recommendations.push({
        priority: 'critical',
        category: 'extraction-failure',
        title: '工具调用提取完全失败',
        description: '无法从响应文本中提取任何工具调用',
        solution: '重新设计提取逻辑，可能需要采用状态机或多阶段解析',
        implementation: 'complete parser redesign'
      });
    }

    // LM Studio特定建议
    recommendations.push({
      priority: 'medium',
      category: 'lmstudio-specific',
      title: 'LM Studio兼容性优化',
      description: 'LM Studio使用OpenAI兼容API，但可能有特殊的响应格式',
      solution: '添加LM Studio特定的预处理器，处理其独特的响应格式',
      implementation: 'src/providers/openai/lmstudio-preprocessor.ts'
    });

    for (const rec of recommendations) {
      console.log(`   ${this.getPriorityIcon(rec.priority)} ${rec.title}`);
      console.log(`      📝 ${rec.description}`);
      console.log(`      💡 ${rec.solution}`);
      console.log(`      📁 ${rec.implementation}`);
      console.log('');
    }

    this.testResults.results.push({
      test: 'fix-recommendations',
      status: 'completed',
      details: {
        totalRecommendations: recommendations.length,
        byPriority: {
          critical: recommendations.filter(r => r.priority === 'critical').length,
          high: recommendations.filter(r => r.priority === 'high').length,
          medium: recommendations.filter(r => r.priority === 'medium').length
        },
        recommendations
      }
    });
  }

  /**
   * 获取优先级图标
   */
  getPriorityIcon(priority) {
    switch (priority) {
      case 'critical': return '🚨';
      case 'high': return '🔥';
      case 'medium': return '⚠️';
      default: return '💡';
    }
  }

  /**
   * 生成测试总结
   */
  generateSummary() {
    const total = this.testResults.results.length;
    const passed = this.testResults.results.filter(r => r.status === 'passed').length;
    const failed = this.testResults.results.filter(r => r.status === 'failed').length;
    const completed = this.testResults.results.filter(r => r.status === 'completed').length;

    const fixRec = this.testResults.results.find(r => r.test === 'fix-recommendations');
    
    this.testResults.summary = {
      total,
      passed,
      failed,
      completed,
      issuesFound: this.testResults.results.reduce((sum, r) => 
        sum + (r.details?.parsingIssues || 0), 0),
      recommendations: fixRec?.details?.totalRecommendations || 0,
      criticalIssues: fixRec?.details?.byPriority?.critical || 0,
      highIssues: fixRec?.details?.byPriority?.high || 0
    };
  }

  /**
   * 保存测试结果
   */
  async saveResults() {
    const outputDir = path.join(__dirname, '../output/functional');
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputFile = path.join(outputDir, `${this.testResults.sessionId}.json`);
    await fs.writeFile(outputFile, JSON.stringify(this.testResults, null, 2));
    
    console.log(`\n📄 分析结果已保存: ${outputFile}`);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  const analysis = new LMStudioToolParsingAnalysis();
  analysis.runAnalysis().catch(console.error);
}

export { LMStudioToolParsingAnalysis };