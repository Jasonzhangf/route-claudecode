#!/usr/bin/env node
/**
 * Stage 2: 路由测试
 * 测试模型路由逻辑和provider选择
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Stage 2: 路由测试');
console.log('===================\n');

// 读取Stage 1的输出
const stage1OutputPath = path.join(__dirname, 'stage1-base-request.json');

if (!fs.existsSync(stage1OutputPath)) {
  console.error('❌ 找不到Stage 1的输出文件');
  console.log('💡 请先运行 test-stage1-input-processing.js');
  process.exit(1);
}

const baseRequest = JSON.parse(fs.readFileSync(stage1OutputPath, 'utf8'));

console.log('📋 输入的BaseRequest:');
console.log(`   Model: ${baseRequest.model}`);
console.log(`   Stream: ${baseRequest.stream}`);
console.log(`   Messages: ${baseRequest.messages.length}`);
console.log(`   Request ID: ${baseRequest.metadata.requestId}`);

// 读取路由配置
const configPath = path.join(process.env.HOME, '.claude-code-router', 'config-router.json');

if (!fs.existsSync(configPath)) {
  console.error('❌ 找不到路由配置文件');
  console.log(`💡 预期位置: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('\n📋 路由配置分析:');
console.log(`   默认provider: ${config.routing.defaultProvider}`);
console.log(`   可用providers: ${Object.keys(config.routing.providers).join(', ')}`);

// 模拟路由逻辑
function mockDetermineCategory(request) {
  // 检查是否为thinking模式
  if (request.metadata?.thinking) {
    return 'thinking';
  }
  
  // 检查长上下文（简化版本）
  const totalTokens = request.messages.reduce((acc, msg) => acc + msg.content.length, 0);
  if (totalTokens > 60000) {
    return 'longcontext';
  }
  
  // 检查是否为background处理（haiku模型）
  if (request.model.includes('haiku')) {
    return 'background';
  }
  
  // 检查是否有search工具
  if (request.metadata?.tools) {
    const hasSearchTools = request.metadata.tools.some(tool => 
      tool.name && (
        tool.name.includes('search') || 
        tool.name.includes('web') ||
        tool.name.includes('browse')
      )
    );
    if (hasSearchTools) {
      return 'search';
    }
  }
  
  // 默认类别
  return 'default';
}

function mockRouteByCategory(request, category, config) {
  // 检查对象式路由规则
  const configRules = config.routing.rules;
  if (configRules && typeof configRules === 'object' && !Array.isArray(configRules)) {
    const categoryRule = configRules[category];
    if (categoryRule && categoryRule.provider) {
      return {
        providerId: categoryRule.provider,
        reason: 'category-based-routing',
        rule: categoryRule
      };
    }
  }
  
  // 回退：查找支持该类别的provider
  for (const [providerId, providerConfig] of Object.entries(config.routing.providers)) {
    const categoryMappings = providerConfig.settings?.categoryMappings;
    if (categoryMappings && categoryMappings[category]) {
      return {
        providerId,
        reason: 'provider-category-mapping',
        providerConfig
      };
    }
  }
  
  // 最终回退到默认provider
  return {
    providerId: config.routing.defaultProvider,
    reason: 'default-fallback'
  };
}

function mockApplyModelMapping(request, providerId, category, config) {
  const originalModel = request.model;
  
  // 检查类别规则中的模型映射
  const configRules = config.routing.rules;
  if (configRules && typeof configRules === 'object' && !Array.isArray(configRules)) {
    const categoryRule = configRules[category];
    if (categoryRule && categoryRule.model) {
      request.model = categoryRule.model;
      return {
        originalModel,
        newModel: request.model,
        reason: 'category-rule-mapping'
      };
    }
  }
  
  // 检查provider配置中的默认模型映射
  const providerConfig = config.routing.providers[providerId];
  if (providerConfig?.settings?.models && providerConfig.settings.models.length > 0) {
    request.model = providerConfig.settings.models[0];
    return {
      originalModel,
      newModel: request.model,
      reason: 'provider-default-mapping'
    };
  }
  
  return {
    originalModel,
    newModel: request.model,
    reason: 'no-mapping'
  };
}

// 执行路由测试
console.log('\n🎯 执行路由逻辑:');

// Step 1: 确定类别
const category = mockDetermineCategory(baseRequest);
console.log(`   确定类别: ${category}`);

// Step 2: 根据类别路由
const routingResult = mockRouteByCategory(baseRequest, category, config);
console.log(`   选择provider: ${routingResult.providerId}`);
console.log(`   路由原因: ${routingResult.reason}`);

if (routingResult.rule) {
  console.log(`   规则详情: ${JSON.stringify(routingResult.rule, null, 4)}`);
}

// Step 3: 应用模型映射
const modelMapping = mockApplyModelMapping(baseRequest, routingResult.providerId, category, config);
console.log(`   模型映射: ${modelMapping.originalModel} -> ${modelMapping.newModel}`);
console.log(`   映射原因: ${modelMapping.reason}`);

// 检查选择的provider配置
const selectedProvider = config.routing.providers[routingResult.providerId];
if (selectedProvider) {
  console.log(`\n📋 选择的Provider配置:`);
  console.log(`   类型: ${selectedProvider.type}`);
  console.log(`   端点: ${selectedProvider.endpoint}`);
  console.log(`   认证类型: ${selectedProvider.authentication.type}`);
  if (selectedProvider.settings) {
    console.log(`   支持的模型: ${selectedProvider.settings.models?.join(', ') || 'N/A'}`);
    console.log(`   专长: ${selectedProvider.settings.specialties?.join(', ') || 'N/A'}`);
  }
} else {
  console.log(`\n❌ 警告：找不到provider配置: ${routingResult.providerId}`);
}

// 构建最终路由结果
const finalResult = {
  baseRequest,
  routing: {
    category,
    providerId: routingResult.providerId,
    reason: routingResult.reason,
    rule: routingResult.rule
  },
  modelMapping,
  providerConfig: selectedProvider,
  timestamp: new Date().toISOString()
};

// 保存路由结果
const outputPath = path.join(__dirname, 'stage2-routing-result.json');
fs.writeFileSync(outputPath, JSON.stringify(finalResult, null, 2));

console.log(`\n✅ Stage 2 完成！路由结果已保存到: ${outputPath}`);
console.log('💡 可以继续运行 Stage 3: test-stage3-codewhisperer-conversion.js');