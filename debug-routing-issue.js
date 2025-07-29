#!/usr/bin/env node

/**
 * 调试路由映射问题
 * 检查为什么 claude-sonnet-4-20250514 被映射到 gemini-2.5-flash 而不是 gemini-2.5-pro
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 调试路由映射问题');
console.log('='.repeat(50));

// 读取配置文件
const configPath = path.join(process.env.HOME, '.route-claude-code/config.release.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('\n📋 当前路由配置:');
Object.entries(config.routing).forEach(([category, rule]) => {
  console.log(`\n${category}:`);
  console.log(`  provider: ${rule.provider}`);
  console.log(`  model: ${rule.model}`);
  if (rule.backup) {
    console.log(`  backup: ${rule.backup.length} 个备用provider`);
    rule.backup.forEach((backup, i) => {
      console.log(`    ${i+1}. ${backup.provider} -> ${backup.model} (weight: ${backup.weight || 1})`);
    });
  }
});

console.log('\n🔍 分析问题:');
console.log('根据日志: claude-sonnet-4-20250514 -> gemini-2.5-flash');
console.log('路由类别: search');

const searchConfig = config.routing.search;
console.log(`\nsearch 类别配置:`);
console.log(`  provider: ${searchConfig.provider}`);
console.log(`  model: ${searchConfig.model}`);

if (searchConfig.model !== 'gemini-2.5-flash') {
  console.log('\n❌ 发现不一致!');
  console.log(`配置中 search.model = "${searchConfig.model}"`);
  console.log('但日志显示映射到了 "gemini-2.5-flash"');
  console.log('\n可能的原因:');
  console.log('1. Provider 内部有默认模型映射');
  console.log('2. 存在其他地方的硬编码');
  console.log('3. 缓存或旧配置问题');
} else {
  console.log('\n✅ 配置一致');
  console.log('映射结果符合配置文件');
}

console.log('\n🔧 建议解决方案:');
console.log('1. 检查 provider 是否有内部模型映射');
console.log('2. 重启服务清除可能的缓存');
console.log('3. 确认配置文件最后修改时间');

// 检查配置文件修改时间
const stats = fs.statSync(configPath);
console.log(`\n📅 配置文件最后修改: ${stats.mtime}`);

console.log('\n🧪 测试建议:');
console.log('1. 发送一个明确的非搜索请求，看看是否正确路由到 default');
console.log('2. 发送一个搜索请求，观察完整的路由日志');
console.log('3. 检查 shuaihong-openai provider 的实现');

console.log('\n' + '='.repeat(50));
console.log('调试完成');