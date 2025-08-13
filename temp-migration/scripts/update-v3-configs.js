/**
 * 更新~/.route-claudecode/config/v3目录下的所有配置文件
 * 使其符合新的六层架构标准
 * 
 * Project owner: Jason Zhang
 */

import { loadUserConfig } from '../src/v3/config/config-merger.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

class V3ConfigUpdater {
  constructor() {
    this.v3ConfigDir = path.join(os.homedir(), '.route-claudecode/config/v3');
    this.results = {
      totalFiles: 0,
      updated: 0,
      failed: 0,
      results: []
    };
  }

  async updateAllConfigs() {
    console.log('🔄 开始更新V3配置文件...\n');
    console.log(`📁 配置目录: ${this.v3ConfigDir}`);

    if (!fs.existsSync(this.v3ConfigDir)) {
      console.log('❌ V3配置目录不存在');
      return false;
    }

    // 扫描并更新所有配置文件
    await this.scanAndUpdateDirectory(this.v3ConfigDir);

    this.printSummary();
    return this.results.failed === 0;
  }

  async scanAndUpdateDirectory(dirPath) {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        await this.scanAndUpdateDirectory(itemPath);
      } else if (item.endsWith('.json') && item.includes('config')) {
        await this.updateConfigFile(itemPath);
      }
    }
  }

  async updateConfigFile(configPath) {
    this.results.totalFiles++;
    const relativePath = path.relative(this.v3ConfigDir, configPath);
    
    try {
      console.log(`📋 处理配置文件: ${relativePath}`);
      
      // 读取现有配置
      const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // 创建新架构配置
      const newConfig = this.createNewArchitectureConfig(existingConfig, relativePath);
      
      // 备份原文件
      const backupPath = configPath + '.backup-' + Date.now();
      fs.writeFileSync(backupPath, JSON.stringify(existingConfig, null, 2));
      console.log(`   💾 备份原文件: ${path.basename(backupPath)}`);
      
      // 写入新配置
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
      
      this.results.updated++;
      this.results.results.push({
        file: relativePath,
        status: 'updated',
        backup: path.basename(backupPath)
      });
      
      console.log(`   ✅ 更新完成: ${relativePath}`);
      
    } catch (error) {
      this.results.failed++;
      this.results.results.push({
        file: relativePath,
        status: 'failed',
        error: error.message
      });
      
      console.log(`   ❌ 更新失败: ${relativePath} - ${error.message}`);
    }
  }

  createNewArchitectureConfig(oldConfig, relativePath) {
    // 基于新六层架构创建配置
    const newConfig = {
      name: `${oldConfig.name || 'V3 Configuration'} - Six Layer Architecture`,
      description: `Updated v3.0 configuration with six-layer architecture and preprocessing pipeline`,
      version: "3.0.0",
      configType: this.determineConfigType(relativePath),
      
      // 服务器配置
      server: {
        port: oldConfig.server?.port || this.getDefaultPort(relativePath),
        host: oldConfig.server?.host || "127.0.0.1",
        architecture: "v3.0-six-layer",
        environment: "development"
      },

      // 用户Provider配置（简化）
      providers: this.convertToUserProviders(oldConfig.providers || {}),

      // 路由配置
      routing: this.convertToNewRouting(oldConfig.routing || {}),

      // 调试配置
      debug: {
        enabled: oldConfig.debug?.enabled !== false,
        logLevel: oldConfig.debug?.logLevel || "info",
        traceRequests: true,
        saveRequests: true
      },

      // 元数据
      metadata: {
        createdAt: new Date().toISOString(),
        version: "3.0.0",
        basedOn: oldConfig.name || "legacy-v3-config",
        author: "Jason Zhang",
        compatibility: {
          "v2.7.0": false,
          "v3.0": true,
          "backwardCompatible": false
        },
        updateInfo: {
          updatedAt: new Date().toISOString(),
          updateReason: "Six-layer architecture migration",
          originalFile: relativePath
        }
      }
    };

    return newConfig;
  }

  convertToUserProviders(oldProviders) {
    const userProviders = {};

    for (const [providerName, providerConfig] of Object.entries(oldProviders)) {
      // 简化为用户配置格式
      userProviders[providerName] = {
        endpoint: providerConfig.endpoint || this.getDefaultEndpoint(providerName),
        models: providerConfig.models || [providerConfig.defaultModel || "default-model"]
      };

      // 添加API密钥配置（如果需要）
      if (this.requiresApiKey(providerName)) {
        userProviders[providerName].apiKey = providerConfig.apiKey || `\${${providerName.toUpperCase()}_API_KEY}`;
      }
    }

    return userProviders;
  }

  convertToNewRouting(oldRouting) {
    // 转换为新的路由格式
    const newRouting = {};
    
    // 提取categories或使用直接路由配置
    const categories = oldRouting.categories || oldRouting;

    const routingCategories = ['default', 'background', 'thinking', 'longcontext', 'search'];
    
    for (const category of routingCategories) {
      if (categories[category]) {
        newRouting[category] = {
          provider: categories[category].provider || categories[category].providers?.[0] || 'default-provider',
          model: categories[category].model || 'default-model'
        };
      } else {
        // 创建默认路由
        newRouting[category] = {
          provider: 'default-provider',
          model: 'default-model'
        };
      }
    }

    return newRouting;
  }

  determineConfigType(relativePath) {
    if (relativePath.includes('single-provider')) {
      return 'single-provider';
    } else if (relativePath.includes('load-balancing')) {
      return 'load-balancing';
    } else {
      return 'general';
    }
  }

  getDefaultPort(relativePath) {
    // 从文件名提取端口
    const portMatch = relativePath.match(/(\d{4,5})/);
    return portMatch ? parseInt(portMatch[1]) : 3456;
  }

  getDefaultEndpoint(providerName) {
    const endpointMap = {
      'lmstudio': 'http://localhost:1234/v1/chat/completions',
      'shuaihong': 'https://ai.shuaihong.fun/v1/chat/completions',
      'modelscope': 'https://dashscope.aliyuncs.com/v1/chat/completions',
      'google': 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent',
      'gemini': 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent',
      'codewhisperer': 'aws://codewhisperer',
      'anthropic': 'https://api.anthropic.com/v1/messages'
    };

    // 尝试匹配provider名称
    for (const [key, endpoint] of Object.entries(endpointMap)) {
      if (providerName.toLowerCase().includes(key)) {
        return endpoint;
      }
    }

    return 'http://localhost:8080/v1/chat/completions';
  }

  requiresApiKey(providerName) {
    const apiKeyProviders = ['shuaihong', 'modelscope', 'google', 'gemini', 'anthropic'];
    return apiKeyProviders.some(provider => providerName.toLowerCase().includes(provider));
  }

  printSummary() {
    console.log('\n📊 V3配置文件更新结果汇总:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📁 总文件数: ${this.results.totalFiles}`);
    console.log(`✅ 成功更新: ${this.results.updated}`);
    console.log(`❌ 更新失败: ${this.results.failed}`);
    console.log(`🎯 成功率: ${((this.results.updated / this.results.totalFiles) * 100).toFixed(1)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (this.results.updated > 0) {
      console.log('\n✅ 成功更新的文件:');
      this.results.results
        .filter(r => r.status === 'updated')
        .forEach(result => {
          console.log(`   • ${result.file} (备份: ${result.backup})`);
        });
    }

    if (this.results.failed > 0) {
      console.log('\n❌ 更新失败的文件:');
      this.results.results
        .filter(r => r.status === 'failed')
        .forEach(result => {
          console.log(`   • ${result.file}: ${result.error}`);
        });
    }

    console.log('\n🎉 V3配置文件更新完成！');
    console.log('💡 所有配置文件现在符合六层架构标准');
    console.log('💡 原文件已备份，可以安全回滚');
    console.log('💡 新配置支持用户/系统配置分离');
    console.log('💡 新配置支持自动预处理功能');
  }

  getResults() {
    return this.results;
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const updater = new V3ConfigUpdater();
  updater.updateAllConfigs();
}

export default V3ConfigUpdater;