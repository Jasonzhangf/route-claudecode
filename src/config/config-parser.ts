/**
 * RCC v4.0 Configuration Parser (强制jq版本)
 *
 * 处理配置文件的解析、格式转换和基础验证
 * 所有JSON解析强制使用jq确保配置文件处理一致性
 *
 * @author Jason Zhang
 */

import * as fs from 'fs';
import * as path from 'path';
import { secureLogger } from '../utils/secure-logger';
import { JQJsonHandler } from '../utils/jq-json-handler';

/**
 * 支持的配置文件格式
 */
export type ConfigFormat = 'json' | 'yaml' | 'yml';

/**
 * 解析结果
 */
export interface ParseResult<T = any> {
  data: T;
  format: ConfigFormat;
  filePath: string;
  parsedAt: Date;
}

/**
 * 解析选项
 */
export interface ParseOptions {
  allowComments?: boolean;
  stripBOM?: boolean;
  encoding?: BufferEncoding;
}

/**
 * 配置文件解析器
 */
export class ConfigParser {
  private static readonly SUPPORTED_FORMATS: ConfigFormat[] = ['json', 'yaml', 'yml'];
  private static readonly DEFAULT_ENCODING: BufferEncoding = 'utf8';

  /**
   * 解析配置文件
   */
  async parse<T = any>(filePath: string, options: ParseOptions = {}): Promise<ParseResult<T>> {
    secureLogger.debug(`📄 解析配置文件: ${filePath}`);

    try {
      // 检查文件是否存在
      await this.ensureFileExists(filePath);

      // 确定文件格式
      const format = this.detectFormat(filePath);

      // 读取文件内容
      const content = await this.readFileContent(filePath, options);

      // 解析内容
      const data = await this.parseContent<T>(content, format, options);

      const result: ParseResult<T> = {
        data,
        format,
        filePath,
        parsedAt: new Date(),
      };

      secureLogger.debug(`✅ 配置文件解析成功: ${filePath} (格式: ${format})`);
      return result;
    } catch (error) {
      secureLogger.error(`❌ 配置文件解析失败: ${filePath}`, { error: error.message });
      throw new Error(`Failed to parse config file ${filePath}: ${error.message}`);
    }
  }

  /**
   * 批量解析配置文件
   */
  async parseMultiple<T = any>(filePaths: string[], options: ParseOptions = {}): Promise<ParseResult<T>[]> {
    secureLogger.debug(`📄 批量解析配置文件 (${filePaths.length}个)`);

    const results = await Promise.allSettled(filePaths.map(filePath => this.parse<T>(filePath, options)));

    const successResults: ParseResult<T>[] = [];
    const failures: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successResults.push(result.value);
      } else {
        failures.push(`${filePaths[index]}: ${result.reason.message}`);
      }
    });

    if (failures.length > 0) {
      secureLogger.warn(`⚠️ 部分配置文件解析失败`, { failures });
    }

    secureLogger.debug(`✅ 批量解析完成: ${successResults.length}/${filePaths.length} 成功`);
    return successResults;
  }

  /**
   * 检测文件格式
   */
  private detectFormat(filePath: string): ConfigFormat {
    const ext = path.extname(filePath).toLowerCase().substring(1);

    if (this.isSupportedFormat(ext)) {
      return ext as ConfigFormat;
    }

    // 默认使用JSON格式
    secureLogger.warn(`⚠️ 未识别的文件扩展名: ${ext}，使用默认JSON格式`);
    return 'json';
  }

  /**
   * 解析Demo1格式配置文件 (使用jq强制解析)
   */
  async parseDemo1Config<T = any>(filePath: string, options: ParseOptions = {}): Promise<ParseResult<T>> {
    secureLogger.info(`📄 使用jq解析Demo1格式配置: ${filePath}`);

    try {
      // 检查文件是否存在
      await this.ensureFileExists(filePath);

      // 使用jq直接解析文件
      const data = JQJsonHandler.parseJsonFile<T>(filePath);

      // 验证Demo1配置格式
      if (!this.isValidDemo1Config(data)) {
        throw new Error('配置文件不符合Demo1格式规范');
      }

      const result: ParseResult<T> = {
        data,
        format: 'json',
        filePath,
        parsedAt: new Date(),
      };

      secureLogger.info(`✅ Demo1配置解析成功: ${filePath}`);
      return result;
    } catch (error) {
      secureLogger.error(`❌ Demo1配置解析失败: ${filePath}`, { error: error.message });
      throw new Error(`Failed to parse Demo1 config ${filePath}: ${error.message}`);
    }
  }

  /**
   * 验证Demo1配置格式
   */
  private isValidDemo1Config(data: any): boolean {
    return data && 
           Array.isArray(data.Providers) && 
           data.Router && 
           typeof data.APIKEY === 'string';
  }

  /**
   * 检查是否为支持的格式
   */
  private isSupportedFormat(format: string): boolean {
    return ConfigParser.SUPPORTED_FORMATS.includes(format as ConfigFormat);
  }

  /**
   * 确保文件存在
   */
  private async ensureFileExists(filePath: string): Promise<void> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
    } catch (error) {
      throw new Error(`Configuration file not found: ${filePath}`);
    }
  }

  /**
   * 读取文件内容
   */
  private async readFileContent(filePath: string, options: ParseOptions): Promise<string> {
    const encoding = options.encoding || ConfigParser.DEFAULT_ENCODING;

    try {
      let content = await fs.promises.readFile(filePath, encoding);

      // 移除BOM
      if (options.stripBOM !== false) {
        content = this.stripBOM(content);
      }

      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * 移除BOM (Byte Order Mark)
   */
  private stripBOM(content: string): string {
    if (content.charCodeAt(0) === 0xfeff) {
      return content.slice(1);
    }
    return content;
  }

  /**
   * 解析内容
   */
  private async parseContent<T>(content: string, format: ConfigFormat, options: ParseOptions): Promise<T> {
    switch (format) {
      case 'json':
        return this.parseJSON<T>(content, options);
      case 'yaml':
      case 'yml':
        return this.parseYAML<T>(content, options);
      default:
        throw new Error(`Unsupported config format: ${format}`);
    }
  }

  /**
   * 解析JSON内容 (强制使用jq)
   */
  private parseJSON<T>(content: string, options: ParseOptions): T {
    try {
      // 如果允许注释，先移除注释
      if (options.allowComments) {
        content = this.removeJSONComments(content);
      }

      // 强制使用jq解析JSON确保一致性
      secureLogger.debug('🔧 使用jq强制解析JSON配置内容');
      return JQJsonHandler.parseJsonString<T>(content);
    } catch (error) {
      throw new Error(`jq JSON解析失败: ${error.message}`);
    }
  }

  /**
   * 解析YAML内容
   */
  private parseYAML<T>(content: string, options: ParseOptions): T {
    try {
      // 由于我们的项目主要使用JSON，这里简单实现
      // 在实际项目中可能需要引入yaml库
      throw new Error('YAML parsing not implemented yet');
    } catch (error) {
      throw new Error(`Invalid YAML format: ${error.message}`);
    }
  }

  /**
   * 移除JSON注释 (简单实现)
   */
  private removeJSONComments(content: string): string {
    // 移除单行注释 //
    content = content.replace(/^\s*\/\/.*$/gm, '');

    // 移除多行注释 /* */
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');

    return content;
  }

  /**
   * 验证解析结果的基本结构
   */
  validateBasicStructure(data: any): void {
    if (data === null || data === undefined) {
      throw new Error('Configuration data is null or undefined');
    }

    if (typeof data !== 'object') {
      throw new Error('Configuration data must be an object');
    }

    if (Array.isArray(data)) {
      throw new Error('Configuration data cannot be an array at root level');
    }
  }

  /**
   * 获取支持的文件格式
   */
  static getSupportedFormats(): ConfigFormat[] {
    return [...ConfigParser.SUPPORTED_FORMATS];
  }

  /**
   * 检查文件是否为支持的配置格式
   */
  static isSupportedConfigFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase().substring(1);
    return ConfigParser.SUPPORTED_FORMATS.includes(ext as ConfigFormat);
  }

  /**
   * 格式化错误信息
   */
  private formatError(error: Error, filePath: string): Error {
    const message = `Configuration parsing error in ${filePath}: ${error.message}`;
    const formattedError = new Error(message);
    formattedError.stack = error.stack;
    return formattedError;
  }
}
