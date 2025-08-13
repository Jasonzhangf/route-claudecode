/**
 * Database Cleanup and Scanner Tool
 * 扫描和清理LMStudio工具调用数据，定位非规范格式
 * 
 * Project owner: Jason Zhang
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseCleanupScanner {
  constructor() {
    this.databasePath = process.env.HOME + '/.route-claudecode/database/captures';
    this.results = {
      totalFiles: 0,
      normalToolCalls: [],
      textDescriptionTools: [],
      nonStandardToolCalls: [],
      pureTextRecords: [],
      errors: []
    };
  }

  async scanAll() {
    console.log('🔍 开始扫描LMStudio数据库...');
    console.log(`📁 数据库路径: ${this.databasePath}\n`);

    try {
      await this.scanDirectory(this.databasePath);
      this.printSummary();
    } catch (error) {
      console.error('❌ 扫描失败:', error.message);
    }
  }

  async scanDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      console.log('⚠️  数据库目录不存在');
      return;
    }

    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        await this.scanDirectory(itemPath);
      } else if (item.endsWith('.json')) {
        await this.analyzeJsonFile(itemPath);
      }
    }
  }

  async analyzeJsonFile(filePath) {
    this.results.totalFiles++;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      const analysis = this.analyzeToolCallData(data, filePath);
      this.categorizeAnalysis(analysis, filePath);
      
    } catch (error) {
      this.results.errors.push({
        file: filePath,
        error: error.message
      });
    }
  }

  analyzeToolCallData(data, filePath) {
    const analysis = {
      hasTools: false,
      hasToolCalls: false,
      hasToolUse: false,
      toolCallTypes: [],
      contentTypes: [],
      isTextOnly: true,
      toolDescriptions: [],
      nonStandardElements: []
    };

    // 检查请求中的工具定义
    if (data.request && data.request.tools) {
      analysis.hasTools = true;
      analysis.isTextOnly = false;
      
      data.request.tools.forEach((tool, index) => {
        if (typeof tool === 'string') {
          analysis.nonStandardElements.push(`Tool ${index}: String instead of object`);
        } else if (tool.description && tool.description.includes('使用') || tool.description && tool.description.includes('调用')) {
          analysis.toolDescriptions.push(`Tool ${index}: Chinese description - ${tool.description}`);
        }
      });
    }

    // 检查响应中的工具调用
    if (data.response) {
      this.analyzeResponseContent(data.response, analysis);
    }

    // 检查是否是纯文本记录
    if (analysis.contentTypes.length === 1 && analysis.contentTypes[0] === 'text' && !analysis.hasTools) {
      analysis.isTextOnly = true;
    } else {
      analysis.isTextOnly = false;
    }

    return analysis;
  }

  analyzeResponseContent(response, analysis) {
    // 检查OpenAI格式的tool_calls
    if (response.choices && response.choices[0] && response.choices[0].message) {
      const message = response.choices[0].message;
      
      if (message.tool_calls) {
        analysis.hasToolCalls = true;
        analysis.isTextOnly = false;
        message.tool_calls.forEach((toolCall, index) => {
          analysis.toolCallTypes.push(`tool_call_${index}: ${toolCall.function?.name || 'unknown'}`);
        });
      }
      
      if (message.content) {
        analysis.contentTypes.push('text');
        // 检查是否包含工具调用的文本描述
        if (message.content.includes('tool_calls') || message.content.includes('function_call')) {
          analysis.toolDescriptions.push('Response contains tool call text description');
        }
      }
    }

    // 检查Anthropic格式的tool_use
    if (response.content && Array.isArray(response.content)) {
      response.content.forEach((content, index) => {
        analysis.contentTypes.push(content.type);
        
        if (content.type === 'tool_use') {
          analysis.hasToolUse = true;
          analysis.isTextOnly = false;
          analysis.toolCallTypes.push(`tool_use_${index}: ${content.name || 'unknown'}`);
        }
      });
    }
  }

  categorizeAnalysis(analysis, filePath) {
    const fileInfo = {
      path: filePath,
      filename: path.basename(filePath),
      hasTools: analysis.hasTools,
      hasToolCalls: analysis.hasToolCalls,
      hasToolUse: analysis.hasToolUse,
      toolCallTypes: analysis.toolCallTypes,
      contentTypes: analysis.contentTypes,
      toolDescriptions: analysis.toolDescriptions,
      nonStandardElements: analysis.nonStandardElements
    };

    if (analysis.isTextOnly && !analysis.hasTools && !analysis.hasToolCalls && !analysis.hasToolUse) {
      this.results.pureTextRecords.push(fileInfo);
    } else if (analysis.toolDescriptions.length > 0) {
      this.results.textDescriptionTools.push(fileInfo);
    } else if (analysis.nonStandardElements.length > 0) {
      this.results.nonStandardToolCalls.push(fileInfo);
    } else if (analysis.hasTools || analysis.hasToolCalls || analysis.hasToolUse) {
      this.results.normalToolCalls.push(fileInfo);
    } else {
      this.results.pureTextRecords.push(fileInfo);
    }
  }

  printSummary() {
    console.log('📊 数据库扫描结果汇总:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📁 总文件数: ${this.results.totalFiles}`);
    console.log(`✅ 正常工具调用: ${this.results.normalToolCalls.length}`);
    console.log(`📝 包含文本描述的工具: ${this.results.textDescriptionTools.length}`);
    console.log(`⚠️  非规范工具调用: ${this.results.nonStandardToolCalls.length}`);
    console.log(`📄 纯文本记录: ${this.results.pureTextRecords.length}`);
    console.log(`❌ 错误文件: ${this.results.errors.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (this.results.textDescriptionTools.length > 0) {
      console.log('📝 包含文本描述的工具文件:');
      this.results.textDescriptionTools.slice(0, 5).forEach(file => {
        console.log(`   ${file.filename}`);
        file.toolDescriptions.forEach(desc => console.log(`     - ${desc}`));
      });
      if (this.results.textDescriptionTools.length > 5) {
        console.log(`   ... 还有 ${this.results.textDescriptionTools.length - 5} 个文件`);
      }
      console.log('');
    }

    if (this.results.nonStandardToolCalls.length > 0) {
      console.log('⚠️  非规范工具调用文件:');
      this.results.nonStandardToolCalls.slice(0, 5).forEach(file => {
        console.log(`   ${file.filename}`);
        file.nonStandardElements.forEach(elem => console.log(`     - ${elem}`));
      });
      if (this.results.nonStandardToolCalls.length > 5) {
        console.log(`   ... 还有 ${this.results.nonStandardToolCalls.length - 5} 个文件`);
      }
      console.log('');
    }

    if (this.results.pureTextRecords.length > 0) {
      console.log('📄 需要清理的纯文本记录文件:');
      this.results.pureTextRecords.slice(0, 10).forEach(file => {
        console.log(`   ${file.filename}`);
      });
      if (this.results.pureTextRecords.length > 10) {
        console.log(`   ... 还有 ${this.results.pureTextRecords.length - 10} 个文件`);
      }
      console.log('');
    }
  }

  async cleanupPureTextRecords() {
    console.log('🧹 开始清理纯文本记录...');
    
    let cleaned = 0;
    for (const record of this.results.pureTextRecords) {
      try {
        fs.unlinkSync(record.path);
        cleaned++;
        console.log(`🗑️  已删除: ${record.filename}`);
      } catch (error) {
        console.error(`❌ 删除失败 ${record.filename}: ${error.message}`);
      }
    }
    
    console.log(`\n✅ 清理完成，共删除 ${cleaned} 个纯文本记录文件`);
  }

  getResults() {
    return this.results;
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const scanner = new DatabaseCleanupScanner();
  
  const args = process.argv.slice(2);
  const shouldCleanup = args.includes('--cleanup');
  
  scanner.scanAll().then(() => {
    if (shouldCleanup) {
      scanner.cleanupPureTextRecords();
    } else {
      console.log('💡 添加 --cleanup 参数来清理纯文本记录文件');
    }
  });
}

export default DatabaseCleanupScanner;