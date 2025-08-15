/**
 * 请求验证中间件
 * 
 * 提供请求格式验证、内容类型检查和安全验证功能
 * 
 * @author Jason Zhang
 */

import { IMiddlewareFunction } from '../interfaces/core/middleware-interface';

/**
 * 验证中间件配置
 */
export interface ValidationConfig {
  maxBodySize?: number;
  validateContentType?: boolean;
  allowedContentTypes?: string[];
  validateJson?: boolean;
  requireAuth?: boolean;
  customValidators?: Array<(req: any) => boolean | string>;
}

/**
 * 创建验证中间件
 */
export function validation(config: ValidationConfig = {}): IMiddlewareFunction {
  const {
    maxBodySize = 10 * 1024 * 1024, // 10MB
    validateContentType = true,
    allowedContentTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'text/plain',
      'multipart/form-data'
    ],
    validateJson = true,
    requireAuth = false,
    customValidators = []
  } = config;

  return async (req, res, next) => {
    try {
      // 1. 检查请求体大小
      if (req.body) {
        const bodySize = JSON.stringify(req.body).length;
        if (bodySize > maxBodySize) {
          res.statusCode = 413;
          res.body = {
            error: 'Payload Too Large',
            message: `Request body size (${bodySize} bytes) exceeds maximum allowed size (${maxBodySize} bytes)`
          };
          return;
        }
      }

      // 2. 验证Content-Type
      if (validateContentType && req.method !== 'GET' && req.method !== 'HEAD') {
        const contentType = req.headers['content-type'] as string;
        
        if (contentType) {
          const baseContentType = contentType.split(';')[0]?.trim();
          
          if (baseContentType && !allowedContentTypes.includes(baseContentType)) {
            res.statusCode = 415;
            res.body = {
              error: 'Unsupported Media Type',
              message: `Content-Type '${baseContentType}' is not supported. Allowed types: ${allowedContentTypes.join(', ')}`
            };
            return;
          }
        }
      }

      // 3. 验证JSON格式
      if (validateJson && req.body && typeof req.body === 'string') {
        try {
          req.body = JSON.parse(req.body);
        } catch (error) {
          res.statusCode = 400;
          res.body = {
            error: 'Bad Request',
            message: 'Invalid JSON format in request body'
          };
          return;
        }
      }

      // 4. 认证检查
      if (requireAuth) {
        const authHeader = req.headers['authorization'] as string;
        
        if (!authHeader) {
          res.statusCode = 401;
          res.body = {
            error: 'Unauthorized',
            message: 'Authorization header is required'
          };
          return;
        }

        if (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('Basic ')) {
          res.statusCode = 401;
          res.body = {
            error: 'Unauthorized',
            message: 'Invalid authorization header format. Expected Bearer or Basic authentication'
          };
          return;
        }
      }

      // 5. 自定义验证器
      for (const validator of customValidators) {
        const result = validator(req);
        
        if (result !== true) {
          res.statusCode = 400;
          res.body = {
            error: 'Validation Failed',
            message: typeof result === 'string' ? result : 'Custom validation failed'
          };
          return;
        }
      }

      // 6. API特定验证
      await validateApiRequest(req, res);

      next();
      
    } catch (error) {
      res.statusCode = 500;
      res.body = {
        error: 'Internal Server Error',
        message: 'Validation middleware error'
      };
      next(error as Error);
    }
  };
}

/**
 * API请求特定验证
 */
async function validateApiRequest(req: any, res: any): Promise<void> {
  const url = req.url;
  const method = req.method;
  const body = req.body;

  // Anthropic API验证
  if (url === '/v1/messages' && method === 'POST') {
    if (!body || !body.messages || !Array.isArray(body.messages)) {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Invalid Anthropic request: messages array is required'
      };
      return;
    }

    for (const message of body.messages) {
      if (!message.role || !message.content) {
        res.statusCode = 400;
        res.body = {
          error: 'Bad Request',
          message: 'Invalid message format: role and content are required'
        };
        return;
      }

      if (!['user', 'assistant', 'system'].includes(message.role)) {
        res.statusCode = 400;
        res.body = {
          error: 'Bad Request',
          message: `Invalid message role: ${message.role}. Must be user, assistant, or system`
        };
        return;
      }
    }

    if (body.model && typeof body.model !== 'string') {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Model must be a string'
      };
      return;
    }

    if (body.max_tokens && (typeof body.max_tokens !== 'number' || body.max_tokens <= 0)) {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'max_tokens must be a positive number'
      };
      return;
    }
  }

  // OpenAI API验证
  if (url === '/v1/chat/completions' && method === 'POST') {
    if (!body || !body.messages || !Array.isArray(body.messages)) {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Invalid OpenAI request: messages array is required'
      };
      return;
    }

    for (const message of body.messages) {
      if (!message.role || !message.content) {
        res.statusCode = 400;
        res.body = {
          error: 'Bad Request',
          message: 'Invalid message format: role and content are required'
        };
        return;
      }

      if (!['user', 'assistant', 'system', 'tool'].includes(message.role)) {
        res.statusCode = 400;
        res.body = {
          error: 'Bad Request',
          message: `Invalid message role: ${message.role}. Must be user, assistant, system, or tool`
        };
        return;
      }
    }

    if (!body.model || typeof body.model !== 'string') {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Model parameter is required and must be a string'
      };
      return;
    }
  }

  // Gemini API验证
  if (url.includes('/v1beta/models/') && url.includes('/generateContent') && method === 'POST') {
    if (!body || !body.contents || !Array.isArray(body.contents)) {
      res.statusCode = 400;
      res.body = {
        error: 'Bad Request',
        message: 'Invalid Gemini request: contents array is required'
      };
      return;
    }

    for (const content of body.contents) {
      if (!content.parts || !Array.isArray(content.parts)) {
        res.statusCode = 400;
        res.body = {
          error: 'Bad Request',
          message: 'Invalid content format: parts array is required'
        };
        return;
      }

      for (const part of content.parts) {
        if (!part.text && !part.inlineData) {
          res.statusCode = 400;
          res.body = {
            error: 'Bad Request',
            message: 'Invalid part format: text or inlineData is required'
          };
          return;
        }
      }
    }
  }
}

/**
 * 创建Anthropic API验证中间件
 */
export function anthropicValidation(): MiddlewareFunction {
  return validation({
    validateJson: true,
    customValidators: [
      (req) => {
        if (req.url === '/v1/messages' && req.method === 'POST') {
          const body = req.body;
          if (!body || !body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
            return 'Anthropic API requires messages array';
          }
        }
        return true;
      }
    ]
  });
}

/**
 * 创建OpenAI API验证中间件
 */
export function openaiValidation(): MiddlewareFunction {
  return validation({
    validateJson: true,
    customValidators: [
      (req) => {
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
          const body = req.body;
          if (!body || !body.model || typeof body.model !== 'string') {
            return 'OpenAI API requires model parameter';
          }
          if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
            return 'OpenAI API requires messages array';
          }
        }
        return true;
      }
    ]
  });
}

/**
 * 创建Gemini API验证中间件
 */
export function geminiValidation(): MiddlewareFunction {
  return validation({
    validateJson: true,
    customValidators: [
      (req) => {
        if (req.url.includes('/generateContent') && req.method === 'POST') {
          const body = req.body;
          if (!body || !body.contents || !Array.isArray(body.contents) || body.contents.length === 0) {
            return 'Gemini API requires contents array';
          }
        }
        return true;
      }
    ]
  });
}