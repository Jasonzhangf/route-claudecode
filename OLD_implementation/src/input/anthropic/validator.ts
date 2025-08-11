/**
 * Anthropic Request Validator
 * Validates incoming requests against Anthropic API specification
 */

import { ValidationError } from '@/types';

export function validateAnthropicRequest(request: any): boolean {
  if (!request || typeof request !== 'object') {
    throw new ValidationError('Request must be an object');
  }

  // Required fields
  if (!request.model || typeof request.model !== 'string') {
    throw new ValidationError('Model is required and must be a string');
  }

  if (!request.messages || !Array.isArray(request.messages)) {
    throw new ValidationError('Messages are required and must be an array');
  }

  if (request.messages.length === 0) {
    throw new ValidationError('At least one message is required');
  }

  // Validate messages
  for (let i = 0; i < request.messages.length; i++) {
    const message = request.messages[i];
    
    if (!message || typeof message !== 'object') {
      throw new ValidationError(`Message at index ${i} must be an object`);
    }

    if (!message.role || typeof message.role !== 'string') {
      throw new ValidationError(`Message at index ${i} must have a role`);
    }

    if (!['user', 'assistant', 'system'].includes(message.role)) {
      throw new ValidationError(`Invalid role "${message.role}" at message index ${i}`);
    }

    if (message.content === undefined || message.content === null) {
      throw new ValidationError(`Message at index ${i} must have content`);
    }

    // Validate content format
    if (typeof message.content !== 'string' && !Array.isArray(message.content)) {
      throw new ValidationError(`Message content at index ${i} must be string or array`);
    }

    if (Array.isArray(message.content)) {
      validateContentBlocks(message.content, i);
    }
  }

  // Optional field validation
  if (request.system !== undefined) {
    if (!Array.isArray(request.system)) {
      throw new ValidationError('System must be an array');
    }

    for (let i = 0; i < request.system.length; i++) {
      const systemMsg = request.system[i];
      if (!systemMsg || typeof systemMsg !== 'object') {
        throw new ValidationError(`System message at index ${i} must be an object`);
      }

      if (systemMsg.type !== 'text') {
        throw new ValidationError(`System message at index ${i} must have type "text"`);
      }

      if (!systemMsg.text || typeof systemMsg.text !== 'string') {
        throw new ValidationError(`System message at index ${i} must have text field`);
      }
    }
  }

  if (request.tools !== undefined) {
    if (!Array.isArray(request.tools)) {
      throw new ValidationError('Tools must be an array');
    }

    for (let i = 0; i < request.tools.length; i++) {
      const tool = request.tools[i];
      
      if (!tool || typeof tool !== 'object') {
        throw new ValidationError(`Tool at index ${i} must be an object`);
      }

      if (!tool.name || typeof tool.name !== 'string') {
        throw new ValidationError(`Tool at index ${i} must have a name`);
      }

      if (!tool.description || typeof tool.description !== 'string') {
        throw new ValidationError(`Tool at index ${i} must have a description`);
      }

      if (!tool.input_schema || typeof tool.input_schema !== 'object') {
        throw new ValidationError(`Tool at index ${i} must have input_schema`);
      }
    }
  }

  // Validate optional numeric fields
  if (request.max_tokens !== undefined) {
    if (typeof request.max_tokens !== 'number' || request.max_tokens <= 0) {
      throw new ValidationError('max_tokens must be a positive number');
    }
  }

  if (request.temperature !== undefined) {
    if (typeof request.temperature !== 'number' || request.temperature < 0 || request.temperature > 1) {
      throw new ValidationError('temperature must be a number between 0 and 1');
    }
  }

  if (request.stream !== undefined && typeof request.stream !== 'boolean') {
    throw new ValidationError('stream must be a boolean');
  }

  return true;
}

function validateContentBlocks(content: any[], messageIndex: number): void {
  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    
    if (!block || typeof block !== 'object') {
      throw new ValidationError(
        `Content block at index ${i} in message ${messageIndex} must be an object`
      );
    }

    if (!block.type || typeof block.type !== 'string') {
      throw new ValidationError(
        `Content block at index ${i} in message ${messageIndex} must have a type`
      );
    }

    switch (block.type) {
      case 'text':
        if (!block.text || typeof block.text !== 'string') {
          throw new ValidationError(
            `Text block at index ${i} in message ${messageIndex} must have text field`
          );
        }
        break;

      case 'tool_use':
        if (!block.id || typeof block.id !== 'string') {
          throw new ValidationError(
            `Tool use block at index ${i} in message ${messageIndex} must have id`
          );
        }
        if (!block.name || typeof block.name !== 'string') {
          throw new ValidationError(
            `Tool use block at index ${i} in message ${messageIndex} must have name`
          );
        }
        if (block.input === undefined) {
          throw new ValidationError(
            `Tool use block at index ${i} in message ${messageIndex} must have input`
          );
        }
        break;

      case 'tool_result':
        if (!block.tool_use_id || typeof block.tool_use_id !== 'string') {
          throw new ValidationError(
            `Tool result block at index ${i} in message ${messageIndex} must have tool_use_id`
          );
        }
        if (block.content === undefined) {
          throw new ValidationError(
            `Tool result block at index ${i} in message ${messageIndex} must have content`
          );
        }
        break;

      case 'image':
        if (!block.source || typeof block.source !== 'object') {
          throw new ValidationError(
            `Image block at index ${i} in message ${messageIndex} must have source`
          );
        }
        break;

      default:
        throw new ValidationError(
          `Unknown content block type "${block.type}" at index ${i} in message ${messageIndex}`
        );
    }
  }
}