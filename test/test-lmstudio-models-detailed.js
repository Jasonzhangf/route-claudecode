/**
 * Test LMStudio models endpoint with detailed analysis
 * 测试LMStudio的models端点并获取详细信息
 */

const http = require('http');

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = http;
    
    const headers = {
      'User-Agent': 'claude-code-router-discovery/2.0.0',
      'Accept': 'application/json,*/*',
      ...options.headers
    };

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
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

async function testLMStudioModelsDetailed() {
  console.log('🔍 Testing LMStudio /v1/models Endpoint (Detailed)');
  console.log('===================================================\n');
  
  try {
    const response = await makeRequest('http://localhost:1234/v1/models');
    
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Content-Length: ${response.data.length} bytes\n`);
    
    if (response.status === 200) {
      try {
        const json = JSON.parse(response.data);
        
        console.log('📋 Full Response Structure:');
        console.log(JSON.stringify(json, null, 2));
        console.log('');
        
        if (json.data && Array.isArray(json.data)) {
          console.log(`✅ Found ${json.data.length} models in 'data' array`);
          
          console.log('\n🔍 Detailed Model Information:');
          json.data.forEach((model, index) => {
            console.log(`\nModel ${index + 1}:`);
            console.log(`  ID: ${model.id || 'N/A'}`);
            console.log(`  Name: ${model.name || 'N/A'}`);
            console.log(`  Created: ${model.created || 'N/A'}`);
            console.log(`  Owned By: ${model.owned_by || 'N/A'}`);
            console.log(`  Object: ${model.object || 'N/A'}`);
            
            if (model.permission) {
              console.log(`  Permission: ${JSON.stringify(model.permission, null, 2)}`);
            }
            
            if (model.root) {
              console.log(`  Root: ${model.root}`);
            }
            
            if (model.parent) {
              console.log(`  Parent: ${model.parent}`);
            }
          });
          
          // 分析模型ID模式
          console.log('\n🔍 Model ID Pattern Analysis:');
          const idPatterns = {};
          
          json.data.forEach(model => {
            if (model.id) {
              // 检查模型ID的各种特征
              const hasVersion = /\d/.test(model.id);
              const hasHyphen = /-/.test(model.id);
              const hasSlash = /\//.test(model.id);
              const hasAt = /@/.test(model.id);
              const hasUnderscore = /_/.test(model.id);
              
              const prefix = model.id.split(/[-/@\/_]/)[0];
              
              if (!idPatterns[prefix]) {
                idPatterns[prefix] = {
                  count: 0,
                  versions: new Set(),
                  hasVersion,
                  hasHyphen,
                  hasSlash,
                  hasAt,
                  hasUnderscore
                };
              }
              
              idPatterns[prefix].count++;
              
              // 提取版本信息
              const versionMatch = model.id.match(/\d+/);
              if (versionMatch) {
                idPatterns[prefix].versions.add(versionMatch[0]);
              }
            }
          });
          
          Object.entries(idPatterns).forEach(([prefix, info]) => {
            console.log(`  ${prefix}:`);
            console.log(`    Count: ${info.count}`);
            console.log(`    Versions: ${Array.from(info.versions).join(', ') || 'N/A'}`);
            console.log(`    Pattern: ${info.hasVersion ? 'Has version numbers' : 'No version'}`);
            console.log(`    Separators: ${[
              info.hasHyphen && 'hyphen', 
              info.hasSlash && 'slash', 
              info.hasAt && 'at', 
              info.hasUnderscore && 'underscore'
            ].filter(Boolean).join(', ') || 'None'}`);
          });
          
        } else if (json.models && Array.isArray(json.models)) {
          console.log(`✅ Found ${json.models.length} models in 'models' array`);
          
          console.log('\n🔍 Detailed Model Information:');
          json.models.forEach((model, index) => {
            console.log(`\nModel ${index + 1}:`);
            console.log(JSON.stringify(model, null, 2));
          });
        } else {
          console.log('❌ No model arrays found in response');
          console.log('Available keys:', Object.keys(json));
        }
        
      } catch (parseError) {
        console.log(`❌ JSON Parse Error: ${parseError.message}`);
        console.log('Raw response:', response.data);
      }
    } else {
      console.log(`❌ Request failed with status: ${response.status}`);
      if (response.data.length > 0) {
        console.log('Error response:', response.data);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error testing LMStudio: ${error.message}`);
    console.log('💡 Make sure LMStudio is running on localhost:1234');
  }
}

// 运行主函数
if (require.main === module) {
  testLMStudioModelsDetailed().catch(console.error);
}