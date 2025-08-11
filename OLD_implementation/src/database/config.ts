/**
 * Database Configuration
 * Configures data capture infrastructure for OpenAI provider
 */

export interface DatabaseConfig {
  enabled: boolean;
  basePath: string;
  captureRawData: boolean;
  captureTransformedData: boolean;
  captureRequests: boolean;
  captureResponses: boolean;
  includeTimestamps: boolean;
  includeMetadata: boolean;
  maxFileSizeMB: number;
  retentionDays: number;
  compressOldFiles: boolean;
}

export interface CaptureConfig {
  requestId: string;
  timestamp: string;
  provider: string;
  endpoint: string;
  model: string;
  captureRaw: boolean;
  captureTransformed: boolean;
}

export default {
  // 数据库配置
  database: {
    enabled: true,
    basePath: process.env.DATABASE_PATH || '~/.route-claude-code/database',
    captureRawData: true,
    captureTransformedData: true,
    captureRequests: true,
    captureResponses: true,
    includeTimestamps: true,
    includeMetadata: true,
    maxFileSizeMB: 100,
    retentionDays: 30,
    compressOldFiles: true
  } as DatabaseConfig,
  
  // 捕获配置
  capture: {
    // 默认启用所有捕获
    captureOpenAI: true,
    captureCodeWhisperer: true,
    captureAnthropic: true,
    
    // 捕获详细程度
    captureLevel: 'detailed', // 'minimal', 'normal', 'detailed'
    
    // 特殊捕获选项
    captureToolCalls: true,
    captureErrors: true,
    captureStreaming: true,
    captureMetadata: true,
    
    // 文件命名策略
    namingStrategy: 'timestamp-id', // 'timestamp-id', 'session-id', 'sequential'
    
    // 数据组织策略
    organizationStrategy: 'provider-date' // 'provider-date', 'session-provider', 'flat'
  },
  
  // 重放配置
  replay: {
    enabled: true,
    autoLoadCaptures: false,
    simulateTiming: false,
    validateResponses: true,
    generateReports: true
  },
  
  // 分析配置
  analysis: {
    enabled: true,
    detectPatterns: true,
    detectAnomalies: true,
    generateStatistics: true,
    autoIdentifyIssues: true,
    toolCallDetection: true
  }
} as const;
