/**
 * 请求验证中间件
 *
 * 提供请求格式验证、内容类型检查和安全验证功能
 *
 * @author Jason Zhang
 */
import { MiddlewareFunction } from '../server/http-server';
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
export declare function validation(config?: ValidationConfig): MiddlewareFunction;
/**
 * 创建Anthropic API验证中间件
 */
export declare function anthropicValidation(): MiddlewareFunction;
/**
 * 创建OpenAI API验证中间件
 */
export declare function openaiValidation(): MiddlewareFunction;
/**
 * 创建Gemini API验证中间件
 */
export declare function geminiValidation(): MiddlewareFunction;
//# sourceMappingURL=validation.d.ts.map