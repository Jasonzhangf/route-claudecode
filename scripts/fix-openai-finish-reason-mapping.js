#!/usr/bin/env node

/**
 * OpenAI Finish Reason映射修复脚本
 * 专门修复OpenAI工具调用的finish_reason映射问题
 * 确保工具调用返回tool_calls而不是end_turn
 */

const fs = require('fs');
const path = require('path');

class OpenAIFinishReasonFixer {
  constructor() {
    this.srcDir = path.join(__dirname, '../src');
    this.fixes = [];
    this.backups = [];
  }

  /**
   * 执行OpenAI专项修复
   */
  async executeOpenAIFixes() {
    console.log('🔧 开始修复OpenAI finish_reason映射问题...');
    
    try {
      // 1. 修复Enhanced Client的finish_reason映射
      await this.fixEnhancedClientFinishReason();
      
      // 2. 修复SDK Client的finish_reason映射
      await this.fixSDKClientFinishReason();
      
      // 3. 修复OpenAI Transformer的finish_reason处理
      await this.fixOpenAITransformerFinishReason();
      
      // 4. 修复流式响应的finish_reason处理
      await this.fixStreamingFinishReason();
      
      // 5. 创建OpenAI专用的finish_reason修正器
      await this.createOpenAIFinishReasonCorrector();
      
      console.log('\n✅ OpenAI finish_reason修复完成!');
      this.printSummary();
      
    } catch (error) {
      console.error('❌ 修复过程中出现错误:', error.message);
      await this.rollbackChanges();
    }
  }

  /**
   * 修复Enhanced Client的finish_reason映射
   */
  async fixEnhancedClientFinishReason() {
    console.log('\n🔧 修复Enhanced Client finish_reason映射...');
    
    const filePath = 'src/providers/openai/enhanced-client.ts';
    if (!fs.existsSync(filePath)) {
      console.log('   ⏭️  跳过: enhanced-client.ts 不存在');
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      this.createBackup(filePath, content);
      
      let modifiedContent = content;

      // 1. 添加工具调用检测方法
      const toolCallDetectionMethod = `
  /**
   * 检测OpenAI响应中是否包含工具调用
   */
  private detectToolCallsInOpenAIResponse(response: any): boolean {
    // 检查choices[0].message.tool_calls
    if (response.choices?.[0]?.message?.tool_calls?.length > 0) {
      return true;
    }
    
    // 检查流式响应中的tool_calls
    if (response.choices?.[0]?.delta?.tool_calls?.length > 0) {
      return true;
    }
    
    // 检查文本内容中的工具调用模式
    const content = response.choices?.[0]?.message?.content || response.choices?.[0]?.delta?.content;
    if (content && typeof content === 'string') {
      const toolCallPatterns = [
        /Tool\\s+call:\\s*\\w+\\s*\\(/i,
        /\\{\\s*"type"\\s*:\\s*"tool_use"/i,
        /\\{\\s*"name"\\s*:\\s*"[^"]+",\\s*"input"\\s*:/i,
        /function_call/i
      ];
      
      return toolCallPatterns.some(pattern => pattern.test(content));
    }
    
    return false;
  }`;

      // 2. 添加finish_reason修正方法
      const finishReasonCorrectionMethod = `
  /**
   * 修正OpenAI响应的finish_reason
   */
  private correctOpenAIFinishReason(response: any, requestId: string): any {
    if (!response.choices?.[0]) {
      return response;
    }

    const choice = response.choices[0];
    const originalFinishReason = choice.finish_reason;
    
    // 检测是否有工具调用
    const hasToolCalls = this.detectToolCallsInOpenAIResponse(response);
    
    // 如果有工具调用但finish_reason不是tool_calls，进行修正
    if (hasToolCalls && originalFinishReason !== 'tool_calls') {
      choice.finish_reason = 'tool_calls';
      
      logger.warn('Corrected OpenAI finish_reason for tool calls', {
        originalFinishReason,
        correctedFinishReason: 'tool_calls',
        hasToolCalls,
        provider: this.name,
        toolCallsCount: choice.message?.tool_calls?.length || choice.delta?.tool_calls?.length || 0
      }, requestId, 'finish-reason-correction');
    }
    
    return response;
  }`;

      // 3. 在类中添加这些方法
      if (!modifiedContent.includes('detectToolCallsInOpenAIResponse')) {
        const classEndPattern = /(\s+)(\}\s*$)/;
        modifiedContent = modifiedContent.replace(classEndPattern, 
          `$1${toolCallDetectionMethod}\n$1${finishReasonCorrectionMethod}\n$1$2`
        );
      }

      // 4. 在响应处理中应用修正
      const responseProcessingFix = `
        // 🔧 Critical Fix: 修正finish_reason映射
        response.data = this.correctOpenAIFinishReason(response.data, requestId);`;

      // 在convertFromOpenAI调用之前添加修正
      const convertFromOpenAIPattern = /(const baseResponse = this\.convertFromOpenAI\([^;]+;)/;
      if (convertFromOpenAIPattern.test(modifiedContent)) {
        modifiedContent = modifiedContent.replace(convertFromOpenAIPattern, 
          `${responseProcessingFix}\n        $1`
        );
      }

      // 5. 修复流式响应处理
      const streamingFix = `
          // 🔧 Streaming Fix: 修正流式响应的finish_reason
          if (chunk.choices?.[0]?.finish_reason) {
            const hasStreamingToolCalls = chunk.choices[0].delta?.tool_calls?.length > 0;
            if (hasStreamingToolCalls && chunk.choices[0].finish_reason === 'stop') {
              chunk.choices[0].finish_reason = 'tool_calls';
              logger.debug('Corrected streaming finish_reason for tool calls', {
                originalReason: 'stop',
                correctedReason: 'tool_calls'
              }, requestId, 'streaming-finish-reason-fix');
            }
          }`;

      // 在流式处理中添加修正
      const streamProcessPattern = /(for await \(const chunk of[^{]+\{)/;
      if (streamProcessPattern.test(modifiedContent)) {
        modifiedContent = modifiedContent.replace(streamProcessPattern, 
          `$1\n${streamingFix}`
        );
      }

      if (modifiedContent !== content) {
        fs.writeFileSync(filePath, modifiedContent);
        this.fixes.push({
          file: filePath,
          type: 'enhanced_client_finish_reason',
          description: '修复Enhanced Client的finish_reason映射'
        });
        console.log('   ✅ 已修复: enhanced-client.ts');
      } else {
        console.log('   ⏭️  跳过: enhanced-client.ts (无需修改)');
      }

    } catch (error) {
      console.error(`   ❌ 修复失败: ${error.message}`);
    }
  }

  /**
   * 修复SDK Client的finish_reason映射
   */
  async fixSDKClientFinishReason() {
    console.log('\n🔧 修复SDK Client finish_reason映射...');
    
    const filePath = 'src/providers/openai/sdk-client.ts';
    if (!fs.existsSync(filePath)) {
      console.log('   ⏭️  跳过: sdk-client.ts 不存在');
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      this.createBackup(filePath, content);
      
      let modifiedContent = content;

      // 1. 修复mapFinishReason方法，确保工具调用正确映射
      const improvedMapFinishReason = `
  /**
   * 映射finish reason - 增强版本，确保工具调用正确映射
   */
  private mapFinishReason(finishReason: string, hasToolCalls: boolean = false): string {
    // 🔧 Critical Fix: 如果有工具调用，强制返回tool_use
    if (hasToolCalls && (finishReason === 'stop' || finishReason === 'tool_calls')) {
      return 'tool_use';
    }
    
    const mapping: Record<string, string> = {
      'stop': 'end_turn',
      'length': 'max_tokens',
      'tool_calls': 'tool_use',
      'function_call': 'tool_use',
      'content_filter': 'stop_sequence'
    };

    return mapping[finishReason] || 'end_turn';
  }`;

      // 替换现有的mapFinishReason方法
      const mapFinishReasonPattern = /private mapFinishReason\([^}]+\}/s;
      if (mapFinishReasonPattern.test(modifiedContent)) {
        modifiedContent = modifiedContent.replace(mapFinishReasonPattern, improvedMapFinishReason);
      }

      // 2. 修复流式处理中的finish_reason映射调用
      const streamingFinishReasonFix = `
          // 🎯 修复：如果整个响应中有工具调用，强制覆盖stop_reason为tool_use
          if (hasToolCalls) {
            anthropicStopReason = 'tool_use';
            
            // 记录工具调用解析结果用于调试
            const finalToolCalls = streamingParser.finalizeToolCalls();
            logger.debug('Streaming tool calls finalized', {
              requestId,
              toolCallsCount: finalToolCalls.length,
              stopReason: anthropicStopReason,
              tools: finalToolCalls.map(t => ({ id: t.id, name: t.name }))
            });
            
            // 重新初始化解析器以避免状态泄露
            streamingParser.reset();
          } else {
            anthropicStopReason = this.mapFinishReason(choice.finish_reason, hasToolCalls);
          }`;

      // 替换现有的finish_reason处理逻辑
      const existingFinishReasonPattern = /let anthropicStopReason = this\.mapFinishReason\([^;]+;[\s\S]*?streamingParser\.reset\(\);[\s\S]*?\}/;
      if (existingFinishReasonPattern.test(modifiedContent)) {
        modifiedContent = modifiedContent.replace(existingFinishReasonPattern, streamingFinishReasonFix);
      }

      // 3. 修复buildCompleteResponseFromStream中的stop_reason设置
      const completeResponseFix = `
    // 🎯 修复：如果有工具调用，强制设置stop_reason为tool_use
    const finalStopReason = toolCalls.length > 0 ? 'tool_use' : this.mapFinishReason(stopReason, toolCalls.length > 0);`;

      // 替换现有的finalStopReason设置
      const finalStopReasonPattern = /const finalStopReason = toolCalls\.length > 0 \? 'tool_use' : stopReason;/;
      if (finalStopReasonPattern.test(modifiedContent)) {
        modifiedContent = modifiedContent.replace(finalStopReasonPattern, completeResponseFix);
      }

      if (modifiedContent !== content) {
        fs.writeFileSync(filePath, modifiedContent);
        this.fixes.push({
          file: filePath,
          type: 'sdk_client_finish_reason',
          description: '修复SDK Client的finish_reason映射'
        });
        console.log('   ✅ 已修复: sdk-client.ts');
      } else {
        console.log('   ⏭️  跳过: sdk-client.ts (无需修改)');
      }

    } catch (error) {
      console.error(`   ❌ 修复失败: ${error.message}`);
    }
  }

  /**
   * 修复OpenAI Transformer的finish_reason处理
   */
  async fixOpenAITransformerFinishReason() {
    console.log('\n🔧 修复OpenAI Transformer finish_reason处理...');
    
    const filePath = 'src/transformers/openai.ts';
    if (!fs.existsSync(filePath)) {
      console.log('   ⏭️  跳过: openai.ts 不存在');
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      this.createBackup(filePath, content);
      
      let modifiedContent = content;

      // 1. 添加finish_reason修正方法
      const finishReasonCorrectionMethod = `
  /**
   * 修正OpenAI响应的finish_reason
   */
  private correctFinishReason(response: any): any {
    const choice = response.choices?.[0];
    if (!choice) return response;

    const originalFinishReason = choice.finish_reason;
    const hasToolCalls = choice.message?.tool_calls?.length > 0;

    // 如果有工具调用但finish_reason不是tool_calls，进行修正
    if (hasToolCalls && originalFinishReason !== 'tool_calls') {
      choice.finish_reason = 'tool_calls';
      
      logger.debug('OpenAI Transformer corrected finish_reason', {
        originalFinishReason,
        correctedFinishReason: 'tool_calls',
        hasToolCalls,
        toolCallsCount: choice.message.tool_calls.length
      });
    }

    return response;
  }`;

      // 2. 在类中添加修正方法
      if (!modifiedContent.includes('correctFinishReason')) {
        const classEndPattern = /(\s+)(\}\s*$)/;
        modifiedContent = modifiedContent.replace(classEndPattern, 
          `$1${finishReasonCorrectionMethod}\n$1$2`
        );
      }

      // 3. 在transformResponseToUnified中应用修正
      const responseTransformFix = `
    // 🔧 Critical Fix: 修正finish_reason
    response = this.correctFinishReason(response);`;

      const transformResponsePattern = /(transformResponseToUnified\(response: any\): UnifiedResponse \{[\s\S]*?)(const choice = response\.choices\?\.\[0\];)/;
      if (transformResponsePattern.test(modifiedContent)) {
        modifiedContent = modifiedContent.replace(transformResponsePattern, 
          `$1${responseTransformFix}\n    $2`
        );
      }

      // 4. 修复流式chunk的finish_reason处理
      const streamChunkFix = `
  /**
   * Convert OpenAI streaming chunk to unified format
   * 🔧 修复finish_reason映射，确保工具调用正确处理
   */
  transformStreamChunk(chunk: any): StreamChunk | null {
    if (!chunk.choices?.[0]) {
      return null;
    }

    const choice = chunk.choices[0];
    
    // 🔧 修正finish_reason：如果有工具调用但finish_reason是stop，修正为tool_calls
    if (choice.finish_reason === 'stop' && choice.delta?.tool_calls?.length > 0) {
      choice.finish_reason = 'tool_calls';
    }
    
    return {
      id: chunk.id,
      object: 'chat.completion.chunk',
      created: chunk.created || Math.floor(Date.now() / 1000),
      model: chunk.model,
      choices: [{
        index: 0,
        delta: choice.delta,
        finish_reason: choice.finish_reason // 传递修正后的finish_reason
      }]
    };
  }`;

      // 替换现有的transformStreamChunk方法
      const streamChunkPattern = /transformStreamChunk\(chunk: any\): StreamChunk \| null \{[\s\S]*?\n  \}/;
      if (streamChunkPattern.test(modifiedContent)) {
        modifiedContent = modifiedContent.replace(streamChunkPattern, streamChunkFix);
      }

      if (modifiedContent !== content) {
        fs.writeFileSync(filePath, modifiedContent);
        this.fixes.push({
          file: filePath,
          type: 'openai_transformer_finish_reason',
          description: '修复OpenAI Transformer的finish_reason处理'
        });
        console.log('   ✅ 已修复: openai.ts');
      } else {
        console.log('   ⏭️  跳过: openai.ts (无需修改)');
      }

    } catch (error) {
      console.error(`   ❌ 修复失败: ${error.message}`);
    }
  }

  /**
   * 修复流式响应的finish_reason处理
   */
  async fixStreamingFinishReason() {
    console.log('\n🔧 修复流式响应finish_reason处理...');
    
    const streamingFiles = [
      'src/transformers/streaming.ts',
      'src/patches/openai/streaming-tool-format-fix.ts'
    ];

    for (const filePath of streamingFiles) {
      if (!fs.existsSync(filePath)) {
        console.log(`   ⏭️  跳过: ${path.basename(filePath)} 不存在`);
        continue;
      }

      try {
        const content = fs.readFileSync(filePath, 'utf8');
        this.createBackup(filePath, content);
        
        let modifiedContent = content;

        // 添加流式finish_reason修正逻辑
        const streamingFinishReasonFix = `
  /**
   * 修正流式响应中的finish_reason
   */
  private correctStreamingFinishReason(chunk: any, hasToolCalls: boolean): any {
    if (!chunk.choices?.[0]) return chunk;
    
    const choice = chunk.choices[0];
    
    // 如果有工具调用但finish_reason是stop，修正为tool_calls
    if (hasToolCalls && choice.finish_reason === 'stop') {
      choice.finish_reason = 'tool_calls';
      
      logger.debug('Corrected streaming finish_reason for tool calls', {
        originalReason: 'stop',
        correctedReason: 'tool_calls',
        hasToolCalls
      });
    }
    
    return chunk;
  }`;

        // 在类中添加修正方法
        if (!modifiedContent.includes('correctStreamingFinishReason')) {
          const classEndPattern = /(\s+)(\}\s*$)/;
          modifiedContent = modifiedContent.replace(classEndPattern, 
            `$1${streamingFinishReasonFix}\n$1$2`
          );
        }

        if (modifiedContent !== content) {
          fs.writeFileSync(filePath, modifiedContent);
          this.fixes.push({
            file: filePath,
            type: 'streaming_finish_reason',
            description: `修复${path.basename(filePath)}的流式finish_reason处理`
          });
          console.log(`   ✅ 已修复: ${path.basename(filePath)}`);
        } else {
          console.log(`   ⏭️  跳过: ${path.basename(filePath)} (无需修改)`);
        }

      } catch (error) {
        console.error(`   ❌ 修复失败 ${path.basename(filePath)}: ${error.message}`);
      }
    }
  }

  /**
   * 创建OpenAI专用的finish_reason修正器
   */
  async createOpenAIFinishReasonCorrector() {
    console.log('\n🔧 创建OpenAI专用finish_reason修正器...');
    
    const correctorPath = 'src/utils/openai-finish-reason-corrector.ts';
    const correctorContent = `/**
 * OpenAI专用Finish Reason修正器
 * 专门处理OpenAI工具调用的finish_reason映射问题
 */

import { getLogger } from '../logging';

export interface OpenAIFinishReasonCorrectionResult {
  originalReason: string;
  correctedReason: string;
  wasCorreted: boolean;
  hasToolCalls: boolean;
  toolCallsCount: number;
}

export class OpenAIFinishReasonCorrector {
  private logger: ReturnType<typeof getLogger>;

  constructor(port?: number) {
    this.logger = getLogger(port);
  }

  /**
   * 修正OpenAI响应的finish_reason
   */
  correctOpenAIFinishReason(
    response: any,
    requestId: string
  ): OpenAIFinishReasonCorrectionResult {
    const choice = response.choices?.[0];
    if (!choice) {
      return {
        originalReason: 'unknown',
        correctedReason: 'unknown',
        wasCorreted: false,
        hasToolCalls: false,
        toolCallsCount: 0
      };
    }

    const originalReason = choice.finish_reason;
    const hasToolCalls = this.detectToolCallsInChoice(choice);
    const toolCallsCount = this.countToolCalls(choice);

    let correctedReason = originalReason;
    let wasCorreted = false;

    // 核心修正逻辑：如果有工具调用但finish_reason不是tool_calls，进行修正
    if (hasToolCalls && originalReason !== 'tool_calls') {
      correctedReason = 'tool_calls';
      wasCorreted = true;
      
      // 应用修正
      choice.finish_reason = correctedReason;

      this.logger.warn('OpenAI finish_reason corrected for tool calls', {
        originalReason,
        correctedReason,
        hasToolCalls,
        toolCallsCount,
        requestId
      }, requestId, 'openai-finish-reason-correction');
    }

    return {
      originalReason,
      correctedReason,
      wasCorreted,
      hasToolCalls,
      toolCallsCount
    };
  }

  /**
   * 修正流式响应的finish_reason
   */
  correctStreamingFinishReason(
    chunk: any,
    hasToolCallsInStream: boolean,
    requestId: string
  ): OpenAIFinishReasonCorrectionResult {
    const choice = chunk.choices?.[0];
    if (!choice || !choice.finish_reason) {
      return {
        originalReason: 'none',
        correctedReason: 'none',
        wasCorreted: false,
        hasToolCalls: hasToolCallsInStream,
        toolCallsCount: 0
      };
    }

    const originalReason = choice.finish_reason;
    const hasToolCallsInChunk = choice.delta?.tool_calls?.length > 0;
    const hasToolCalls = hasToolCallsInStream || hasToolCallsInChunk;

    let correctedReason = originalReason;
    let wasCorreted = false;

    // 流式修正逻辑
    if (hasToolCalls && originalReason === 'stop') {
      correctedReason = 'tool_calls';
      wasCorreted = true;
      
      // 应用修正
      choice.finish_reason = correctedReason;

      this.logger.debug('OpenAI streaming finish_reason corrected', {
        originalReason,
        correctedReason,
        hasToolCallsInStream,
        hasToolCallsInChunk,
        requestId
      }, requestId, 'openai-streaming-finish-reason-correction');
    }

    return {
      originalReason,
      correctedReason,
      wasCorreted,
      hasToolCalls,
      toolCallsCount: hasToolCallsInChunk ? choice.delta.tool_calls.length : 0
    };
  }

  /**
   * 检测choice中是否包含工具调用
   */
  private detectToolCallsInChoice(choice: any): boolean {
    // 检查message.tool_calls
    if (choice.message?.tool_calls?.length > 0) {
      return true;
    }

    // 检查delta.tool_calls（流式响应）
    if (choice.delta?.tool_calls?.length > 0) {
      return true;
    }

    // 检查文本内容中的工具调用模式
    const content = choice.message?.content || choice.delta?.content;
    if (content && typeof content === 'string') {
      return this.detectToolCallsInText(content);
    }

    return false;
  }

  /**
   * 检测文本中的工具调用模式
   */
  private detectToolCallsInText(text: string): boolean {
    const toolCallPatterns = [
      /Tool\\s+call:\\s*\\w+\\s*\\(/i,
      /\\{\\s*"type"\\s*:\\s*"tool_use"/i,
      /\\{\\s*"name"\\s*:\\s*"[^"]+",\\s*"input"\\s*:/i,
      /function_call/i,
      /\\{\\s*"id"\\s*:\\s*"call_[^"]+"/i
    ];

    return toolCallPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 计算工具调用数量
   */
  private countToolCalls(choice: any): number {
    let count = 0;

    if (choice.message?.tool_calls?.length > 0) {
      count += choice.message.tool_calls.length;
    }

    if (choice.delta?.tool_calls?.length > 0) {
      count += choice.delta.tool_calls.length;
    }

    return count;
  }

  /**
   * 批量修正多个响应
   */
  batchCorrectFinishReasons(
    responses: any[],
    requestId: string
  ): OpenAIFinishReasonCorrectionResult[] {
    return responses.map(response => 
      this.correctOpenAIFinishReason(response, requestId)
    );
  }
}

// 导出单例
export const openaiFinishReasonCorrector = new OpenAIFinishReasonCorrector();

// 便捷函数
export function correctOpenAIFinishReason(
  response: any,
  requestId: string
): OpenAIFinishReasonCorrectionResult {
  return openaiFinishReasonCorrector.correctOpenAIFinishReason(response, requestId);
}

export function correctOpenAIStreamingFinishReason(
  chunk: any,
  hasToolCallsInStream: boolean,
  requestId: string
): OpenAIFinishReasonCorrectionResult {
  return openaiFinishReasonCorrector.correctStreamingFinishReason(chunk, hasToolCallsInStream, requestId);
}`;

    try {
      fs.writeFileSync(correctorPath, correctorContent);
      this.fixes.push({
        file: correctorPath,
        type: 'openai_corrector_tool',
        description: '创建OpenAI专用finish_reason修正器'
      });
      console.log('   ✅ 已创建: openai-finish-reason-corrector.ts');
    } catch (error) {
      console.error(`   ❌ 创建失败: ${error.message}`);
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
    console.log('\n📋 OpenAI修复摘要:');
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
    
    console.log('\n🧪 验证步骤:');
    console.log('   1. 重启服务器: npm run start');
    console.log('   2. 运行测试: node scripts/test-finish-reason-correction.js');
    console.log('   3. 检查日志: node scripts/analyze-tool-call-detection-issues.js');
  }
}

// 主函数
async function main() {
  const fixer = new OpenAIFinishReasonFixer();
  await fixer.executeOpenAIFixes();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { OpenAIFinishReasonFixer };