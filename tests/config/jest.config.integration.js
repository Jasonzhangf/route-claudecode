// 集成测试配置
const baseConfig = require('./jest.config.base.js');

module.exports = {
  ...baseConfig,
  testMatch: [
    '<rootDir>/tests/integration/**/*.{test,spec}.{ts,tsx}'
  ],
  testTimeout: 30000, // 集成测试可能需要更长时间
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};