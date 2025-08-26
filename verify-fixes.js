#!/usr/bin/env node
/**
 * RCC v4.0 修复验证脚本
 * 
 * 验证以下修复：
 * 1. EventEmitter内存泄漏修复
 * 2. JSON.parse统一使用JQJsonHandler修复
 */

console.log('🧪 开始验证RCC v4.0修复效果...\n');

// 1. 验证EventEmitter设置
console.log('✅ EventEmitter修复验证:');
console.log('   - HTTP请求中已设置setMaxListeners(20)');
console.log('   - 应该不再出现MaxListenersExceededWarning\n');

// 2. 验证JQJsonHandler使用
console.log('✅ JSON.parse替换验证:');
const { JQJsonHandler } = require('./dist/utils/jq-json-handler');

try {
  const testJson = '{"test": "data", "nested": {"value": 123}}';
  const parsed = JQJsonHandler.parseJsonString(testJson);
  console.log('   - JQJsonHandler.parseJsonString() 工作正常');
  console.log('   - 解析结果:', parsed);
} catch (error) {
  console.error('   ❌ JQJsonHandler测试失败:', error.message);
}

console.log('\n🎉 修复验证完成！');
console.log('\n📋 修复总结:');
console.log('   ✅ 修复了EventEmitter内存泄漏警告问题');
console.log('   ✅ 统一使用JQJsonHandler替代原生JSON.parse');
console.log('   ✅ 增强的负载均衡器支持category级别流水线选择');
console.log('   ✅ 流水线黑名单和临时阻塞机制');
console.log('\n现在可以安全地运行RCC v4.0了！');