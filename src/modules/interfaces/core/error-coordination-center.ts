/**
 * Error Coordination Center Interface
 * Re-exports error types and coordination interfaces
 */

export * from '../../types/src/index';
export * from '../../error-handler/src/error-coordination-center-factory';

// Additional interfaces needed by error-handler modules
export interface ErrorClassification {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  recoverable: boolean;
  confidence?: number;
  matchedPattern?: string;
  contextHints?: string[];
}

export interface ErrorHandlingResult {
  handled: boolean;
  action: string;
  success: boolean;
  message?: string;
  actionTaken?: string;
}

export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTH = 'auth',
  INTERNAL = 'internal'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high', 
  CRITICAL = 'critical'
}

export interface ErrorCoordinationCenter {
  classifyError(error: Error): ErrorClassification;
  handleError(error: Error, context?: any): ErrorHandlingResult;
  generateReport(): ErrorSummaryReport;
}

export interface UnifiedErrorResponse {
  error: boolean;
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ErrorStatistics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByPipeline?: Record<string, number>;
  timeRange?: {
    startTime: number;
    endTime: number;
  };
  lastError?: Date;
}

export interface ErrorSummaryReport {
  reportId?: string;
  timeframe: string;
  timeRange?: {
    startTime: number;
    endTime: number;
  };
  statistics: ErrorStatistics;
  topErrors: Array<{
    type: string;
    count: number;
    percentage: number;
    message?: string;
    errorType?: string;
  }>;
  problemPipelines?: Array<{
    pipelineId: string;
    errorCount: number;
    errorRate: number;
  }>;
  recommendations?: Array<{
    type: 'blacklist' | 'config' | 'monitoring' | 'investigation';
    priority: 'high' | 'medium' | 'low';
    message: string;
    affectedPipelines?: string[];
  }>;
}