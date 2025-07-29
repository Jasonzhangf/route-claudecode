#!/usr/bin/env node

/**
 * 直接测试路由引擎的模型映射逻辑
 * 绕过CLI和服务器，直接测试路由引擎
 */

const fs = require('fs');
const path = require('path');

// 模拟路由引擎的类别判断逻辑
function determineCategory(request) {
  // 检查工具
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
  
  return 'default';
}

// 模拟 applyModelMapping 逻辑
function applyModelMapping(request, providerId, targetModel, category) {
  if (!request.metadata) {
    request.metadata = { requestId: 'test-request' };
  }
  
  request.metadata.originalModel = request.model;
  request.metadata.targetProvider = providerId;
  request.metadata.routingCategory = category;
  
  // 关键步骤：替换模型名
  const originalModel = request.model;
  request.model = targetModel;
  
  console.log(`📝 模型映射应用: ${originalModel} -> ${targetModel}`);
  console.log(`   类别: ${category}, Provider: ${providerId}`);
  
  return request;
}

console.log('🧪 直接测试路由引擎逻辑');
console.log('='.repeat(50));

// 读取配置
const configPath = path.join(process.env.HOME, '.route-claude-code/config.release.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 模拟请求
const testRequest = {
  model: "claude-sonnet-4-20250514",
  messages: [
    { role: "user", content: "Search for something" }
  ],
  metadata: {
    requestId: "test-123",
    tools: [
      { name: "WebSearch", description: "Search the web" }
    ]
  }
};

console.log('\n📋 测试请求:');
console.log(`模型: ${testRequest.model}`);
console.log(`工具: ${testRequest.metadata.tools.map(t => t.name).join(', ')}`);

// 步骤1: 类别判断
const category = determineCategory(testRequest);
console.log(`\n🎯 路由类别: ${category}`);

// 步骤2: 获取配置
const categoryRule = config.routing[category];
console.log(`\n📋 类别配置:`);
console.log(`  provider: ${categoryRule.provider}`);
console.log(`  model: ${categoryRule.model}`);

// 步骤3: 应用映射
const modifiedRequest = applyModelMapping(
  testRequest, 
  categoryRule.provider, 
  categoryRule.model, 
  category
);

console.log(`\n✅ 最终请求模型: ${modifiedRequest.model}`);
console.log(`🔍 元数据:`);
console.log(`  原始模型: ${modifiedRequest.metadata.originalModel}`);
console.log(`  目标Provider: ${modifiedRequest.metadata.targetProvider}`);
console.log(`  路由类别: ${modifiedRequest.metadata.routingCategory}`);

// 验证结果
console.log('\n' + '='.repeat(50));
console.log('🔍 结果分析:');

if (modifiedRequest.model === 'gemini-2.5-pro') {
  console.log('✅ 路由逻辑正确！模型映射为配置中的 gemini-2.5-pro');
} else if (modifiedRequest.model === 'gemini-2.5-flash') {
  console.log('❌ 发现问题！模型被错误映射为 gemini-2.5-flash');
  console.log('   这说明问题不在基础路由逻辑中');
} else {
  console.log(`⚠️ 意外结果：模型映射为 ${modifiedRequest.model}`);
}

console.log('\n📊 配置验证:');
console.log(`配置文件路径: ${configPath}`);
console.log(`search.provider: ${categoryRule.provider}`);
console.log(`search.model: ${categoryRule.model}`);

if (categoryRule.model !== 'gemini-2.5-pro') {
  console.log('❌ 配置文件中的模型设置不正确！');
} else {
  console.log('✅ 配置文件设置正确');
}