#!/usr/bin/env node

/**
 * 收集LMStudio工具解析样本数据
 * 目标：获取真实的LMStudio工具调用响应，作为解析器的标准样本
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function collectLMStudioToolParsingSamples() {
  console.log('🔍 收集LMStudio工具解析样本数据...\n');
  
  const samples = [];
  
  const testCases = [
    {
      name: '创建文件工具调用',
      request: {
        model: 'gpt-oss-20b-mlx',
        messages: [{ role: 'user', content: 'Create a file named test.txt with content "Hello World"' }],
        tools: [{
          type: 'function',
          function: {
            name: 'create_file',
            description: 'Create a file with specified content',
            parameters: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                content: { type: 'string' }
              },
              required: ['filename', 'content']
            }
          }
        }],
        stream: false,
        max_tokens: 500
      }
    },
    {
      name: '读取文件工具调用',
      request: {
        model: 'gpt-oss-20b-mlx',
        messages: [{ role: 'user', content: 'Read the contents of config.json file' }],
        tools: [{
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Read the contents of a file',
            parameters: {
              type: 'object',
              properties: {
                filename: { type: 'string' }
              },
              required: ['filename']
            }
          }
        }],
        stream: false,
        max_tokens: 300
      }
    },
    {
      name: '执行命令工具调用',
      request: {
        model: 'gpt-oss-20b-mlx',
        messages: [{ role: 'user', content: 'List all files in the current directory' }],
        tools: [{
          type: 'function',
          function: {
            name: 'bash',
            description: 'Execute a bash command',
            parameters: {
              type: 'object',
              properties: {
                command: { type: 'string' }
              },
              required: ['command']
            }
          }
        }],
        stream: false,
        max_tokens: 200
      }
    }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`=== 样本 ${i + 1}: ${testCase.name} ===`);
    
    try {
      const response = await axios.post('http://localhost:1234/v1/chat/completions', testCase.request, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer lm-studio-local-key'
        },
        timeout: 30000
      });
      
      console.log('✅ 获取响应成功');
      
      const sample = {
        id: `sample_${i + 1}`,
        name: testCase.name,
        request: testCase.request,
        response: response.data,
        timestamp: new Date().toISOString(),
        analysis: {
          hasChoices: !!response.data.choices,
          choicesCount: response.data.choices?.length || 0,
          hasContent: !!response.data.choices?.[0]?.message?.content,
          contentLength: response.data.choices?.[0]?.message?.content?.length || 0,
          finishReason: response.data.choices?.[0]?.finish_reason,
          hasToolCalls: !!response.data.choices?.[0]?.message?.tool_calls
        }
      };
      
      // 分析content中的特殊格式
      const content = response.data.choices?.[0]?.message?.content || '';
      console.log('📝 响应内容分析:');
      console.log('  - 内容长度:', content.length);
      console.log('  - finish_reason:', response.data.choices?.[0]?.finish_reason);
      
      // 检查LMStudio特殊格式
      const lmstudioPattern = /<\\|constrain\\|>json<\\|message\\|>(\\{[^}]*\\})/g;
      const matches = [...content.matchAll(lmstudioPattern)];
      
      if (matches.length > 0) {
        console.log('  - 🎯 发现LMStudio特殊格式:', matches.length, '个匹配');
        sample.analysis.hasLMStudioFormat = true;
        sample.analysis.lmstudioMatches = matches.map(match => match[1]);
        
        matches.forEach((match, index) => {
          console.log(`    匹配${index + 1}:`, match[1]);
        });
      } else {
        console.log('  - ❌ 未发现LMStudio特殊格式');
        sample.analysis.hasLMStudioFormat = false;
      }
      
      // 检查其他可能的工具调用格式
      const otherPatterns = [
        /function_calls?\\s*[:\\[]/gi,
        /tool_calls?\\s*[:\\[]/gi,
        /"name"\\s*:\\s*"[^"]+"/gi,
        /"arguments"\\s*:\\s*\\{/gi
      ];
      
      sample.analysis.otherToolFormats = [];
      otherPatterns.forEach((pattern, index) => {
        const matches = [...content.matchAll(pattern)];
        if (matches.length > 0) {
          console.log(`  - 🔍 其他格式${index + 1}:`, matches.length, '个匹配');
          sample.analysis.otherToolFormats.push({
            pattern: pattern.source,
            matches: matches.map(m => m[0])
          });
        }
      });
      
      samples.push(sample);
      console.log('✅ 样本数据已收集\\n');
      
    } catch (error) {
      console.log('❌ 获取响应失败:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('错误数据:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    // 间隔等待
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 保存样本数据
  const samplesFile = path.join(__dirname, 'lmstudio-tool-parsing-samples.json');
  fs.writeFileSync(samplesFile, JSON.stringify(samples, null, 2));
  console.log(`📁 样本数据已保存到: ${samplesFile}`);
  
  // 生成解析规则分析报告
  console.log('\\n=== 解析规则分析报告 ===');
  
  let totalWithSpecialFormat = 0;
  let totalWithOtherFormats = 0;
  
  samples.forEach(sample => {
    if (sample.analysis.hasLMStudioFormat) {
      totalWithSpecialFormat++;
    }
    if (sample.analysis.otherToolFormats.length > 0) {
      totalWithOtherFormats++;
    }
  });
  
  console.log(`📊 统计结果:`);
  console.log(`  - 总样本数: ${samples.length}`);
  console.log(`  - 包含LMStudio特殊格式: ${totalWithSpecialFormat}/${samples.length}`);
  console.log(`  - 包含其他工具格式: ${totalWithOtherFormats}/${samples.length}`);
  
  if (totalWithSpecialFormat > 0) {
    console.log('\\n🎯 LMStudio特殊格式解析策略:');
    console.log('  - 正则表达式: /<\\\\|constrain\\\\|>json<\\\\|message\\\\|>(\\\\{[^}]*\\\\})/g');
    console.log('  - 提取JSON: 从match[1]获取参数');
    console.log('  - 工具名推断: 基于参数结构推断工具类型');
  }
  
  console.log('\\n📋 建议的解析器改进:');
  console.log('1. 增强LMStudio特殊格式的正则表达式');
  console.log('2. 添加参数结构到工具名的智能映射');
  console.log('3. 提高解析置信度阈值');
  console.log('4. 添加多格式兼容性支持');
  
  return samples;
}

// 运行收集
collectLMStudioToolParsingSamples().then((samples) => {
  console.log(`\\n🏁 样本收集完成，共${samples.length}个样本`);
}).catch(console.error);