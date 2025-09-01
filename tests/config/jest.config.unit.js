// 单元测试配置
const baseConfig = require('./jest.config.base.js');

module.exports = {
  ...baseConfig,
  testMatch: [
    '<rootDir>/tests/unit/**/*.{test,spec}.{ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};