#!/usr/bin/env node

/**
 * 验证backup路由配置的完整性
 */

function validateBackupConfig() {
  console.log('🔍 验证Backup路由配置');
  console.log('=======================\n');

  try {
    // 加载配置
    const config = require('/Users/fanzhang/.route-claude-code/config.json');
    const routing = config.routing;

    if (!routing) {
      console.error('❌ 未找到routing配置');
      return false;
    }

    console.log('📋 配置验证结果:\n');

    let allValid = true;
    const categories = ['default', 'background', 'thinking', 'longcontext', 'search'];

    for (const category of categories) {
      const categoryConfig = routing[category];
      console.log(`🔍 ${category}:`);

      // 验证基本字段
      if (!categoryConfig.provider) {
        console.log('   ❌ 缺少provider字段');
        allValid = false;
      } else {
        console.log(`   ✅ Primary Provider: ${categoryConfig.provider}`);
      }

      if (!categoryConfig.model) {
        console.log('   ❌ 缺少model字段');
        allValid = false;
      } else {
        console.log(`   ✅ Primary Model: ${categoryConfig.model}`);
      }

      // 验证backup配置
      if (categoryConfig.backup && Array.isArray(categoryConfig.backup)) {
        console.log(`   📦 Backup Providers (${categoryConfig.backup.length}):`);
        
        categoryConfig.backup.forEach((backup, index) => {
          if (!backup.provider) {
            console.log(`     ❌ Backup ${index + 1}: 缺少provider字段`);
            allValid = false;
          } else if (!backup.model) {
            console.log(`     ❌ Backup ${index + 1}: 缺少model字段`);
            allValid = false;
          } else {
            console.log(`     ✅ Backup ${index + 1}: ${backup.provider} → ${backup.model}${backup.weight ? ` (权重: ${backup.weight})` : ''}`);
          }
        });
      } else {
        console.log('   📦 无Backup配置');
      }

      // 验证failover配置
      if (categoryConfig.failover?.enabled) {
        console.log(`   🚨 Failover: ✅ 启用 (冷却期: ${categoryConfig.failover.cooldown}s)`);
        if (categoryConfig.failover.triggers?.length) {
          console.log(`     触发条件: ${categoryConfig.failover.triggers.length}个`);
          categoryConfig.failover.triggers.forEach(trigger => {
            console.log(`       - ${trigger.type}: 阈值${trigger.threshold}, 窗口${trigger.timeWindow}s`);
          });
        }
      } else {
        console.log('   🚨 Failover: ❌ 禁用');
      }

      // 验证负载均衡配置
      if (categoryConfig.loadBalancing?.enabled) {
        console.log(`   ⚖️  负载均衡: ✅ 启用 (策略: ${categoryConfig.loadBalancing.strategy})`);
        if (categoryConfig.loadBalancing.includeBackupInBalancing) {
          console.log('     📊 包含backup providers在负载均衡中');
        }
      } else {
        console.log('   ⚖️  负载均衡: ❌ 禁用');
      }

      console.log('');
    }

    // 验证providers配置
    console.log('🏭 Provider配置验证:');
    const providers = config.providers;
    const usedProviders = new Set();

    // 收集所有使用的provider名称
    for (const categoryConfig of Object.values(routing)) {
      usedProviders.add(categoryConfig.provider);
      if (categoryConfig.backup) {
        categoryConfig.backup.forEach(backup => {
          usedProviders.add(backup.provider);
        });
      }
    }

    // 检查每个使用的provider是否在providers中定义
    for (const providerName of usedProviders) {
      if (providers[providerName]) {
        console.log(`   ✅ ${providerName}: ${providers[providerName].type} @ ${providers[providerName].endpoint}`);
      } else {
        console.log(`   ❌ ${providerName}: 未在providers中定义`);
        allValid = false;
      }
    }

    console.log('\n📊 验证总结:');
    console.log('=============');
    if (allValid) {
      console.log('🎉 配置验证通过！所有字段完整，可以正常使用');
      
      console.log('\n💡 配置亮点:');
      console.log(`- 配置了 ${usedProviders.size} 个不同的providers`);
      console.log(`- ${Object.values(routing).filter(c => c.backup?.length > 0).length} 个类别配置了backup`);
      console.log(`- ${Object.values(routing).filter(c => c.failover?.enabled).length} 个类别启用了failover`);
      console.log(`- ${Object.values(routing).filter(c => c.loadBalancing?.enabled).length} 个类别启用了负载均衡`);

      return true;
    } else {
      console.log('❌ 配置存在问题，请修复后再使用');
      return false;
    }

  } catch (error) {
    console.error('❌ 配置文件读取失败:', error.message);
    return false;
  }
}

function main() {
  console.log('🚀 Backup路由配置验证工具');
  console.log('============================\n');
  
  const isValid = validateBackupConfig();
  
  if (isValid) {
    console.log('\n✅ 您的配置已准备就绪！');
    console.log('\n🎯 下一步建议：');
    console.log('1. 启动服务器测试负载均衡效果');
    console.log('2. 观察日志中的provider选择');
    console.log('3. 模拟故障测试failover机制');
  } else {
    console.log('\n⚠️  请修复配置问题后重新验证');
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateBackupConfig };