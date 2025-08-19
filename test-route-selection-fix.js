#!/usr/bin/env node
/**
 * 路由选择错误修复的黑盒验证测试
 * 验证配置文件加载后路由选择是否正确
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 开始路由选择黑盒验证测试...\n');

/**
 * 测试1: 配置文件解析验证
 */
function testConfigurationParsing() {
  console.log('📋 测试1: 配置文件解析验证');
  
  try {
    // 读取LM Studio配置
    const lmstudioConfig = JSON.parse(fs.readFileSync(
      '/Users/fanzhang/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json', 'utf8'
    ));
    
    // 读取Shuaihong配置
    const shuaihongConfig = JSON.parse(fs.readFileSync(
      '/Users/fanzhang/.route-claudecode/config/v4/single-provider/shuaihong-v4-5507-fixed.json', 'utf8'
    ));
    
    // 验证路由配置差异
    const lmstudioRouteId = lmstudioConfig.routing.routes[0].id;
    const shuaihongRouteId = shuaihongConfig.routing.routes[0].id;
    
    console.log(`   LM Studio Route ID: ${lmstudioRouteId}`);
    console.log(`   Shuaihong Route ID: ${shuaihongRouteId}`);
    
    if (lmstudioRouteId === 'lmstudio-primary-route' && shuaihongRouteId === 'shuaihong-primary-route') {
      console.log('   ✅ 配置文件路由ID正确\n');
      return true;
    } else {
      console.log('   ❌ 配置文件路由ID不匹配\n');
      return false;
    }
  } catch (error) {
    console.error('   ❌ 配置文件解析失败:', error.message);
    return false;
  }
}

/**
 * 测试2: 模型映射验证
 */
function testModelMapping() {
  console.log('📋 测试2: 模型映射验证');
  
  try {
    // 读取配置
    const lmstudioConfig = JSON.parse(fs.readFileSync(
      '/Users/fanzhang/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json', 'utf8'
    ));
    const shuaihongConfig = JSON.parse(fs.readFileSync(
      '/Users/fanzhang/.route-claudecode/config/v4/single-provider/shuaihong-v4-5507-fixed.json', 'utf8'
    ));
    
    // 提取模型映射
    const lmstudioMapping = lmstudioConfig.routing.routes[0].pipeline.layers[0].config.modelMapping;
    const shuaihongMapping = shuaihongConfig.routing.routes[0].pipeline.layers[0].config.modelMapping;
    
    console.log('   LM Studio模型映射:');
    console.log('     claude-3-5-sonnet-20241022 →', lmstudioMapping['claude-3-5-sonnet-20241022']);
    console.log('   Shuaihong模型映射:');
    console.log('     claude-3-5-sonnet-20241022 →', shuaihongMapping['claude-3-5-sonnet-20241022']);
    
    // 验证映射差异
    const lmstudioModel = lmstudioMapping['claude-3-5-sonnet-20241022'];
    const shuaihongModel = shuaihongMapping['claude-3-5-sonnet-20241022'];
    
    if (lmstudioModel === 'gpt-oss-20b-mlx' && shuaihongModel === 'gpt-4o-mini') {
      console.log('   ✅ 模型映射配置正确，不同配置有不同映射\n');
      return true;
    } else {
      console.log('   ❌ 模型映射配置错误\n');
      return false;
    }
  } catch (error) {
    console.error('   ❌ 模型映射验证失败:', error.message);
    return false;
  }
}

/**
 * 测试3: 端点配置验证
 */
function testEndpointConfiguration() {
  console.log('📋 测试3: 端点配置验证');
  
  try {
    const lmstudioConfig = JSON.parse(fs.readFileSync(
      '/Users/fanzhang/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json', 'utf8'
    ));
    const shuaihongConfig = JSON.parse(fs.readFileSync(
      '/Users/fanzhang/.route-claudecode/config/v4/single-provider/shuaihong-v4-5507-fixed.json', 'utf8'
    ));
    
    // 提取端点配置
    const lmstudioEndpoint = lmstudioConfig.serverCompatibilityProviders['lmstudio-compatibility'].connection.endpoint;
    const shuaihongEndpoint = shuaihongConfig.routing.routes[0].pipeline.layers[2].config.baseURL;
    
    console.log(`   LM Studio端点: ${lmstudioEndpoint}`);
    console.log(`   Shuaihong端点: ${shuaihongEndpoint}`);
    
    if (lmstudioEndpoint.includes('localhost:1234') && shuaihongEndpoint.includes('shuaihong.fun')) {
      console.log('   ✅ 端点配置正确，指向不同的服务\n');
      return true;
    } else {
      console.log('   ❌ 端点配置错误\n');
      return false;
    }
  } catch (error) {
    console.error('   ❌ 端点配置验证失败:', error.message);
    return false;
  }
}

/**
 * 测试4: Debug日志模拟路由选择
 */
function testRouteSelectionSimulation() {
  console.log('📋 测试4: 路由选择逻辑模拟测试');
  
  try {
    // 模拟请求
    const testRequest = {
      model: 'claude-3-5-haiku-20241022',
      messages: [{ role: 'user', content: 'test' }]
    };
    
    // 模拟当前硬编码逻辑 (错误的)
    const hardcodedRouting = {
      routeId: 'lmstudio-primary-route',
      providerId: 'lmstudio-compatibility',
      mappedModel: 'gpt-oss-20b-mlx'
    };
    
    // 期望的正确逻辑 (基于配置)
    const expectedShuaihongRouting = {
      routeId: 'shuaihong-primary-route',
      providerId: 'openai-server-provider',
      mappedModel: 'gpt-4o-mini'
    };
    
    console.log('   当前硬编码结果:');
    console.log('     Route ID:', hardcodedRouting.routeId);
    console.log('     Provider ID:', hardcodedRouting.providerId);
    console.log('     Mapped Model:', hardcodedRouting.mappedModel);
    
    console.log('   期望正确结果:');
    console.log('     Route ID:', expectedShuaihongRouting.routeId);
    console.log('     Provider ID:', expectedShuaihongRouting.providerId);
    console.log('     Mapped Model:', expectedShuaihongRouting.mappedModel);
    
    // 验证差异
    const isCorrect = (
      hardcodedRouting.routeId !== expectedShuaihongRouting.routeId &&
      hardcodedRouting.providerId !== expectedShuaihongRouting.providerId &&
      hardcodedRouting.mappedModel !== expectedShuaihongRouting.mappedModel
    );
    
    if (isCorrect) {
      console.log('   ❌ 确认路由选择逻辑被硬编码，需要修复\n');
      return false; // 期望失败，因为这证明了问题存在
    } else {
      console.log('   🤔 路由选择逻辑可能已修复\n');
      return true;
    }
  } catch (error) {
    console.error('   ❌ 路由选择模拟失败:', error.message);
    return false;
  }
}

/**
 * 测试5: Debug日志分析
 */
function testDebugLogAnalysis() {
  console.log('📋 测试5: Debug日志实际结果分析');
  
  try {
    // 查找最新的debug日志文件
    const debugDir = '/Users/fanzhang/.route-claudecode/debug-logs/port-5507';
    if (!fs.existsSync(debugDir)) {
      console.log('   ⚠️ Debug日志目录不存在\n');
      return false;
    }
    
    const files = fs.readdirSync(debugDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse(); // 最新的文件在前
    
    if (files.length === 0) {
      console.log('   ⚠️ 没有找到debug日志文件\n');
      return false;
    }
    
    const latestFile = files[0];
    const logPath = path.join(debugDir, latestFile);
    const debugData = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    
    console.log(`   分析最新日志文件: ${latestFile}`);
    
    // 分析路由决策
    const pipelineSteps = debugData.pipelineSteps || [];
    const routerStep = pipelineSteps.find(step => step.layer === 'router');
    
    if (routerStep && routerStep.output && routerStep.output.routing_decision) {
      const routing = routerStep.output.routing_decision;
      console.log('   实际路由决策:');
      console.log('     Route ID:', routing.routeId);
      console.log('     Provider ID:', routing.providerId);
      console.log('     Original Model:', routing.originalModel);
      console.log('     Mapped Model:', routing.mappedModel);
      
      // 验证是否使用了正确的路由
      if (routing.routeId === 'lmstudio-primary-route') {
        console.log('   ❌ 确认使用了错误的硬编码路由\n');
        return false;
      } else if (routing.routeId === 'shuaihong-primary-route') {
        console.log('   ✅ 使用了正确的shuaihong路由\n');
        return true;
      } else {
        console.log('   🤔 使用了未知的路由:', routing.routeId, '\n');
        return false;
      }
    } else {
      console.log('   ❌ Debug日志中没有找到路由决策数据\n');
      return false;
    }
  } catch (error) {
    console.error('   ❌ Debug日志分析失败:', error.message);
    return false;
  }
}

/**
 * 运行所有测试
 */
function runAllTests() {
  const tests = [
    { name: '配置文件解析验证', fn: testConfigurationParsing },
    { name: '模型映射验证', fn: testModelMapping },
    { name: '端点配置验证', fn: testEndpointConfiguration },
    { name: '路由选择逻辑模拟', fn: testRouteSelectionSimulation },
    { name: 'Debug日志实际结果分析', fn: testDebugLogAnalysis }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ 测试 "${test.name}" 执行失败:`, error.message);
      failed++;
    }
  }
  
  console.log('🎯 测试结果汇总:');
  console.log(`   ✅ 通过: ${passed}`);
  console.log(`   ❌ 失败: ${failed}`);
  console.log(`   📊 总计: ${passed + failed}`);
  
  if (failed > 0) {
    console.log('\n🔥 关键发现: 路由选择被硬编码在pipeline-server.ts中，需要修复！');
    console.log('📍 问题位置: /opt/homebrew/lib/node_modules/route-claude-code/src/server/pipeline-server.ts:289-299');
    console.log('💡 修复方案: 使用真实的protocolMatcher进行动态路由选择');
  } else {
    console.log('\n✨ 所有测试通过，路由选择逻辑正常！');
  }
}

// 执行测试
runAllTests();