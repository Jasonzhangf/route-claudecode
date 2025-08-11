/**
 * Format Validator
 * Validates request and response formats for all supported AI providers
 */

import { AIRequest, AIResponse } from '../../types/interfaces.js';
import { SupportedFormat } from './format-converter.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class FormatValidator {
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    this.initialized = true;
    console.log('✅ FormatValidator initialized');
  }

  validateRequest(request: any, format: SupportedFormat): ValidationResult {
    if (!this.initialized) {
      throw new Error('FormatValidator not initialized');
    }

    switch (format) {
      case 'standard':
        return this.validateStandardRequest(request);
      case 'anthropic':
        return this.validateAnthropicRequest(request);
      case 'openai':
        return this.validateOpenAIRequest(request);
      case 'gemini':
        return this.validateGeminiRequest(request);
      case 'codewhisperer':
        return this.validateCodeWhispererRequest(request);
      default:
        return {
          valid: false,
          errors: [`Unsupported format: ${format}`],
          warnings: []
        };
    }
  }

  validateResponse(response: any, format: SupportedFormat): ValidationResult {
    if (!this.initialized) {
      throw new Error('FormatValidator not initialized');
    }

    switch (format) {
      case 'standard':
        return this.validateStandardResponse(response);
      case 'anthropic':
        return this.validateAnthropicResponse(response);
      case 'openai':
        return this.validateOpenAIResponse(response);
      case 'gemini':
        return this.validateGeminiResponse(response);
      case 'codewhisperer':
        return this.validateCodeWhispererResponse(response);
      default:
        return {
          valid: false,
          errors: [`Unsupported format: ${format}`],
          warnings: []
        };
    }
  }

  // Standard format validation
  private validateStandardRequest(request: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!request.id) {
      errors.push('Missing required field: id');
    }
    if (!request.provider) {
      errors.push('Missing required field: provider');
    }
    if (!request.model) {
      errors.push('Missing required field: model');
    }
    if (!request.messages) {
      errors.push('Missing required field: messages');
    } else if (!Array.isArray(request.messages)) {
      errors.push('Field "messages" must be an array');
    } else if (request.messages.length === 0) {
      warnings.push('Messages array is empty');
    }

    // Validate messages
    if (Array.isArray(request.messages)) {
      request.messages.forEach((msg: any, index: number) => {
        if (!msg.role) {
          errors.push(`Message ${index}: missing role`);
        } else if (!['user', 'assistant', 'system'].includes(msg.role)) {
          errors.push(`Message ${index}: invalid role "${msg.role}"`);
        }
        if (!msg.content) {
          errors.push(`Message ${index}: missing content`);
        }
      });
    }

    // Validate metadata
    if (!request.metadata) {
      warnings.push('Missing metadata field');
    } else {
      if (!request.metadata.timestamp) {
        warnings.push('Missing metadata.timestamp');
      }
      if (!request.metadata.source) {
        warnings.push('Missing metadata.source');
      }
    }

    // Validate tools if present
    if (request.tools) {
      if (!Array.isArray(request.tools)) {
        errors.push('Field "tools" must be an array');
      } else {
        request.tools.forEach((tool: any, index: number) => {
          if (!tool.name) {
            errors.push(`Tool ${index}: missing name`);
          }
          if (!tool.description) {
            warnings.push(`Tool ${index}: missing description`);
          }
          if (!tool.parameters) {
            errors.push(`Tool ${index}: missing parameters`);
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateStandardResponse(response: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!response.id) {
      errors.push('Missing required field: id');
    }
    if (!response.model) {
      errors.push('Missing required field: model');
    }
    if (!response.choices) {
      errors.push('Missing required field: choices');
    } else if (!Array.isArray(response.choices)) {
      errors.push('Field "choices" must be an array');
    } else if (response.choices.length === 0) {
      errors.push('Choices array cannot be empty');
    }

    // Validate choices
    if (Array.isArray(response.choices)) {
      response.choices.forEach((choice: any, index: number) => {
        if (typeof choice.index !== 'number') {
          errors.push(`Choice ${index}: missing or invalid index`);
        }
        if (!choice.message) {
          errors.push(`Choice ${index}: missing message`);
        } else {
          if (!choice.message.role) {
            errors.push(`Choice ${index}: missing message role`);
          }
          if (choice.message.content === undefined) {
            warnings.push(`Choice ${index}: missing message content`);
          }
        }
      });
    }

    // Validate usage
    if (!response.usage) {
      warnings.push('Missing usage information');
    } else {
      if (typeof response.usage.promptTokens !== 'number') {
        warnings.push('Invalid or missing usage.promptTokens');
      }
      if (typeof response.usage.completionTokens !== 'number') {
        warnings.push('Invalid or missing usage.completionTokens');
      }
      if (typeof response.usage.totalTokens !== 'number') {
        warnings.push('Invalid or missing usage.totalTokens');
      }
    }

    // Validate metadata
    if (!response.metadata) {
      warnings.push('Missing metadata');
    } else {
      if (!response.metadata.timestamp) {
        warnings.push('Missing metadata.timestamp');
      }
      if (!response.metadata.provider) {
        warnings.push('Missing metadata.provider');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Anthropic format validation
  private validateAnthropicRequest(request: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!request.model) {
      errors.push('Missing required field: model');
    }
    if (!request.messages) {
      errors.push('Missing required field: messages');
    } else if (!Array.isArray(request.messages)) {
      errors.push('Field "messages" must be an array');
    }
    if (!request.max_tokens || typeof request.max_tokens !== 'number') {
      errors.push('Missing or invalid max_tokens');
    }

    // Validate messages
    if (Array.isArray(request.messages)) {
      request.messages.forEach((msg: any, index: number) => {
        if (!msg.role || !['user', 'assistant'].includes(msg.role)) {
          errors.push(`Message ${index}: invalid role (must be 'user' or 'assistant')`);
        }
        if (!msg.content) {
          errors.push(`Message ${index}: missing content`);
        }
      });
    }

    // Validate tools if present
    if (request.tools) {
      if (!Array.isArray(request.tools)) {
        errors.push('Field "tools" must be an array');
      } else {
        request.tools.forEach((tool: any, index: number) => {
          if (!tool.name) {
            errors.push(`Tool ${index}: missing name`);
          }
          if (!tool.input_schema) {
            errors.push(`Tool ${index}: missing input_schema`);
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateAnthropicResponse(response: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!response.id) {
      errors.push('Missing required field: id');
    }
    if (!response.model) {
      errors.push('Missing required field: model');
    }
    if (!response.content) {
      errors.push('Missing required field: content');
    } else if (!Array.isArray(response.content)) {
      errors.push('Field "content" must be an array');
    }
    if (!response.stop_reason) {
      warnings.push('Missing stop_reason');
    }

    // Validate content
    if (Array.isArray(response.content)) {
      response.content.forEach((item: any, index: number) => {
        if (!item.type) {
          errors.push(`Content ${index}: missing type`);
        } else if (!['text', 'tool_use', 'tool_result'].includes(item.type)) {
          errors.push(`Content ${index}: invalid type "${item.type}"`);
        }
      });
    }

    // Validate usage
    if (!response.usage) {
      warnings.push('Missing usage information');
    } else {
      if (typeof response.usage.input_tokens !== 'number') {
        warnings.push('Invalid or missing usage.input_tokens');
      }
      if (typeof response.usage.output_tokens !== 'number') {
        warnings.push('Invalid or missing usage.output_tokens');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // OpenAI format validation
  private validateOpenAIRequest(request: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!request.model) {
      errors.push('Missing required field: model');
    }
    if (!request.messages) {
      errors.push('Missing required field: messages');
    } else if (!Array.isArray(request.messages)) {
      errors.push('Field "messages" must be an array');
    }

    // Validate messages
    if (Array.isArray(request.messages)) {
      request.messages.forEach((msg: any, index: number) => {
        if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) {
          errors.push(`Message ${index}: invalid role`);
        }
        if (!msg.content && !msg.tool_calls) {
          errors.push(`Message ${index}: missing content or tool_calls`);
        }
      });
    }

    // Validate tools if present
    if (request.tools) {
      if (!Array.isArray(request.tools)) {
        errors.push('Field "tools" must be an array');
      } else {
        request.tools.forEach((tool: any, index: number) => {
          if (tool.type !== 'function') {
            errors.push(`Tool ${index}: type must be 'function'`);
          }
          if (!tool.function || !tool.function.name) {
            errors.push(`Tool ${index}: missing function.name`);
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateOpenAIResponse(response: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!response.id) {
      errors.push('Missing required field: id');
    }
    if (!response.model) {
      errors.push('Missing required field: model');
    }
    if (!response.choices) {
      errors.push('Missing required field: choices');
    } else if (!Array.isArray(response.choices)) {
      errors.push('Field "choices" must be an array');
    }

    // Validate choices
    if (Array.isArray(response.choices)) {
      response.choices.forEach((choice: any, index: number) => {
        if (typeof choice.index !== 'number') {
          errors.push(`Choice ${index}: missing or invalid index`);
        }
        if (!choice.message) {
          errors.push(`Choice ${index}: missing message`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Gemini format validation
  private validateGeminiRequest(request: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!request.contents) {
      errors.push('Missing required field: contents');
    } else if (!Array.isArray(request.contents)) {
      errors.push('Field "contents" must be an array');
    }

    // Validate contents
    if (Array.isArray(request.contents)) {
      request.contents.forEach((content: any, index: number) => {
        if (!content.role || !['user', 'model'].includes(content.role)) {
          errors.push(`Content ${index}: invalid role (must be 'user' or 'model')`);
        }
        if (!content.parts || !Array.isArray(content.parts)) {
          errors.push(`Content ${index}: missing or invalid parts array`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateGeminiResponse(response: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!response.candidates && !response.text) {
      errors.push('Missing candidates or text in response');
    }

    if (response.candidates) {
      if (!Array.isArray(response.candidates)) {
        errors.push('Field "candidates" must be an array');
      } else {
        response.candidates.forEach((candidate: any, index: number) => {
          if (!candidate.content) {
            errors.push(`Candidate ${index}: missing content`);
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // CodeWhisperer format validation
  private validateCodeWhispererRequest(request: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!request.fileContext) {
      errors.push('Missing required field: fileContext');
    } else {
      if (!request.fileContext.filename) {
        errors.push('Missing fileContext.filename');
      }
      if (!request.fileContext.programmingLanguage) {
        errors.push('Missing fileContext.programmingLanguage');
      }
      if (!request.fileContext.leftFileContent) {
        warnings.push('Missing fileContext.leftFileContent');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateCodeWhispererResponse(response: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!response.completions && !response.recommendations) {
      errors.push('Missing completions or recommendations in response');
    }

    if (response.completions) {
      if (!Array.isArray(response.completions)) {
        errors.push('Field "completions" must be an array');
      } else if (response.completions.length === 0) {
        warnings.push('Empty completions array');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Utility methods
  validateConvertedRequest(
    originalRequest: any,
    convertedRequest: any,
    sourceFormat: SupportedFormat,
    targetFormat: SupportedFormat
  ): ValidationResult {
    const sourceValidation = this.validateRequest(originalRequest, sourceFormat);
    const targetValidation = this.validateRequest(convertedRequest, targetFormat);

    const errors = [
      ...sourceValidation.errors.map(err => `Source: ${err}`),
      ...targetValidation.errors.map(err => `Target: ${err}`)
    ];

    const warnings = [
      ...sourceValidation.warnings.map(warn => `Source: ${warn}`),
      ...targetValidation.warnings.map(warn => `Target: ${warn}`)
    ];

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateConvertedResponse(
    originalResponse: any,
    convertedResponse: any,
    sourceFormat: SupportedFormat,
    targetFormat: SupportedFormat
  ): ValidationResult {
    const sourceValidation = this.validateResponse(originalResponse, sourceFormat);
    const targetValidation = this.validateResponse(convertedResponse, targetFormat);

    const errors = [
      ...sourceValidation.errors.map(err => `Source: ${err}`),
      ...targetValidation.errors.map(err => `Target: ${err}`)
    ];

    const warnings = [
      ...sourceValidation.warnings.map(warn => `Source: ${warn}`),
      ...targetValidation.warnings.map(warn => `Target: ${warn}`)
    ];

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Get validation summary
  getValidationSummary(results: ValidationResult[]): {
    totalValidations: number;
    validCount: number;
    invalidCount: number;
    totalErrors: number;
    totalWarnings: number;
  } {
    return {
      totalValidations: results.length,
      validCount: results.filter(r => r.valid).length,
      invalidCount: results.filter(r => !r.valid).length,
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0)
    };
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
    console.log('✅ FormatValidator shutdown completed');
  }
}

console.log('✅ FormatValidator loaded');