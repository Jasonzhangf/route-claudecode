#!/usr/bin/env node

/**
 * 详细调试路由映射过程
 * 模拟完整的路由逻辑来找到 gemini-2.5-flash 来源
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 详细路由映射调试');
console.log('='.repeat(60));

// 模拟 request
const mockRequest = {
  model: "claude-sonnet-4-20250514",
  messages: [
    { role: "user", content: "Hello" }
  ],
  metadata: {
    requestId: "debug-test",
    tools: [
      { name: "WebSearch", description: "Search the web" }
    ]
  }
};

console.log('\n📋 模拟请求:');
console.log(JSON.stringify(mockRequest, null, 2));

// 读取配置
const configPath = path.join(process.env.HOME, '.route-claude-code/config.release.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 模拟类别判断逻辑
function determineCategory(request) {
  // Check for background models (haiku models for lightweight tasks)
  if (request.model.includes('haiku')) {
    return 'background';
  }

  // Check for explicit thinking mode
  if (request.metadata?.thinking) {
    return 'thinking';
  }

  // Check for long context based on token count
  // 简化版本，假设 < 45000 tokens
  const tokenCount = 1000; // mock
  if (tokenCount > 45000) {
    return 'longcontext';
  }

  // Check for search tools
  if (request.metadata?.tools && Array.isArray(request.metadata.tools)) {
    const hasSearchTools = request.metadata.tools.some((tool) => 
      typeof tool === 'object' && tool.name && (
        tool.name.toLowerCase().includes('search') ||
        tool.name.toLowerCase().includes('web') ||
        tool.name === 'WebSearch'
      )
    );
    
    if (hasSearchTools) {
      return 'search';
    }
  }

  // Default category for all other cases
  return 'default';
}

const category = determineCategory(mockRequest);
console.log(`\n🎯 路由类别判断: ${category}`);

const categoryRule = config.routing[category];
console.log(`\n📋 类别配置:`);
console.log(`  provider: ${categoryRule.provider}`);
console.log(`  model: ${categoryRule.model}`);

// 检查 provider 配置
const providerConfig = config.providers[categoryRule.provider];
console.log(`\n🔧 Provider 配置 (${categoryRule.provider}):`);
console.log(`  type: ${providerConfig.type}`);
console.log(`  endpoint: ${providerConfig.endpoint}`);
console.log(`  defaultModel: ${providerConfig.defaultModel}`);
console.log(`  支持的模型: ${providerConfig.models.join(', ')}`);

// 检查是否配置模型在支持列表中
const configuredModel = categoryRule.model;
const isModelSupported = providerConfig.models.includes(configuredModel);

console.log(`\n✅ 模型兼容性检查:`);
console.log(`  配置模型: ${configuredModel}`);
console.log(`  是否支持: ${isModelSupported ? '✅' : '❌'}`);
console.log(`  Provider默认模型: ${providerConfig.defaultModel}`);

if (!isModelSupported) {
  console.log(`\n❌ 发现问题!`);
  console.log(`配置的模型 "${configuredModel}" 不在 provider 支持列表中`);
  console.log(`这可能导致 provider 使用默认模型或第一个支持的模型`);
  
  console.log(`\n🔧 可能的解决方案:`);
  console.log(`1. 修改路由配置使用支持的模型:`);
  providerConfig.models.forEach(model => {
    console.log(`   - ${model}`);
  });
  console.log(`2. 或者在 provider 配置中添加 "${configuredModel}"`);
} else {
  console.log(`\n✅ 模型配置正确`);
  console.log(`模型 "${configuredModel}" 在支持列表中`);
}

// 检查是否存在模型映射逻辑
console.log(`\n🔍 潜在的模型映射来源:`);
console.log(`1. Provider 内部模型映射 (如 gemini client 的 extractModelName)`);
console.log(`2. Transformer 的模型转换逻辑`);  
console.log(`3. 旧的硬编码或缓存配置`);

// 分析日志中的映射
console.log(`\n📊 日志分析:`);
console.log(`原始模型: claude-sonnet-4-20250514`);
console.log(`配置目标: ${configuredModel}`);
console.log(`实际结果: gemini-2.5-flash`);

if (configuredModel !== 'gemini-2.5-flash') {
  console.log(`\n❌ 关键问题确认:`);
  console.log(`配置要求使用 "${configuredModel}"`);
  console.log(`但实际使用了 "gemini-2.5-flash"`);
  console.log(`\n🔍 建议检查:`);
  console.log(`1. src/providers/openai/ 目录中的模型处理逻辑`);
  console.log(`2. 是否存在 defaultModel fallback 机制`);
  console.log(`3. 重启服务确保没有缓存问题`);
  console.log(`4. 检查 enhanced-client.ts 的模型选择逻辑`);
}

console.log('\n' + '='.repeat(60));
console.log('调试完成');