/**
 * OpenAI Tool Call Analyzer
 * 分析tool call被错误处理为文本的问题
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/utils/logger';
import { CaptureData } from './data-capture';

// 工具调用模式识别
const TOOL_CALL_PATTERNS = [
  // 标准工具调用模式
  /Tool call:\s*(\w+)\((.*?)\)(?:\n|$)/g,
  // 带前缀的工具调用模式
  /(?:⏺\s*)?Tool call:\s*(\w+)\((.*?)\)(?:\n|$)/g,
  // JSON格式的工具调用
  /"tool_call":\s*\{[^}]*"name":\s*"([^"]+)"[^}]*"arguments":\s*(\{.*?\})/g,
  // 函数调用模式
  /function_call\s*=\s*(\w+)\((.*?)\)/g
];

export interface ToolCallAnalysis {
  requestId: string;
  provider: string;
  model: string;
  hasToolCallsInRequest: boolean;
  hasToolCallsInResponse: boolean;
  toolCallsInRequest: any[];
  toolCallsInResponse: any[];
  textContainsToolCallPattern: boolean;
  extractedToolCalls: Array<{ id: string; name: string; input: any }>;
  issueType: 'tool_as_text' | 'missing_tool_parsing' | 'incorrect_format' | 'none';
  recommendations: string[];
}

/**
 * 分析捕获的数据，识别tool call处理问题
 */
export function analyzeToolCallIssue(captureData: CaptureData): ToolCallAnalysis {
  const analysis: ToolCallAnalysis = {
    requestId: captureData.requestId,
    provider: captureData.provider,
    model: captureData.model,
    hasToolCallsInRequest: false,
    hasToolCallsInResponse: false,
    toolCallsInRequest: [],
    toolCallsInResponse: [],
    textContainsToolCallPattern: false,
    extractedToolCalls: [],
    issueType: 'none',
    recommendations: []
  };

  try {
    // 检查请求中的工具调用
    if (captureData.request?.tools) {
      analysis.hasToolCallsInRequest = true;
      analysis.toolCallsInRequest = captureData.request.tools;
    }

    // 检查响应中的工具调用
    if (captureData.response) {
      // 检查标准响应格式中的工具调用
      if (captureData.response.choices?.[0]?.message?.tool_calls) {
        analysis.hasToolCallsInResponse = true;
        analysis.toolCallsInResponse = captureData.response.choices[0].message.tool_calls;
      }
      
      // 检查流式响应格式
      if (captureData.response.events) {
        const toolCallEvents = captureData.response.events.filter((e: any) => 
          e.choices?.[0]?.delta?.tool_calls
        );
        if (toolCallEvents.length > 0) {
          analysis.hasToolCallsInResponse = true;
          analysis.toolCallsInResponse = toolCallEvents.map((e: any) => e.choices[0].delta.tool_calls);
        }
      }

      // 检查响应文本中是否包含工具调用模式
      const responseText = getResponseText(captureData.response);
      if (responseText) {
        analysis.textContainsToolCallPattern = checkForToolCallPatterns(responseText);
        
        if (analysis.textContainsToolCallPattern) {
          // 尝试提取工具调用
          analysis.extractedToolCalls = extractToolCallsFromText(responseText);
          
          // 如果在文本中发现了工具调用模式但没有正确解析为工具调用，则标记问题
          if (!analysis.hasToolCallsInResponse && analysis.extractedToolCalls.length > 0) {
            analysis.issueType = 'tool_as_text';
            analysis.recommendations.push('工具调用被错误地处理为文本内容');
            analysis.recommendations.push('需要在响应处理中添加工具调用模式检测');
            analysis.recommendations.push('考虑使用缓冲式处理避免分段解析问题');
          }
        }
      }
    }

    // 识别具体问题类型
    if (analysis.hasToolCallsInRequest && !analysis.hasToolCallsInResponse && 
        analysis.textContainsToolCallPattern) {
      analysis.issueType = 'tool_as_text';
    } else if (analysis.hasToolCallsInRequest && !analysis.hasToolCallsInResponse) {
      analysis.issueType = 'missing_tool_parsing';
    }

  } catch (error) {
    logger.error('Failed to analyze tool call issue', { 
      error: error instanceof Error ? error.message : String(error),
      requestId: captureData.requestId
    });
  }

  return analysis;
}

/**
 * 获取响应中的文本内容
 */
function getResponseText(response: any): string {
  try {
    // 非流式响应
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content;
    }
    
    // 流式响应中的文本事件
    if (response.events) {
      return response.events
        .filter((e: any) => e.choices?.[0]?.delta?.content)
        .map((e: any) => e.choices[0].delta.content)
        .join('');
    }
    
    // Anthropic格式响应
    if (response.content) {
      return response.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');
    }
    
    return '';
  } catch (error) {
    return '';
  }
}

/**
 * 检查文本中是否包含工具调用模式
 */
function checkForToolCallPatterns(text: string): boolean {
  for (const pattern of TOOL_CALL_PATTERNS) {
    const testPattern = new RegExp(pattern.source, pattern.flags);
    if (testPattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * 从文本中提取工具调用
 */
function extractToolCallsFromText(text: string): Array<{ id: string; name: string; input: any }> {
  const toolCalls: Array<{ id: string; name: string; input: any }> = [];
  
  try {
    // 使用第一个模式提取工具调用
    const pattern = TOOL_CALL_PATTERNS[0];
    const globalPattern = new RegExp(pattern.source, 'g');
    let match;
    
    while ((match = globalPattern.exec(text)) !== null) {
      const [fullMatch, toolName, argsString] = match;
      let toolInput = {};
      
      try {
        if (argsString.trim()) {
          // 如果参数看起来像JSON，尝试解析
          if (argsString.trim().startsWith('{') && argsString.trim().endsWith('}')) {
            toolInput = JSON.parse(argsString);
          } else {
            // 否则，假设它是一个简单的命令字符串
            toolInput = { command: argsString };
          }
        }
      } catch (e) {
        toolInput = { command: argsString };
      }
      
      toolCalls.push({
        id: `extracted_${Date.now()}_${toolCalls.length}`,
        name: toolName,
        input: toolInput
      });
    }
  } catch (error) {
    logger.error('Failed to extract tool calls from text', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
  
  return toolCalls;
}

/**
 * 分析所有捕获的文件中的tool call问题
 */
export function analyzeAllCapturedFiles(): ToolCallAnalysis[] {
  const analyses: ToolCallAnalysis[] = [];
  
  try {
    const databaseDir = path.join(process.env.HOME || '', '.route-claude-code', 'database');
    const capturesDir = path.join(databaseDir, 'captures', 'openai');
    
    if (!fs.existsSync(capturesDir)) {
      logger.warn('OpenAI captures directory not found', { capturesDir });
      return analyses;
    }
    
    const files = fs.readdirSync(capturesDir);
    const jsonFiles = files.filter(file => file.endsWith('.json')).sort();
    
    logger.info('Analyzing captured files for tool call issues', { 
      fileCount: jsonFiles.length,
      capturesDir 
    });
    
    for (const file of jsonFiles) {
      try {
        const filepath = path.join(capturesDir, file);
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8')) as CaptureData;
        
        // 只分析包含工具调用的请求
        if (data.request?.tools || (data.response && getResponseText(data.response))) {
          const analysis = analyzeToolCallIssue(data);
          if (analysis.issueType !== 'none') {
            analyses.push(analysis);
          }
        }
      } catch (error) {
        logger.error('Failed to analyze captured file', { 
          file,
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
  } catch (error) {
    logger.error('Failed to analyze all captured files', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
  
  return analyses;
}

/**
 * 生成分析报告
 */
export function generateAnalysisReport(analyses: ToolCallAnalysis[]): string {
  let report = '# OpenAI Tool Call Analysis Report\n\n';
  
  const totalIssues = analyses.length;
  const toolAsTextIssues = analyses.filter(a => a.issueType === 'tool_as_text').length;
  const missingParsingIssues = analyses.filter(a => a.issueType === 'missing_tool_parsing').length;
  
  report += `## Summary\n`;
  report += `- Total issues found: ${totalIssues}\n`;
  report += `- Tool calls as text: ${toolAsTextIssues}\n`;
  report += `- Missing tool parsing: ${missingParsingIssues}\n\n`;
  
  if (totalIssues > 0) {
    report += `## Detailed Issues\n\n`;
    
    for (const analysis of analyses) {
      report += `### Request ID: ${analysis.requestId}\n`;
      report += `- Provider: ${analysis.provider}\n`;
      report += `- Model: ${analysis.model}\n`;
      report += `- Issue Type: ${analysis.issueType}\n`;
      report += `- Has tools in request: ${analysis.hasToolCallsInRequest}\n`;
      report += `- Has tools in response: ${analysis.hasToolCallsInResponse}\n`;
      report += `- Text contains tool call pattern: ${analysis.textContainsToolCallPattern}\n`;
      
      if (analysis.extractedToolCalls.length > 0) {
        report += `- Extracted tool calls: ${analysis.extractedToolCalls.length}\n`;
        for (const toolCall of analysis.extractedToolCalls) {
          report += `  - ${toolCall.name}: ${JSON.stringify(toolCall.input)}\n`;
        }
      }
      
      if (analysis.recommendations.length > 0) {
        report += `- Recommendations:\n`;
        for (const recommendation of analysis.recommendations) {
          report += `  - ${recommendation}\n`;
        }
      }
      
      report += `\n`;
    }
  } else {
    report += `## No issues found\n\n`;
    report += `All tool calls are properly handled.\n`;
  }
  
  return report;
}