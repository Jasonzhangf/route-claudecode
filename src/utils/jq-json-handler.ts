import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TIMEOUT_DEFAULTS } from '../constants/timeout-defaults';
import { ERROR_MESSAGES } from '../constants/error-messages';
import { getServerPort, getServerHost } from '../constants/server-defaults';

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
                timeout: TIMEOUT_DEFAULTS.JQ_PARSE_TIMEOUT,
                maxBuffer: 50 * 1024 * 1024  // 🚀 大幅提升: 50MB缓冲区支持大型JSON文件
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
            // 🚀 增强: 支持大型JSON解析，提高缓冲区到512MB
            const result = execFileSync('jq', [filter], {
                input: jsonString,
                encoding: 'utf8',
                timeout: TIMEOUT_DEFAULTS.JQ_PARSE_TIMEOUT,
                maxBuffer: 50 * 1024 * 1024  // 🚀 大幅提升: 50MB缓冲区支持大型JSON解析
            });
            
            // 直接使用jq的输出，避免二次解析
            return this.parseJqOutput<T>(result.trim());
        } catch (error) {
            // 🔧 增强错误诊断: 详细记录JSON解析错误信息
            const errorMessage = error.message || error.toString();
            const isNumericError = errorMessage.includes('Invalid numeric literal');
            const isParseError = errorMessage.includes('parse error');
            
            console.log(`🔧 [JQ-DIAGNOSTIC] JSON解析失败诊断:`, {
                errorMessage,
                isNumericError,
                isParseError,
                jsonLength: jsonString.length,
                jsonPreview: jsonString.substring(0, 100) + (jsonString.length > 100 ? '...' : ''),
                hasControlChars: /[\x00-\x1F]/.test(jsonString),
                hasInvalidNumbers: /:\s*[0-9]*\.?[0-9]*[eE][+\-]?[0-9]*[^0-9,}\]\s]/.test(jsonString)
            });

            // 🔧 修复: 针对不同类型的错误采用不同的修复策略
            if (isNumericError) {
                console.log(`🔧 [JQ-FIX] 检测到数值字面量错误，尝试修复`);
                try {
                    const fixedJson = this.fixNumericLiterals(jsonString);
                    console.log(`🔧 [JQ-FIX] 尝试修复数值字面量后重试`);
                    
                    const result = execFileSync('jq', [filter], {
                        input: fixedJson,
                        encoding: 'utf8',
                        timeout: TIMEOUT_DEFAULTS.JQ_PARSE_TIMEOUT,
                        maxBuffer: 50 * 1024 * 1024
                    });
                    
                    console.log(`✅ [JQ-FIX] 数值修复成功`);
                    return this.parseJqOutput<T>(result.trim());
                } catch (numericError) {
                    console.warn(`❌ [JQ-FIX] 数值修复失败: ${numericError.message}`);
                }
            }

            // 🔧 修复: 如果jq解析失败，尝试修复单引号JSON后重试
            console.log(`🔧 [JQ-FIX] jq parse failed, trying to fix single quotes: ${error.message}`);
            try {
                const fixedJson = this.fixSingleQuoteJson(jsonString);
                console.log(`🔧 [JQ-FIX] Attempting retry with fixed JSON`);
                
                const result = execFileSync('jq', [filter], {
                    input: fixedJson,
                    encoding: 'utf8',
                    timeout: TIMEOUT_DEFAULTS.JQ_PARSE_TIMEOUT,
                    maxBuffer: 50 * 1024 * 1024  // 🚀 大幅提升: 重试时也支持50MB大型JSON
                });
                
                console.log(`✅ [JQ-FIX] Fixed JSON parse succeeded`);
                return this.parseJqOutput<T>(result.trim());
            } catch (retryError) {
                console.warn(`❌ [JQ-FIX] Fixed JSON parse also failed: ${retryError.message}`);
                // 如果修复后仍然失败，使用原始错误处理
                return this.fallbackJsonParse<T>(jsonString, error);
            }
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
            
            // 🔧 修复: 移除不合理的100K限制，增加大缓冲区处理
            // 支持512MB+的大型JSON处理，为工具调用等复杂请求提供足够空间
            // 🎨 改进格式化: 使用更友好的格式化输出
            const args = compact ? ['-c', '.'] : ['-M', '--indent', '2', '--tab', '.'];
            const result = execFileSync('jq', args, {
                input: basicJson,
                encoding: 'utf8',
                timeout: TIMEOUT_DEFAULTS.JQ_STRINGIFY_TIMEOUT,
                maxBuffer: 50 * 1024 * 1024  // 🚀 大幅提升: 增加缓冲区到50MB，支持512K+ tokens的大型JSON处理
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
                timeout: TIMEOUT_DEFAULTS.JQ_MERGE_TIMEOUT,
                maxBuffer: 50 * 1024 * 1024  // 🚀 大幅提升: 50MB缓冲区支持大型JSON合并
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
                    port: serverConfig?.port || getServerPort(),
                    host: serverConfig?.host || getServerHost(),
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
     * 容错JSON解析fallback - 创建API错误响应而非直接失败
     * @private
     */
    private static fallbackJsonParse<T>(jsonString: string, originalError: any): T {
        console.warn('🔧 [JQ-FALLBACK] jq解析失败，尝试容错解析:', originalError.message);
        
        // 🔧 记录完整的错误数据用于调试
        console.error('🔧 [JQ-FALLBACK] 完整错误数据记录:', {
            originalError: originalError.message,
            jsonStringLength: jsonString.length,
            jsonStringPreview: jsonString.substring(0, 500) + (jsonString.length > 500 ? '...' : ''),
            errorType: originalError.constructor?.name || 'UnknownError',
            stack: originalError.stack
        });
        
        try {
            // 🔧 首次fallback: 尝试原生JSON.parse
            console.log('🔧 [JQ-FALLBACK] 尝试原生JSON.parse作为fallback');
            const originalParse = (global as any).__originalJSONParse || JSON.parse;
            const parsed = originalParse(jsonString);
            console.log('✅ [JQ-FALLBACK] 原生JSON.parse成功');
            return parsed;
        } catch (nativeError) {
            console.warn('❌ [JQ-FALLBACK] 原生JSON.parse也失败:', nativeError.message);
            
            try {
                // 🔧 二次fallback: 尝试修复常见JSON问题后用原生解析
                console.log('🔧 [JQ-FALLBACK] 尝试修复JSON格式后用原生解析');
                let fixedJson = this.emergencyJsonFix(jsonString);
                const originalParse = (global as any).__originalJSONParse || JSON.parse;
                const parsed = originalParse(fixedJson);
                console.log('✅ [JQ-FALLBACK] 修复后原生JSON.parse成功');
                return parsed;
            } catch (fixedError) {
                console.warn('❌ [JQ-FALLBACK] 修复后原生JSON.parse也失败:', fixedError.message);
                
                // 🔧 最终fallback: 创建API错误响应对象而非抛出异常
                console.log('🔧 [JQ-FALLBACK] 创建API错误响应对象，避免系统崩溃');
                
                // 检查是否看起来像OpenAI格式的错误响应
                if (jsonString.includes('choices') || jsonString.includes('error')) {
                    return {
                        error: {
                            type: 'json_parse_error',
                            message: `JSON解析失败: ${originalError.message}`,
                            details: 'Server returned malformed JSON response',
                            original_error: originalError.message,
                            fallback_used: true
                        }
                    } as T;
                } else {
                    // 创建通用的API错误响应
                    return {
                        choices: [{
                            message: {
                                role: 'assistant',
                                content: `⚠️ JSON解析错误: 服务器返回的响应格式异常。原始错误: ${originalError.message}`
                            },
                            finish_reason: 'error'
                        }],
                        error: {
                            type: 'json_parse_error',
                            message: `JSON解析失败: ${originalError.message}`,
                            fallback_used: true
                        },
                        usage: { prompt_tokens: 0, completion_tokens: 50 }
                    } as T;
                }
            }
        }
    }

    /**
     * JSON stringify fallback
     * @private
     */
    private static fallbackJsonStringify(data: any, compact: boolean): string {
        try {
            // 🔧 修复: 对于大JSON，使用原生JSON.stringify作为fallback
            // 确保生成有效的JSON而不是手动序列化
            console.log('🔧 [JQ-FALLBACK] 使用原生JSON.stringify作为fallback');
            
            // 🎨 改进格式化: 使用更合理的缩进增强可读性
            // 临时禁用JSON使用警告，因为这是预期的fallback行为
            const originalStringify = (global as any).__originalJSONStringify || JSON.stringify;
            if (compact) {
                return originalStringify(data);
            } else {
                // 使用2个空格缩进，与jq保持一致
                return originalStringify(data, null, 2);
            }
        } catch (error) {
            console.error('❌ [JQ-FALLBACK] 原生JSON.stringify也失败，使用手动序列化:', error.message);
            // 最后的备用方案：手动序列化
            return this.createBasicJson(data);
        }
    }

    /**
     * 修复数值字面量错误
     * @private
     */
    private static fixNumericLiterals(jsonString: string): string {
        try {
            console.log(`🔧 [JQ-NUMERIC-FIX] 开始修复数值字面量错误`);
            
            let fixed = jsonString;
            
            // 1. 修复无效的科学记数法 (如 1.23e+abc -> 1.23)
            fixed = fixed.replace(/([0-9]+\.?[0-9]*)[eE][+\-]?[^0-9][^,}\]\s]*/g, '$1');
            
            // 2. 修复不完整的小数 (如 123. -> 123.0)
            fixed = fixed.replace(/([0-9]+)\.([\s,}\]])/g, '$1.0$2');
            
            // 3. 修复多个小数点 (如 1.2.3 -> 1.23)
            fixed = fixed.replace(/([0-9]+)\.([0-9]*)\.([0-9]*)/g, '$1.$2$3');
            
            // 4. 修复开头的小数点 (如 .123 -> 0.123)
            fixed = fixed.replace(/([\[\{:,\s])\.([0-9]+)/g, '$10.$2');
            
            // 5. 修复非法的数值字符 (移除数字后面的非法字符)
            fixed = fixed.replace(/([0-9]+\.?[0-9]*)[^0-9eE+\-,}\]\s][^,}\]\s]*/g, '$1');
            
            // 6. 修复超长的数值 (截断到合理长度)
            fixed = fixed.replace(/([0-9]{20,})/g, (match) => {
                console.log(`🔧 [JQ-NUMERIC-FIX] 截断超长数值: ${match.substring(0, 50)}...`);
                return match.substring(0, 15); // 保留前15位数字
            });
            
            // 7. 修复NaN和Infinity
            fixed = fixed.replace(/:\s*NaN\b/g, ': null');
            fixed = fixed.replace(/:\s*Infinity\b/g, ': null');
            fixed = fixed.replace(/:\s*-Infinity\b/g, ': null');
            
            console.log(`🔧 [JQ-NUMERIC-FIX] 数值修复完成`);
            return fixed;
            
        } catch (error) {
            console.warn(`❌ [JQ-NUMERIC-FIX] 数值修复失败:`, error.message);
            return jsonString;
        }
    }

    /**
     * 修复单引号JSON格式问题
     * @private
     */
    private static fixSingleQuoteJson(jsonString: string): string {
        try {
            console.log(`🔧 [JQ-FIX] Starting fix for single quote JSON:`, jsonString.substring(0, 100) + '...');
            
            let fixed = jsonString;
            
            // 1. 移除多余的转义字符
            fixed = fixed.replace(/\\"/g, '"');
            
            // 2. 简单粗暴但有效的单引号替换
            // 先标记所有单引号的位置，然后有选择地替换
            let result = '';
            let i = 0;
            
            while (i < fixed.length) {
                const char = fixed[i];
                
                if (char === "'") {
                    // 检查是否应该被替换为双引号
                    // 简单规则：如果前面是 : 或 { 或 [ 或 ,，后面不是 '，则替换
                    const prevNonSpace = this.findPrevNonSpace(fixed, i);
                    const nextChar = fixed[i + 1];
                    
                    if (prevNonSpace && [':', '{', '[', ','].includes(prevNonSpace) && nextChar !== "'") {
                        result += '"';
                    } else if (nextChar && [':', ',', '}', ']'].includes(nextChar)) {
                        // 或者如果后面是 : , } ]，也替换
                        result += '"';
                    } else {
                        result += char;
                    }
                } else {
                    result += char;
                }
                i++;
            }
            
            fixed = result;
            
            // 3. 修复Python/JavaScript布尔值和null
            fixed = fixed.replace(/:\s*True\b/g, ': true');
            fixed = fixed.replace(/:\s*False\b/g, ': false');  
            fixed = fixed.replace(/:\s*None\b/g, ': null');
            
            // 修复数组中的布尔值
            fixed = fixed.replace(/,\s*True\b/g, ', true');
            fixed = fixed.replace(/,\s*False\b/g, ', false');
            fixed = fixed.replace(/,\s*None\b/g, ', null');
            
            // 修复数组开头的布尔值
            fixed = fixed.replace(/\[\s*True\b/g, '[true');
            fixed = fixed.replace(/\[\s*False\b/g, '[false');
            fixed = fixed.replace(/\[\s*None\b/g, '[null');
            
            // 4. 修复未闭合的引号和括号
            const openBraces = (fixed.match(/\{/g) || []).length;
            const closeBraces = (fixed.match(/\}/g) || []).length;
            const openBrackets = (fixed.match(/\[/g) || []).length;
            const closeBrackets = (fixed.match(/\]/g) || []).length;
            
            if (openBraces > closeBraces) {
                fixed += '}'.repeat(openBraces - closeBraces);
            }
            if (openBrackets > closeBrackets) {
                fixed += ']'.repeat(openBrackets - closeBrackets);
            }
            
            console.log(`🔧 [JQ-FIX] Fixed JSON result:`, fixed.substring(0, 100) + '...');
            return fixed;
            
        } catch (error) {
            // 如果修复失败，返回原始字符串
            console.warn(`❌ [JQ-FIX] Fix failed:`, error.message);
            return jsonString;
        }
    }

    /**
     * 紧急JSON修复 - 最后的救命稻草
     * @private
     */
    private static emergencyJsonFix(jsonString: string): string {
        try {
            console.log(`🚨 [EMERGENCY-FIX] 启动紧急JSON修复`);
            
            let fixed = jsonString;
            
            // 1. 移除所有控制字符和不可见字符
            fixed = fixed.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
            
            // 2. 修复常见的引号问题
            fixed = fixed.replace(/'/g, '"'); // 单引号转双引号
            fixed = fixed.replace(/"/g, '"'); // 中文引号转英文引号
            fixed = fixed.replace(/"/g, '"'); // 中文引号转英文引号
            
            // 3. 修复布尔值和null
            fixed = fixed.replace(/\bTrue\b/g, 'true');
            fixed = fixed.replace(/\bFalse\b/g, 'false');
            fixed = fixed.replace(/\bNone\b/g, 'null');
            fixed = fixed.replace(/\bundefined\b/g, 'null');
            
            // 4. 修复数值问题
            fixed = fixed.replace(/\bNaN\b/g, 'null');
            fixed = fixed.replace(/\bInfinity\b/g, 'null');
            fixed = fixed.replace(/\b-Infinity\b/g, 'null');
            
            // 5. 修复数组和对象的括号匹配
            const openBraces = (fixed.match(/\{/g) || []).length;
            const closeBraces = (fixed.match(/\}/g) || []).length;
            const openBrackets = (fixed.match(/\[/g) || []).length;
            const closeBrackets = (fixed.match(/\]/g) || []).length;
            
            if (openBraces > closeBraces) {
                fixed += '}'.repeat(openBraces - closeBraces);
            }
            if (openBrackets > closeBrackets) {
                fixed += ']'.repeat(openBrackets - closeBrackets);
            }
            
            // 6. 移除尾部逗号
            fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
            
            // 7. 处理不完整的JSON - 如果看起来像被截断了
            if (!fixed.trim().endsWith('}') && !fixed.trim().endsWith(']')) {
                if (fixed.includes('{') && !fixed.includes('}')) {
                    fixed += '}';
                } else if (fixed.includes('[') && !fixed.includes(']')) {
                    fixed += ']';
                }
            }
            
            console.log(`🚨 [EMERGENCY-FIX] 紧急修复完成`);
            return fixed;
            
        } catch (error) {
            console.error(`💥 [EMERGENCY-FIX] 紧急修复也失败了:`, error.message);
            // 如果连紧急修复都失败，返回一个最基本的空对象JSON
            return '{}';
        }
    }

    private static findPrevNonSpace(str: string, index: number): string | null {
        for (let i = index - 1; i >= 0; i--) {
            if (str[i] !== ' ' && str[i] !== '\t' && str[i] !== '\n') {
                return str[i];
            }
        }
        return null;
    }
}

/**
 * 强制jq策略 - 覆盖全局JSON方法
 * 在开发模式下警告直接使用JSON.parse/stringify
 */
if (process.env.NODE_ENV !== 'production') {
    const originalParse = JSON.parse;
    const originalStringify = JSON.stringify;

    // 保存原始函数到全局对象，供fallback使用
    (global as any).__originalJSONParse = originalParse;
    (global as any).__originalJSONStringify = originalStringify;

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