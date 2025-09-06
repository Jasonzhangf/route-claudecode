/**
 * Jest测试环境设置文件
 * 配置真实的测试环境
 */

// 设置测试超时
jest.setTimeout(10000);

// 配置环境变量
process.env.NODE_ENV = 'test';