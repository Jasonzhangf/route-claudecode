/**
 * Token calculation utilities
 * Based on demo1 implementation with tiktoken
 */

import { get_encoding } from 'tiktoken';
import { logger } from './logger';

const enc = get_encoding('cl100k_base');

export interface TokenCount {
  total: number;
  messages: number;
  system: number;
  tools: number;
}

/**
 * Calculate token count for messages, system prompts, and tools
 */
export function calculateTokenCount(
  messages: Array<{ role: string; content: any }>,
  system?: any,
  tools?: any[]
): number {
  try {
    let tokenCount = 0;

    // Count message tokens
    if (Array.isArray(messages)) {
      messages.forEach((message) => {
        tokenCount += countMessageTokens(message.content);
      });
    }

    // Count system prompt tokens
    if (system) {
      tokenCount += countSystemTokens(system);
    }

    // Count tool tokens
    if (tools && Array.isArray(tools)) {
      tools.forEach((tool) => {
        tokenCount += countToolTokens(tool);
      });
    }

    return tokenCount;
  } catch (error) {
    logger.error('Token count calculation failed', { error, messages, system, tools });
    throw new Error(`Token count calculation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Calculate detailed token breakdown
 */
export function calculateDetailedTokenCount(
  messages: Array<{ role: string; content: any }>,
  system?: any,
  tools?: any[]
): TokenCount {
  try {
    let messageTokens = 0;
    let systemTokens = 0;
    let toolTokens = 0;

    // Count message tokens
    if (Array.isArray(messages)) {
      messages.forEach((message) => {
        messageTokens += countMessageTokens(message.content);
      });
    }

    // Count system prompt tokens
    if (system) {
      systemTokens = countSystemTokens(system);
    }

    // Count tool tokens
    if (tools && Array.isArray(tools)) {
      tools.forEach((tool) => {
        toolTokens += countToolTokens(tool);
      });
    }

    return {
      total: messageTokens + systemTokens + toolTokens,
      messages: messageTokens,
      system: systemTokens,
      tools: toolTokens
    };
  } catch (error) {
    logger.error('Detailed token count calculation failed', { error, messages, system, tools });
    throw new Error(`Detailed token count calculation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Count tokens in message content
 */
function countMessageTokens(content: any): number {
  if (typeof content === 'string') {
    return enc.encode(content).length;
  }

  if (Array.isArray(content)) {
    let tokens = 0;
    content.forEach((contentPart: any) => {
      if (contentPart.type === 'text' && contentPart.text) {
        tokens += enc.encode(contentPart.text).length;
      } else if (contentPart.type === 'tool_use') {
        tokens += enc.encode(JSON.stringify(contentPart.input || {})).length;
      } else if (contentPart.type === 'tool_result') {
        const resultContent = typeof contentPart.content === 'string' 
          ? contentPart.content 
          : JSON.stringify(contentPart.content || {});
        tokens += enc.encode(resultContent).length;
      }
    });
    return tokens;
  }

  return 0;
}

/**
 * Count tokens in system prompts
 */
function countSystemTokens(system: any): number {
  if (typeof system === 'string') {
    return enc.encode(system).length;
  }

  if (Array.isArray(system)) {
    let tokens = 0;
    system.forEach((item: any) => {
      if (item.type === 'text' && item.text) {
        if (typeof item.text === 'string') {
          tokens += enc.encode(item.text).length;
        } else if (Array.isArray(item.text)) {
          item.text.forEach((textPart: any) => {
            tokens += enc.encode(textPart || '').length;
          });
        }
      }
    });
    return tokens;
  }

  return 0;
}

/**
 * Count tokens in tools
 */
function countToolTokens(tool: any): number {
  let tokens = 0;

  if (tool.name) {
    tokens += enc.encode(tool.name).length;
  }

  if (tool.description) {
    tokens += enc.encode(tool.description).length;
  }

  if (tool.input_schema) {
    tokens += enc.encode(JSON.stringify(tool.input_schema)).length;
  }

  return tokens;
}

/**
 * Fallback token estimation when tiktoken fails
 */
function estimateTokenCount(
  messages: Array<{ role: string; content: any }>,
  system?: any,
  tools?: any[]
): number {
  let totalChars = 0;

  // Estimate from messages
  if (Array.isArray(messages)) {
    messages.forEach((message) => {
      totalChars += estimateContentLength(message.content);
    });
  }

  // Estimate from system
  if (system) {
    totalChars += estimateContentLength(system);
  }

  // Estimate from tools
  if (tools && Array.isArray(tools)) {
    tools.forEach((tool) => {
      totalChars += JSON.stringify(tool).length;
    });
  }

  // Rough conversion: ~4 characters per token
  return Math.ceil(totalChars / 4);
}

/**
 * Estimate character length of content
 */
function estimateContentLength(content: any): number {
  if (typeof content === 'string') {
    return content.length;
  }

  if (Array.isArray(content)) {
    return content.reduce((total, item) => {
      if (typeof item === 'string') {
        return total + item.length;
      } else if (item && typeof item === 'object') {
        return total + JSON.stringify(item).length;
      }
      return total;
    }, 0);
  }

  if (content && typeof content === 'object') {
    return JSON.stringify(content).length;
  }

  return 0;
}