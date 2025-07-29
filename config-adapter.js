#!/usr/bin/env node

/**
 * 配置适配器：将新的providers数组格式转换为旧的provider+backup格式
 * 用于兼容现有的路由引擎
 */

const fs = require('fs');
const path = require('path');

function convertNewConfigToOld() {
  console.log('🔄 配置格式转换中...');
  
  const configPath = '/Users/fanzhang/.route-claude-code/config.json';
  
  try {
    // 读取当前配置
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (!config.routing) {
      console.error('❌ 未找到routing配置');
      return false;
    }

    let needsConversion = false;
    
    // 转换每个路由类别
    for (const [category, categoryConfig] of Object.entries(config.routing)) {
      if (categoryConfig.providers && Array.isArray(categoryConfig.providers)) {
        needsConversion = true;
        
        // 按权重排序
        const sortedProviders = categoryConfig.providers.sort((a, b) => (a.weight || 1) - (b.weight || 1));
        
        // 第一个作为primary
        const primary = sortedProviders[0];
        config.routing[category] = {
          provider: primary.provider,
          model: primary.model
        };
        
        // 其余作为backup
        if (sortedProviders.length > 1) {
          config.routing[category].backup = sortedProviders.slice(1).map(p => ({
            provider: p.provider,
            model: p.model,
            weight: p.weight
          }));
        }
        
        console.log(`✅ ${category}: ${primary.provider} + ${sortedProviders.length - 1}个backup`);
      }
    }
    
    if (needsConversion) {
      // 备份原配置
      const backupPath = configPath + '.backup.' + Date.now();
      fs.writeFileSync(backupPath, JSON.stringify(config, null, 2));
      console.log(`📋 原配置已备份到: ${backupPath}`);
      
      // 保存转换后的配置
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log('✅ 配置转换完成');
      
      return true;
    } else {
      console.log('ℹ️  配置已经是兼容格式，无需转换');
      return true;
    }
    
  } catch (error) {
    console.error('❌ 配置转换失败:', error.message);
    return false;
  }
}

function main() {
  console.log('🔧 配置兼容性适配器');
  console.log('====================\n');
  
  const success = convertNewConfigToOld();
  
  if (success) {
    console.log('\n🎉 配置现在兼容现有的路由引擎了！');
    console.log('\n💡 说明：');
    console.log('- 最小权重的provider作为primary');
    console.log('- 其余providers作为backup');
    console.log('- 保持了原有的优先级逻辑');
    console.log('\n🚀 您现在可以启动服务器了');
  } else {
    console.log('\n❌ 转换失败，请检查配置格式');
  }
}

if (require.main === module) {
  main();
}

module.exports = { convertNewConfigToOld };