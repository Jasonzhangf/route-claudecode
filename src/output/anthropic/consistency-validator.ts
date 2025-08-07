/**
 * Finish Reason一致性验证器
 * 在输出前进行最终的finish reason与工具调用一致性检查和修复
 */

import { getLogger } from '../../logging';
import { AnthropicResponse } from '../../types';

interface ValidationResult {
  consistent: boolean;
  fixed: boolean;
  originalStopReason: string;
  finalStopReason: string;
  toolCount: number;
  issues: string[];
}

export class FinishReasonConsistencyValidator {
  private logger: ReturnType<typeof getLogger>;

  constructor(port?: number) {
    this.logger = getLogger(port);
  }

  /**
   * 🎯 验证并修复stop_reason一致性
   * 如果有工具调用，不能是end_turn，必须是tool_use
   */
  validateAndFix(response: AnthropicResponse, requestId?: string): {
    response: AnthropicResponse;
    result: ValidationResult;
  } {
    const startTime = Date.now();
    const originalStopReason = response.stop_reason || 'unknown';
    const issues: string[] = [];

    // 1. 统计工具调用
    const toolCount = this.countToolUseBlocks(response);
    const hasTools = toolCount > 0;

    // 2. 检查一致性
    let consistent = true;
    let fixed = false;

    if (hasTools && (response.stop_reason !== 'tool_use')) {
      consistent = false;
      issues.push(`Found ${toolCount} tool(s) but stop_reason is '${response.stop_reason}', should be 'tool_use'`);
      
      // 修复：设置为tool_use
      response.stop_reason = 'tool_use';
      fixed = true;

      this.logger.warn('🔧 [CONSISTENCY] Fixed inconsistent stop_reason', {
        originalStopReason,
        fixedStopReason: 'tool_use',
        toolCount,
        requestId,
        duration: `${Date.now() - startTime}ms`
      }, requestId, 'consistency-validator');
    }

    if (!hasTools && (response.stop_reason === 'tool_use')) {
      consistent = false;
      issues.push(`No tools found but stop_reason is 'tool_use', should be 'end_turn'`);
      
      // 修复：设置为end_turn
      response.stop_reason = 'end_turn';
      fixed = true;

      this.logger.warn('🔧 [CONSISTENCY] Fixed unnecessary tool_use stop_reason', {
        originalStopReason,
        fixedStopReason: 'end_turn',
        toolCount: 0,
        requestId,
        duration: `${Date.now() - startTime}ms`
      }, requestId, 'consistency-validator');
    }

    // 3. 记录验证结果
    const result: ValidationResult = {
      consistent: consistent && !fixed,
      fixed,
      originalStopReason,
      finalStopReason: response.stop_reason || 'unknown',
      toolCount,
      issues
    };

    if (consistent && !fixed) {
      this.logger.debug('✅ [CONSISTENCY] Stop reason already consistent', {
        stopReason: response.stop_reason,
        toolCount,
        requestId,
        duration: `${Date.now() - startTime}ms`
      }, requestId, 'consistency-validator');
    }

    return { response, result };
  }

  /**
   * 统计tool_use块的数量
   */
  private countToolUseBlocks(response: AnthropicResponse): number {
    if (!response.content || !Array.isArray(response.content)) {
      this.logger.debug('🔍 [TOOL-COUNT] No content array found', {
        hasContent: !!response.content,
        isArray: Array.isArray(response.content)
      });
      return 0;
    }

    const toolBlocks = response.content.filter(block => block.type === 'tool_use');
    const textBlocks = response.content.filter(block => block.type === 'text');
    
    this.logger.debug('🔍 [TOOL-COUNT] Content analysis', {
      totalBlocks: response.content.length,
      toolBlocks: toolBlocks.length,
      textBlocks: textBlocks.length,
      blockTypes: response.content.map(b => b.type),
      textContent: textBlocks.map(b => b.text?.substring(0, 50) + '...'),
      toolNames: toolBlocks.map(b => b.name)
    });
    
    // 检查文本块中是否包含未转换的工具调用
    const textWithToolCalls = textBlocks.filter(block => 
      block.text && block.text.includes('Tool call:')
    );
    
    if (textWithToolCalls.length > 0) {
      this.logger.warn('🚨 [TOOL-COUNT] Found unconverted tool calls in text blocks', {
        unconvertedCount: textWithToolCalls.length,
        samples: textWithToolCalls.map(b => b.text?.substring(0, 100) + '...')
      });
    }

    return toolBlocks.length;
  }

  /**
   * 获取工具调用详情
   */
  getToolDetails(response: AnthropicResponse): Array<{
    id: string;
    name: string;
    hasInput: boolean;
  }> {
    if (!response.content || !Array.isArray(response.content)) {
      return [];
    }

    return response.content
      .filter(block => block.type === 'tool_use')
      .map(block => ({
        id: block.id || 'unknown',
        name: block.name || 'unknown',
        hasInput: block.input !== undefined
      }));
  }

  /**
   * 批量验证多个响应
   */
  validateBatch(responses: AnthropicResponse[], requestId?: string): {
    responses: AnthropicResponse[];
    summary: {
      total: number;
      consistent: number;
      fixed: number;
      totalTools: number;
      totalIssues: number;
    };
  } {
    const results = responses.map((response, index) => 
      this.validateAndFix(response, `${requestId}-batch-${index}`)
    );

    const summary = {
      total: responses.length,
      consistent: results.filter(r => r.result.consistent).length,
      fixed: results.filter(r => r.result.fixed).length,
      totalTools: results.reduce((sum, r) => sum + r.result.toolCount, 0),
      totalIssues: results.reduce((sum, r) => sum + r.result.issues.length, 0)
    };

    this.logger.info('📊 [CONSISTENCY] Batch validation completed', {
      ...summary,
      requestId
    }, requestId, 'consistency-validator');

    return {
      responses: results.map(r => r.response),
      summary
    };
  }

  /**
   * 检查是否需要验证
   */
  shouldValidate(response: AnthropicResponse): boolean {
    // 只验证有content且有stop_reason的响应
    return !!(
      response && 
      response.content && 
      Array.isArray(response.content) && 
      response.stop_reason
    );
  }

  /**
   * 生成验证报告
   */
  generateValidationReport(result: ValidationResult): string {
    const { consistent, fixed, originalStopReason, finalStopReason, toolCount, issues } = result;

    if (consistent && !fixed) {
      return `✅ Consistent: ${finalStopReason} with ${toolCount} tools`;
    }

    if (fixed) {
      return `🔧 Fixed: ${originalStopReason} → ${finalStopReason} (${toolCount} tools)`;
    }

    return `❌ Issues: ${issues.join('; ')}`;
  }
}

/**
 * 全局一致性验证器实例
 */
const validatorInstances = new Map<number | string, FinishReasonConsistencyValidator>();

/**
 * 获取或创建一致性验证器实例
 */
export function getConsistencyValidator(port?: number): FinishReasonConsistencyValidator {
  const key = port || 'default';
  
  if (!validatorInstances.has(key)) {
    validatorInstances.set(key, new FinishReasonConsistencyValidator(port));
  }

  return validatorInstances.get(key)!;
}

/**
 * 创建新的一致性验证器实例
 */
export function createConsistencyValidator(port?: number): FinishReasonConsistencyValidator {
  const key = port || 'default';
  const instance = new FinishReasonConsistencyValidator(port);
  validatorInstances.set(key, instance);
  return instance;
}