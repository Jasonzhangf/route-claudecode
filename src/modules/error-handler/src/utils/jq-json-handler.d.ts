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
export declare class JQJsonHandler {
    /**
     * 解析JSON字符串
     *
     * @param jsonString JSON字符串
     * @returns 解析后的对象
     */
    static parseJsonString(jsonString: string): any;
    /**
     * 将对象序列化为JSON字符串
     *
     * @param obj 要序列化的对象
     * @param pretty 是否格式化输出
     * @returns JSON字符串
     */
    static stringifyJson(obj: any, pretty?: boolean): string;
    /**
     * 从文件读取并解析JSON
     *
     * @param filePath 文件路径
     * @returns 解析后的对象
     */
    static parseJsonFile(filePath: string): any;
    /**
     * 将对象写入JSON文件
     *
     * @param obj 要写入的对象
     * @param filePath 文件路径
     * @param pretty 是否格式化输出
     */
    static writeJsonFile(obj: any, filePath: string, pretty?: boolean): void;
    /**
     * 合并多个JSON对象
     *
     * @param objects 要合并的对象数组
     * @returns 合并后的对象
     */
    static mergeJsonObjects(objects: any[]): any;
    /**
     * 从JSON对象中提取指定路径的值
     *
     * @param obj JSON对象
     * @param path 路径（如 'user.profile.name'）
     * @returns 提取的值
     */
    static extractValue(obj: any, path: string): any;
    /**
     * 在JSON对象中设置指定路径的值
     *
     * @param obj JSON对象
     * @param path 路径（如 'user.profile.name'）
     * @param value 要设置的值
     * @returns 更新后的对象
     */
    static setValue(obj: any, path: string, value: any): any;
}
export default JQJsonHandler;
//# sourceMappingURL=jq-json-handler.d.ts.map