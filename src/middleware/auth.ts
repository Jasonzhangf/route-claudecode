/**
 * 认证中间件
 * 
 * 处理API密钥验证和用户认证
 * 
 * @author Jason Zhang
 */

import { MiddlewareFunction } from '../server/http-server';

/**
 * 认证配置选项
 */
export interface AuthOptions {
  type: 'apikey' | 'bearer' | 'basic';
  validate: (token: string) => Promise<any> | any;
  headerName?: string;
  cookieName?: string;
  queryParam?: string;
  required?: boolean;
  message?: string;
}

/**
 * 创建认证中间件
 */
export function auth(options: AuthOptions): MiddlewareFunction {
  const {
    type,
    validate,
    headerName = 'Authorization',
    cookieName = 'auth-token',
    queryParam = 'token',
    required = true,
    message = 'Authentication required'
  } = options;
  
  return async (req, res, next) => {
    try {
      const token = extractToken(req, type, headerName, cookieName, queryParam);
      
      if (!token) {
        if (required) {
          res.statusCode = 401;
          res.body = { error: 'Unauthorized', message };
          return;
        } else {
          return next();
        }
      }
      
      // 验证令牌
      const user = await validate(token);
      
      if (!user) {
        res.statusCode = 401;
        res.body = { error: 'Unauthorized', message: 'Invalid credentials' };
        return;
      }
      
      // 将用户信息附加到请求上下文
      req.user = user;
      
      next();
      
    } catch (error) {
      res.statusCode = 401;
      res.body = { 
        error: 'Unauthorized', 
        message: error instanceof Error ? error.message : 'Authentication failed' 
      };
    }
  };
}

/**
 * 提取认证令牌
 */
function extractToken(
  req: any,
  type: string,
  headerName: string,
  cookieName: string,
  queryParam: string
): string | null {
  // 从请求头提取
  const headerValue = req.headers[headerName.toLowerCase()];
  if (headerValue) {
    switch (type) {
      case 'bearer':
        if (typeof headerValue === 'string' && headerValue.startsWith('Bearer ')) {
          return headerValue.substring(7);
        }
        break;
        
      case 'basic':
        if (typeof headerValue === 'string' && headerValue.startsWith('Basic ')) {
          return headerValue.substring(6);
        }
        break;
        
      case 'apikey':
        if (typeof headerValue === 'string') {
          return headerValue;
        }
        break;
    }
  }
  
  // 从查询参数提取
  if (req.query[queryParam]) {
    return req.query[queryParam];
  }
  
  // 从Cookie提取（简单实现）
  const cookieHeader = req.headers.cookie;
  if (cookieHeader && typeof cookieHeader === 'string') {
    const cookies = parseCookies(cookieHeader);
    if (cookies[cookieName]) {
      return cookies[cookieName];
    }
  }
  
  return null;
}

/**
 * 解析Cookie头
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}

/**
 * 创建API密钥认证中间件
 */
export function apiKeyAuth(validApiKeys: string[]): MiddlewareFunction {
  return auth({
    type: 'apikey',
    headerName: 'X-API-Key',
    validate: (token: string) => {
      if (validApiKeys.includes(token)) {
        return { apiKey: token, type: 'api-key' };
      }
      return null;
    }
  });
}

/**
 * 创建Bearer令牌认证中间件
 */
export function bearerAuth(validateToken: (token: string) => Promise<any> | any): MiddlewareFunction {
  return auth({
    type: 'bearer',
    validate: validateToken
  });
}

/**
 * 创建Basic认证中间件
 */
export function basicAuth(validateCredentials: (username: string, password: string) => Promise<any> | any): MiddlewareFunction {
  return auth({
    type: 'basic',
    validate: async (token: string) => {
      try {
        const credentials = Buffer.from(token, 'base64').toString('utf-8');
        const [username, password] = credentials.split(':');
        
        if (!username || !password) {
          return null;
        }
        
        return await validateCredentials(username, password);
      } catch {
        return null;
      }
    }
  });
}

/**
 * 简单认证配置
 */
export interface SimpleAuthConfig {
  required?: boolean;
  apiKeyHeader?: string;
  bearerHeader?: string;
  basicAuth?: boolean;
}

/**
 * 创建简单认证中间件 - 与PipelineServer兼容
 */
export function authentication(config: SimpleAuthConfig = {}): MiddlewareFunction {
  const {
    required = false,
    apiKeyHeader = 'X-API-Key',
    bearerHeader = 'Authorization',
    basicAuth: enableBasic = true
  } = config;

  return async (req, res, next) => {
    // 如果不要求认证，直接通过
    if (!required) {
      return next();
    }

    // 检查API密钥
    const apiKey = req.headers[apiKeyHeader.toLowerCase()];
    if (apiKey) {
      req.user = { type: 'api-key', key: apiKey };
      return next();
    }

    // 检查Bearer令牌
    const authHeader = req.headers[bearerHeader.toLowerCase()] as string;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      req.user = { type: 'bearer', token: authHeader.substring(7) };
      return next();
    }

    // 检查Basic认证
    if (enableBasic && authHeader && authHeader.startsWith('Basic ')) {
      req.user = { type: 'basic', token: authHeader.substring(6) };
      return next();
    }

    // 如果必须认证但没有提供凭据
    if (required) {
      res.statusCode = 401;
      res.body = {
        error: 'Unauthorized',
        message: 'Authentication required'
      };
      return;
    }

    next();
  };
}