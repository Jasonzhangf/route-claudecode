/**
 * Claude Code请求和响应的严格数据模式定义
 *
 * 提供完整的输入输出验证标准，确保数据完整性
 *
 * @author RCC Client Module
 * @version 4.0.0
 */

// ValidationSchema type - define locally or import from middleware
export interface ValidationSchema {
  [key: string]: any; // 允许任意属性
}

/**
 * Claude Code请求消息内容类型
 */
export interface ClaudeMessageContent {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

/**
 * Claude Code请求消息
 */
export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ClaudeMessageContent[];
}

/**
 * Claude Code工具定义
 */
export interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Claude Code完整请求结构
 */
export interface ClaudeCodeRequest {
  model: string;
  max_tokens: number;
  messages: ClaudeMessage[];
  system?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  tools?: ClaudeToolDefinition[];
  tool_choice?: {
    type: 'auto' | 'any' | 'tool';
    name?: string;
  };
  metadata?: {
    user_id?: string;
    conversation_id?: string;
    request_id?: string;
  };
}

/**
 * Claude Code工具使用
 */
export interface ClaudeToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

/**
 * Claude Code响应内容
 */
export interface ClaudeResponseContent {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, any>;
}

/**
 * Claude Code完整响应结构
 */
export interface ClaudeCodeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ClaudeResponseContent[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * 客户端输入验证错误详情
 */
export interface ClientInputValidationError {
  module: 'client.input.validation';
  field: string;
  expected: string;
  actual: string;
  value: any;
  path: string;
  message: string;
  code: string;
  timestamp: number;
}

/**
 * 客户端输出验证错误详情
 */
export interface ClientOutputValidationError {
  module: 'client.output.validation';
  field: string;
  expected: string;
  actual: string;
  value: any;
  path: string;
  message: string;
  code: string;
  timestamp: number;
}

/**
 * Claude Code请求验证模式
 */
export const CLAUDE_CODE_REQUEST_SCHEMA: ValidationSchema = {
  model: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\-._]+$/,
  },
  max_tokens: {
    type: 'number',
    required: true,
    enum: [1, 4096, 8192, 16384, 32768, 65536, 100000, 200000],
  },
  messages: {
    type: 'array',
    required: true,
    minItems: 1,
    maxItems: 100,
    properties: {
      role: {
        type: 'string',
        required: true,
        enum: ['user', 'assistant', 'system'],
      },
      content: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 500000,
      },
    },
  },
  system: {
    type: 'string',
    required: false,
    minLength: 1,
    maxLength: 100000,
  },
  temperature: {
    type: 'number',
    required: false,
    enum: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  },
  top_p: {
    type: 'number',
    required: false,
    enum: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  },
  top_k: {
    type: 'number',
    required: false,
  },
  stop_sequences: {
    type: 'array',
    required: false,
    minItems: 0,
    maxItems: 4,
    properties: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
    },
  },
  stream: {
    type: 'boolean',
    required: false,
  },
  tools: {
    type: 'array',
    required: false,
    minItems: 0,
    maxItems: 20,
    properties: {
      name: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 64,
        pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
      },
      description: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 1024,
      },
      input_schema: {
        type: 'object',
        required: true,
      },
    },
  },
  tool_choice: {
    type: 'object',
    required: false,
    properties: {
      type: {
        type: 'string',
        required: true,
        enum: ['auto', 'any', 'tool'],
      },
      name: {
        type: 'string',
        required: false,
        minLength: 1,
        maxLength: 64,
      },
    },
  },
  metadata: {
    type: 'object',
    required: false,
    properties: {
      user_id: {
        type: 'string',
        required: false,
        minLength: 1,
        maxLength: 256,
      },
      conversation_id: {
        type: 'string',
        required: false,
        minLength: 1,
        maxLength: 256,
      },
      request_id: {
        type: 'string',
        required: false,
        minLength: 1,
        maxLength: 256,
      },
    },
  },
};

/**
 * Claude Code响应验证模式
 */
export const CLAUDE_CODE_RESPONSE_SCHEMA: ValidationSchema = {
  id: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 256,
    pattern: /^[a-zA-Z0-9\-_]+$/,
  },
  type: {
    type: 'string' as const,
    required: true,
    enum: ['message'],
  },
  role: {
    type: 'string',
    required: true,
    enum: ['assistant'],
  },
  content: {
    type: 'array',
    required: true,
    minItems: 1,
    maxItems: 50,
    properties: {
      type: {
        type: 'string',
        required: true,
        enum: ['text', 'tool_use'],
      },
      text: {
        type: 'string',
        required: false,
        minLength: 0,
        maxLength: 1000000,
      },
      id: {
        type: 'string',
        required: false,
        minLength: 1,
        maxLength: 256,
      },
      name: {
        type: 'string',
        required: false,
        minLength: 1,
        maxLength: 64,
      },
      input: {
        type: 'object',
        required: false,
      },
    },
  },
  model: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  stop_reason: {
    type: 'string',
    required: true,
    enum: ['end_turn', 'max_tokens', 'stop_sequence', 'tool_use'],
  },
  stop_sequence: {
    type: 'string',
    required: false,
    minLength: 1,
    maxLength: 100,
  },
  usage: {
    type: 'object',
    required: true,
    properties: {
      input_tokens: {
        type: 'number',
        required: true,
      },
      output_tokens: {
        type: 'number',
        required: true,
      },
    },
  },
};

/**
 * 客户端配置验证模式
 */
export const CLIENT_CONFIG_SCHEMA: ValidationSchema = {
  serverHost: {
    type: 'string',
    required: false,
    pattern: /^[a-zA-Z0-9\-._]+$/,
    minLength: 1,
    maxLength: 255,
  },
  serverPort: {
    type: 'number',
    required: false,
    enum: Array.from({ length: 65536 }, (_, i) => i),
  },
  transparent: {
    type: 'boolean',
    required: false,
  },
  timeout: {
    type: 'number',
    required: false,
  },
  retries: {
    type: 'number',
    required: false,
  },
  debug: {
    type: 'boolean',
    required: false,
  },
};

/**
 * Debug数据记录模式
 */
export const DEBUG_RECORD_SCHEMA: ValidationSchema = {
  timestamp: {
    type: 'string',
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  },
  port: {
    type: 'number',
    required: true,
  },
  requestId: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 256,
  },
  input: {
    type: 'object',
    required: true,
  },
  output: {
    type: 'object',
    required: false,
  },
  processingTime: {
    type: 'number',
    required: false,
  },
  error: {
    type: 'object',
    required: false,
  },
};
