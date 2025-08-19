/**
 * 简化版RCC4服务器 - 直接HTTP绑定实现
 * 绕过复杂的Pipeline架构，直接实现HTTP服务器
 */

import * as http from 'http';
import { URL } from 'url';

interface SimpleServerConfig {
  port: number;
  host: string;
  debug?: boolean;
}

export class SimpleRCCServer {
  private server: http.Server | null = null;
  private config: SimpleServerConfig;
  private isRunning = false;

  constructor(config: SimpleServerConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch(error => {
          this.handleError(error, req, res);
        });
      });

      this.server.on('error', (error) => {
        console.error(`❌ HTTP Server error:`, error);
        reject(error);
      });

      console.log(`🚀 Starting Simple RCC Server on ${this.config.host}:${this.config.port}`);
      
      this.server.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        console.log(`✅ Simple RCC Server started successfully on http://${this.config.host}:${this.config.port}`);
        console.log(`🌐 Server is ready to accept connections`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false;
        this.server = null;
        console.log('🛑 Simple RCC Server stopped');
        resolve();
      });
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method || 'GET';
    const url = req.url || '/';
    
    console.log(`📥 ${method} ${url}`);

    // Health check endpoint
    if (url === '/health' && method === 'GET') {
      this.sendJSON(res, 200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: 'Simple RCC Server',
        version: '4.0.0'
      });
      return;
    }

    // Anthropic Messages API
    if (url === '/v1/messages' && method === 'POST') {
      const body = await this.parseRequestBody(req);
      console.log(`📦 Anthropic request:`, body);
      
      if (!body || !body.model || !body.messages) {
        this.sendJSON(res, 400, {
          error: 'Bad Request',
          message: 'Invalid Anthropic request format'
        });
        return;
      }

      // Simple response generation
      const response = {
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [
          {
            type: 'text',
            text: '这是RCC4简化服务器的测试响应。HTTP服务器工作正常！'
          }
        ],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: this.countTokens(body.messages),
          output_tokens: 15
        }
      };

      this.sendJSON(res, 200, response);
      return;
    }

    // OpenAI Chat Completions API  
    if (url === '/v1/chat/completions' && method === 'POST') {
      const body = await this.parseRequestBody(req);
      console.log(`📦 OpenAI request:`, body);
      
      if (!body || !body.model || !body.messages) {
        this.sendJSON(res, 400, {
          error: 'Bad Request',
          message: 'Invalid OpenAI request format'
        });
        return;
      }

      const response = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'RCC4简化服务器正常运行，HTTP绑定成功！'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: this.countTokens(body.messages),
          completion_tokens: 12,
          total_tokens: this.countTokens(body.messages) + 12
        }
      };

      this.sendJSON(res, 200, response);
      return;
    }

    // Default 404
    this.sendJSON(res, 404, {
      error: 'Not Found',
      message: `Endpoint ${method} ${url} not found`
    });
  }

  private async parseRequestBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve(parsed);
        } catch (error) {
          reject(new Error('Invalid JSON in request body'));
        }
      });
      
      req.on('error', reject);
    });
  }

  private sendJSON(res: http.ServerResponse, statusCode: number, data: any): void {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });
    res.end(JSON.stringify(data, null, 2));
  }

  private countTokens(messages: any[]): number {
    if (!Array.isArray(messages)) return 0;
    return messages.reduce((total, msg) => {
      const content = msg.content || '';
      return total + Math.ceil(content.length / 4); // Rough token estimation
    }, 0);
  }

  private handleError(error: any, req: http.IncomingMessage, res: http.ServerResponse): void {
    console.error(`❌ Request error:`, error);
    
    if (!res.headersSent) {
      this.sendJSON(res, 500, {
        error: 'Internal Server Error',
        message: 'Request processing failed'
      });
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.config.port,
      host: this.config.host,
      server: 'Simple RCC Server'
    };
  }
}