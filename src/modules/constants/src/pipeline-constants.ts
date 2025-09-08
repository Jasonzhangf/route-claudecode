/**
 * API端点路径常量
 * 集中管理所有API端点路径，避免硬编码
 */

export const API_PATHS = {
  // OpenAI 兼容端点
  OPENAI: {
    CHAT_COMPLETIONS: '/v1/chat/completions',
    MODELS: '/v1/models',
    EMBEDDINGS: '/v1/embeddings',
    FILES: '/v1/files',
    IMAGES: '/v1/images'
  },
  
  // Anthropic 兼容端点
  ANTHROPIC: {
    MESSAGES: '/v1/messages',
    MODELS: '/v1/models'
  },
  
  // Gemini 兼容端点
  GEMINI: {
    MODELS: '/v1/models',
    GENERATE_CONTENT: '/v1beta/models/{model}:generateContent',
    STREAMING_GENERATE_CONTENT: '/v1beta/models/{model}:streamGenerateContent'
  },
  
  // 通用路径模板
  TEMPLATES: {
    MODEL_OPERATION: '/v1/models/{model}',
    CHAT_COMPLETION: '/v1/chat/completions'
  }
} as const;

/**
 * 协议基础URL常量
 * 集中管理所有服务的基础URL
 */

export const PROTOCOL_BASE_URLS = {
  OPENAI: {
    PRODUCTION: 'https://api.openai.com',
    STAGING: 'https://api.staging.openai.com',
    DEFAULT: 'https://api.openai.com'
  },
  ANTHROPIC: {
    PRODUCTION: 'https://api.anthropic.com',
    STAGING: 'https://api.staging.anthropic.com',
    DEFAULT: 'https://api.anthropic.com'
  },
  GEMINI: {
    PRODUCTION: 'https://generativelanguage.googleapis.com',
    STAGING: 'https://staging-generativelanguage.googleapis.com',
    DEFAULT: 'https://generativelanguage.googleapis.com'
  },
  
  // 本地开发环境
  LOCAL: {
    DEFAULT: 'http://localhost:1234',
    LM_STUDIO: 'http://localhost:1234',
    OLLAMA: 'http://localhost:11434',
    VLLM: 'http://localhost:8000'
  }
} as const;

/**
 * 系统路径常量
 * 多操作系统兼容的系统路径管理
 */

export const SYSTEM_PATHS = {
  // 路由ClaudeCode系统标准路径
  ROUTE_CLADEC_HOME: '.route-claudecode',
  AUTH_SUBDIR: 'auth',
  CONFIG_SUBDIR: 'config', 
  LOGS_SUBDIR: 'logs',
  TEMP_SUBDIR: 'temp',
  
  // 路径构建函数
  getHomeDir: (): string => {
    return require('os').homedir();
  },
  
  getRouteClaudeCodeHome: (): string => {
    const home = require('os').homedir();
    return process.env.ROUTE_CLADEC_HOME || require('path').join(home, SYSTEM_PATHS.ROUTE_CLADEC_HOME);
  },
  
  getAuthDir: (): string => {
    return process.env.ROUTE_CLADEC_AUTH_DIR || 
           require('path').join(SYSTEM_PATHS.getRouteClaudeCodeHome(), SYSTEM_PATHS.AUTH_SUBDIR);
  },
  
  getConfigDir: (): string => {
    return process.env.ROUTE_CLADEC_CONFIG_DIR || 
           require('path').join(SYSTEM_PATHS.getRouteClaudeCodeHome(), SYSTEM_PATHS.CONFIG_SUBDIR);
  },
  
  getLogsDir: (): string => {
    return process.env.ROUTE_CLADEC_LOGS_DIR || 
           require('path').join(SYSTEM_PATHS.getRouteClaudeCodeHome(), SYSTEM_PATHS.LOGS_SUBDIR);
  },
  
  getAuthPath: (fileName: string): string => {
    return require('path').join(SYSTEM_PATHS.getAuthDir(), `${fileName}.json`);
  },
  
  getConfigPath: (fileName: string): string => {
    return require('path').join(SYSTEM_PATHS.getConfigDir(), `${fileName}.json`);
  }
} as const;

/**
 * 环境变量常量
 * 标准化环境变量名称
 */

export const ENV_VARS = {
  ROUTE_CLADEC_HOME: 'ROUTE_CLADEC_CODE_HOME',
  ROUTE_CLADEC_AUTH_DIR: 'ROUTE_CLAUDECODE_AUTH_DIR', 
  ROUTE_CLADEC_CONFIG_DIR: 'ROUTE_CLAUDECODE_CONFIG_DIR',
  ROUTE_CLADEC_LOGS_DIR: 'ROUTE_CLAUDECODE_LOGS_DIR',
  ROUTE_CLADEC_TEMP_DIR: 'ROUTE_CLAUDECODE_TEMP_DIR'
} as const;

/**
 * 文件格式常量
 * 标准化文件扩展名管理
 */

export const FILE_FORMATS = {
  // 配置文件格式
  CONFIG: {
    JSON: '.json',
    YAML: '.yaml',
    YML: '.yml',
    JS: '.js'
  },
  
  // 源代码文件格式
  SOURCE: {
    TYPESCRIPT: '.ts',
    JAVASCRIPT: '.js',
    DECLARATION: '.d.ts',
    MAP: '.map'
  },
  
  // 文档文件格式
  DOCUMENTATION: {
    MARKDOWN: '.md',
    README: 'README.md',
    LICENSE: 'LICENSE'
  },
  
  // 模型文件格式
  MODEL: {
    ONNX: '.onnx',
    H5: '.h5',
    PT: '.pt',
    PTH: '.pth'
  }
} as const;

/**
 * 错误消息常量扩展
 * 流水线模块专用错误消息
 */

export const PIPELINE_ERROR_MESSAGES = {
  VALIDATION: {
    MISSING_PARAMETER: (param: string) => `缺少${param}参数`,
    INVALID_MESSAGES: 'messages参数或格式无效',
    MODEL_NOT_SUPPORTED: (model: string, supportedList: string) => 
      `模型 ${model} 不在支持列表中: ${supportedList}`,
    EMPTY_MESSAGES: '所有消息都无效或为空，无法处理请求',
    INVALID_INPUT: '无效的输入数据'
  },
  INITIALIZATION: {
    MODULE_NOT_INITIALIZED: (module: string) => `${module}兼容模块未初始化`,
    NO_MODELS_AVAILABLE: (provider: string) => `${provider}没有可用模型`,
    CONNECTION_TEST_FAILED: (provider: string) => `${provider}连接测试失败`
  },
  PROCESSING: {
    STREAMING_NOT_IMPLEMENTED: '流式处理暂未实现',
    HEALTH_CHECK_FAILED: (provider: string, error: string) => 
      `${provider}健康检查失败: ${error}`,
    CONNECTION_TEST_FAILED: (provider: string, error: string) => 
      `${provider}连接测试失败: ${error}`
  },
  API_ERRORS: {
    API_ERROR: (provider: string, error: string) => `${provider} API错误: ${error}`,
    CONNECTION_ERROR: (provider: string, error: string) => `${provider}连接错误: ${error}`,
    TIMEOUT_ERROR: (provider: string, error: string) => `${provider}请求超时: ${error}`,
    UNKNOWN_ERROR: (provider: string, error: string) => `${provider}未知错误: ${error}`,
    AUTHENTICATION_FAILED: (provider: string) => `${provider}认证失败`,
    AUTHORIZATION_FAILED: (provider: string) => `${provider}授权失败`
  },
  FILE_SYSTEM: {
    AUTH_FILE_NOT_FOUND: (filePath: string) => `认证文件未找到: ${filePath}`,
    AUTH_FILE_READ_ERROR: (filePath: string) => `认证文件读取失败: ${filePath}`,
    AUTH_FILE_INVALID_FORMAT: (filePath: string) => `认证文件格式无效: ${filePath}`,
    DIRECTORY_CREATE_FAILED: (dirPath: string) => `目录创建失败: ${dirPath}`
  }
} as const;

/**
 * 模型限制常量
 * 集中管理所有模型的token限制
 */

export const MODEL_LIMITS = {
  OPENAI: {
    'gpt-4': { maxTokens: 8192, maxRequestTokens: 6000 },
    'gpt-4-turbo': { maxTokens: 128000, maxRequestTokens: 100000 },
    'gpt-3.5-turbo': { maxTokens: 16384, maxRequestTokens: 12000 },
    'gpt-4o': { maxTokens: 128000, maxRequestTokens: 100000 },
    'gpt-4o-mini': { maxTokens: 128000, maxRequestTokens: 100000 },
  },
  
  LMSTUDIO: {
    DEFAULT: { maxTokens: 8192, maxRequestTokens: 6000 },
    LLAMA_3_1_8B: { maxTokens: 8192, maxRequestTokens: 6000 },
    LLAMA_3_1_70B: { maxTokens: 32768, maxRequestTokens: 28000 },
    MIXTRAL_8X7B: { maxTokens: 32768, maxRequestTokens: 28000 }
  },
  
  ANTHROPIC: {
    'claude-3-5-sonnet-20241022': { maxTokens: 200000, maxRequestTokens: 180000 },
    'claude-3-haiku-20240307': { maxTokens: 200000, maxRequestTokens: 180000 },
    'claude-3-sonnet-20240229': { maxTokens: 200000, maxRequestTokens: 180000 },
    'claude-3-opus-20240229': { maxTokens: 200000, maxRequestTokens: 180000 }
  },
  
  GEMINI: {
    'gemini-pro': { maxTokens: 32768, maxRequestTokens: 28000 },
    'gemini-pro-vision': { maxTokens: 16384, maxRequestTokens: 12000 },
    'gemini-1.5-pro': { maxTokens: 2097152, maxRequestTokens: 1000000 },
    'gemini-1.5-flash': { maxTokens: 1048576, maxRequestTokens: 500000 }
  },
  
  FALLBACK: {
    DEFAULT: { maxTokens: 8192, maxRequestTokens: 6000 },
    SMALL: { maxTokens: 4096, maxRequestTokens: 3000 },
    LARGE: { maxTokens: 128000, maxRequestTokens: 100000 }
  }
} as const;

/**
 * 获取模型限制的助手函数
 */
export const getModelLimits = (modelName: string, provider: string = 'OPENAI'): 
  { maxTokens: number; maxRequestTokens: number } => {
  
  // 尝试从指定provider获取限制
  const providerLimits = MODEL_LIMITS[provider as keyof typeof MODEL_LIMITS];
  if (providerLimits && providerLimits[modelName as keyof typeof providerLimits]) {
    return providerLimits[modelName as keyof typeof providerLimits];
  }
  
  // 尝试从OpenAI获取限制
  const openaiLimits = MODEL_LIMITS.OPENAI[modelName as keyof typeof MODEL_LIMITS.OPENAI];
  if (openaiLimits) {
    return openaiLimits;
  }
  
  // 返回默认限制
  return MODEL_LIMITS.FALLBACK.DEFAULT;
};

/**
 * 模块路径常量
 * 集中管理模块导入路径
 */

export const MODULE_PATHS = {
  // 核心模块路径
  CORE: {
    PIPELINE: '../../pipeline/src',
    INTERFACES: '../../interfaces',
    TYPES: '../../types/src',
    CONSTANTS: '../../constants/src',
    UTILS: '../../utils'
  },
  
  // 功能模块路径
  FUNCTIONAL: {
    ERROR_HANDLER: '../../error-handler/src',
    CONFIG: '../../config'
  },
  
  // 子模块完整路径
  SUBMODULES: {
    PIPELINE_INTERFACE: '../../pipeline/src/module-interface',
    FOUR_LAYER_INTERFACES: '../../interfaces/module/four-layer-interfaces',
    ERROR_COORDINATION_CENTER: '../../interfaces/core/error-coordination-center',
    ENHANCED_ERROR_HANDLER: '../../error-handler/src/enhanced-error-handler',
    UNIFIED_ERROR_HANDLER: '../../error-handler/src/unified-error-handler-impl',
    UNIFIED_ERROR_HANDLER_INTERFACE: '../../error-handler/src/unified-error-handler-interface',
    SECURE_LOGGER: '../../error-handler/src/utils/secure-logger'
  },
  
  // 工具模块路径
  UTILS: {
    JQ_JSON_HANDLER: '../../utils/jq-json-handler'
  },
  
  // 路径获取函数
  getModulePath: (moduleKey: string): string => {
    const allPaths = {
      ...MODULE_PATHS.CORE,
      ...MODULE_PATHS.FUNCTIONAL,
      ...MODULE_PATHS.SUBMODULES,
      ...MODULE_PATHS.UTILS
    };
    return allPaths[moduleKey as keyof typeof allPaths] || moduleKey;
  }
} as const;

/**
 * 协议默认值常量
 * 集中管理协议相关的默认配置值
 */

export const PROTOCOL_DEFAULTS = {
  REQUEST_TIMEOUT_MS: 30000,
  CONNECTION_TIMEOUT_MS: 10000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  MILLISECONDS_PER_SECOND: 1000,
  MAX_CONCURRENT_REQUESTS: 10,
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 4096,
  DEFAULT_TOP_P: 1.0,
  DEFAULT_FREQUENCY_PENALTY: 0.0,
  DEFAULT_PRESENCE_PENALTY: 0.0
} as const;

/**
 * 用户代理常量
 * 标准化HTTP请求的User-Agent
 */

export const USER_AGENTS = {
  GOOGLE_API_NODEJS: 'google-api-nodejs-client/9.15.1',
  GL_NODE: 'gl-node/22.17.0',
  DEFAULT_OPENAI: 'OpenAI/NodeJS',
  DEFAULT_BROWSER: 'Mozilla/5.0 (compatible; RCC/4.0)'
} as const;

/**
 * 路径管理工具类
 * 提供跨平台路径操作工具
 */

export class PathManager {
  
  /**
   * 获取用户主目录
   */
  static getHomeDir(): string {
    return require('os').homedir();
  }
  
  /**
   * 获取路由ClaudeCode主目录
   */
  static getRouteClaudeCodeHome(): string {
    return process.env[ENV_VARS.ROUTE_CLADEC_HOME] || 
           require('path').join(this.getHomeDir(), SYSTEM_PATHS.ROUTE_CLADEC_HOME);
  }
  
  /**
   * 获取认证文件目录
   */
  static getAuthDir(): string {
    return process.env[ENV_VARS.ROUTE_CLADEC_AUTH_DIR] || 
           require('path').join(this.getRouteClaudeCodeHome(), SYSTEM_PATHS.AUTH_SUBDIR);
  }
  
  /**
   * 获取认证文件完整路径
   */
  static getAuthPath(fileName: string): string {
    return require('path').join(this.getAuthDir(), `${fileName}.json`);
  }
  
  /**
   * 获取配置文件目录
   */
  static getConfigDir(): string {
    return process.env[ENV_VARS.ROUTE_CLADEC_CONFIG_DIR] || 
           require('path').join(this.getRouteClaudeCodeHome(), SYSTEM_PATHS.CONFIG_SUBDIR);
  }
  
  /**
   * 获取配置文件完整路径
   */
  static getConfigPath(fileName: string): string {
    return require('path').join(this.getConfigDir(), `${fileName}.json`);
  }
  
  /**
   * 获取日志文件目录
   */
  static getLogsDir(): string {
    return process.env[ENV_VARS.ROUTE_CLADEC_LOGS_DIR] || 
           require('path').join(this.getRouteClaudeCodeHome(), SYSTEM_PATHS.LOGS_SUBDIR);
  }
  
  /**
   * 确保目录存在，不存在则创建
   */
  static ensureDirExists(dirPath: string): void {
    const fs = require('fs');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
  
  /**
   * 检查文件是否存在
   */
  static fileExists(filePath: string): boolean {
    try {
      const fs = require('fs');
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 安全读取文件
   */
  static safeReadFile(filePath: string): string | null {
    try {
      const fs = require('fs');
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      return null;
    }
  }
  
  /**
   * 安全写入文件
   */
  static safeWriteFile(filePath: string, content: string): boolean {
    try {
      const fs = require('fs');
      // 确保目录存在
      this.ensureDirExists(require('path').dirname(filePath));
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * 导出所有常量
 */
export const PIPELINE_CONSTANTS = {
  API_PATHS,
  PROTOCOL_BASE_URLS,
  SYSTEM_PATHS,
  ENV_VARS,
  FILE_FORMATS,
  PIPELINE_ERROR_MESSAGES,
  MODEL_LIMITS,
  MODULE_PATHS,
  PROTOCOL_DEFAULTS,
  USER_AGENTS,
  PathManager,
  getModelLimits
};