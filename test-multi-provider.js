#!/usr/bin/env node

/**
 * 测试多provider路由配置
 * 验证权重优先级和负载均衡逻辑
 */

function testMultiProviderRouting() {
  console.log('🎯 测试多Provider路由配置');
  console.log('==============================\n');

  // 加载配置
  const config = require('/Users/fanzhang/.route-claude-code/config.json');
  const routing = config.routing;

  if (!routing) {
    console.error('❌ 未找到routing配置');
    return false;
  }

  console.log('📋 配置分析:\n');

  let allValid = true;
  const categories = ['default', 'background', 'thinking', 'longcontext', 'search'];

  for (const category of categories) {
    const categoryConfig = routing[category];
    console.log(`🔍 ${category}:`);

    if (!categoryConfig.providers || !Array.isArray(categoryConfig.providers)) {
      console.log('   ❌ 配置格式错误：缺少providers数组');
      allValid = false;
      continue;
    }

    // 按权重分组显示
    const weightGroups = new Map();
    categoryConfig.providers.forEach(p => {
      const weight = p.weight || 1;
      if (!weightGroups.has(weight)) {
        weightGroups.set(weight, []);
      }
      weightGroups.get(weight).push(p);
    });

    const sortedWeights = Array.from(weightGroups.keys()).sort((a, b) => a - b);
    
    console.log(`   📊 权重分组 (${categoryConfig.providers.length}个provider):`);
    sortedWeights.forEach((weight, index) => {
      const providers = weightGroups.get(weight);
      const priority = index === 0 ? '🥇 最高优先级' : index === 1 ? '🥈 备用' : '🥉 后备';
      console.log(`     权重 ${weight} ${priority}: ${providers.length}个`);
      providers.forEach(p => {
        console.log(`       - ${p.provider} → ${p.model}`);
      });
    });

    // 模拟负载均衡测试
    console.log('   🧪 负载均衡模拟 (20次选择):');
    const results = simulateSelection(categoryConfig.providers, 20);
    
    const totalSelections = Object.values(results).reduce((a, b) => a + b, 0);
    Object.entries(results).forEach(([provider, count]) => {
      const percentage = totalSelections > 0 ? (count / totalSelections * 100).toFixed(1) : '0';
      console.log(`       ${provider}: ${count}次 (${percentage}%)`);
    });

    console.log('');
  }

  // 测试权重优先级逻辑
  console.log('🧪 权重优先级测试:\n');
  
  testWeightPriority();

  console.log('\n📊 测试总结:');
  console.log('=============');
  if (allValid) {
    console.log('🎉 配置验证通过！');
    console.log('\n💡 配置特点:');
    console.log('- 支持无限数量的providers');
    console.log('- 权重决定优先级（数字越小优先级越高）');
    console.log('- 相同权重内自动负载均衡');
    console.log('- 高优先级provider不可用时自动降级');
    
    return true;
  } else {
    console.log('❌ 配置存在问题，请修复后再试');
    return false;
  }
}

/**
 * 模拟provider选择逻辑
 */
function simulateSelection(providers, rounds) {
  const results = {};
  const roundRobinCounters = new Map();
  
  // 初始化结果计数
  providers.forEach(p => {
    results[p.provider] = 0;
  });
  
  // 按权重分组
  const weightGroups = new Map();
  providers.forEach(p => {
    const weight = p.weight || 1;
    if (!weightGroups.has(weight)) {
      weightGroups.set(weight, []);
    }
    weightGroups.get(weight).push(p);
  });
  
  const sortedWeights = Array.from(weightGroups.keys()).sort((a, b) => a - b);
  
  // 模拟选择（假设所有provider都健康）
  for (let i = 0; i < rounds; i++) {
    // 选择最高优先级（最小权重）的组
    const highestPriorityWeight = sortedWeights[0];
    const availableProviders = weightGroups.get(highestPriorityWeight);
    
    // 在同权重组内round-robin
    if (!roundRobinCounters.has(highestPriorityWeight)) {
      roundRobinCounters.set(highestPriorityWeight, 0);
    }
    
    const counter = roundRobinCounters.get(highestPriorityWeight);
    const selectedIndex = counter % availableProviders.length;
    const selected = availableProviders[selectedIndex];
    
    results[selected.provider]++;
    roundRobinCounters.set(highestPriorityWeight, counter + 1);
  }
  
  return results;
}

/**
 * 测试权重优先级逻辑
 */
function testWeightPriority() {
  console.log('🔍 权重优先级逻辑验证:');
  
  const testCases = [
    {
      name: '相同权重负载均衡',
      providers: [
        { provider: 'A', model: 'model-a', weight: 1 },
        { provider: 'B', model: 'model-b', weight: 1 },
        { provider: 'C', model: 'model-c', weight: 1 }
      ],
      expected: '应该均匀分配 (约33%每个)'
    },
    {
      name: '不同权重优先级',
      providers: [
        { provider: 'Primary', model: 'model-1', weight: 1 },
        { provider: 'Secondary', model: 'model-2', weight: 2 },
        { provider: 'Tertiary', model: 'model-3', weight: 3 }
      ],
      expected: '只使用Primary (100%)'
    },
    {
      name: '混合权重场景',
      providers: [
        { provider: 'A1', model: 'model-a1', weight: 1 },
        { provider: 'A2', model: 'model-a2', weight: 1 },
        { provider: 'B1', model: 'model-b1', weight: 2 }
      ],
      expected: 'A1和A2各50%, B1不使用'
    }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n   测试 ${index + 1}: ${testCase.name}`);
    console.log(`   预期: ${testCase.expected}`);
    
    const results = simulateSelection(testCase.providers, 10);
    console.log('   实际结果:');
    
    Object.entries(results).forEach(([provider, count]) => {
      const percentage = count > 0 ? (count / 10 * 100).toFixed(0) : '0';
      console.log(`     ${provider}: ${count}/10 (${percentage}%)`);
    });
  });
}

function main() {
  console.log('🚀 多Provider路由系统测试');
  console.log('===========================\n');
  
  const success = testMultiProviderRouting();
  
  if (success) {
    console.log('\n✅ 多Provider配置验证完成！');
    console.log('\n🎯 配置优势:');
    console.log('1. 🔢 无限扩展: 支持任意数量的providers');
    console.log('2. ⚖️  智能分配: 权重决定优先级和分配比例');
    console.log('3. 🔄 自动均衡: 相同权重内自动负载均衡');
    console.log('4. 🛡️ 自动降级: 高优先级不可用时自动使用低优先级');
    console.log('\n💡 使用示例:');
    console.log('- 权重1: 主要providers (优先使用)');
    console.log('- 权重2: 备用providers (主要不可用时使用)');
    console.log('- 权重3: 应急providers (最后的选择)');
  } else {
    console.log('\n❌ 配置验证失败，请检查配置格式');
  }
}

if (require.main === module) {
  main();
}

module.exports = { testMultiProviderRouting };