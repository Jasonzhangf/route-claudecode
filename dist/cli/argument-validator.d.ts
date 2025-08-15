/**
 * 命令行参数验证器
 *
 * 提供命令行参数的验证、类型转换和错误处理
 *
 * @author Jason Zhang
 */
import { ParsedCommand } from '../interfaces';
/**
 * 验证规则定义
 */
export interface ValidationRule {
    field: string;
    type: 'string' | 'number' | 'boolean' | 'port' | 'path' | 'url';
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: string[];
    custom?: (value: any) => boolean | string;
}
/**
 * 验证结果
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    normalizedOptions: Record<string, any>;
}
/**
 * 验证错误
 */
export interface ValidationError {
    field: string;
    message: string;
    value: any;
}
/**
 * 验证警告
 */
export interface ValidationWarning {
    field: string;
    message: string;
    suggestion?: string;
}
/**
 * 参数验证器
 */
export declare class ArgumentValidator {
    private commandRules;
    constructor();
    /**
     * 验证命令参数
     */
    validate(command: ParsedCommand): ValidationResult;
    /**
     * 初始化验证规则
     */
    private initializeValidationRules;
    /**
     * 验证单个字段
     */
    private validateField;
    /**
     * 验证类型
     */
    private validateType;
    /**
     * 验证范围
     */
    private validateRange;
    /**
     * 转换为kebab-case
     */
    private kebabCase;
    /**
     * 检查端口是否被使用（模拟实现）
     */
    private isPortInUse;
    /**
     * 验证IP地址
     */
    private isValidIP;
    /**
     * 验证主机名
     */
    private isValidHostname;
    /**
     * 验证URL
     */
    private isValidURL;
    /**
     * 检查文件是否存在（模拟实现）
     */
    private fileExists;
}
//# sourceMappingURL=argument-validator.d.ts.map