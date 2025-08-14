#!/usr/bin/env node

/**
 * 测试配置修改脚本
 * 允许在测试过程中动态修改配置，无需二次用户审批
 */

const fs = require('fs');
const path = require('path');

function loadConfig(configPath) {
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configContent);
  } catch (error) {
    console.error(`无法加载配置文件 ${configPath}:`, error.message);
    return null;
  }
}

function saveConfig(configPath, config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`配置已保存到 ${configPath}`);
    return true;
  } catch (error) {
    console.error(`无法保存配置文件 ${configPath}:`, error.message);
    return false;
  }
}

function updateProviderWeight(config, providerName, weight) {
  if (!config.routing) {
    console.error('配置中未找到路由信息');
    return false;
  }
  
  let updated = false;
  for (const category in config.routing) {
    const route = config.routing[category];
    if (route.provider === providerName && route.weight) {
      route.weight = weight;
      updated = true;
      console.log(`更新 ${category} 类别中 ${providerName} 的权重为 ${weight}`);
    } else if (Array.isArray(route.providers)) {
      for (const provider of route.providers) {
        if (provider.provider === providerName && provider.weight) {
          provider.weight = weight;
          updated = true;
          console.log(`更新 ${category} 类别中 ${providerName} 的权重为 ${weight}`);
        }
      }
    }
  }
  
  if (!updated) {
    console.log(`未找到使用 ${providerName} 的路由配置`);
  }
  
  return updated;
}

function toggleModel(config, providerName, modelName, action) {
  if (!config.providers || !config.providers[providerName]) {
    console.error(`未找到Provider ${providerName}`);
    return false;
  }
  
  const provider = config.providers[providerName];
  if (!provider.models) {
    console.error(`Provider ${providerName} 中未找到模型列表`);
    return false;
  }
  
  if (action === 'disable') {
    // 从可用模型列表中移除
    provider.models = provider.models.filter(model => model !== modelName);
    console.log(`已禁用 ${providerName} 的模型 ${modelName}`);
  } else if (action === 'enable') {
    // 添加到可用模型列表
    if (!provider.models.includes(modelName)) {
      provider.models.push(modelName);
      console.log(`已启用 ${providerName} 的模型 ${modelName}`);
    } else {
      console.log(`模型 ${modelName} 在 ${providerName} 中已处于启用状态`);
    }
  } else {
    console.error('无效的操作，仅支持 "enable" 或 "disable"');
    return false;
  }
  
  return true;
}

function adjustRateLimit(config, errorCode, newDuration) {
  if (!config.routing) {
    console.error('配置中未找到路由信息');
    return false;
  }
  
  let updated = false;
  for (const category in config.routing) {
    const route = config.routing[category];
    if (route.failover && route.failover.triggers) {
      for (const trigger of route.failover.triggers) {
        if (trigger.type === 'http_status' && trigger.codes.includes(errorCode)) {
          trigger.blacklistDuration = newDuration;
          updated = true;
          console.log(`更新 ${category} 类别中错误码 ${errorCode} 的黑名单时长为 ${newDuration} 秒`);
        }
      }
    }
  }
  
  if (!updated) {
    console.log(`未找到错误码 ${errorCode} 的配置`);
  }
  
  return updated;
}

function updateServerPort(config, newPort) {
  if (!config.server) {
    console.error('配置中未找到服务器信息');
    return false;
  }
  
  const oldPort = config.server.port;
  config.server.port = newPort;
  console.log(`服务器端口已从 ${oldPort} 更新为 ${newPort}`);
  return true;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('使用方法:');
    console.log('  node delivery-test-config-modifier.js <configPath> --update-provider-weight <provider> <weight>');
    console.log('  node delivery-test-config-modifier.js <configPath> --toggle-model <provider> <model> <enable|disable>');
    console.log('  node delivery-test-config-modifier.js <configPath> --adjust-rate-limit <errorCode> <duration>');
    console.log('  node delivery-test-config-modifier.js <configPath> --update-port <port>');
    process.exit(1);
  }
  
  const configPath = args[0];
  const action = args[1];
  
  // 加载配置
  const config = loadConfig(configPath);
  if (!config) {
    process.exit(1);
  }
  
  let success = false;
  
  switch (action) {
    case '--update-provider-weight':
      if (args.length !== 5) {
        console.error('参数错误: 需要提供 <provider> <weight>');
        process.exit(1);
      }
      const providerName = args[2];
      const weight = parseInt(args[3]);
      success = updateProviderWeight(config, providerName, weight);
      break;
      
    case '--toggle-model':
      if (args.length !== 6) {
        console.error('参数错误: 需要提供 <provider> <model> <enable|disable>');
        process.exit(1);
      }
      const modelProvider = args[2];
      const modelName = args[3];
      const toggleAction = args[4];
      success = toggleModel(config, modelProvider, modelName, toggleAction);
      break;
      
    case '--adjust-rate-limit':
      if (args.length !== 4) {
        console.error('参数错误: 需要提供 <errorCode> <duration>');
        process.exit(1);
      }
      const errorCode = parseInt(args[2]);
      const duration = parseInt(args[3]);
      success = adjustRateLimit(config, errorCode, duration);
      break;
      
    case '--update-port':
      if (args.length !== 3) {
        console.error('参数错误: 需要提供 <port>');
        process.exit(1);
      }
      const newPort = parseInt(args[2]);
      success = updateServerPort(config, newPort);
      break;
      
    default:
      console.error(`不支持的操作: ${action}`);
      process.exit(1);
  }
  
  if (success) {
    // 保存修改后的配置
    if (saveConfig(configPath, config)) {
      console.log('✅ 配置修改完成');
      process.exit(0);
    } else {
      console.log('❌ 配置保存失败');
      process.exit(1);
    }
  } else {
    console.log('❌ 配置修改失败');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}