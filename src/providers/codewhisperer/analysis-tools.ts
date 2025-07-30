/**
 * CodeWhisperer Data Analysis Tools
 * Provides comparison and analysis functionality for captured data
 * 
 * Project Owner: Jason Zhang
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/utils/logger';
import { 
  CaptureData, 
  AuthCaptureData, 
  ConversionCaptureData, 
  HttpCaptureData, 
  ParsingCaptureData, 
  ToolCallCaptureData,
  findRelatedCaptures,
  listCapturedFiles,
  loadCapturedData 
} from './data-capture';

// OpenAI data capture import for comparison
import { loadCapturedData as loadOpenAICaptureData, listCapturedFiles as listOpenAIFiles } from '../openai/data-capture';

export interface ComparisonReport {
  requestId: string;
  timestamp: string;
  codewhisperer: {
    captures: CaptureData[];
    performance: PerformanceMetrics;
    issues: Issue[];
  };
  openai?: {
    captures: any[];
    performance: PerformanceMetrics;
    issues: Issue[];
  };
  comparison?: ComparisonMetrics;
  recommendations: string[];
}

export interface PerformanceMetrics {
  totalTime: number;
  authTime: number;
  conversionTime: number;
  httpTime: number;
  parsingTime: number;
  toolProcessingTime: number;
  errorCount: number;
  successRate: number;
}

export interface Issue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'auth' | 'conversion' | 'http' | 'parsing' | 'tool_processing';
  description: string;
  data: any;
  recommendations: string[];
}

export interface ComparisonMetrics {
  performanceDifference: number; // percentage difference
  reliabilityDifference: number;
  dataLosses: string[];
  formatDifferences: string[];
  toolCallAccuracy: number;
}

/**
 * Generate comprehensive analysis report for a request
 */
export function generateAnalysisReport(requestId: string): ComparisonReport {
  const startTime = Date.now();
  
  try {
    logger.info('Generating analysis report', { requestId });
    
    // Get CodeWhisperer captures
    const cwCaptures = findRelatedCaptures(requestId);
    
    if (cwCaptures.length === 0) {
      throw new Error(`No CodeWhisperer captures found for request ${requestId}`);
    }
    
    // Calculate performance metrics
    const cwMetrics = calculatePerformanceMetrics(cwCaptures);
    
    // Identify issues
    const cwIssues = identifyIssues(cwCaptures);
    
    // Try to find corresponding OpenAI captures for comparison
    const openaiCaptures = findOpenAICaptures(requestId);
    let openaiMetrics: PerformanceMetrics | undefined;
    let openaiIssues: Issue[] = [];
    let comparisonMetrics: ComparisonMetrics | undefined;
    
    if (openaiCaptures.length > 0) {
      openaiMetrics = calculateOpenAIPerformanceMetrics(openaiCaptures);
      openaiIssues = identifyOpenAIIssues(openaiCaptures);
      comparisonMetrics = compareProviders(cwCaptures, openaiCaptures, cwMetrics, openaiMetrics);
    }
    
    // Generate recommendations
    const recommendations = generateRecommendations(cwCaptures, cwIssues, comparisonMetrics);
    
    const report: ComparisonReport = {
      requestId,
      timestamp: new Date().toISOString(),
      codewhisperer: {
        captures: cwCaptures,
        performance: cwMetrics,
        issues: cwIssues
      },
      ...(openaiCaptures.length > 0 && {
        openai: {
          captures: openaiCaptures,
          performance: openaiMetrics!,
          issues: openaiIssues
        },
        comparison: comparisonMetrics
      }),
      recommendations
    };
    
    logger.info('Analysis report generated successfully', {
      requestId,
      generationTime: Date.now() - startTime,
      cwCaptureCount: cwCaptures.length,
      openaiCaptureCount: openaiCaptures.length,
      issueCount: cwIssues.length
    });
    
    return report;
  } catch (error) {
    logger.error('Failed to generate analysis report', {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Calculate performance metrics from captures
 */
function calculatePerformanceMetrics(captures: CaptureData[]): PerformanceMetrics {
  const metrics: PerformanceMetrics = {
    totalTime: 0,
    authTime: 0,
    conversionTime: 0,
    httpTime: 0,
    parsingTime: 0,
    toolProcessingTime: 0,
    errorCount: 0,
    successRate: 0
  };
  
  let successCount = 0;
  
  captures.forEach(capture => {
    // Check for performance issues - safely access timeTaken
    const timeTaken = 'timeTaken' in capture.data ? (capture.data as any).timeTaken || 0 : 0;
    metrics.totalTime += timeTaken;
    
    switch (capture.stage) {
      case 'auth':
        metrics.authTime += timeTaken;
        if (capture.event === 'auth_failure') {
          metrics.errorCount++;
        } else {
          successCount++;
        }
        break;
      case 'conversion':
        metrics.conversionTime += timeTaken;
        successCount++;
        break;
      case 'http':
        metrics.httpTime += timeTaken;
        if (capture.event === 'http_error') {
          metrics.errorCount++;
        } else {
          successCount++;
        }
        break;
      case 'parsing':
        metrics.parsingTime += timeTaken;
        if (capture.event === 'parsing_error') {
          metrics.errorCount++;
        } else {
          successCount++;
        }
        break;
      case 'tool_processing':
        metrics.toolProcessingTime += timeTaken;
        if (capture.event === 'tool_error') {
          metrics.errorCount++;
        } else {
          successCount++;
        }
        break;
    }
  });
  
  metrics.successRate = captures.length > 0 ? (successCount / captures.length) * 100 : 0;
  
  return metrics;
}

/**
 * Identify issues from captures
 */
function identifyIssues(captures: CaptureData[]): Issue[] {
  const issues: Issue[] = [];
  
  captures.forEach(capture => {
    // Check for auth issues
    if (capture.stage === 'auth' && capture.event === 'auth_failure') {
      issues.push({
        severity: 'high',
        category: 'auth',
        description: 'Authentication failure detected',
        data: capture.data,
        recommendations: [
          'Check token validity',
          'Verify network connectivity',
          'Review auth endpoint configuration'
        ]
      });
    }
    
    // Check for HTTP errors
    if (capture.stage === 'http' && capture.event === 'http_error') {
      const httpCapture = capture as HttpCaptureData;
      const severity = httpCapture.data.responseStatus === 500 ? 'critical' : 'high';
      issues.push({
        severity,
        category: 'http',
        description: `HTTP error ${httpCapture.data.responseStatus}`,
        data: capture.data,
        recommendations: [
          'Check API endpoint availability',
          'Verify request format',
          'Review rate limiting'
        ]
      });
    }
    
    // Check for parsing errors
    if (capture.stage === 'parsing' && capture.event === 'parsing_error') {
      issues.push({
        severity: 'medium',
        category: 'parsing',
        description: 'Response parsing failed',
        data: capture.data,
        recommendations: [
          'Check response format compatibility',
          'Review parsing logic',
          'Enable debug logging'
        ]
      });
    }
    
    // Check for tool call issues
    if (capture.stage === 'tool_processing' && capture.event === 'tool_error') {
      issues.push({
        severity: 'medium',
        category: 'tool_processing',
        description: 'Tool call processing error',
        data: capture.data,
        recommendations: [
          'Review tool call format',
          'Check JSON parsing logic',
          'Validate tool definitions'
        ]
      });
    }
    
    // Check for performance issues - safely access timeTaken
    const timeTaken = 'timeTaken' in capture.data ? (capture.data as any).timeTaken || 0 : 0;
    if (timeTaken > 10000) { // 10 seconds
      issues.push({
        severity: 'medium',
        category: capture.stage as any,
        description: `Slow ${capture.stage} operation (${timeTaken}ms)`,
        data: { timeTaken },
        recommendations: [
          'Optimize processing logic',
          'Check network conditions',
          'Consider timeout adjustments'
        ]
      });
    }
  });
  
  return issues;
}

/**
 * Find OpenAI captures for comparison (if available)
 */
function findOpenAICaptures(requestId: string): any[] {
  try {
    const openaiFiles = listOpenAIFiles();
    const relatedFiles = openaiFiles.filter(file => file.includes(requestId));
    
    const captures: any[] = [];
    relatedFiles.forEach(file => {
      const data = loadOpenAICaptureData(file);
      if (data) {
        captures.push(data);
      }
    });
    
    return captures.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch (error) {
    logger.debug('Failed to find OpenAI captures for comparison', { requestId, error });
    return [];
  }
}

/**
 * Calculate performance metrics for OpenAI captures
 */
function calculateOpenAIPerformanceMetrics(captures: any[]): PerformanceMetrics {
  // Simplified implementation - would need to adapt based on OpenAI capture structure
  return {
    totalTime: 0,
    authTime: 0,
    conversionTime: 0,
    httpTime: 0,
    parsingTime: 0,
    toolProcessingTime: 0,
    errorCount: captures.filter(c => c.error).length,
    successRate: ((captures.length - captures.filter(c => c.error).length) / captures.length) * 100
  };
}

/**
 * Identify issues in OpenAI captures
 */
function identifyOpenAIIssues(captures: any[]): Issue[] {
  const issues: Issue[] = [];
  
  captures.forEach(capture => {
    if (capture.error) {
      issues.push({
        severity: 'medium',
        category: 'http',
        description: 'OpenAI API error',
        data: capture.error,
        recommendations: ['Review OpenAI API status', 'Check request format']
      });
    }
  });
  
  return issues;
}

/**
 * Compare CodeWhisperer and OpenAI performance
 */
function compareProviders(
  cwCaptures: CaptureData[],
  openaiCaptures: any[],
  cwMetrics: PerformanceMetrics,
  openaiMetrics: PerformanceMetrics
): ComparisonMetrics {
  const performanceDifference = cwMetrics.totalTime > 0 && openaiMetrics.totalTime > 0
    ? ((cwMetrics.totalTime - openaiMetrics.totalTime) / openaiMetrics.totalTime) * 100
    : 0;
  
  const reliabilityDifference = cwMetrics.successRate - openaiMetrics.successRate;
  
  // Analyze data losses and format differences
  const dataLosses: string[] = [];
  const formatDifferences: string[] = [];
  
  // Count tool calls in both
  const cwToolCalls = cwCaptures.filter(c => 
    c.stage === 'tool_processing' && c.event === 'tool_call_detected'
  ).length;
  
  const openaiToolCalls = openaiCaptures.filter(c => 
    c.request?.tools || c.response?.choices?.[0]?.message?.tool_calls
  ).length;
  
  const toolCallAccuracy = cwToolCalls > 0 && openaiToolCalls > 0
    ? Math.min(cwToolCalls, openaiToolCalls) / Math.max(cwToolCalls, openaiToolCalls)
    : 1.0;
  
  if (cwToolCalls !== openaiToolCalls) {
    dataLosses.push(`Tool call count mismatch: CW=${cwToolCalls}, OpenAI=${openaiToolCalls}`);
  }
  
  return {
    performanceDifference,
    reliabilityDifference,
    dataLosses,
    formatDifferences,
    toolCallAccuracy
  };
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  captures: CaptureData[],
  issues: Issue[],
  comparison?: ComparisonMetrics
): string[] {
  const recommendations: string[] = [];
  
  // Performance recommendations - safely access timeTaken
  const totalTime = captures.reduce((sum, c) => sum + ('timeTaken' in c.data ? (c.data as any).timeTaken || 0 : 0), 0);
  if (totalTime > 5000) {
    recommendations.push('Consider implementing response caching to improve performance');
  }
  
  // Error rate recommendations
  const errorCount = issues.filter(i => i.severity === 'high' || i.severity === 'critical').length;
  if (errorCount > 0) {
    recommendations.push('Implement retry mechanisms for critical failures');
    recommendations.push('Add circuit breaker pattern for reliability');
  }
  
  // Tool call recommendations
  const toolIssues = issues.filter(i => i.category === 'tool_processing').length;
  if (toolIssues > 0) {
    recommendations.push('Review tool call parsing logic for better accuracy');
    recommendations.push('Implement tool call validation before processing');
  }
  
  // Comparison-based recommendations
  if (comparison) {
    if (comparison.performanceDifference > 50) {
      recommendations.push('CodeWhisperer is significantly slower - investigate bottlenecks');
    }
    if (comparison.reliabilityDifference < -10) {
      recommendations.push('CodeWhisperer has lower success rate - improve error handling');
    }
    if (comparison.toolCallAccuracy < 0.9) {
      recommendations.push('Tool call processing accuracy is suboptimal - review parsing logic');
    }
  }
  
  return recommendations;
}

/**
 * Save analysis report to file
 */
export function saveAnalysisReport(report: ComparisonReport): string {
  try {
    const reportsDir = path.join(process.env.HOME || '', '.route-claude-code', 'database', 'reports');
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analysis-report-${report.requestId}-${timestamp}.json`;
    const filepath = path.join(reportsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    
    logger.info('Analysis report saved', { filepath, requestId: report.requestId });
    
    return filepath;
  } catch (error) {
    logger.error('Failed to save analysis report', {
      requestId: report.requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Generate summary of recent captures
 */
export function generateCaptureSummary(daysBack: number = 1): any {
  try {
    const files = listCapturedFiles();
    const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
    
    const recentCaptures: CaptureData[] = [];
    
    files.forEach(file => {
      try {
        const filepath = path.join(process.env.HOME || '', '.route-claude-code', 'database', 'captures', 'codewhisperer', file);
        const stats = fs.statSync(filepath);
        
        if (stats.mtime.getTime() >= cutoffTime) {
          const data = loadCapturedData(file);
          if (data) {
            recentCaptures.push(data);
          }
        }
      } catch (error) {
        logger.debug('Failed to process capture file', { file, error });
      }
    });
    
    // Group by stage and event
    const summary: any = {
      totalCaptures: recentCaptures.length,
      timeRange: `${daysBack} day(s)`,
      stages: {},
      performance: {
        averageAuthTime: 0,
        averageHttpTime: 0,
        averageParsingTime: 0,
        totalErrors: 0,
        successRate: 0
      }
    };
    
    let totalTime = 0;
    let totalRequests = 0;
    let errorCount = 0;
    
    recentCaptures.forEach(capture => {
      const stage = capture.stage;
      if (!summary.stages[stage]) {
        summary.stages[stage] = {
          count: 0,
          events: {},
          averageTime: 0,
          totalTime: 0
        };
      }
      
      summary.stages[stage].count++;
      summary.stages[stage].totalTime += ('timeTaken' in capture.data ? (capture.data as any).timeTaken || 0 : 0);
      
      if (!summary.stages[stage].events[capture.event]) {
        summary.stages[stage].events[capture.event] = 0;
      }
      summary.stages[stage].events[capture.event]++;
      
      totalTime += ('timeTaken' in capture.data ? (capture.data as any).timeTaken || 0 : 0);
      totalRequests++;
      
      if (capture.event.includes('failure') || capture.event.includes('error')) {
        errorCount++;
      }
    });
    
    // Calculate averages
    Object.keys(summary.stages).forEach(stage => {
      const stageData = summary.stages[stage];
      stageData.averageTime = stageData.count > 0 ? stageData.totalTime / stageData.count : 0;
    });
    
    summary.performance.successRate = totalRequests > 0 ? ((totalRequests - errorCount) / totalRequests) * 100 : 0;
    summary.performance.totalErrors = errorCount;
    
    if (summary.stages.auth) {
      summary.performance.averageAuthTime = summary.stages.auth.averageTime;
    }
    if (summary.stages.http) {
      summary.performance.averageHttpTime = summary.stages.http.averageTime;
    }
    if (summary.stages.parsing) {
      summary.performance.averageParsingTime = summary.stages.parsing.averageTime;
    }
    
    return summary;
  } catch (error) {
    logger.error('Failed to generate capture summary', {
      daysBack,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}