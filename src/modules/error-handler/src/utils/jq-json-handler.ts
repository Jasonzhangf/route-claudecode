/**
 * JQ JSON处理器
 * 
 * 提供JSON解析和字符串化功能，兼容jq工具的处理方式
 * 
 * @author Claude Code Router v4.0
 */

/**
 * JQ JSON处理器类
 */
export class JQJsonHandler {
  /**
   * 解析JSON字符串
   * 
   * @param jsonString JSON字符串
   * @returns 解析后的对象
   */
  static parseJsonString(jsonString: string): any {
    return JSON.parse(jsonString);
  }

  /**
   * 将对象序列化为JSON字符串
   * 
   * @param obj 要序列化的对象
   * @param pretty 是否格式化输出
   * @returns JSON字符串
   */
  static stringifyJson(obj: any, pretty: boolean = false): string {
    return JSON.stringify(obj, null, pretty ? 2 : 0);
  }

  /**
   * 从文件读取并解析JSON
   * 
   * @param filePath 文件路径
   * @returns 解析后的对象
   */
  static parseJsonFile(filePath: string): any {
    const fs = require('fs');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return this.parseJsonString(fileContent);
  }

  /**
   * 将对象写入JSON文件
   * 
   * @param obj 要写入的对象
   * @param filePath 文件路径
   * @param pretty 是否格式化输出
   */
  static writeJsonFile(obj: any, filePath: string, pretty: boolean = true): void {
    const fs = require('fs');
    const jsonString = this.stringifyJson(obj, pretty);
    fs.writeFileSync(filePath, jsonString, 'utf8');
  }

  /**
   * 合并多个JSON对象
   * 
   * @param objects 要合并的对象数组
   * @returns 合并后的对象
   */
  static mergeJsonObjects(objects: any[]): any {
    return objects.reduce((acc, obj) => {
      return { ...acc, ...obj };
    }, {});
  }

  /**
   * 从JSON对象中提取指定路径的值
   * 
   * @param obj JSON对象
   * @param path 路径（如 'user.profile.name'）
   * @returns 提取的值
   */
  static extractValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = current[key];
    }
    
    return current;
  }

  /**
   * 在JSON对象中设置指定路径的值
   * 
   * @param obj JSON对象
   * @param path 路径（如 'user.profile.name'）
   * @param value 要设置的值
   * @returns 更新后的对象
   */
  static setValue(obj: any, path: string, value: any): any {
    const keys = path.split('.');
    const result = JSON.parse(JSON.stringify(obj)); // 深拷贝
    let current = result;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === null || current[key] === undefined) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    return result;
  }
}

// 导出默认实例
export default JQJsonHandler;