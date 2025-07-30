/**
 * CodeWhisperer Provider Module
 * Exports all CodeWhisperer functionality
 */

export { CodeWhispererAuth } from './auth';
export { CodeWhispererConverter } from './converter';
export { CodeWhispererClient } from './client';
export { parseEvents, convertEventsToAnthropic, parseNonStreamingResponse } from './parser';
export { processBufferedResponse } from './parser-buffered';

// Data capture and analysis exports
export { 
  saveCaptureData,
  captureAuthEvent,
  captureConversionEvent,
  captureHttpEvent,
  captureParsingEvent,
  captureToolCallEvent,
  listCapturedFiles,
  loadCapturedData,
  getCaptureStats,
  findRelatedCaptures,
  cleanupOldCaptures
} from './data-capture';

export { 
  generateAnalysisReport,
  generateCaptureSummary,
  saveAnalysisReport
} from './analysis-tools';

export type {
  CaptureData,
  AuthCaptureData,
  ConversionCaptureData,
  HttpCaptureData,
  ParsingCaptureData,
  ToolCallCaptureData
} from './data-capture';

export type {
  ComparisonReport,
  PerformanceMetrics,
  Issue,
  ComparisonMetrics
} from './analysis-tools';