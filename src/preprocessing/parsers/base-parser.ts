/**
 * 基础格式解析器接口
 * 遵循零硬编码、零Fallback、零沉默失败原则
 */

export interface ParseResult {
  hasTools: boolean;
  toolCount: number;
  toolCalls: ToolCall[];
  finishReason?: string;
  confidence: number; // 0-1, 检测置信度
}

export interface ToolCall {
  id: string;
  name: string;
  input: any;
  type: 'tool_use' | 'function_call';
}

export interface ParsingContext {
  provider: string;
  requestId: string;
  stage: 'request' | 'response';
  format: 'anthropic' | 'openai' | 'gemini';
}

/**
 * 基础格式解析器抽象类
 * 所有格式解析器必须继承此类
 */
export abstract class BaseFormatParser {
  protected readonly parserName: string;
  
  constructor(parserName: string) {
    this.parserName = parserName;
    
    if (!parserName) {
      throw new Error('Parser name is required - violates zero hardcoding principle');
    }
  }

  /**
   * 检测数据是否符合此解析器的格式
   * 必须实现，不允许fallback
   */
  abstract canParse(data: any, context: ParsingContext): boolean;

  /**
   * 解析工具调用
   * 必须实现，不允许静默失败
   */
  abstract parseToolCalls(data: any, context: ParsingContext): ParseResult;

  /**
   * 获取finish reason
   * 必须实现，不允许fallback
   */
  abstract getFinishReason(data: any, context: ParsingContext): string | undefined;

  /**
   * 修复finish reason
   * 必须实现，不允许静默失败
   */
  abstract fixFinishReason(data: any, targetReason: string, context: ParsingContext): any;

  /**
   * 验证解析结果
   * 防止静默失败
   */
  protected validateParseResult(result: ParseResult, context: ParsingContext): void {
    if (!result) {
      throw new Error(`${this.parserName} parser returned null result - silent failure detected`);
    }

    if (typeof result.hasTools !== 'boolean') {
      throw new Error(`${this.parserName} parser returned invalid hasTools - must be boolean`);
    }

    if (typeof result.toolCount !== 'number' || result.toolCount < 0) {
      throw new Error(`${this.parserName} parser returned invalid toolCount - must be non-negative number`);
    }

    if (!Array.isArray(result.toolCalls)) {
      throw new Error(`${this.parserName} parser returned invalid toolCalls - must be array`);
    }

    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      throw new Error(`${this.parserName} parser returned invalid confidence - must be 0-1`);
    }

    // 验证工具调用数量一致性
    if (result.hasTools && result.toolCount === 0) {
      throw new Error(`${this.parserName} parser inconsistency - hasTools=true but toolCount=0`);
    }

    if (!result.hasTools && result.toolCount > 0) {
      throw new Error(`${this.parserName} parser inconsistency - hasTools=false but toolCount>0`);
    }

    if (result.toolCount !== result.toolCalls.length) {
      throw new Error(`${this.parserName} parser inconsistency - toolCount=${result.toolCount} but toolCalls.length=${result.toolCalls.length}`);
    }
  }

  /**
   * 验证工具调用对象
   */
  protected validateToolCall(toolCall: ToolCall, context: ParsingContext): void {
    if (!toolCall) {
      throw new Error(`${this.parserName} parser returned null tool call`);
    }

    if (!toolCall.id) {
      throw new Error(`${this.parserName} parser returned tool call without id - violates zero fallback principle`);
    }

    if (!toolCall.name) {
      throw new Error(`${this.parserName} parser returned tool call without name - violates zero fallback principle`);
    }

    if (!toolCall.type || (toolCall.type !== 'tool_use' && toolCall.type !== 'function_call')) {
      throw new Error(`${this.parserName} parser returned invalid tool call type - must be 'tool_use' or 'function_call'`);
    }

    // 检查fallback值
    if (toolCall.id === 'unknown' || toolCall.id === 'default') {
      throw new Error(`${this.parserName} parser returned fallback tool call id: ${toolCall.id} - violates zero fallback principle`);
    }

    if (toolCall.name === 'unknown' || toolCall.name === 'default') {
      throw new Error(`${this.parserName} parser returned fallback tool call name: ${toolCall.name} - violates zero fallback principle`);
    }
  }

  /**
   * 记录解析日志
   */
  protected logParseResult(result: ParseResult, context: ParsingContext): void {
    console.log(`🔍 [${this.parserName.toUpperCase()}] Parse result:`, {
      hasTools: result.hasTools,
      toolCount: result.toolCount,
      confidence: result.confidence,
      finishReason: result.finishReason,
      provider: context.provider,
      requestId: context.requestId
    });

    if (result.hasTools && result.toolCalls.length > 0) {
      console.log(`🔧 [${this.parserName.toUpperCase()}] Tool calls detected:`, 
        result.toolCalls.map(tc => ({ id: tc.id, name: tc.name, type: tc.type }))
      );
    }
  }
}