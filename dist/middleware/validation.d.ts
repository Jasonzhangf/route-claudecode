/**
 * 请求验证中间件
 *
 * 提供请求格式验证、内容类型检查和安全验证功能
 *
 * @author Jason Zhang
 */
import { IMiddlewareFunction } from '../interfaces/core/server-interface';
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
export declare function validation(config?: ValidationConfig): IMiddlewareFunction;
/**
 * 创建Anthropic API验证中间件
 */
export declare function anthropicValidation(): any;
/**
 * 创建OpenAI API验证中间件
 */
export declare function openaiValidation(): any;
/**
 * 创建Gemini API验证中间件
 */
export declare function geminiValidation(): any;
//# sourceMappingURL=validation.d.ts.map