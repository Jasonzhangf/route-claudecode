/**
 * RCC服务器启动器
 */

import * as fs from 'fs';
import * as path from 'path';
import { HTTPServer, ServerConfig } from './http-server';
import { ValidationLogger } from '../utils/validation-logger';
import { RCCError } from '../types';
import { VERSION } from '../index';

export interface RCCServerOptions {
  port: number;
  host: string;
  configPath?: string;
  debug?: boolean;
}

export async function startRCCServer(options: RCCServerOptions): Promise<void> {
  ValidationLogger.info('启动RCC服务器', {
    version: VERSION,
    port: options.port,
    host: options.host
  });
  
  try {
    const config = await loadConfiguration(options.configPath);
    
    const serverConfig: ServerConfig = {
      port: options.port,
      host: options.host,
      debug: options.debug || false,
      timeout: 30000,
      keepAliveTimeout: 5000
    };
    
    const server = new HTTPServer(serverConfig);
    
    server.addRoute('POST', '/v1/messages', async (req, res) => {
      try {
        // 动态导入流水线处理器
        const { processPipelineRequest } = await import('../pipeline/pipeline-processor');
        
        const result = await processPipelineRequest(req.body, {
          requestId: req.id,
          config: config
        });
        
        if (result.success) {
          res.body = result.response;
          res.statusCode = 200;
        } else {
          res.body = {
            error: result.error || 'Pipeline processing failed',
            message: result.message || 'Request could not be processed'
          };
          res.statusCode = 500;
        }
        
      } catch (error) {
        ValidationLogger.error('流水线处理失败', {
          requestId: req.id,
          error: error instanceof Error ? error.message : String(error)
        });
        
        res.body = {
          error: 'Pipeline processing failed',
          message: 'Internal server error during request processing'
        };
        res.statusCode = 500;
      }
    });
    
    await server.start();
    
    ValidationLogger.info('RCC服务器启动成功', {
      endpoint: `http://${options.host}:${options.port}`
    });
    
    setupGracefulShutdown(server);
    await keepServerAlive();
    
  } catch (error) {
    const rccError = error instanceof RCCError 
      ? error 
      : new RCCError('服务器启动失败', 'SERVER_START_FAILED');
    
    ValidationLogger.error('服务器启动失败', {
      code: rccError.code,
      message: rccError.message
    });
    
    process.exit(1);
  }
}

async function loadConfiguration(configPath?: string): Promise<any> {
  const homeDir = process.env.HOME || '.';
  const finalConfigPath = configPath || path.join(homeDir, '.route-claudecode/config.json');
  
  if (!fs.existsSync(finalConfigPath)) {
    return { providers: [] };
  }
  
  try {
    const configContent = fs.readFileSync(finalConfigPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    throw new RCCError('配置文件解析失败', 'CONFIG_PARSE_ERROR');
  }
}

function setupGracefulShutdown(server: HTTPServer): void {
  const gracefulShutdown = async (signal: string) => {
    ValidationLogger.info('收到关闭信号', { signal });
    
    try {
      await server.stop();
      ValidationLogger.info('服务器已关闭');
      process.exit(0);
    } catch (error) {
      ValidationLogger.error('服务器关闭失败', { error });
      process.exit(1);
    }
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

async function keepServerAlive(): Promise<void> {
  return new Promise(() => {
    // 保持运行
  });
}