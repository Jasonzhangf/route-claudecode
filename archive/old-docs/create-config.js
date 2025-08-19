#!/usr/bin/env node

/**
 * RCC v4.0 配置文件创建工具
 * 帮助用户创建标准的config.json文件
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createConfig() {
  console.log('🔧 RCC v4.0 Configuration Creator');
  console.log('==================================');
  console.log('');

  // 询问配置类型
  console.log('选择配置类型:');
  console.log('1. LM Studio (本地)');
  console.log('2. 混合Provider (多服务商)');
  console.log('3. 自定义');
  
  const configType = await question('请选择 (1-3): ');
  
  let config = {};
  let filename = 'config.json';
  
  switch (configType) {
    case '1':
      config = await createLMStudioConfig();
      filename = 'config.json';
      break;
    case '2':
      config = await createHybridConfig();
      filename = 'config.json';
      break;
    case '3':
      config = await createCustomConfig();
      filename = 'config.json';
      break;
    default:
      console.log('❌ 无效选择，使用默认LM Studio配置');
      config = await createLMStudioConfig();
  }
  
  // 询问保存位置
  console.log('');
  console.log('选择保存位置:');
  console.log('1. ./config.json (当前项目)');
  console.log('2. ./config/config.json (当前项目的config目录)');
  console.log('3. ~/.route-claudecode/config.json (用户全局配置)');
  console.log('4. 自定义路径');
  
  const location = await question('请选择 (1-4): ');
  let configPath = '';
  
  switch (location) {
    case '1':
      configPath = './config.json';
      break;
    case '2':
      configPath = './config/config.json';
      // 确保config目录存在
      if (!fs.existsSync('./config')) {
        fs.mkdirSync('./config', { recursive: true });
      }
      break;
    case '3':
      configPath = path.join(process.env.HOME, '.route-claudecode/config.json');
      // 确保目录存在
      const userConfigDir = path.dirname(configPath);
      if (!fs.existsSync(userConfigDir)) {
        fs.mkdirSync(userConfigDir, { recursive: true });
      }
      break;
    case '4':
      configPath = await question('请输入完整路径: ');
      break;
    default:
      configPath = './config.json';
  }
  
  // 保存配置文件
  try {
    // 确保目录存在
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('');
    console.log(`✅ 配置文件已创建: ${configPath}`);
    console.log('');
    console.log('🚀 现在您可以启动RCC服务器:');
    console.log(`   rcc4 start --config ${configPath}`);
    console.log('   或者 (如果使用默认路径):');
    console.log('   rcc4 start');
    
  } catch (error) {
    console.error(`❌ 创建配置文件失败: ${error.message}`);
    process.exit(1);
  }
  
  rl.close();
}

async function createLMStudioConfig() {
  const port = await question('LM Studio端口 (默认1234): ') || '1234';
  const serverPort = await question('RCC服务器端口 (默认5506): ') || '5506';
  
  return {
    "configVersion": "4.0.0",
    "architecture": "four-layer-v4.0",
    "server": {
      "port": parseInt(serverPort),
      "host": "localhost",
      "name": "rcc-lmstudio-server"
    },
    "standardProviders": {
      "lmstudio": {
        "id": "lmstudio",
        "name": "LM Studio Local Server",
        "protocol": "openai",
        "type": "local",
        "priority": 1,
        "weight": 100,
        "connection": {
          "endpoint": `http://localhost:${port}/v1/chat/completions`,
          "authentication": {
            "type": "none"
          }
        },
        "models": {
          "supported": [
            "llama-3.1-8b-instruct",
            "qwen2.5-coder-32b-instruct",
            "local-model"
          ]
        },
        "healthCheck": {
          "enabled": true,
          "interval": 30000,
          "endpoint": `http://localhost:${port}/v1/models`
        }
      }
    },
    "routing": {
      "strategy": "single-provider",
      "configuration": {
        "zeroFallbackPolicy": true,
        "strictErrorReporting": true
      },
      "routes": [
        {
          "id": "lmstudio-route",
          "name": "LM Studio Route",
          "priority": 1,
          "weight": 100,
          "conditions": {
            "models": ["claude-3-5-sonnet-20241022"],
            "categories": ["default", "coding", "thinking"]
          },
          "targets": ["lmstudio"]
        }
      ],
      "routingRules": {
        "modelMapping": {
          "claude-3-5-sonnet-20241022": {
            "preferredRoutes": ["lmstudio-route"],
            "modelOverrides": {
              "lmstudio-route": "llama-3.1-8b-instruct"
            }
          }
        }
      }
    },
    "debug": {
      "enabled": true,
      "logLevel": "info"
    },
    "metadata": {
      "version": "4.0.0",
      "description": "LM Studio local configuration",
      "tags": ["lmstudio", "local"]
    }
  };
}

async function createHybridConfig() {
  console.log('⚠️  混合配置需要多个API密钥，请确保已设置环境变量');
  const serverPort = await question('RCC服务器端口 (默认5510): ') || '5510';
  
  return {
    "configVersion": "4.0.0",
    "architecture": "four-layer-v4.0",
    "server": {
      "port": parseInt(serverPort),
      "host": "localhost",
      "name": "rcc-hybrid-server"
    },
    "standardProviders": {
      "lmstudio": {
        "id": "lmstudio",
        "name": "LM Studio Local",
        "protocol": "openai",
        "type": "local",
        "priority": 1,
        "weight": 50,
        "connection": {
          "endpoint": "http://localhost:1234/v1/chat/completions",
          "authentication": { "type": "none" }
        },
        "models": { "supported": ["llama-3.1-8b-instruct"] }
      },
      "gemini": {
        "id": "gemini",
        "name": "Google Gemini",
        "protocol": "gemini",
        "type": "cloud",
        "priority": 2,
        "weight": 30,
        "connection": {
          "endpoint": "https://generativelanguage.googleapis.com",
          "authentication": {
            "type": "api_key",
            "credentials": {
              "apiKeys": ["${GEMINI_API_KEY}"]
            }
          }
        },
        "models": { "supported": ["gemini-2.5-flash"] }
      }
    },
    "routing": {
      "strategy": "intelligent-hybrid",
      "configuration": {
        "zeroFallbackPolicy": false,
        "strictErrorReporting": true
      }
    },
    "metadata": {
      "version": "4.0.0",
      "description": "Hybrid multi-provider configuration",
      "tags": ["hybrid", "lmstudio", "gemini"]
    }
  };
}

async function createCustomConfig() {
  console.log('🛠️  自定义配置模式 - 将创建基础模板');
  const serverPort = await question('RCC服务器端口: ') || '5506';
  
  return {
    "configVersion": "4.0.0",
    "architecture": "four-layer-v4.0",
    "server": {
      "port": parseInt(serverPort),
      "host": "localhost",
      "name": "rcc-custom-server"
    },
    "standardProviders": {},
    "routing": {
      "strategy": "single-provider",
      "configuration": {
        "zeroFallbackPolicy": true,
        "strictErrorReporting": true
      }
    },
    "metadata": {
      "version": "4.0.0",
      "description": "Custom configuration template",
      "tags": ["custom"]
    }
  };
}

// 运行配置创建器
if (require.main === module) {
  createConfig().catch(error => {
    console.error('❌ 配置创建失败:', error);
    process.exit(1);
  });
}

module.exports = { createConfig };