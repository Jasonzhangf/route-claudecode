/**
 * HTTP请求上下文处理工具
 * 
 * 负责创建和管理HTTP请求/响应上下文
 * 
 * @author RCC v4.0
 */

import * as http from 'http';
import * as url from 'url';
import { 
  RequestContext, 
  ResponseContext, 
  HTTPMethod,
  ServerConfig 
} from './http-types';
import { RCCError } from '../../types/src/index';

/**
 * HTTP请求上下文管理器
 */
export class HTTPContextManager {
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  /**
   * 创建请求上下文
   */
  createRequestContext(req: http.IncomingMessage): RequestContext {
    const requestId = this.generateRequestId();
    const parsedUrl = url.parse(req.url || '', true);

    return {
      id: requestId,
      startTime: new Date(),
      method: (req.method || 'GET') as HTTPMethod,
      url: req.url || '/',
      headers: req.headers as Record<string, string | string[]>,
      query: parsedUrl.query as Record<string, string>,
      params: {},
      metadata: {},
    };
  }

  /**
   * 创建响应上下文
   */
  createResponseContext(req: RequestContext, originalResponse?: http.ServerResponse): ResponseContext {
    return {
      req,
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': req.id,
      },
      sent: false,
      _originalResponse: originalResponse,
    };
  }

  /**
   * 解析请求体
   */
  async parseRequestBody(req: http.IncomingMessage, context: RequestContext): Promise<void> {
    if (req.method === 'GET' || req.method === 'HEAD') {
      return;
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      req.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;

        if (totalSize > this.config.maxRequestSize!) {
          reject(new Error('Request body too large'));
          return;
        }

        chunks.push(chunk);
      });

      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8');

          if (body.trim()) {
            const contentType = req.headers['content-type'] || '';

            if (contentType.includes('application/json')) {
              try {
                context.body = JSON.parse(body);
              } catch (parseError) {
                const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown JSON parsing error';
                const contextualError = new Error(`Invalid JSON format in request body: ${errorMessage}. Body preview: ${body.substring(0, 200)}${body.length > 200 ? '...' : ''}`);
                
                if (this.config.debug) {
                  console.error('❌ JSON parsing failed:', {
                    error: errorMessage,
                    bodyLength: body.length,
                    bodyPreview: body.substring(0, 100),
                    contentType: contentType
                  });
                }
                
                reject(contextualError);
                return;
              }
            } else {
              context.body = body;
            }
          } else {
            context.body = undefined;
          }

          resolve();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
          const contextualError = new Error(`Failed to process request body: ${errorMessage}`);
          
          if (this.config.debug) {
            console.error('❌ Request body processing failed:', {
              error: errorMessage,
              totalSize: totalSize,
              chunksCount: chunks.length
            });
          }
          
          reject(contextualError);
        }
      });

      req.on('error', (error) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown request error';
        reject(new Error(`Request stream error: ${errorMessage}`));
      });
    });
  }

  /**
   * 发送HTTP响应
   */
  async sendResponse(res: http.ServerResponse, context: ResponseContext): Promise<void> {
    if (context.sent) {
      return;
    }

    context.sent = true;

    // 设置响应头
    for (const [key, value] of Object.entries(context.headers)) {
      if (value !== undefined && value !== null) {
        res.setHeader(key, value);
      }
    }

    res.statusCode = context.statusCode;

    // 发送响应体
    if (context.body !== undefined) {
      // 检查是否为流式响应
      if (typeof context.body === 'object' && context.body !== null && 'chunks' in context.body) {
        // 处理流式响应
        const streamResponse = context.body as any;
        if (Array.isArray(streamResponse.chunks)) {
          // 设置流式响应头
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          // 发送每个chunk
          for (const chunk of streamResponse.chunks) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          res.end();
        } else {
          res.end(JSON.stringify(context.body, null, 2));
        }
      } else if (typeof context.body === 'object') {
        res.end(JSON.stringify(context.body, null, 2));
      } else {
        res.end(String(context.body));
      }
    } else {
      res.end();
    }

    if (this.config.debug) {
      const duration = Date.now() - context.req.startTime.getTime();
      console.log(
        `📤 ${context.statusCode} ${context.req.method} ${context.req.url} [${context.req.id}] ${duration}ms`
      );
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}