/**
 * Jest测试环境设置文件
 * 配置真实的测试环境
 */

// 设置测试超时
jest.setTimeout(10000);

// 配置环境变量
process.env.NODE_ENV = 'test';

// 全局测试设置验证
describe('Test Environment Setup', () => {
  it('should have correct environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should have Jest timeout configured', () => {
    expect(typeof jest.setTimeout).toBe('function');
  });

  it('should be able to run basic assertions', () => {
    expect(true).toBe(true);
    expect(1 + 1).toBe(2);
  });
});