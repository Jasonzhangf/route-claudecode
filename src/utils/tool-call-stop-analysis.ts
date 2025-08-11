/**
 * 工具调用停止逻辑分析
 * 分析工具调用后返回结果时导致对话停止的问题
 */

import { logger } from '@/utils/logger';

export class ToolCallStopAnalysis {
  /**
   * 分析工具调用停止问题的根本原因
   */
  static analyzeToolCallStopIssues(): {
    problems: string[];
    solutions: string[];
    codeLocations: string[];
  } {
    const problems = [
      '1. 工具调用finish_reason映射错误：OpenAI的"tool_calls"应该映射为"tool_use"，但可能在某些场景下被错误映射为"end_turn"',
      '2. message_stop事件发送时机错误：工具调用后不应该发送message_stop，但可能在某些分支中错误发送',
      '3. 流式处理和非流式处理不一致：enhanced-client和client处理工具调用的逻辑不同步',
      '4. 工具调用结果返回时的状态推断错误：当工具调用结果返回时，系统可能错误推断为对话结束',
      '5. transformer层保留finish_reason导致下游处理冲突：修复后transformer不再移除finish_reason，可能与客户端处理冲突'
    ];

    const solutions = [
      '1. 统一工具调用finish_reason映射：确保所有"tool_calls"和"function_call"都正确映射为"tool_use"',
      '2. 严格禁止工具调用场景发送message_stop：工具调用只能发送message_delta，不能发送message_stop',
      '3. 同步流式和非流式处理逻辑：确保enhanced-client和client对工具调用的处理完全一致',
      '4. 添加工具调用状态检测：在处理工具调用结果时，明确识别这是工具结果而不是对话结束',
      '5. 添加调试日志：在工具调用处理的关键节点添加详细日志，便于追踪问题'
    ];

    const codeLocations = [
      'enhanced-client.ts:620-681 - 智能缓存流处理中的工具调用finish_reason处理',
      'enhanced-client.ts:674-679 - message_stop发送条件判断',
      'client.ts:175-184 - 基础客户端的finish_reason捕获',
      'streaming.ts:275-315 - 流式转换器的工具调用处理',
      'finish-reason-handler.ts:160-194 - 统一处理器的智能推断逻辑'
    ];

    return { problems, solutions, codeLocations };
  }

  /**
   * 检查具体的代码逻辑问题
   */
  static checkCodeLogicIssues(): {
    criticalIssues: string[];
    riskAreas: string[];
  } {
    const criticalIssues = [
      'enhanced-client.ts:674行的条件判断：if (mappedStopReason !== "tool_use") 这个逻辑在工具调用场景下可能有问题',
      'enhanced-client.ts:622行的shouldIncludeStopReason条件：只检查了特定的finish_reason，可能遗漏其他情况',
      'streaming.ts:275行的hasToolCalls判断：基于toolCallMap.size，但可能在某些情况下不准确'
    ];

    const riskAreas = [
      '工具调用的finish_reason推断逻辑：当没有明确finish_reason时，智能推断可能出错',
      'message_delta和message_stop的发送时机：在工具调用场景下时机选择不当',
      '多轮对话的状态管理：工具调用后的对话状态可能不正确'
    ];

    return { criticalIssues, riskAreas };
  }
}

export default ToolCallStopAnalysis;