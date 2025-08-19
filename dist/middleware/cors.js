"use strict";
/**
 * CORS中间件
 *
 * 处理跨域资源共享
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cors = cors;
/**
 * 创建CORS中间件
 */
function cors(options = {}) {
    const { origin = '*', methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders = ['Content-Type', 'Authorization', 'X-Request-ID'], exposedHeaders = ['X-Request-ID'], credentials = false, maxAge = 86400, // 24小时
     } = options;
    return (req, res, next) => {
        // 设置Access-Control-Allow-Origin
        if (typeof origin === 'boolean') {
            if (origin) {
                res.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
            }
        }
        else if (typeof origin === 'string') {
            res.headers['Access-Control-Allow-Origin'] = origin;
        }
        else if (Array.isArray(origin)) {
            const requestOrigin = req.headers.origin;
            if (origin.includes(requestOrigin)) {
                res.headers['Access-Control-Allow-Origin'] = requestOrigin;
            }
        }
        // 设置其他CORS头
        res.headers['Access-Control-Allow-Methods'] = methods.join(', ');
        res.headers['Access-Control-Allow-Headers'] = allowedHeaders.join(', ');
        res.headers['Access-Control-Expose-Headers'] = exposedHeaders.join(', ');
        res.headers['Access-Control-Max-Age'] = maxAge.toString();
        if (credentials) {
            res.headers['Access-Control-Allow-Credentials'] = 'true';
        }
        // 处理预检请求
        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.body = '';
            return;
        }
        next();
    };
}
//# sourceMappingURL=cors.js.map