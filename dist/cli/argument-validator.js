"use strict";
/**
 * 命令行参数验证器
 *
 * 提供命令行参数的验证、类型转换和错误处理
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArgumentValidator = void 0;
/**
 * 参数验证器
 */
class ArgumentValidator {
    constructor() {
        this.commandRules = new Map();
        this.initializeValidationRules();
    }
    /**
     * 验证命令参数
     */
    validate(command) {
        const rules = this.commandRules.get(command.command) || [];
        const errors = [];
        const warnings = [];
        const normalizedOptions = { ...command.options };
        // 验证每个规则
        for (const rule of rules) {
            const value = normalizedOptions[rule.field];
            const result = this.validateField(rule, value);
            if (!result.valid) {
                errors.push({
                    field: rule.field,
                    message: result.error,
                    value,
                });
            }
            else if (result.normalized !== undefined) {
                normalizedOptions[rule.field] = result.normalized;
            }
            if (result.warning) {
                warnings.push({
                    field: rule.field,
                    message: result.warning,
                    suggestion: result.suggestion,
                });
            }
        }
        // 检查未知选项
        const knownFields = new Set(rules.map(r => r.field));
        for (const [field, value] of Object.entries(command.options)) {
            if (!knownFields.has(field)) {
                warnings.push({
                    field,
                    message: `Unknown option: ${field}`,
                    suggestion: `Remove --${this.kebabCase(field)} or check command help`,
                });
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            normalizedOptions,
        };
    }
    /**
     * 初始化验证规则
     */
    initializeValidationRules() {
        // Start 命令验证规则
        this.commandRules.set('start', [
            {
                field: 'port',
                type: 'port',
                min: 1024,
                max: 65535,
                custom: value => {
                    if (value && this.isPortInUse(value)) {
                        return `Port ${value} is already in use`;
                    }
                    return true;
                },
            },
            {
                field: 'host',
                type: 'string',
                pattern: /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$|^localhost$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
                custom: value => {
                    if (value && value !== 'localhost' && !this.isValidIP(value) && !this.isValidHostname(value)) {
                        return 'Invalid host format';
                    }
                    return true;
                },
            },
            {
                field: 'config',
                type: 'path',
                custom: value => {
                    if (value && !this.fileExists(value)) {
                        return `Configuration file not found: ${value}`;
                    }
                    return true;
                },
            },
            {
                field: 'debug',
                type: 'boolean',
            },
        ]);
        // Stop 命令验证规则
        this.commandRules.set('stop', [
            {
                field: 'port',
                type: 'port',
                min: 1024,
                max: 65535,
            },
            {
                field: 'force',
                type: 'boolean',
            },
        ]);
        // Code 命令验证规则
        this.commandRules.set('code', [
            {
                field: 'port',
                type: 'port',
                min: 1024,
                max: 65535,
            },
            {
                field: 'autoStart',
                type: 'boolean',
            },
            {
                field: 'export',
                type: 'boolean',
            },
        ]);
        // Status 命令验证规则
        this.commandRules.set('status', [
            {
                field: 'port',
                type: 'port',
                min: 1024,
                max: 65535,
            },
            {
                field: 'detailed',
                type: 'boolean',
            },
        ]);
        // Config 命令验证规则
        this.commandRules.set('config', [
            {
                field: 'list',
                type: 'boolean',
            },
            {
                field: 'validate',
                type: 'boolean',
            },
            {
                field: 'reset',
                type: 'boolean',
            },
            {
                field: 'path',
                type: 'path',
            },
        ]);
    }
    /**
     * 验证单个字段
     */
    validateField(rule, value) {
        // 检查必需字段
        if (rule.required && (value === undefined || value === null)) {
            return {
                valid: false,
                error: `Field ${rule.field} is required`,
            };
        }
        // 如果值为空且不是必需的，跳过验证
        if (value === undefined || value === null) {
            return { valid: true };
        }
        // 类型验证
        const typeResult = this.validateType(rule, value);
        if (!typeResult.valid) {
            return typeResult;
        }
        // 范围验证
        if (rule.min !== undefined || rule.max !== undefined) {
            const rangeResult = this.validateRange(rule, value);
            if (!rangeResult.valid) {
                return rangeResult;
            }
        }
        // 模式验证
        if (rule.pattern && typeof value === 'string') {
            if (!rule.pattern.test(value)) {
                return {
                    valid: false,
                    error: `Field ${rule.field} does not match required pattern`,
                };
            }
        }
        // 枚举验证
        if (rule.enum && !rule.enum.includes(value)) {
            return {
                valid: false,
                error: `Field ${rule.field} must be one of: ${rule.enum.join(', ')}`,
            };
        }
        // 自定义验证
        if (rule.custom) {
            const customResult = rule.custom(value);
            if (typeof customResult === 'string') {
                return {
                    valid: false,
                    error: customResult,
                };
            }
            if (!customResult) {
                return {
                    valid: false,
                    error: `Field ${rule.field} failed custom validation`,
                };
            }
        }
        return { valid: true, normalized: value };
    }
    /**
     * 验证类型
     */
    validateType(rule, value) {
        switch (rule.type) {
            case 'string':
                if (typeof value !== 'string') {
                    return {
                        valid: false,
                        error: `Field ${rule.field} must be a string`,
                    };
                }
                break;
            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    return {
                        valid: false,
                        error: `Field ${rule.field} must be a number`,
                    };
                }
                break;
            case 'boolean':
                if (typeof value !== 'boolean') {
                    return {
                        valid: false,
                        error: `Field ${rule.field} must be a boolean`,
                    };
                }
                break;
            case 'port':
                if (typeof value !== 'number' || !Number.isInteger(value)) {
                    return {
                        valid: false,
                        error: `Field ${rule.field} must be a valid port number`,
                    };
                }
                break;
            case 'path':
                if (typeof value !== 'string') {
                    return {
                        valid: false,
                        error: `Field ${rule.field} must be a valid file path`,
                    };
                }
                break;
            case 'url':
                if (typeof value !== 'string' || !this.isValidURL(value)) {
                    return {
                        valid: false,
                        error: `Field ${rule.field} must be a valid URL`,
                    };
                }
                break;
        }
        return { valid: true, normalized: value };
    }
    /**
     * 验证范围
     */
    validateRange(rule, value) {
        if (typeof value === 'number') {
            if (rule.min !== undefined && value < rule.min) {
                return {
                    valid: false,
                    error: `Field ${rule.field} must be at least ${rule.min}`,
                };
            }
            if (rule.max !== undefined && value > rule.max) {
                return {
                    valid: false,
                    error: `Field ${rule.field} must be at most ${rule.max}`,
                };
            }
        }
        if (typeof value === 'string') {
            if (rule.min !== undefined && value.length < rule.min) {
                return {
                    valid: false,
                    error: `Field ${rule.field} must be at least ${rule.min} characters long`,
                };
            }
            if (rule.max !== undefined && value.length > rule.max) {
                return {
                    valid: false,
                    error: `Field ${rule.field} must be at most ${rule.max} characters long`,
                };
            }
        }
        return { valid: true };
    }
    /**
     * 转换为kebab-case
     */
    kebabCase(str) {
        return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    }
    /**
     * 检查端口是否被使用（模拟实现）
     */
    isPortInUse(port) {
        // TODO: 实现实际的端口检查
        // 这里可以使用 net 模块检查端口是否可用
        return false;
    }
    /**
     * 验证IP地址
     */
    isValidIP(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4)
            return false;
        return parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255 && part === num.toString();
        });
    }
    /**
     * 验证主机名
     */
    isValidHostname(hostname) {
        if (hostname.length > 255)
            return false;
        const labels = hostname.split('.');
        return labels.every(label => {
            if (label.length === 0 || label.length > 63)
                return false;
            return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label);
        });
    }
    /**
     * 验证URL
     */
    isValidURL(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 检查文件是否存在（模拟实现）
     */
    fileExists(path) {
        // TODO: 实现实际的文件检查
        // 这里可以使用 fs 模块检查文件是否存在
        return true;
    }
}
exports.ArgumentValidator = ArgumentValidator;
//# sourceMappingURL=argument-validator.js.map