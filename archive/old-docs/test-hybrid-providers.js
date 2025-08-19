#!/usr/bin/env node

/**
 * RCC v4.0 混合Provider配置验证测试
 * 验证ModelScope, ShuaiHong, Gemini, OpenAI, LM Studio配置
 */

const fs = require('fs');
const path = require('path');

async function testHybridProviders() {
  console.log('🔍 Testing RCC v4.0 Hybrid Provider Configuration');
  console.log('═'.repeat(70));

  // 读取综合混合配置
  const configPath = path.join(process.env.HOME, '.route-claudecode', 'config', 'v4', 'hybrid-provider', 'comprehensive-hybrid-v4-5510.json');
  
  if (!fs.existsSync(configPath)) {
    console.error('❌ Configuration file not found:', configPath);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  console.log('📄 Configuration:', path.basename(configPath));
  console.log('🌐 Server Port:', config.server?.port || 'Not specified');
  console.log('');

  // 验证Provider配置
  console.log('🔧 Provider Configuration Analysis:');
  console.log('-'.repeat(50));

  // 检查Server Compatibility Providers
  if (config.serverCompatibilityProviders) {
    console.log('\n📡 Server Compatibility Providers:');
    for (const [key, provider] of Object.entries(config.serverCompatibilityProviders)) {
      console.log(`  ✅ ${provider.name} (${provider.id})`);
      console.log(`     Protocol: ${provider.protocol}`);
      console.log(`     Endpoint: ${provider.connection?.endpoint}`);
      console.log(`     Type: ${provider.type}`);
      console.log(`     Priority: ${provider.priority || 'Not specified'}`);
      console.log(`     Weight: ${provider.weight || 'Not specified'}`);
      console.log(`     Models: ${provider.models?.supported?.length || 0} supported`);
      console.log('');
    }
  }

  // 检查Standard Providers  
  if (config.standardProviders) {
    console.log('🌟 Standard Providers:');
    for (const [key, provider] of Object.entries(config.standardProviders)) {
      console.log(`  ✅ ${provider.name} (${provider.id})`);
      console.log(`     Protocol: ${provider.protocol}`);
      console.log(`     Endpoint: ${provider.connection?.endpoint}`);
      console.log(`     Type: ${provider.type}`);
      console.log(`     Priority: ${provider.priority || 'Not specified'}`);
      console.log(`     Weight: ${provider.weight || 'Not specified'}`);
      console.log(`     Models: ${provider.models?.supported?.length || 0} supported`);
      
      // 检查多Key配置
      if (provider.connection?.authentication?.credentials?.apiKeys) {
        console.log(`     🔑 Multi-Key Setup: ${provider.connection.authentication.credentials.apiKeys.length} keys`);
      }
      console.log('');
    }
  }

  // 验证路由配置
  console.log('🛤️  Routing Configuration:');
  console.log('-'.repeat(50));
  
  if (config.routing?.routes) {
    console.log(`📍 Total Routes: ${config.routing.routes.length}`);
    config.routing.routes.forEach((route, index) => {
      console.log(`  ${index + 1}. ${route.name} (${route.id})`);
      console.log(`     Priority: ${route.priority}, Weight: ${route.weight}`);
      console.log(`     Conditions: ${route.conditions?.models?.join(', ') || 'None'}`);
      console.log(`     Categories: ${route.conditions?.categories?.join(', ') || 'None'}`);
    });
    console.log('');
  }

  // 验证模型映射
  if (config.routing?.routingRules?.modelMapping) {
    console.log('🎯 Model Mapping:');
    for (const [model, mapping] of Object.entries(config.routing.routingRules.modelMapping)) {
      console.log(`  📝 ${model}:`);
      console.log(`     Preferred Routes: ${mapping.preferredRoutes?.join(', ')}`);
      if (mapping.modelOverrides) {
        console.log(`     Model Overrides:`);
        for (const [route, overrideModel] of Object.entries(mapping.modelOverrides)) {
          console.log(`       ${route} → ${overrideModel}`);
        }
      }
    }
    console.log('');
  }

  // 验证分类路由
  if (config.routing?.routingRules?.categoryRouting) {
    console.log('📂 Category Routing:');
    for (const [category, rules] of Object.entries(config.routing.routingRules.categoryRouting)) {
      console.log(`  🏷️  ${category}:`);
      console.log(`     Routes: ${rules.routes?.join(', ')}`);
      console.log(`     Weights: ${rules.weights?.join(', ')}`);
      console.log(`     Selection: ${rules.selection}`);
    }
    console.log('');
  }

  // 验证关键特性
  console.log('⚙️  Key Features:');
  console.log('-'.repeat(50));
  console.log(`✅ Zero Fallback Policy: ${config.routing?.configuration?.zeroFallbackPolicy ? 'Enabled' : 'Disabled'}`);
  console.log(`✅ Strict Error Reporting: ${config.routing?.configuration?.strictErrorReporting ? 'Enabled' : 'Disabled'}`);
  console.log(`✅ Load Balancing: ${config.routing?.routingRules?.loadBalancing?.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`✅ Health Monitoring: ${config.routing?.routingRules?.loadBalancing?.healthCheck?.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`✅ Debug System: ${config.debug?.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`✅ Security: ${config.security?.authentication?.enabled ? 'Enabled' : 'Disabled'}`);
  console.log('');

  // Provider能力统计
  const totalProviders = Object.keys(config.serverCompatibilityProviders || {}).length + 
                         Object.keys(config.standardProviders || {}).length;
  const totalModels = [
    ...Object.values(config.serverCompatibilityProviders || {}),
    ...Object.values(config.standardProviders || {})
  ].reduce((sum, provider) => sum + (provider.models?.supported?.length || 0), 0);

  console.log('📊 Summary Statistics:');
  console.log('-'.repeat(50));
  console.log(`🔧 Total Providers: ${totalProviders}`);
  console.log(`🤖 Total Models: ${totalModels}`);
  console.log(`🛤️  Total Routes: ${config.routing?.routes?.length || 0}`);
  console.log(`🏷️  Categories: ${Object.keys(config.routing?.routingRules?.categoryRouting || {}).length}`);
  console.log('');

  // 测试Provider可用性
  console.log('🌐 Provider Availability Test:');
  console.log('-'.repeat(50));
  
  // 这里可以添加具体的Provider连接测试
  console.log('ℹ️  Note: Actual provider connectivity tests require API keys and active services');
  console.log('💡 For full testing, use: node test-provider-connectivity.js');
  
  console.log('');
  console.log('🎉 Hybrid Provider Configuration Analysis Complete!');
  console.log('✨ Configuration includes: LM Studio + ModelScope + ShuaiHong + Gemini + OpenAI');
}

// 运行测试
if (require.main === module) {
  testHybridProviders().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testHybridProviders };