#!/usr/bin/env node

/**
 * 创建真实Provider测试配置文件
 * 使用环境变量提供API密钥，确保隐私安全
 */

const fs = require('fs');
const path = require('path');

function createTestConfig() {
  console.log('🔧 Creating real provider test configuration...');
  
  // 检查环境变量
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const modelScopeApiKey = process.env.MODELSCOPE_API_KEY;
  const shuaiHongApiKey = process.env.SHUAIHONG_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  const config = {
    "configVersion": "4.0.0",
    "architecture": "four-layer-v4.0",
    "server": {
      "port": 5511,
      "host": "localhost",
      "name": "test-real-providers-server"
    },
    "standardProviders": {}
  };
  
  // 只添加有API密钥的Provider
  if (geminiApiKey) {
    config.standardProviders["google-gemini"] = {
      "id": "google-gemini",
      "name": "Google Gemini API",
      "protocol": "gemini",
      "type": "premium",
      "priority": 1,
      "weight": 30,
      "connection": {
        "endpoint": "https://generativelanguage.googleapis.com",
        "authentication": {
          "type": "api_key",
          "credentials": {
            "apiKeys": [geminiApiKey]
          }
        }
      },
      "models": {
        "supported": ["gemini-2.5-flash", "gemini-2.5-pro"]
      }
    };
    console.log('✅ Added Google Gemini provider');
  } else {
    console.log('⚠️  Skipping Google Gemini (no GEMINI_API_KEY)');
  }
  
  if (modelScopeApiKey) {
    config.standardProviders["modelscope-qwen"] = {
      "id": "modelscope-qwen",
      "name": "ModelScope OpenAI Compatible API",
      "protocol": "openai",
      "type": "standard",
      "priority": 2,
      "weight": 40,
      "connection": {
        "endpoint": "https://api-inference.modelscope.cn/v1/chat/completions",
        "authentication": {
          "type": "bearer",
          "credentials": {
            "apiKeys": [modelScopeApiKey]
          }
        }
      },
      "models": {
        "supported": ["Qwen/Qwen3-Coder-480B-A35B-Instruct", "Qwen/Qwen2.5-Coder-32B-Instruct"]
      }
    };
    console.log('✅ Added ModelScope provider');
  } else {
    console.log('⚠️  Skipping ModelScope (no MODELSCOPE_API_KEY)');
  }
  
  if (shuaiHongApiKey) {
    config.standardProviders["shuaihong-horizon"] = {
      "id": "shuaihong-horizon",
      "name": "ShuaiHong OpenAI Compatible API",
      "protocol": "openai",
      "type": "backup",
      "priority": 3,
      "weight": 30,
      "connection": {
        "endpoint": "https://ai.shuaihong.fun/v1/chat/completions",
        "authentication": {
          "type": "bearer",
          "credentials": {
            "apiKeys": [shuaiHongApiKey]
          }
        }
      },
      "models": {
        "supported": ["horizon", "gpt-4o-mini", "claude-3-haiku"]
      }
    };
    console.log('✅ Added ShuaiHong provider');
  } else {
    console.log('⚠️  Skipping ShuaiHong (no SHUAIHONG_API_KEY)');
  }
  
  if (openaiApiKey) {
    config.standardProviders["openai-official"] = {
      "id": "openai-official",
      "name": "OpenAI Official API",
      "protocol": "openai",
      "type": "premium",
      "priority": 1,
      "weight": 50,
      "connection": {
        "endpoint": "https://api.openai.com/v1/chat/completions",
        "authentication": {
          "type": "bearer",
          "credentials": {
            "apiKeys": [openaiApiKey]
          }
        }
      },
      "models": {
        "supported": ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"]
      }
    };
    console.log('✅ Added OpenAI provider');
  } else {
    console.log('⚠️  Skipping OpenAI (no OPENAI_API_KEY)');
  }
  
  // 保存配置文件
  const configPath = path.join(__dirname, 'test-real-providers-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  const providerCount = Object.keys(config.standardProviders).length;
  console.log(`\n📄 Configuration saved: ${configPath}`);
  console.log(`🔧 Providers configured: ${providerCount}`);
  
  if (providerCount === 0) {
    console.log('\n❌ No providers configured! Set environment variables:');
    console.log('   export GEMINI_API_KEY="your-gemini-key"');
    console.log('   export MODELSCOPE_API_KEY="your-modelscope-key"');
    console.log('   export SHUAIHONG_API_KEY="your-shuaihong-key"');
    console.log('   export OPENAI_API_KEY="your-openai-key"');
    process.exit(1);
  }
  
  console.log('\n🎯 Ready for testing! Run:');
  console.log(`   rcc4 test --config ${configPath}`);
  
  return configPath;
}

// 运行配置创建
if (require.main === module) {
  createTestConfig();
}

module.exports = { createTestConfig };