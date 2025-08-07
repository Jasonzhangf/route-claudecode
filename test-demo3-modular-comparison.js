#!/usr/bin/env node
/**
 * Demo3 与 RouteClaudeCode 模块化对比测试
 * 捕获完整的输入端到服务器请求到返回数据的流水线对比
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');

class Demo3ComparisonTester {
  constructor() {
    this.outputDir = path.join(__dirname, 'debug', 'demo3-comparison-output');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.sessionDir = path.join(this.outputDir, `session-${this.timestamp}`);
    
    // 确保输出目录存在
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
    
    console.log(`🔍 Demo3对比测试会话目录: ${this.sessionDir}`);
  }

  /**
   * 保存数据到文件
   */
  saveData(filename, data, description) {
    const filepath = path.join(this.sessionDir, filename);
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    fs.writeFileSync(filepath, content);
    console.log(`📄 保存${description}: ${filepath}`);
    return filepath;
  }

  /**
   * 执行Demo3测试并捕获数据
   */
  async capturDemo3Data() {
    console.log('\n🎯 步骤1: 捕获Demo3完整流水线数据');
    console.log('==========================================');
    
    const demo3Path = path.join(__dirname, 'examples', 'demo3', 'AIClient-2-API');
    const demo3Port = 3000;
    
    try {
      // 测试Demo3是否运行
      console.log(`🔍 测试Demo3服务器 (端口${demo3Port})...`);
      
      const healthCheck = await axios.get(`http://localhost:${demo3Port}/health`, {
        timeout: 5000
      }).catch(err => null);
      
      if (!healthCheck) {
        console.log(`⚠️  Demo3服务器未运行，尝试启动...`);
        
        // 检查demo3目录是否存在
        if (!fs.existsSync(demo3Path)) {
          throw new Error(`Demo3路径不存在: ${demo3Path}`);
        }
        
        console.log(`📁 切换到Demo3目录: ${demo3Path}`);
        process.chdir(demo3Path);
        
        // 启动Demo3服务器
        console.log(`🚀 启动Demo3服务器 (端口${demo3Port})...`);
        const demo3Server = spawn('node', ['src/api-server.js'], {
          stdio: 'pipe',
          detached: false,
          env: { ...process.env, PORT: demo3Port.toString() }
        });
        
        // 等待服务器启动
        await new Promise((resolve, reject) => {
          let output = '';
          const timeout = setTimeout(() => reject(new Error('Demo3启动超时')), 15000);
          
          demo3Server.stdout.on('data', (data) => {
            output += data.toString();
            console.log(`[Demo3]: ${data.toString().trim()}`);
            if (output.includes('Server running') || output.includes('listening')) {
              clearTimeout(timeout);
              resolve();
            }
          });
          
          demo3Server.stderr.on('data', (data) => {
            console.error(`[Demo3 Error]: ${data.toString().trim()}`);
          });
          
          demo3Server.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
        
        console.log('✅ Demo3服务器启动成功');
      } else {
        console.log('✅ Demo3服务器已运行');
      }
      
      // 测试请求数据
      const testRequests = [
        {
          name: 'simple-text',
          description: '简单文本请求',
          request: {
            model: 'claude-3-sonnet-20240229',
            messages: [
              { role: 'user', content: 'Hello, how are you?' }
            ],
            max_tokens: 1000,
            stream: false
          }
        },
        {
          name: 'with-tools',
          description: '带工具调用的请求',
          request: {
            model: 'claude-3-sonnet-20240229',
            messages: [
              { role: 'user', content: 'What is the weather like in New York?' }
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'get_weather',
                  description: 'Get current weather for a location',
                  parameters: {
                    type: 'object',
                    properties: {
                      location: {
                        type: 'string',
                        description: 'The city name'
                      }
                    },
                    required: ['location']
                  }
                }
              }
            ],
            max_tokens: 1000,
            stream: false
          }
        }
      ];
      
      const demo3Results = {};
      
      for (const testCase of testRequests) {
        console.log(`\n🧪 执行Demo3测试: ${testCase.description}`);
        
        try {
          // 保存请求数据
          this.saveData(`demo3-${testCase.name}-request.json`, testCase.request, `Demo3 ${testCase.description} 请求`);
          
          // 发送请求到Demo3
          const startTime = Date.now();
          const response = await axios.post(`http://localhost:${demo3Port}/v1/chat/completions`, testCase.request, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer demo-token'
            },
            timeout: 30000,
            validateStatus: () => true // 接受所有状态码
          });
          
          const duration = Date.now() - startTime;
          
          const result = {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data,
            duration,
            timestamp: new Date().toISOString()
          };
          
          demo3Results[testCase.name] = result;
          
          // 保存响应数据
          this.saveData(`demo3-${testCase.name}-response.json`, result, `Demo3 ${testCase.description} 响应`);
          
          if (response.status === 200) {
            console.log(`✅ Demo3 ${testCase.description} 成功 (${duration}ms)`);
          } else {
            console.log(`❌ Demo3 ${testCase.description} 失败: ${response.status} - ${JSON.stringify(response.data).substring(0, 200)}`);
          }
          
        } catch (error) {
          console.log(`❌ Demo3 ${testCase.description} 异常: ${error.message}`);
          demo3Results[testCase.name] = {
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }
      
      // 保存Demo3完整结果
      this.saveData('demo3-complete-results.json', demo3Results, 'Demo3 完整测试结果');
      
      return demo3Results;
      
    } catch (error) {
      console.error(`❌ Demo3数据捕获失败: ${error.message}`);
      this.saveData('demo3-error.json', { error: error.message, stack: error.stack }, 'Demo3 错误信息');
      return null;
    }
  }

  /**
   * 捕获我们系统的数据
   */
  async captureOurSystemData() {
    console.log('\n🎯 步骤2: 捕获RouteClaudeCode流水线数据');
    console.log('=============================================');
    
    const ourSystemPort = 5505; // 当前运行的端口
    
    try {
      // 测试我们的系统
      console.log(`🔍 测试RouteClaudeCode服务器 (端口${ourSystemPort})...`);
      
      const healthCheck = await axios.get(`http://localhost:${ourSystemPort}/health`, {
        timeout: 5000
      }).catch(err => null);
      
      if (!healthCheck) {
        console.log(`❌ RouteClaudeCode服务器未运行，请先启动服务`);
        console.log(`💡 提示: ./rcc start 或 node dist/cli.js start config.json`);
        return null;
      }
      
      console.log('✅ RouteClaudeCode服务器已运行');
      
      // 测试相同的请求
      const testRequests = [
        {
          name: 'simple-text',
          description: '简单文本请求',
          request: {
            model: 'claude-3-sonnet-20240229',
            messages: [
              { role: 'user', content: 'Hello, how are you?' }
            ],
            max_tokens: 1000,
            stream: false
          }
        },
        {
          name: 'with-tools',
          description: '带工具调用的请求',
          request: {
            model: 'claude-3-sonnet-20240229',
            messages: [
              { role: 'user', content: 'What is the weather like in New York?' }
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'get_weather',
                  description: 'Get current weather for a location',
                  parameters: {
                    type: 'object',
                    properties: {
                      location: {
                        type: 'string',
                        description: 'The city name'
                      }
                    },
                    required: ['location']
                  }
                }
              }
            ],
            max_tokens: 1000,
            stream: false
          }
        }
      ];
      
      const ourResults = {};
      
      for (const testCase of testRequests) {
        console.log(`\n🧪 执行RouteClaudeCode测试: ${testCase.description}`);
        
        try {
          // 保存请求数据
          this.saveData(`our-${testCase.name}-request.json`, testCase.request, `RouteClaudeCode ${testCase.description} 请求`);
          
          // 发送请求到我们的系统
          const startTime = Date.now();
          const response = await axios.post(`http://localhost:${ourSystemPort}/v1/chat/completions`, testCase.request, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer our-token'
            },
            timeout: 30000,
            validateStatus: () => true // 接受所有状态码
          });
          
          const duration = Date.now() - startTime;
          
          const result = {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data,
            duration,
            timestamp: new Date().toISOString()
          };
          
          ourResults[testCase.name] = result;
          
          // 保存响应数据
          this.saveData(`our-${testCase.name}-response.json`, result, `RouteClaudeCode ${testCase.description} 响应`);
          
          if (response.status === 200) {
            console.log(`✅ RouteClaudeCode ${testCase.description} 成功 (${duration}ms)`);
          } else {
            console.log(`❌ RouteClaudeCode ${testCase.description} 失败: ${response.status} - ${JSON.stringify(response.data).substring(0, 200)}`);
          }
          
        } catch (error) {
          console.log(`❌ RouteClaudeCode ${testCase.description} 异常: ${error.message}`);
          ourResults[testCase.name] = {
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }
      
      // 保存我们系统的完整结果
      this.saveData('our-system-complete-results.json', ourResults, 'RouteClaudeCode 完整测试结果');
      
      return ourResults;
      
    } catch (error) {
      console.error(`❌ RouteClaudeCode数据捕获失败: ${error.message}`);
      this.saveData('our-system-error.json', { error: error.message, stack: error.stack }, 'RouteClaudeCode 错误信息');
      return null;
    }
  }

  /**
   * 对比分析数据差异
   */
  async analyzeDataDifferences(demo3Data, ourData) {
    console.log('\n🎯 步骤3: 流水线数据差异分析');
    console.log('==============================');
    
    if (!demo3Data || !ourData) {
      console.log('❌ 缺少对比数据，跳过差异分析');
      return;
    }
    
    const analysis = {
      timestamp: new Date().toISOString(),
      testCases: {},
      summary: {
        demo3Success: 0,
        ourSuccess: 0,
        totalTests: 0,
        differences: []
      }
    };
    
    const testCases = ['simple-text', 'with-tools'];
    
    for (const testCase of testCases) {
      console.log(`\n📊 分析测试用例: ${testCase}`);
      
      const demo3Result = demo3Data[testCase];
      const ourResult = ourData[testCase];
      
      const caseAnalysis = {
        testCase,
        demo3Status: demo3Result?.status || 'error',
        ourStatus: ourResult?.status || 'error',
        statusMatch: false,
        differences: [],
        recommendations: []
      };
      
      analysis.summary.totalTests++;
      
      if (demo3Result?.status === 200) analysis.summary.demo3Success++;
      if (ourResult?.status === 200) analysis.summary.ourSuccess++;
      
      // 状态码比较
      if (demo3Result?.status !== ourResult?.status) {
        const diff = `状态码差异: Demo3=${demo3Result?.status}, Ours=${ourResult?.status}`;
        caseAnalysis.differences.push(diff);
        analysis.summary.differences.push(`${testCase}: ${diff}`);
        console.log(`⚠️  ${diff}`);
      } else {
        caseAnalysis.statusMatch = true;
        console.log(`✅ 状态码一致: ${demo3Result?.status}`);
      }
      
      // 响应数据结构比较
      if (demo3Result?.data && ourResult?.data) {
        // 比较响应格式
        const demo3Keys = Object.keys(demo3Result.data);
        const ourKeys = Object.keys(ourResult.data);
        
        const missingKeys = demo3Keys.filter(key => !ourKeys.includes(key));
        const extraKeys = ourKeys.filter(key => !demo3Keys.includes(key));
        
        if (missingKeys.length > 0) {
          const diff = `缺少字段: ${missingKeys.join(', ')}`;
          caseAnalysis.differences.push(diff);
          caseAnalysis.recommendations.push(`添加缺少的响应字段: ${missingKeys.join(', ')}`);
          console.log(`⚠️  ${diff}`);
        }
        
        if (extraKeys.length > 0) {
          const diff = `多余字段: ${extraKeys.join(', ')}`;
          caseAnalysis.differences.push(diff);
          console.log(`ℹ️  ${diff}`);
        }
        
        // 特定字段内容比较
        if (demo3Result.data.choices && ourResult.data.choices) {
          const demo3Choice = demo3Result.data.choices[0];
          const ourChoice = ourResult.data.choices[0];
          
          if (demo3Choice?.message?.tool_calls && ourChoice?.message?.tool_calls) {
            console.log('🔧 检测到工具调用，进行详细比较...');
            // 工具调用结构比较
            const demo3Tools = demo3Choice.message.tool_calls;
            const ourTools = ourChoice.message.tool_calls;
            
            if (demo3Tools.length !== ourTools.length) {
              const diff = `工具调用数量差异: Demo3=${demo3Tools.length}, Ours=${ourTools.length}`;
              caseAnalysis.differences.push(diff);
              console.log(`⚠️  ${diff}`);
            }
          }
        }
      }
      
      // 错误详情比较
      if (demo3Result?.error || ourResult?.error) {
        if (demo3Result?.error) {
          caseAnalysis.differences.push(`Demo3错误: ${demo3Result.error}`);
        }
        if (ourResult?.error) {
          caseAnalysis.differences.push(`Our系统错误: ${ourResult.error}`);
        }
      }
      
      analysis.testCases[testCase] = caseAnalysis;
    }
    
    // 保存分析结果
    this.saveData('pipeline-comparison-analysis.json', analysis, '流水线对比分析结果');
    
    // 生成修复建议
    this.generateFixRecommendations(analysis);
    
    return analysis;
  }

  /**
   * 生成修复建议
   */
  generateFixRecommendations(analysis) {
    console.log('\n🎯 步骤4: 生成修复建议');
    console.log('======================');
    
    const recommendations = {
      timestamp: new Date().toISOString(),
      summary: analysis.summary,
      priorities: [],
      codeChanges: [],
      testingRequired: []
    };
    
    // 分析失败模式
    if (analysis.summary.demo3Success > analysis.summary.ourSuccess) {
      recommendations.priorities.push({
        level: 'HIGH',
        issue: '我们系统成功率低于Demo3',
        action: '需要立即修复导致失败的根本原因'
      });
    }
    
    // 分析具体差异
    for (const [testCase, caseAnalysis] of Object.entries(analysis.testCases)) {
      if (!caseAnalysis.statusMatch) {
        if (caseAnalysis.demo3Status === 200 && caseAnalysis.ourStatus === 400) {
          recommendations.priorities.push({
            level: 'CRITICAL',
            issue: `${testCase}: 我们系统返回400错误，Demo3正常`,
            action: '检查请求格式差异，修复400错误根因'
          });
          
          recommendations.codeChanges.push({
            area: 'request-formatting',
            description: `修复${testCase}的请求格式以匹配Demo3标准`,
            files: ['src/providers/codewhisperer/converter.ts', 'src/transformers/anthropic.ts']
          });
        }
      }
      
      if (caseAnalysis.differences.length > 0) {
        recommendations.testingRequired.push({
          testCase,
          focus: caseAnalysis.differences,
          recommendations: caseAnalysis.recommendations
        });
      }
    }
    
    // 保存建议
    this.saveData('fix-recommendations.json', recommendations, '修复建议');
    
    // 输出关键建议
    console.log('\n📋 关键修复建议:');
    recommendations.priorities.forEach((priority, index) => {
      console.log(`${index + 1}. [${priority.level}] ${priority.issue}`);
      console.log(`   👉 ${priority.action}`);
    });
    
    console.log('\n🔧 需要修改的代码区域:');
    recommendations.codeChanges.forEach((change, index) => {
      console.log(`${index + 1}. ${change.area}: ${change.description}`);
      console.log(`   📁 相关文件: ${change.files.join(', ')}`);
    });
    
    return recommendations;
  }

  /**
   * 运行完整的对比测试
   */
  async runCompleteComparison() {
    console.log('🚀 启动Demo3与RouteClaudeCode模块化对比测试');
    console.log('================================================\n');
    
    try {
      // 捕获Demo3数据
      const demo3Data = await this.capturDemo3Data();
      
      // 捕获我们系统的数据
      const ourData = await this.captureOurSystemData();
      
      // 分析差异
      const analysis = await this.analyzeDataDifferences(demo3Data, ourData);
      
      console.log(`\n🎉 对比测试完成！`);
      console.log(`📂 输出目录: ${this.sessionDir}`);
      console.log(`📊 测试结果: Demo3成功率=${analysis?.summary.demo3Success || 0}/${analysis?.summary.totalTests || 0}, 我们系统=${analysis?.summary.ourSuccess || 0}/${analysis?.summary.totalTests || 0}`);
      
      return {
        demo3Data,
        ourData,
        analysis,
        outputDir: this.sessionDir
      };
      
    } catch (error) {
      console.error(`❌ 对比测试失败: ${error.message}`);
      this.saveData('comparison-error.json', { error: error.message, stack: error.stack }, '对比测试错误');
      throw error;
    }
  }
}

// 运行对比测试
if (require.main === module) {
  const tester = new Demo3ComparisonTester();
  tester.runCompleteComparison().catch(console.error);
}

module.exports = { Demo3ComparisonTester };