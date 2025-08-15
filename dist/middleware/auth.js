"use strict";
/**
 * 认证中间件
 *
 * 处理API密钥验证和用户认证
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = auth;
exports.apiKeyAuth = apiKeyAuth;
exports.bearerAuth = bearerAuth;
exports.basicAuth = basicAuth;
/**
 * 创建认证中间件
 */
function auth(options) {
    const { type, validate, headerName = 'Authorization', cookieName = 'auth-token', queryParam = 'token', required = true, message = 'Authentication required' } = options;
    return async (req, res, next) => {
        try {
            const token = extractToken(req, type, headerName, cookieName, queryParam);
            if (!token) {
                if (required) {
                    res.statusCode = 401;
                    res.body = { error: 'Unauthorized', message };
                    return;
                }
                else {
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
        }
        catch (error) {
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
function extractToken(req, type, headerName, cookieName, queryParam) {
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
function parseCookies(cookieHeader) {
    const cookies = {};
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
function apiKeyAuth(validApiKeys) {
    return auth({
        type: 'apikey',
        headerName: 'X-API-Key',
        validate: (token) => {
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
function bearerAuth(validateToken) {
    return auth({
        type: 'bearer',
        validate: validateToken
    });
}
/**
 * 创建Basic认证中间件
 */
function basicAuth(validateCredentials) {
    return auth({
        type: 'basic',
        validate: async (token) => {
            try {
                const credentials = Buffer.from(token, 'base64').toString('utf-8');
                const [username, password] = credentials.split(':');
                if (!username || !password) {
                    return null;
                }
                return await validateCredentials(username, password);
            }
            catch {
                return null;
            }
        }
    });
}
//# sourceMappingURL=auth.js.map