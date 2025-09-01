// 模拟数据生成器
export class MockDataGenerator {
  // 生成随机字符串
  static randomString(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  // 生成随机邮箱
  static randomEmail(): string {
    return `${this.randomString(8)}@example.com`;
  }
  
  // 生成随机日期
  static randomDate(start: Date = new Date(2020, 0, 1), end: Date = new Date()): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }
  
  // 生成随机布尔值
  static randomBoolean(): boolean {
    return Math.random() >= 0.5;
  }
  
  // 生成随机整数
  static randomInt(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  // 生成 API 响应模拟数据
  static apiResponse(data: any = {}, overrides: any = {}): any {
    const defaults = {
      id: `resp-${this.randomString(8)}`,
      timestamp: new Date().toISOString(),
      status: 200,
      data: data
    };
    
    return { ...defaults, ...overrides };
  }
  
  // 生成错误响应模拟数据
  static errorResponse(message: string, code: string = 'INTERNAL_ERROR'): any {
    return {
      error: {
        code,
        message,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  // 生成流水线响应模拟数据
  static pipelineResponse(content: string, finishReason: string = 'stop'): any {
    return {
      id: `chatcmpl-${this.randomString(12)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-3.5-turbo',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content
          },
          finish_reason: finishReason
        }
      ]
    };
  }
}