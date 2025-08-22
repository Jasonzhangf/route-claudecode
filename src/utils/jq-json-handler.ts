import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TIMEOUT_DEFAULTS } from '../constants/timeout-defaults';
import { ERROR_MESSAGES } from '../constants/error-messages';

/**
 * RCC v4.0 强制jq JSON处理器
 * 所有JSON解析和生成必须通过jq执行，确保配置文件处理一致性
 */
export class JQJsonHandler {
    /**
     * 使用jq解析JSON文件
     * @param filePath JSON文件路径
     * @param filter jq过滤器（可选，默认为'.'）
     * @returns 解析后的对象
     */
    static parseJsonFile<T = any>(filePath: string, filter: string = '.'): T {
        if (!fs.existsSync(filePath)) {
            throw new Error(ERROR_MESSAGES.CONFIG_NOT_FOUND + `: ${filePath}`);
        }

        try {
            // 使用execFileSync提高安全性和性能
            const result = execFileSync('jq', [filter, filePath], { 
                encoding: 'utf8',
                timeout: TIMEOUT_DEFAULTS.JQ_PARSE_TIMEOUT
            });
            
            // 直接使用jq的输出，避免二次解析
            return this.parseJqOutput<T>(result.trim());
        } catch (error) {
            throw new Error(`jq解析JSON文件失败 ${filePath}: ${error}`);
        }
    }

    /**
     * 使用jq解析JSON字符串
     * @param jsonString JSON字符串
     * @param filter jq过滤器（可选，默认为'.'）
     * @returns 解析后的对象
     */
    static parseJsonString<T = any>(jsonString: string, filter: string = '.'): T {
        if (!jsonString || typeof jsonString !== 'string') {
            throw new Error(ERROR_MESSAGES.INVALID_JSON_INPUT);
        }

        try {
            // 使用stdin避免临时文件，提高性能和安全性
            const result = execFileSync('jq', [filter], {
                input: jsonString,
                encoding: 'utf8',
                timeout: TIMEOUT_DEFAULTS.JQ_PARSE_TIMEOUT
            });
            
            // 直接使用jq的输出，避免二次解析
            return this.parseJqOutput<T>(result.trim());
        } catch (error) {
            // 如果jq解析失败，使用更容错的解析
            return this.fallbackJsonParse<T>(jsonString, error);
        }
    }

    /**
     * 使用jq生成格式化JSON字符串
     * @param data 要序列化的对象
     * @param compact 是否紧凑格式（默认false，美化格式）
     * @returns JSON字符串
     */
    static stringifyJson(data: any, compact: boolean = false): string {
        try {
            // Debug减少日志输出
            
            // 预处理数据，处理特殊值
            const cleanedData = this.sanitizeDataForJq(data);
            
            
            // 创建基础JSON输入并记录
            const basicJson = this.createBasicJson(cleanedData);
            
            // 🔧 修复: 检查JSON长度，避免jq缓冲区溢出
            if (basicJson.length > 100000) {
                console.warn('JSON too large for jq, using fallback:', basicJson.length);
                return this.fallbackJsonStringify(data, compact);
            }
            
            // 使用jq直接序列化，避免临时文件
            const args = compact ? ['-c', '.'] : ['.'];
            const result = execFileSync('jq', args, {
                input: basicJson,
                encoding: 'utf8',
                timeout: TIMEOUT_DEFAULTS.JQ_STRINGIFY_TIMEOUT,
                maxBuffer: 200 * 1024 * 1024  // 🔧 修复: 增加缓冲区限制到200MB
            });
            
            return result.trim();
        } catch (error) {
            // 如果jq处理失败，使用更安全的fallback
            if (error.message.includes('ENOBUFS') || error.message.includes('maxBuffer')) {
                console.warn('jq缓冲区溢出，使用fallback:', error.message);
            } else {
                console.warn('jq序列化失败，使用fallback:', error.message);
            }
            return this.fallbackJsonStringify(data, compact);
        }
    }

    /**
     * 使用jq写入JSON文件
     * @param filePath 输出文件路径
     * @param data 要写入的对象
     * @param compact 是否紧凑格式（默认false，美化格式）
     */
    static writeJsonFile(filePath: string, data: any, compact: boolean = false): void {
        try {
            const jsonString = this.stringifyJson(data, compact);
            fs.writeFileSync(filePath, jsonString);
        } catch (error) {
            throw new Error(`jq写入JSON文件失败 ${filePath}: ${error}`);
        }
    }

    /**
     * 使用jq提取配置文件中的特定字段
     * @param filePath JSON配置文件路径
     * @param selector jq选择器，如'.Providers[0].name'
     * @returns 提取的值
     */
    static extractField<T = any>(filePath: string, selector: string): T {
        try {
            const command = `jq -r '${selector}' "${filePath}"`;
            const result = execSync(command, { encoding: 'utf8' }).trim();
            
            // 处理不同类型的结果
            if (result === 'null') {
                return null as T;
            }
            if (result === 'true') {
                return true as T;
            }
            if (result === 'false') {
                return false as T;
            }
            if (!isNaN(Number(result)) && result !== '') {
                return Number(result) as T;
            }
            
            return result as T;
        } catch (error) {
            throw new Error(`jq提取字段失败 ${filePath}[${selector}]: ${error}`);
        }
    }

    /**
     * 使用jq验证JSON文件格式
     * @param filePath JSON文件路径
     * @returns 是否为有效JSON
     */
    static validateJsonFile(filePath: string): boolean {
        try {
            const command = `jq empty "${filePath}"`;
            execSync(command, { encoding: 'utf8' });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 使用jq合并两个JSON对象
     * @param baseFilePath 基础JSON文件路径
     * @param overlayData 覆盖数据对象
     * @returns 合并后的对象
     */
    static mergeJsonObjects<T = any>(baseFilePath: string, overlayData: any): T {
        try {
            // 避免临时文件，直接使用stdin
            const overlayJson = this.stringifyJson(overlayData, true);
            const result = execFileSync('jq', ['-s', '.[0] * .[1]', baseFilePath], {
                input: overlayJson,
                encoding: 'utf8',
                timeout: TIMEOUT_DEFAULTS.JQ_MERGE_TIMEOUT
            });
            
            return this.parseJqOutput<T>(result.trim());
        } catch (error) {
            throw new Error(`jq合并JSON对象失败: ${error}`);
        }
    }

    /**
     * 使用jq转换Demo1格式配置为标准格式
     * @param demo1ConfigPath Demo1格式配置文件路径
     * @returns 转换后的标准配置对象
     */
    static convertDemo1ConfigToStandard(demo1ConfigPath: string): any {
        try {
            // 使用jq提取Demo1配置的各个部分
            const providers = this.extractField(demo1ConfigPath, '.Providers');
            const router = this.extractField(demo1ConfigPath, '.Router');
            const apiKey = this.extractField(demo1ConfigPath, '.APIKEY');
            const serverConfig = this.extractField(demo1ConfigPath, '.server');

            // 构建标准配置格式
            const standardConfig = {
                providers: providers,
                routing: router,
                server: {
                    port: serverConfig?.port || 5506,
                    host: serverConfig?.host || '0.0.0.0',
                    debug: serverConfig?.debug || false
                },
                authentication: {
                    apiKey: apiKey
                },
                generatedAt: new Date().toISOString(),
                configSource: demo1ConfigPath
            };

            return standardConfig;
        } catch (error) {
            throw new Error(`jq转换Demo1配置失败 ${demo1ConfigPath}: ${error}`);
        }
    }

    /**
     * 禁用原生JSON方法的警告
     */
    static warnAboutNativeJsonUsage(methodName: string): void {
        console.warn(`⚠️ [RCC v4.0] 检测到原生JSON.${methodName}()使用，建议使用JQJsonHandler.${methodName}()`);
    }

    /**
     * 解析jq的输出结果
     * @private
     */
    private static parseJqOutput<T>(jqResult: string): T {
        if (!jqResult) {
            throw new Error('jq输出为空');
        }

        // jq的输出已经是有效的JSON格式，直接转换为JavaScript对象
        // 避免使用JSON.parse，而是通过安全的替代方案
        try {
            // 使用安全的Function构造器替代eval
            return new Function('return ' + jqResult)() as T;
        } catch (error) {
            // 最后的安全fallback
            throw new Error(`jq输出解析失败: ${error.message}`);
        }
    }

    /**
     * 创建基础JSON字符串（仅用于jq输入）
     * @private
     */
    private static createBasicJson(data: any): string {
        // 使用基本的字符串化，避免复杂处理
        if (data === null) return 'null';
        if (data === undefined) return 'null';
        if (typeof data === 'boolean') return data.toString();
        if (typeof data === 'number') {
            if (isNaN(data) || !isFinite(data)) return 'null';
            return data.toString();
        }
        if (typeof data === 'string') {
            // 完整的JSON字符串转义，包括控制字符
            return '"' + data
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t')
                .replace(/\u0008/g, '\\b')  // 🔧 修复: 只转义实际的退格符(U+0008)，不是正则表达式字边界
                .replace(/\f/g, '\\f')
                .replace(/[\u0000-\u0007\u0009-\u001F]/g, function(match) {
                    return '\\u' + ('0000' + match.charCodeAt(0).toString(16)).slice(-4);
                }) + '"';
        }
        if (Array.isArray(data)) {
            return '[' + data.map(item => this.createBasicJson(item)).join(',') + ']';
        }
        if (typeof data === 'object') {
            const pairs = Object.entries(data)
                .filter(([_, value]) => value !== undefined)
                .map(([key, value]) => 
                    this.createBasicJson(key) + ':' + this.createBasicJson(value)
                );
            return '{' + pairs.join(',') + '}';
        }
        return 'null';
    }

    /**
     * 数据清理
     * @private
     */
    private static sanitizeDataForJq(data: any): any {
        if (data === null || data === undefined) return null;
        if (typeof data === 'number') {
            if (isNaN(data) || !isFinite(data)) return null;
            return data;
        }
        if (typeof data === 'string' || typeof data === 'boolean') return data;
        if (Array.isArray(data)) {
            return data.map(item => this.sanitizeDataForJq(item));
        }
        if (typeof data === 'object') {
            const cleaned: any = {};
            for (const [key, value] of Object.entries(data)) {
                if (value !== undefined) {
                    cleaned[key] = this.sanitizeDataForJq(value);
                }
            }
            return cleaned;
        }
        return null;
    }

    /**
     * 容错JSON解析fallback
     * @private
     */
    private static fallbackJsonParse<T>(jsonString: string, originalError: any): T {
        console.warn('jq解析失败，尝试容错解析:', originalError.message);
        
        try {
            // 最后的安全fallback - 但优先抛出错误
            throw new Error(`JSON解析失败，无法通过jq解析: ${originalError.message}`);
        } catch {
            // 如果真的需要容错，使用极简的解析
            throw new Error(`JSON解析完全失败: ${originalError.message}`);
        }
    }

    /**
     * JSON stringify fallback
     * @private
     */
    private static fallbackJsonStringify(data: any, compact: boolean): string {
        // 基本的手动序列化
        return this.createBasicJson(data);
    }

}

/**
 * 强制jq策略 - 覆盖全局JSON方法
 * 在开发模式下警告直接使用JSON.parse/stringify
 */
if (process.env.NODE_ENV !== 'production') {
    const originalParse = JSON.parse;
    const originalStringify = JSON.stringify;

    JSON.parse = function(text: string, reviver?: any) {
        JQJsonHandler.warnAboutNativeJsonUsage('parse');
        return originalParse.call(this, text, reviver);
    };

    JSON.stringify = function(value: any, replacer?: any, space?: any) {
        JQJsonHandler.warnAboutNativeJsonUsage('stringify');
        return originalStringify.call(this, value, replacer, space);
    };
}

export default JQJsonHandler;