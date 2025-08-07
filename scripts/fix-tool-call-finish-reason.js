#!/usr/bin/env node

/**
 * 修复工具调用finish_reason映射问题
 * 确保OpenAI工具调用正确返回tool_calls而不是end_turn
 */

const fs = require('fs');
const path = require('path');

class ToolCallFinishReasonFixer {
  constructor() {
    this.srcDir = path.join(__dirname, '../src');
    this.fixes = [];
    this.backups = [];
  }

  /**
   * 执行所有修复
   */
  async executeAllFixes() {
    console.log('🔧 开始修复工具调用finish_reason映射问题...');
    
    try {
      // 1. 修复OpenAI客户端的finish_reason映射
      await this.fixOpenAIFinishReasonMapping();
      
      // 2. 修复流式响应的finish_reason处理
      await this.fixStreamingFinishReasonHandling();
      
      // 3. 修复工具调用检测逻辑
      await this.fixToolCallDetectionLogic();
      
      // 4. 添加finish_reason验证
      await this.addFinishReasonValidation();
      
      console.log('\n✅ 所有修复完成!');
      this.printSummary();
      
    } catch (error) {
      console.error('❌ 修复过程中出现错误:', error.message);
      await this.rollbackChanges();
    }
  }

  /**
   * 修复OpenAI客户端的finish_reason映射
   */
  async fixOpenAIFinishReasonMapping() {
    console.log('\n🔧 修复OpenAI客户端finish_reason映射...');
    
    const clientFiles = [
      'src/providers/openai/enhanced-client.ts',
      'src/providers/openai/sdk-client.ts',
      'src/providers/openai/client-factory.ts'
    ];
    
    for (const filePath of clientFiles) {
      if (fs.existsSync(filePath)) {
        await this.fixFileFinishReasonMapping(filePath);
      }
    }
  }

  /**
   * 修复单个文件的finish_reason映射
   */
  async fixFileFinishReasonMapping(filePath) {
    console.log(`   📝 修复文件: ${filePath}`);
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // 创建备份
      this.createBackup(filePath, content);
      
      let modifiedContent = content;
      
      // 修复1: 确保工具调用时finish_reason正确映射
      const finishReasonFix = `
      // 🔧 Critical Fix: 正确映射finish_reason，确保工具调用返回tool_calls
      const hasToolCalls = response.choices?.[0]?.message?.tool_calls?.length > 0 ||
                           response.choices?.[0]?.delta?.tool_calls?.length > 0 ||
                           (typeof responseText === 'string' && this.detectToolCallsInText(responseText));
      
      let mappedFinishReason = originalFinishReason;
      if (hasToolCalls && originalFinishReason === 'stop') {
        mappedFinishReason = 'tool_calls';
        logger.debug('Corrected finish_reason from stop to tool_calls due to tool calls presence', {
          originalFinishReason,
          correctedFinishReason: mappedFinishReason,
          toolCallsDetected: hasToolCalls
        }, requestId, 'finish-reason-fix');
      }`;
      
      // 查找并替换finish_reason处理逻辑
      const finishReasonPattern = /finish_reason\s*[:=]\s*[^;,}]+/g;
      if (finishReasonPattern.test(modifiedContent)) {
        modifiedContent = modifiedContent.replace(
          /(\s+)(finish_reason\s*[:=]\s*[^;,}]+)/g,
          `$1${finishReasonFix}\n$1finish_reason: mappedFinishReason`
        );
      }
      
      // 修复2: 添加工具调用检测方法
      const toolCallDetectionMethod = `
  /**
   * 检测文本中是否包含工具调用
   */
  private detectToolCallsInText(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    
    const toolCallPatterns = [
      /Tool\\s+call:\\s*\\w+\\s*\\(/i,
      /\\{\\s*"type"\\s*:\\s*"tool_use"/i,
      /\\{\\s*"name"\\s*:\\s*"[^"]+",\\s*"input"\\s*:/i,
      /function_call/i,
      /tool_calls/i
    ];
    
    return toolCallPatterns.some(pattern => pattern.test(text));
  }`;
      
      // 在类定义中添加检测方法
      if (modifiedContent.includes('class ') && !modifiedContent.includes('detectToolCallsInText')) {
        const classEndPattern = /(\s+)(\}\s*$)/;
        modifiedContent = modifiedContent.replace(classEndPattern, `$1${toolCallDetectionMethod}\n$1$2`);
      }
      
      // 修复3: 确保流式响应中的finish_reason正确处理
      const streamingFinishReasonFix = `
      // 🔧 Streaming Fix: 确保流式响应中工具调用的finish_reason正确
      if (chunk.choices?.[0]?.finish_reason) {
        const originalReason = chunk.choices[0].finish_reason;
        const hasStreamingToolCalls = chunk.choices[0].delta?.tool_calls?.length > 0;
        
        if (hasStreamingToolCalls && originalReason === 'stop') {
          chunk.choices[0].finish_reason = 'tool_calls';
          logger.debug('Corrected streaming finish_reason for tool calls', {
            originalReason,
            correctedReason: 'tool_calls'
          }, requestId, 'streaming-finish-reason-fix');
        }
      }`;
      
      // 在流式处理中添加修复
      if (modifiedContent.includes('streaming') || modifiedContent.includes('stream')) {
        const streamProcessPattern = /(for\s+await\s*\([^)]+\)\s*\{[^}]*chunk[^}]*)/g;
        modifiedContent = modifiedContent.replace(streamProcessPattern, `$1\n${streamingFinishReasonFix}`);
      }
      
      if (modifiedContent !== originalContent) {
        fs.writeFileSync(filePath, modifiedContent);
        this.fixes.push({
          file: filePath,
          type: 'finish_reason_mapping',
          description: '修复finish_reason映射逻辑'
        });
        console.log(`   ✅ 已修复: ${path.basename(filePath)}`);
      } else {
        console.log(`   ⏭️  跳过: ${path.basename(filePath)} (无需修改)`);
      }
      
    } catch (error) {
      console.error(`   ❌ 修复失败 ${filePath}: ${error.message}`);
    }
  }

  /**
   * 修复流式响应的finish_reason处理
   */
  async fixStreamingFinishReasonHandling() {
    console.log('\n🔧 修复流式响应finish_reason处理...');
    
    const streamingFiles = [
      'src/transformers/streaming.ts',
      'src/transformers/openai.ts',
      'src/pipeline/response-pipeline.ts'
    ];
    
    for (const filePath of streamingFiles) {
      if (fs.existsSync(filePath)) {
        await this.fixStreamingFile(filePath);
      }
    }
  }

  /**
   * 修复流式文件
   */
  async fixStreamingFile(filePath) {
    console.log(`   📝 修复流式文件: ${filePath}`);
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      this.createBackup(filePath, content);
      
      let modifiedContent = content;
      
      // 添加流式finish_reason修复逻辑
      const streamingFix = `
  /**
   * 修复流式响应中的finish_reason
   */
  private fixStreamingFinishReason(chunk: any, accumulatedToolCalls: any[] = []): any {
    if (!chunk || !chunk.choices?.[0]) return chunk;
    
    const choice = chunk.choices[0];
    const hasToolCalls = choice.delta?.tool_calls?.length > 0 || accumulatedToolCalls.length > 0;
    
    // 如果有工具调用但finish_reason是stop，修正为tool_calls
    if (choice.finish_reason === 'stop' && hasToolCalls) {
      choice.finish_reason = 'tool_calls';
      
      logger.debug('Fixed streaming finish_reason for tool calls', {
        originalReason: 'stop',
        correctedReason: 'tool_calls',
        toolCallsCount: accumulatedToolCalls.length
      });
    }
    
    return chunk;
  }`;
      
      // 在类中添加修复方法
      if (modifiedContent.includes('class ') && !modifiedContent.includes('fixStreamingFinishReason')) {
        const classEndPattern = /(\s+)(\}\s*$)/;
        modifiedContent = modifiedContent.replace(classEndPattern, `$1${streamingFix}\n$1$2`);
      }
      
      // 在流式处理中调用修复方法
      const streamCallPattern = /(yield\s+[^;]+chunk[^;]*;)/g;
      modifiedContent = modifiedContent.replace(streamCallPattern, 
        `chunk = this.fixStreamingFinishReason(chunk, accumulatedToolCalls);\n        $1`
      );
      
      if (modifiedContent !== originalContent) {
        fs.writeFileSync(filePath, modifiedContent);
        this.fixes.push({
          file: filePath,
          type: 'streaming_finish_reason',
          description: '修复流式finish_reason处理'
        });
        console.log(`   ✅ 已修复: ${path.basename(filePath)}`);
      } else {
        console.log(`   ⏭️  跳过: ${path.basename(filePath)} (无需修改)`);
      }
      
    } catch (error) {
      console.error(`   ❌ 修复失败 ${filePath}: ${error.message}`);
    }
  }

  /**
   * 修复工具调用检测逻辑
   */
  async fixToolCallDetectionLogic() {
    console.log('\n🔧 修复工具调用检测逻辑...');
    
    const detectionFiles = [
      'src/utils/unified-tool-call-detector.ts',
      'src/utils/optimized-tool-call-detector.ts'
    ];
    
    for (const filePath of detectionFiles) {
      if (fs.existsSync(filePath)) {
        await this.enhanceToolCallDetection(filePath);
      }
    }
  }

  /**
   * 增强工具调用检测
   */
  async enhanceToolCallDetection(filePath) {
    console.log(`   📝 增强检测逻辑: ${filePath}`);
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      this.createBackup(filePath, content);
      
      let modifiedContent = content;
      
      // 添加更精确的工具调用检测模式
      const enhancedPatterns = `
  /**
   * 增强的工具调用检测模式 - 减少漏检和误检
   */
  private getEnhancedToolCallPatterns(): Array<{pattern: RegExp, name: string, confidence: number}> {
    return [
      // 高置信度模式 - OpenAI格式
      { pattern: /\\{\\s*"tool_calls"\\s*:\\s*\\[/i, name: 'openai_tool_calls_array', confidence: 1.0 },
      { pattern: /\\{\\s*"id"\\s*:\\s*"call_[^"]+"/i, name: 'openai_tool_call_id', confidence: 1.0 },
      { pattern: /\\{\\s*"function"\\s*:\\s*\\{\\s*"name"\\s*:/i, name: 'openai_function_call', confidence: 0.95 },
      
      // Anthropic格式
      { pattern: /\\{\\s*"type"\\s*:\\s*"tool_use"/i, name: 'anthropic_tool_use', confidence: 1.0 },
      { pattern: /\\{\\s*"id"\\s*:\\s*"toolu_[^"]+"/i, name: 'anthropic_tool_id', confidence: 1.0 },
      
      // 文本格式工具调用
      { pattern: /Tool\\s+call:\\s*\\w+\\s*\\(/i, name: 'text_tool_call', confidence: 0.9 },
      { pattern: /工具调用\\s*:\\s*[\\u4e00-\\u9fff\\w]+\\s*\\(/i, name: 'chinese_tool_call', confidence: 0.9 },
      
      // 函数调用模式
      { pattern: /\\w+\\s*\\(\\s*\\{[^}]*"[^"]+\\s*"\\s*:/i, name: 'function_with_json_args', confidence: 0.8 },
      
      // 跨chunk检测模式 - 关键用于流式响应
      { pattern: /\\{\\s*"tool_calls"\\s*:\\s*\\[\\s*$/i, name: 'partial_tool_calls_start', confidence: 0.7 },
      { pattern: /\\{\\s*"id"\\s*:\\s*"call_[^"]*$/i, name: 'partial_tool_id', confidence: 0.7 },
      { pattern: /Tool\\s+call\\s*:\\s*$/i, name: 'partial_text_tool_call', confidence: 0.6 }
    ];
  }`;
      
      // 在类中添加增强模式
      if (modifiedContent.includes('class ') && !modifiedContent.includes('getEnhancedToolCallPatterns')) {
        const classEndPattern = /(\s+)(\}\s*$)/;
        modifiedContent = modifiedContent.replace(classEndPattern, `$1${enhancedPatterns}\n$1$2`);
      }
      
      // 添加finish_reason修正方法
      const finishReasonCorrection = `
  /**
   * 根据检测到的工具调用修正finish_reason
   */
  correctFinishReason(originalReason: string, hasToolCalls: boolean, context: any): string {
    // 如果检测到工具调用但finish_reason是stop或end_turn，修正为tool_calls
    if (hasToolCalls && (originalReason === 'stop' || originalReason === 'end_turn')) {
      logger.debug('Correcting finish_reason due to detected tool calls', {
        originalReason,
        correctedReason: 'tool_calls',
        hasToolCalls,
        provider: context.provider
      }, context.requestId, 'finish-reason-correction');
      
      return context.provider === 'openai' ? 'tool_calls' : 'tool_use';
    }
    
    return originalReason;
  }`;
      
      if (!modifiedContent.includes('correctFinishReason')) {
        const classEndPattern = /(\s+)(\}\s*$)/;
        modifiedContent = modifiedContent.replace(classEndPattern, `$1${finishReasonCorrection}\n$1$2`);
      }
      
      if (modifiedContent !== originalContent) {
        fs.writeFileSync(filePath, modifiedContent);
        this.fixes.push({
          file: filePath,
          type: 'tool_call_detection',
          description: '增强工具调用检测逻辑'
        });
        console.log(`   ✅ 已增强: ${path.basename(filePath)}`);
      } else {
        console.log(`   ⏭️  跳过: ${path.basename(filePath)} (无需修改)`);
      }
      
    } catch (error) {
      console.error(`   ❌ 增强失败 ${filePath}: ${error.message}`);
    }
  }

  /**
   * 添加finish_reason验证
   */
  async addFinishReasonValidation() {
    console.log('\n🔧 添加finish_reason验证...');
    
    // 创建验证工具
    const validatorPath = 'src/utils/finish-reason-validator.ts';
    const validatorContent = `/**
 * Finish Reason验证器
 * 确保工具调用的finish_reason正确映射
 */

import { getLogger } from '../logging';

export interface FinishReasonValidationResult {
  isValid: boolean;
  originalReason: string;
  correctedReason: string;
  hasToolCalls: boolean;
  confidence: number;
}

export class FinishReasonValidator {
  private logger: ReturnType<typeof getLogger>;

  constructor(port?: number) {
    this.logger = getLogger(port);
  }

  /**
   * 验证并修正finish_reason
   */
  validateAndCorrect(
    finishReason: string,
    responseData: any,
    provider: string,
    requestId: string
  ): FinishReasonValidationResult {
    const hasToolCalls = this.detectToolCalls(responseData);
    const correctedReason = this.correctFinishReason(finishReason, hasToolCalls, provider);
    
    const result: FinishReasonValidationResult = {
      isValid: finishReason === correctedReason,
      originalReason: finishReason,
      correctedReason,
      hasToolCalls,
      confidence: this.calculateConfidence(responseData, hasToolCalls)
    };

    if (!result.isValid) {
      this.logger.warn('Finish reason correction applied', {
        originalReason: finishReason,
        correctedReason,
        hasToolCalls,
        provider,
        confidence: result.confidence
      }, requestId, 'finish-reason-validation');
    }

    return result;
  }

  /**
   * 检测响应中是否包含工具调用
   */
  private detectToolCalls(responseData: any): boolean {
    if (!responseData) return false;

    // 检查OpenAI格式
    if (responseData.choices?.[0]?.message?.tool_calls?.length > 0) {
      return true;
    }

    // 检查Anthropic格式
    if (responseData.content && Array.isArray(responseData.content)) {
      return responseData.content.some((block: any) => block.type === 'tool_use');
    }

    // 检查文本中的工具调用
    const text = this.extractTextContent(responseData);
    if (text) {
      const toolCallPatterns = [
        /Tool\\s+call:\\s*\\w+\\s*\\(/i,
        /\\{\\s*"type"\\s*:\\s*"tool_use"/i,
        /\\{\\s*"name"\\s*:\\s*"[^"]+",\\s*"input"\\s*:/i,
        /function_call/i
      ];
      
      return toolCallPatterns.some(pattern => pattern.test(text));
    }

    return false;
  }

  /**
   * 修正finish_reason
   */
  private correctFinishReason(finishReason: string, hasToolCalls: boolean, provider: string): string {
    if (!hasToolCalls) return finishReason;

    // 如果有工具调用但finish_reason不正确，进行修正
    if (finishReason === 'stop' || finishReason === 'end_turn') {
      return provider === 'openai' ? 'tool_calls' : 'tool_use';
    }

    return finishReason;
  }

  /**
   * 提取文本内容
   */
  private extractTextContent(responseData: any): string {
    if (typeof responseData === 'string') return responseData;
    
    if (responseData.choices?.[0]?.message?.content) {
      return responseData.choices[0].message.content;
    }
    
    if (responseData.content && Array.isArray(responseData.content)) {
      return responseData.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join(' ');
    }
    
    return '';
  }

  /**
   * 计算检测置信度
   */
  private calculateConfidence(responseData: any, hasToolCalls: boolean): number {
    if (!hasToolCalls) return 1.0;

    let confidence = 0.5;

    // 如果有明确的工具调用结构，提高置信度
    if (responseData.choices?.[0]?.message?.tool_calls?.length > 0) {
      confidence = 1.0;
    } else if (responseData.content?.some((block: any) => block.type === 'tool_use')) {
      confidence = 1.0;
    } else {
      // 基于文本模式的检测，置信度较低
      confidence = 0.7;
    }

    return confidence;
  }
}

// 导出单例
export const finishReasonValidator = new FinishReasonValidator();`;

    try {
      fs.writeFileSync(validatorPath, validatorContent);
      this.fixes.push({
        file: validatorPath,
        type: 'validation_tool',
        description: '创建finish_reason验证工具'
      });
      console.log(`   ✅ 已创建验证工具: ${validatorPath}`);
    } catch (error) {
      console.error(`   ❌ 创建验证工具失败: ${error.message}`);
    }
  }

  /**
   * 创建备份
   */
  createBackup(filePath, content) {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    fs.writeFileSync(backupPath, content);
    this.backups.push(backupPath);
  }

  /**
   * 回滚更改
   */
  async rollbackChanges() {
    console.log('\n🔄 回滚所有更改...');
    
    for (const backupPath of this.backups) {
      try {
        const originalPath = backupPath.replace(/\\.backup\\.\\d+$/, '');
        const backupContent = fs.readFileSync(backupPath, 'utf8');
        fs.writeFileSync(originalPath, backupContent);
        fs.unlinkSync(backupPath);
        console.log(`   ✅ 已回滚: ${path.basename(originalPath)}`);
      } catch (error) {
        console.error(`   ❌ 回滚失败 ${backupPath}: ${error.message}`);
      }
    }
  }

  /**
   * 打印修复摘要
   */
  printSummary() {
    console.log('\n📋 修复摘要:');
    console.log(`   总修复数: ${this.fixes.length}`);
    
    const fixTypes = {};
    for (const fix of this.fixes) {
      fixTypes[fix.type] = (fixTypes[fix.type] || 0) + 1;
    }
    
    for (const [type, count] of Object.entries(fixTypes)) {
      console.log(`   ${type}: ${count} 个文件`);
    }
    
    console.log('\n🎯 修复内容:');
    for (const fix of this.fixes) {
      console.log(`   • ${fix.description} (${path.basename(fix.file)})`);
    }
    
    console.log('\n⚠️  注意事项:');
    console.log('   • 请重启服务器以应用更改');
    console.log('   • 建议运行测试验证修复效果');
    console.log('   • 备份文件已创建，如有问题可回滚');
  }
}

// 主函数
async function main() {
  const fixer = new ToolCallFinishReasonFixer();
  await fixer.executeAllFixes();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ToolCallFinishReasonFixer };