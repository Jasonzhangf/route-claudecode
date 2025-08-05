/**
 * Check provider model endpoints and pricing pages
 * 探索供应商的模型列表接口和定价页面
 */

const https = require('https');
const http = require('http');

// 增强的请求函数
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const headers = {
      'User-Agent': 'claude-code-router-discovery/2.0.0',
      'Accept': 'text/html,application/json,*/*',
      ...options.headers
    };

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: headers,
      timeout: 15000
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

/**
 * 测试ShuaiHong的各种模型列表端点
 */
async function testShuaiHongModelEndpoints() {
  console.log('🔍 Testing ShuaiHong Model Endpoints\n');
  
  const baseUrl = 'https://ai.shuaihong.fun';
  const endpoints = [
    '/models',
    '/v1/models', 
    '/chat/completions/models',
    '/v1/chat/completions/models',
    '/pricing',
    '/v1/pricing'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n📡 Testing: ${baseUrl}${endpoint}`);
      
      const response = await makeRequest(baseUrl + endpoint);
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Content-Type: ${response.headers['content-type'] || 'unknown'}`);
      console.log(`   Content-Length: ${response.data.length} bytes`);
      
      if (response.status === 200) {
        console.log(`   ✅ SUCCESS`);
        
        // 如果是JSON，尝试解析并显示模型列表
        if (response.headers['content-type']?.includes('application/json')) {
          try {
            const json = JSON.parse(response.data);
            console.log(`   🔍 JSON Response Preview:`);
            
            if (json.data && Array.isArray(json.data)) {
              console.log(`   📋 Models found: ${json.data.length}`);
              json.data.slice(0, 5).forEach((model, index) => {
                console.log(`      ${index + 1}. ${model.id || model.name || JSON.stringify(model)}`);
              });
              if (json.data.length > 5) {
                console.log(`      ... and ${json.data.length - 5} more models`);
              }
            } else if (json.models && Array.isArray(json.models)) {
              console.log(`   📋 Models found: ${json.models.length}`);
              json.models.slice(0, 5).forEach((model, index) => {
                console.log(`      ${index + 1}. ${model.id || model.name || JSON.stringify(model)}`);
              });
              if (json.models.length > 5) {
                console.log(`      ... and ${json.models.length - 5} more models`);
              }
            } else {
              console.log(`   🔍 Full JSON Response (first 500 chars):`);
              console.log(`      ${JSON.stringify(json).substring(0, 500)}...`);
            }
          } catch (parseError) {
            console.log(`   ❌ JSON Parse Error: ${parseError.message}`);
          }
        } 
        // 如果是HTML，检查是否包含模型信息
        else if (response.headers['content-type']?.includes('text/html')) {
          console.log(`   🔍 HTML Response Preview (first 300 chars):`);
          const preview = response.data.substring(0, 300);
          console.log(`      ${preview}...`);
          
          // 检查是否包含模型相关关键词
          const modelKeywords = ['model', 'gpt', 'claude', 'gemini', 'qwen', 'glm', 'pricing'];
          const foundKeywords = modelKeywords.filter(keyword => 
            preview.toLowerCase().includes(keyword)
          );
          
          if (foundKeywords.length > 0) {
            console.log(`   🎯 Relevant keywords found: ${foundKeywords.join(', ')}`);
          }
        }
      } else {
        console.log(`   ❌ FAILED - Status: ${response.status}`);
        if (response.data.length > 0) {
          console.log(`   Error preview: ${response.data.substring(0, 200)}...`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
}

/**
 * 测试LMStudio的模型列表端点
 */
async function testLMStudioModelEndpoints() {
  console.log('\n🔍 Testing LMStudio Model Endpoints');
  
  const endpoints = [
    'http://localhost:1234/models',
    'http://localhost:1234/v1/models',
    'http://localhost:1234/chat/completions/models',
    'http://localhost:1234/v1/chat/completions/models'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n📡 Testing: ${endpoint}`);
      
      const response = await makeRequest(endpoint);
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Content-Type: ${response.headers['content-type'] || 'unknown'}`);
      console.log(`   Content-Length: ${response.data.length} bytes`);
      
      if (response.status === 200) {
        console.log(`   ✅ SUCCESS`);
        
        // 如果是JSON，尝试解析并显示模型列表
        if (response.headers['content-type']?.includes('application/json')) {
          try {
            const json = JSON.parse(response.data);
            console.log(`   🔍 JSON Response Preview:`);
            
            if (json.data && Array.isArray(json.data)) {
              console.log(`   📋 Models found: ${json.data.length}`);
              json.data.slice(0, 5).forEach((model, index) => {
                console.log(`      ${index + 1}. ${model.id || model.name || JSON.stringify(model)}`);
              });
              if (json.data.length > 5) {
                console.log(`      ... and ${json.data.length - 5} more models`);
              }
            } else if (json.models && Array.isArray(json.models)) {
              console.log(`   📋 Models found: ${json.models.length}`);
              json.models.slice(0, 5).forEach((model, index) => {
                console.log(`      ${index + 1}. ${model.id || model.name || JSON.stringify(model)}`);
              });
              if (json.models.length > 5) {
                console.log(`      ... and ${json.models.length - 5} more models`);
              }
            } else {
              console.log(`   🔍 Full JSON Response (first 500 chars):`);
              console.log(`      ${JSON.stringify(json).substring(0, 500)}...`);
            }
          } catch (parseError) {
            console.log(`   ❌ JSON Parse Error: ${parseError.message}`);
          }
        }
      } else {
        console.log(`   ❌ FAILED - Status: ${response.status}`);
        if (response.data.length > 0) {
          console.log(`   Error preview: ${response.data.substring(0, 200)}...`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 Provider Model Endpoint Discovery');
  console.log('===================================\n');
  
  try {
    await testShuaiHongModelEndpoints();
    await testLMStudioModelEndpoints();
    
    console.log('\n🎯 Endpoint Discovery Complete');
    console.log('\n📋 Summary:');
    console.log('   - Check which endpoints returned successful responses');
    console.log('   - Look for JSON responses with model arrays');
    console.log('   - Note any HTML pages with model information');
    console.log('   - Use this information to enhance the model discovery script');
    
  } catch (error) {
    console.error('❌ Discovery failed:', error);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Discovery failed:', error);
    process.exit(1);
  });
}
