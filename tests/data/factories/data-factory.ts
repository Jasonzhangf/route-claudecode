// 测试数据工厂基类
export abstract class DataFactory<T> {
  abstract create(overrides?: Partial<T>): T;
  abstract createMany(count: number, overrides?: Partial<T>): T[];
  
  // 创建带有默认值的对象
  protected withDefaults(defaults: T, overrides?: Partial<T>): T {
    return { ...defaults, ...overrides };
  }
}

// 用户数据工厂示例
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export class UserFactory extends DataFactory<User> {
  private static idCounter = 1;
  
  create(overrides?: Partial<User>): User {
    const id = overrides?.id || `user-${UserFactory.idCounter++}`;
    const timestamp = new Date();
    
    const defaults: User = {
      id,
      name: `User ${id}`,
      email: `${id}@example.com`,
      createdAt: timestamp
    };
    
    return this.withDefaults(defaults, overrides);
  }
  
  createMany(count: number, overrides?: Partial<User>): User[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

// API 请求数据工厂
export interface ApiRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  timestamp: Date;
}

export class ApiRequestFactory extends DataFactory<ApiRequest> {
  create(overrides?: Partial<ApiRequest>): ApiRequest {
    const timestamp = new Date();
    
    const defaults: ApiRequest = {
      method: 'GET',
      url: '/api/test',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RCC-Test-Client'
      },
      timestamp
    };
    
    return this.withDefaults(defaults, overrides);
  }
  
  createMany(count: number, overrides?: Partial<ApiRequest>): ApiRequest[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
  
  // 创建特定类型的请求
  createGetRequest(url: string, overrides?: Partial<ApiRequest>): ApiRequest {
    return this.create({
      method: 'GET',
      url,
      ...overrides
    });
  }
  
  createPostRequest(url: string, body: any, overrides?: Partial<ApiRequest>): ApiRequest {
    return this.create({
      method: 'POST',
      url,
      body,
      ...overrides
    });
  }
}