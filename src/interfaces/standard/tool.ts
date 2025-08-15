/**
 * 标准工具数据结构接口
 * 
 * 定义工具调用和工具定义的标准格式
 * 
 * @author Jason Zhang
 */

/**
 * 工具定义接口
 */
export interface Tool {
  readonly type: 'function';
  readonly function: FunctionDefinition;
  readonly metadata?: ToolMetadata;
}

/**
 * 函数定义
 */
export interface FunctionDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: JSONSchema;
  readonly examples?: FunctionExample[];
  readonly deprecated?: boolean;
  readonly version?: string;
}

/**
 * JSON Schema接口
 */
export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  default?: any;
  examples?: any[];
}

/**
 * 函数示例
 */
export interface FunctionExample {
  name: string;
  description: string;
  input: Record<string, any>;
  output: any;
  notes?: string;
}

/**
 * 工具元数据
 */
export interface ToolMetadata {
  category?: string;
  tags?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  requiresAuth?: boolean;
  rateLimit?: RateLimit;
  cost?: CostInfo;
  availability?: AvailabilityInfo;
}

/**
 * 速率限制
 */
export interface RateLimit {
  requestsPerMinute: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  concurrentRequests?: number;
}

/**
 * 成本信息
 */
export interface CostInfo {
  basePrice: number;
  currency: string;
  unit: 'call' | 'token' | 'minute' | 'mb';
  freeQuota?: number;
}

/**
 * 可用性信息
 */
export interface AvailabilityInfo {
  status: 'available' | 'deprecated' | 'maintenance' | 'unavailable';
  regions?: string[];
  supportedProviders?: string[];
  lastChecked?: Date;
}

/**
 * 工具使用结果接口
 */
export interface ToolUseResult {
  readonly id: string;
  readonly status: 'success' | 'error' | 'timeout' | 'cancelled';
  readonly result?: any;
  readonly error?: ToolError;
  readonly metadata: ToolUseMetadata;
}

/**
 * 工具错误
 */
export interface ToolError {
  code: string;
  message: string;
  details?: Record<string, any>;
  recoverable: boolean;
  suggestions?: string[];
}

/**
 * 工具使用元数据
 */
export interface ToolUseMetadata {
  executionTime: number;
  startTime: Date;
  endTime: Date;
  retryCount: number;
  resourceUsage?: ResourceUsage;
  traceId?: string;
}

/**
 * 资源使用情况
 */
export interface ResourceUsage {
  cpuTime?: number;
  memoryUsed?: number;
  networkRequests?: number;
  storageAccessed?: number;
}

/**
 * 工具执行器接口
 */
export interface ToolExecutor {
  /**
   * 执行工具
   */
  execute(tool: Tool, input: Record<string, any>, context?: ToolExecutionContext): Promise<ToolUseResult>;
  
  /**
   * 验证工具输入
   */
  validateInput(tool: Tool, input: Record<string, any>): ValidationResult;
  
  /**
   * 获取工具状态
   */
  getToolStatus(toolName: string): AvailabilityInfo;
  
  /**
   * 列出可用工具
   */
  listAvailableTools(): Tool[];
  
  /**
   * 取消工具执行
   */
  cancelExecution(executionId: string): Promise<boolean>;
}

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
  retryPolicy?: RetryPolicy;
  environmentVariables?: Record<string, string>;
}

/**
 * 重试策略
 */
export interface RetryPolicy {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
  retryableErrors?: string[];
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * 验证错误
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

/**
 * 工具注册表接口
 */
export interface ToolRegistry {
  /**
   * 注册工具
   */
  register(tool: Tool): void;
  
  /**
   * 注销工具
   */
  unregister(toolName: string): void;
  
  /**
   * 获取工具
   */
  getTool(toolName: string): Tool | null;
  
  /**
   * 列出所有工具
   */
  listTools(): Tool[];
  
  /**
   * 搜索工具
   */
  searchTools(query: string): Tool[];
  
  /**
   * 验证工具定义
   */
  validateTool(tool: Tool): ValidationResult;
}

/**
 * 可变的工具接口（用于构建器）
 */
interface MutableTool {
  type: 'function';
  function: MutableFunctionDefinition;
  metadata?: ToolMetadata;
}

/**
 * 可变的函数定义接口
 */
interface MutableFunctionDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  examples?: FunctionExample[];
  deprecated?: boolean;
  version?: string;
}

/**
 * 工具构建器
 */
export class ToolBuilder {
  private tool: Partial<MutableTool> = {};
  
  constructor() {
    this.tool = {
      type: 'function',
      function: {
        name: '',
        description: '',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    };
  }
  
  /**
   * 设置函数名称
   */
  setName(name: string): this {
    if (!this.tool.function) {
      this.tool.function = { name: '', description: '', parameters: { type: 'object' } };
    }
    this.tool.function.name = name;
    return this;
  }
  
  /**
   * 设置函数描述
   */
  setDescription(description: string): this {
    if (!this.tool.function) {
      this.tool.function = { name: '', description: '', parameters: { type: 'object' } };
    }
    this.tool.function.description = description;
    return this;
  }
  
  /**
   * 添加参数
   */
  addParameter(name: string, schema: JSONSchema, required: boolean = false): this {
    if (!this.tool.function) {
      this.tool.function = { name: '', description: '', parameters: { type: 'object' } };
    }
    if (!this.tool.function.parameters.properties) {
      this.tool.function.parameters.properties = {};
    }
    
    this.tool.function.parameters.properties[name] = schema;
    
    if (required) {
      if (!this.tool.function.parameters.required) {
        this.tool.function.parameters.required = [];
      }
      this.tool.function.parameters.required.push(name);
    }
    
    return this;
  }
  
  /**
   * 设置参数模式
   */
  setParameterSchema(schema: JSONSchema): this {
    if (!this.tool.function) {
      this.tool.function = { name: '', description: '', parameters: { type: 'object' } };
    }
    this.tool.function.parameters = schema;
    return this;
  }
  
  /**
   * 添加示例
   */
  addExample(example: FunctionExample): this {
    if (!this.tool.function) {
      this.tool.function = { name: '', description: '', parameters: { type: 'object' } };
    }
    if (!this.tool.function.examples) {
      this.tool.function.examples = [];
    }
    this.tool.function.examples.push(example);
    return this;
  }
  
  /**
   * 设置元数据
   */
  setMetadata(metadata: ToolMetadata): this {
    this.tool.metadata = metadata;
    return this;
  }
  
  /**
   * 设置风险级别
   */
  setRiskLevel(level: 'low' | 'medium' | 'high'): this {
    if (!this.tool.metadata) {
      this.tool.metadata = {};
    }
    this.tool.metadata.riskLevel = level;
    return this;
  }
  
  /**
   * 添加标签
   */
  addTag(tag: string): this {
    if (!this.tool.metadata) {
      this.tool.metadata = {};
    }
    if (!this.tool.metadata.tags) {
      this.tool.metadata.tags = [];
    }
    this.tool.metadata.tags.push(tag);
    return this;
  }
  
  /**
   * 构建工具
   */
  build(): Tool {
    if (!this.tool.function?.name || !this.tool.function?.description) {
      throw new Error('Missing required fields in Tool');
    }
    
    return this.tool as Tool;
  }
  
  /**
   * 从OpenAI格式创建
   */
  static fromOpenAI(openaiTool: any): ToolBuilder {
    const builder = new ToolBuilder();
    
    if (openaiTool.function) {
      builder
        .setName(openaiTool.function.name)
        .setDescription(openaiTool.function.description)
        .setParameterSchema(openaiTool.function.parameters);
    }
    
    return builder;
  }
  
  /**
   * 从Anthropic格式创建
   */
  static fromAnthropic(anthropicTool: any): ToolBuilder {
    const builder = new ToolBuilder();
    
    builder
      .setName(anthropicTool.name)
      .setDescription(anthropicTool.description)
      .setParameterSchema(anthropicTool.input_schema);
    
    return builder;
  }
}