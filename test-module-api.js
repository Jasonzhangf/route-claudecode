/**
 * 模块API功能测试脚本
 * 
 * 测试所有模块类型的API管理功能
 */

const http = require('http');
const fs = require('fs');

// 测试配置
const API_BASE_URL = 'http://localhost:5506';
const TEST_TIMEOUT = 10000;

// 测试用的配置
const testConfigs = {
  transformer: {
    type: 'transformer',
    moduleType: 'anthropic-openai',
    config: {}
  },
  
  protocol: {
    type: 'protocol',
    moduleType: 'openai',
    config: {}
  },
  
  serverCompatibility: {
    type: 'server-compatibility',
    moduleType: 'lmstudio',
    config: {
      baseUrl: 'http://localhost:8080',
      models: ['llama-3.1-8b-instruct'],
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000
    }
  },
  
  server: {
    type: 'server',
    moduleType: 'openai',
    config: {
      baseURL: 'http://localhost:8080',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000
    }
  },
  
  validator: {
    type: 'validator',
    moduleType: 'anthropic',
    config: {
      strictMode: true,
      allowExtraFields: false
    }
  },
  
  provider: {
    type: 'provider',
    moduleType: 'anthropic',
    config: {
      apiKey: 'test-api-key',
      defaultModel: 'claude-3-sonnet-20240229'
    }
  }
};

/**
 * 发送HTTP请求
 */
function sendRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ statusCode: res.statusCode, headers: res.headers, body: result });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    
    req.on('error', (e) => {
      console.error(`HTTP请求错误: ${e.message}`);
      reject(e);
    });
    
    req.setTimeout(TEST_TIMEOUT, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    
    req.end();
  });
}

/**
 * 测试创建模块
 */
async function testCreateModule(moduleConfig) {
  console.log(`\n🧪 测试创建 ${moduleConfig.type} 模块...`);
  
  try {
    const options = {
      hostname: 'localhost',
      port: 5506,
      path: '/api/v1/modules',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const response = await sendRequest(options, moduleConfig);
    console.log(`  状态码: ${response.statusCode}`);
    console.log(`  响应:`, response.body);
    
    if (response.statusCode === 200 && response.body && response.body.id) {
      console.log(`  ✅ 模块创建成功: ${response.body.id}`);
      return response.body.id;
    } else {
      console.log(`  ❌ 模块创建失败`);
      return null;
    }
  } catch (error) {
    console.log(`  ❌ 创建模块时出错: ${error.message}`);
    return null;
  }
}

/**
 * 测试启动模块
 */
async function testStartModule(moduleId) {
  console.log(`\n🚀 测试启动模块 ${moduleId}...`);
  
  try {
    const options = {
      hostname: 'localhost',
      port: 5506,
      path: `/api/v1/modules/${moduleId}/start`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const response = await sendRequest(options);
    console.log(`  状态码: ${response.statusCode}`);
    console.log(`  响应:`, response.body);
    
    if (response.statusCode === 200 && response.body && response.body.status === 'started') {
      console.log(`  ✅ 模块启动成功`);
      return true;
    } else {
      console.log(`  ❌ 模块启动失败`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ 启动模块时出错: ${error.message}`);
    return false;
  }
}

/**
 * 测试配置模块
 */
async function testConfigureModule(moduleId, config) {
  console.log(`\n⚙️  测试配置模块 ${moduleId}...`);
  
  try {
    const options = {
      hostname: 'localhost',
      port: 5506,
      path: `/api/v1/modules/${moduleId}/configure`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const response = await sendRequest(options, config);
    console.log(`  状态码: ${response.statusCode}`);
    console.log(`  响应:`, response.body);
    
    if (response.statusCode === 200 && response.body && response.body.status === 'configured') {
      console.log(`  ✅ 模块配置成功`);
      return true;
    } else {
      console.log(`  ❌ 模块配置失败`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ 配置模块时出错: ${error.message}`);
    return false;
  }
}

/**
 * 测试获取模块状态
 */
async function testGetModuleStatus(moduleId) {
  console.log(`\n📊 测试获取模块 ${moduleId} 状态...`);
  
  try {
    const options = {
      hostname: 'localhost',
      port: 5506,
      path: `/api/v1/modules/${moduleId}/status`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const response = await sendRequest(options);
    console.log(`  状态码: ${response.statusCode}`);
    console.log(`  响应:`, response.body);
    
    if (response.statusCode === 200 && response.body) {
      console.log(`  ✅ 获取模块状态成功`);
      return true;
    } else {
      console.log(`  ❌ 获取模块状态失败`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ 获取模块状态时出错: ${error.message}`);
    return false;
  }
}

/**
 * 测试处理请求
 */
async function testProcessModule(moduleId, input) {
  console.log(`\n🔄 测试处理模块 ${moduleId} 请求...`);
  
  try {
    const options = {
      hostname: 'localhost',
      port: 5506,
      path: `/api/v1/modules/${moduleId}/process`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const response = await sendRequest(options, input);
    console.log(`  状态码: ${response.statusCode}`);
    console.log(`  响应:`, response.body);
    
    if (response.statusCode === 200) {
      console.log(`  ✅ 模块处理请求成功`);
      return true;
    } else {
      console.log(`  ❌ 模块处理请求失败`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ 处理请求时出错: ${error.message}`);
    return false;
  }
}

/**
 * 测试停止模块
 */
async function testStopModule(moduleId) {
  console.log(`\n⏹️  测试停止模块 ${moduleId}...`);
  
  try {
    const options = {
      hostname: 'localhost',
      port: 5506,
      path: `/api/v1/modules/${moduleId}/stop`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const response = await sendRequest(options);
    console.log(`  状态码: ${response.statusCode}`);
    console.log(`  响应:`, response.body);
    
    if (response.statusCode === 200 && response.body && response.body.status === 'stopped') {
      console.log(`  ✅ 模块停止成功`);
      return true;
    } else {
      console.log(`  ❌ 模块停止失败`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ 停止模块时出错: ${error.message}`);
    return false;
  }
}

/**
 * 测试销毁模块
 */
async function testDestroyModule(moduleId) {
  console.log(`\n🗑️  测试销毁模块 ${moduleId}...`);
  
  try {
    const options = {
      hostname: 'localhost',
      port: 5506,
      path: `/api/v1/modules/${moduleId}`,
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const response = await sendRequest(options);
    console.log(`  状态码: ${response.statusCode}`);
    console.log(`  响应:`, response.body);
    
    if (response.statusCode === 200) {
      console.log(`  ✅ 模块销毁成功`);
      return true;
    } else {
      console.log(`  ❌ 模块销毁失败`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ 销毁模块时出错: ${error.message}`);
    return false;
  }
}

/**
 * 测试获取所有模块状态
 */
async function testGetAllModulesStatus() {
  console.log(`\n📋 测试获取所有模块状态...`);
  
  try {
    const options = {
      hostname: 'localhost',
      port: 5506,
      path: '/api/v1/modules',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const response = await sendRequest(options);
    console.log(`  状态码: ${response.statusCode}`);
    console.log(`  响应:`, response.body);
    
    if (response.statusCode === 200 && response.body) {
      console.log(`  ✅ 获取所有模块状态成功`);
      return true;
    } else {
      console.log(`  ❌ 获取所有模块状态失败`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ 获取所有模块状态时出错: ${error.message}`);
    return false;
  }
}

/**
 * 运行完整测试
 */
async function runFullTest() {
  console.log('🚀 开始模块API功能测试...\n');
  
  const moduleIds = {};
  const testResults = {};
  
  // 测试创建所有类型的模块
  for (const [moduleName, config] of Object.entries(testConfigs)) {
    const moduleId = await testCreateModule(config);
    if (moduleId) {
      moduleIds[moduleName] = moduleId;
      testResults[`${moduleName}_create`] = true;
    } else {
      testResults[`${moduleName}_create`] = false;
    }
  }
  
  // 测试启动所有模块
  for (const [moduleName, moduleId] of Object.entries(moduleIds)) {
    if (moduleId) {
      const result = await testStartModule(moduleId);
      testResults[`${moduleName}_start`] = result;
    }
  }
  
  // 测试配置所有模块
  for (const [moduleName, moduleId] of Object.entries(moduleIds)) {
    if (moduleId) {
      const result = await testConfigureModule(moduleId, testConfigs[moduleName].config);
      testResults[`${moduleName}_configure`] = result;
    }
  }
  
  // 测试获取所有模块状态
  await testGetAllModulesStatus();
  
  // 测试获取单个模块状态
  for (const [moduleName, moduleId] of Object.entries(moduleIds)) {
    if (moduleId) {
      const result = await testGetModuleStatus(moduleId);
      testResults[`${moduleName}_status`] = result;
    }
  }
  
  // 测试处理请求（仅对部分模块）
  const processTestModules = ['transformer', 'protocol'];
  for (const moduleName of processTestModules) {
    const moduleId = moduleIds[moduleName];
    if (moduleId) {
      // 简单的测试输入
      const testInput = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }]
      };
      
      const result = await testProcessModule(moduleId, testInput);
      testResults[`${moduleName}_process`] = result;
    }
  }
  
  // 测试停止所有模块
  for (const [moduleName, moduleId] of Object.entries(moduleIds)) {
    if (moduleId) {
      const result = await testStopModule(moduleId);
      testResults[`${moduleName}_stop`] = result;
    }
  }
  
  // 测试销毁所有模块
  for (const [moduleName, moduleId] of Object.entries(moduleIds)) {
    if (moduleId) {
      const result = await testDestroyModule(moduleId);
      testResults[`${moduleName}_destroy`] = result;
    }
  }
  
  // 输出测试结果摘要
  console.log('\n📋 测试结果摘要:');
  console.log('==================');
  
  let passedTests = 0;
  let totalTests = 0;
  
  for (const [testName, result] of Object.entries(testResults)) {
    totalTests++;
    if (result) {
      passedTests++;
      console.log(`✅ ${testName}`);
    } else {
      console.log(`❌ ${testName}`);
    }
  }
  
  console.log('\n📊 最终结果:');
  console.log(`  通过: ${passedTests}/${totalTests}`);
  console.log(`  通过率: ${(passedTests/totalTests*100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 所有测试通过！');
  } else {
    console.log('\n⚠️  部分测试失败，请检查日志。');
  }
}

// 运行测试
runFullTest().catch(error => {
  console.error('测试过程中发生错误:', error);
});