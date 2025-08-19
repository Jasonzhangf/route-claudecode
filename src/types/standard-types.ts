/**
 * 标准类型定义
 *
 * 定义系统中使用的标准数据类型
 *
 * @author Jason Zhang
 */

/**
 * 标准请求接口
 */
export interface StandardRequest {
  readonly id: string;
  readonly model: string;
  readonly messages: any[];
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly stream?: boolean;
  readonly tools?: any[];
  readonly metadata: any;
  readonly timestamp: Date;
}

/**
 * 标准响应接口
 */
export interface StandardResponse {
  readonly id: string;
  readonly model: string;
  readonly choices: any[];
  readonly usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  readonly metadata: any;
  readonly timestamp: Date;
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  details?: any;
}

/**
 * 验证模式接口
 */
export interface ValidationSchema {
  [key: string]: any;
}
