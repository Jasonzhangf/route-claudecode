// 测试环境配置管理
// Simple configuration without dotenv dependency

// 默认测试配置
export interface TestConfig {
  // 数据库配置
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  
  // API 配置
  api: {
    baseUrl: string;
    timeout: number;
  };
  
  // 测试特定配置
  test: {
    parallel: boolean;
    retryAttempts: number;
    slowTestThreshold: number;
  };
}

// 默认配置
export const defaultConfig: TestConfig = {
  database: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
    username: process.env.TEST_DB_USER || 'testuser',
    password: process.env.TEST_DB_PASSWORD || 'testpass',
    database: process.env.TEST_DB_NAME || 'testdb'
  },
  api: {
    baseUrl: process.env.TEST_API_BASE_URL || 'http://localhost:3000',
    timeout: parseInt(process.env.TEST_API_TIMEOUT || '5000', 10)
  },
  test: {
    parallel: process.env.TEST_PARALLEL === 'true',
    retryAttempts: parseInt(process.env.TEST_RETRY_ATTEMPTS || '5', 10),
    slowTestThreshold: parseInt(process.env.TEST_SLOW_THRESHOLD || '1000', 10) // ms
  }
};

// 获取当前环境配置
export function getTestConfig(): TestConfig {
  return {
    ...defaultConfig,
    database: {
      ...defaultConfig.database,
      host: process.env.TEST_DB_HOST || defaultConfig.database.host,
      port: parseInt(process.env.TEST_DB_PORT || defaultConfig.database.port.toString(), 10),
      username: process.env.TEST_DB_USER || defaultConfig.database.username,
      password: process.env.TEST_DB_PASSWORD || defaultConfig.database.password,
      database: process.env.TEST_DB_NAME || defaultConfig.database.database
    },
    api: {
      ...defaultConfig.api,
      baseUrl: process.env.TEST_API_BASE_URL || defaultConfig.api.baseUrl,
      timeout: parseInt(process.env.TEST_API_TIMEOUT || defaultConfig.api.timeout.toString(), 10)
    },
    test: {
      ...defaultConfig.test,
      parallel: process.env.TEST_PARALLEL === 'true',
      retryAttempts: parseInt(process.env.TEST_RETRY_ATTEMPTS || defaultConfig.test.retryAttempts.toString(), 10),
      slowTestThreshold: parseInt(process.env.TEST_SLOW_THRESHOLD || defaultConfig.test.slowTestThreshold.toString(), 10)
    }
  };
}

// 配置验证
export function validateConfig(config: TestConfig): boolean {
  // 验证必要配置项
  if (!config.database.host || !config.database.username) {
    throw new Error('Database configuration is incomplete');
  }
  
  if (!config.api.baseUrl) {
    throw new Error('API base URL is required');
  }
  
  return true;
}