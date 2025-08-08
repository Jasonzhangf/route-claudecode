/**
 * Pipeline Types Definition
 * 流水线系统类型定义
 * Owner: Jason Zhang
 */

export interface PipelineStep {
  stepNumber: number;
  stepName: string;
  provider: string;
  process(input: any, context?: any): Promise<any>;
}

export interface StepDataCapture {
  stepNumber: number;
  stepName: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'codewhisperer';
  input: any;
  output: any;
  timing: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  metadata: {
    requestId: string;
    sessionId: string;
    model: string;
    category: string;
  };
  errors?: any[];
}

export interface PipelineContext {
  requestId: string;
  sessionId: string;
  userId?: string;
  clientInfo?: {
    userAgent?: string;
    ip?: string;
    host?: string;
  };
  headers?: Record<string, string>;
  startTime: number;
}

export interface PipelineFlow {
  flowId: string;
  steps: StepDataCapture[];
  totalDuration: number;
  status: 'success' | 'failed' | 'partial';
  error?: any;
  metadata: {
    requestId: string;
    sessionId: string;
    provider: string;
    model: string;
    category: string;
    startTime: number;
    endTime: number;
  };
}

export interface PerformanceMetrics {
  stepNumber: number;
  stepName: string;
  provider: string;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  totalRequests: number;
  errorCount: number;
  lastUpdated: number;
}

export interface DataCaptureConfig {
  enabled: boolean;
  steps: number[];
  providers: string[];
  categories: string[];
  sampling?: {
    enabled: boolean;
    rate: number; // 0-1
  };
  storage: {
    type: 'file' | 'database';
    path: string;
    maxSize?: number;
    rotation?: boolean;
  };
}

export type StepName = 
  | 'input-processing'
  | 'input-preprocessing'
  | 'routing'
  | 'request-transformation'
  | 'api-interaction'
  | 'response-preprocessing'
  | 'response-transformation'
  | 'output-processing';

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'codewhisperer';

export type CategoryType = 'tool-calls' | 'long-text' | 'normal-text' | 'error';