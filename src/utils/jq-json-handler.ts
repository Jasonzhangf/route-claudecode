import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

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
            throw new Error(`JSON文件不存在: ${filePath}`);
        }

        try {
            const command = `jq '${filter}' "${filePath}"`;
            const result = execSync(command, { encoding: 'utf8' });
            return JSON.parse(result.trim());
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
        try {
            // 将JSON字符串写入临时文件
            const tempFile = path.join('/tmp', `rcc4-temp-${Date.now()}.json`);
            fs.writeFileSync(tempFile, jsonString);

            const command = `jq '${filter}' "${tempFile}"`;
            const result = execSync(command, { encoding: 'utf8' });
            
            // 清理临时文件
            fs.unlinkSync(tempFile);
            
            return JSON.parse(result.trim());
        } catch (error) {
            throw new Error(`jq解析JSON字符串失败: ${error}`);
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
            // 先用原生JSON.stringify生成基础JSON
            const basicJson = JSON.stringify(data);
            
            // 将JSON写入临时文件
            const tempFile = path.join('/tmp', `rcc4-temp-${Date.now()}.json`);
            fs.writeFileSync(tempFile, basicJson);

            // 使用jq格式化
            const filter = compact ? '-c .' : '.';
            const command = `jq '${filter}' "${tempFile}"`;
            const result = execSync(command, { encoding: 'utf8' });
            
            // 清理临时文件
            fs.unlinkSync(tempFile);
            
            return result.trim();
        } catch (error) {
            throw new Error(`jq序列化JSON失败: ${error}`);
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
            // 将覆盖数据写入临时文件
            const tempFile = path.join('/tmp', `rcc4-overlay-${Date.now()}.json`);
            this.writeJsonFile(tempFile, overlayData);

            const command = `jq -s '.[0] * .[1]' "${baseFilePath}" "${tempFile}"`;
            const result = execSync(command, { encoding: 'utf8' });
            
            // 清理临时文件
            fs.unlinkSync(tempFile);
            
            return JSON.parse(result.trim());
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