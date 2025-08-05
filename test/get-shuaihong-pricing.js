/**
 * Get detailed HTML content from ShuaiHong pricing page
 * 获取ShuaiHong定价页面的详细HTML内容
 */

const https = require('https');

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : require('http');
    
    const headers = {
      'User-Agent': 'claude-code-router-discovery/2.0.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      ...options.headers
    };

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: headers,
      timeout: 20000
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

async function getShuaiHongPricingContent() {
  console.log('🔍 Getting ShuaiHong Pricing Page Content');
  console.log('===============================================\n');
  
  try {
    const response = await makeRequest('https://ai.shuaihong.fun/pricing');
    
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Content-Length: ${response.data.length} bytes\n`);
    
    if (response.status === 200) {
      // 保存完整HTML内容到文件
      const fs = require('fs');
      const path = require('path');
      
      const filename = `shuaihong-pricing-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
      const filepath = path.join(__dirname, filename);
      
      fs.writeFileSync(filepath, response.data, 'utf8');
      console.log(`✅ Full HTML content saved to: ${filepath}\n`);
      
      // 查找模型相关的关键词
      const modelKeywords = [
        'gpt', 'claude', 'gemini', 'qwen', 'glm', 
        'model', 'models', '定价', 'price', 'pricing',
        'token', 'tokens', 'api', 'openai'
      ];
      
      const lowerContent = response.data.toLowerCase();
      const foundKeywords = modelKeywords.filter(keyword => 
        lowerContent.includes(keyword)
      );
      
      console.log('🔍 Model-related keywords found in HTML:');
      foundKeywords.forEach(keyword => {
        console.log(`   - ${keyword}`);
      });
      
      // 查找可能的模型名称模式
      const modelPatterns = [
        /gpt-\w+/g,
        /claude-\w+/g,
        /gemini-\w+/g,
        /qwen[\w-]*/g,
        /glm-\w+/g,
        /\b[a-z]+-\d+[a-z]*\b/g
      ];
      
      console.log('\n🔍 Potential model names found in HTML:');
      const uniqueModels = new Set();
      
      modelPatterns.forEach(pattern => {
        const matches = response.data.match(pattern);
        if (matches) {
          matches.forEach(match => {
            if (match.length > 3 && match.length < 50) {
              uniqueModels.add(match);
            }
          });
        }
      });
      
      Array.from(uniqueModels).slice(0, 20).forEach(model => {
        console.log(`   - ${model}`);
      });
      
      if (uniqueModels.size > 20) {
        console.log(`   ... and ${uniqueModels.size - 20} more potential models`);
      }
      
      // 查找表格内容（通常定价信息在表格中）
      const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
      const tables = response.data.match(tableRegex);
      
      if (tables) {
        console.log(`\n🔍 Found ${tables.length} table(s) in HTML:`);
        tables.forEach((table, index) => {
          const rows = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
          if (rows) {
            console.log(`   Table ${index + 1} has ${rows.length} rows`);
            // 显示前几行内容
            rows.slice(0, 3).forEach((row, rowIndex) => {
              const cleanRow = row.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              if (cleanRow.length > 0 && cleanRow.length < 200) {
                console.log(`      Row ${rowIndex + 1}: ${cleanRow}`);
              }
            });
            if (rows.length > 3) {
              console.log(`      ... and ${rows.length - 3} more rows`);
            }
          }
        });
      }
      
      // 查找列表内容
      const listRegex = /<ul[^>]*>[\s\S]*?<\/ul>/gi;
      const lists = response.data.match(listRegex);
      
      if (lists) {
        console.log(`\n🔍 Found ${lists.length} list(s) in HTML:`);
        lists.forEach((list, index) => {
          const items = list.match(/<li[^>]*>[\s\S]*?<\/li>/gi);
          if (items) {
            console.log(`   List ${index + 1} has ${items.length} items`);
            items.slice(0, 5).forEach((item, itemIndex) => {
              const cleanItem = item.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              if (cleanItem.length > 0 && cleanItem.length < 150) {
                console.log(`      Item ${itemIndex + 1}: ${cleanItem}`);
              }
            });
            if (items.length > 5) {
              console.log(`      ... and ${items.length - 5} more items`);
            }
          }
        });
      }
      
    } else {
      console.log(`❌ Failed to get pricing page: ${response.status}`);
      if (response.data.length > 0) {
        console.log(`Error: ${response.data.substring(0, 500)}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error getting pricing content: ${error.message}`);
  }
}

// 运行主函数
if (require.main === module) {
  getShuaiHongPricingContent().catch(console.error);
}