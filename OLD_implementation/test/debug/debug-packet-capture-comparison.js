#!/usr/bin/env node

/**
 * 底层抓包对比系统 - Demo2 vs Router HTTP请求差异分析
 * 项目所有者: Jason Zhang
 * 
 * 目标:
 * 1. 捕获demo2发送到CodeWhisperer API的原始HTTP请求
 * 2. 捕获router发送的HTTP请求和400错误响应
 * 3. 逐字节对比分析差异
 * 4. 生成修复建议
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { spawn, execSync } = require('child_process');

// 配置常量
const CONFIG = {
  DEMO2_PATH: '/Users/fanzhang/Library/Application Support/Kiro/User/globalStorage/kiro.kiroagent/c8a1031074c0308699739f156aa70303/74a08cf8613c7dec4db7b264470db812/a5e967c0/examples/demo2',
  ROUTER_URL: 'http://localhost:3458',
  DEMO2_URL: 'http://localhost:8080',
  CODEWHISPERER_ENDPOINT: 'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse',
  OUTPUT_DIR: '/tmp/packet-capture-comparison',
  DEBUG_DATA_DIR: '~/.route-claude-code/database/debug-captures'
};

// 测试用例数据
const TEST_CASES = {
  simple_text: {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: "Hello, how are you?"
      }
    ],
    stream: false
  },
  
  background_model: {
    model: "claude-3-5-haiku-20241022", // 这个应该路由到background类别
    max_tokens: 1000,
    messages: [
      {
        role: "user", 
        content: "Quick question about JavaScript"
      }
    ],
    stream: false
  },

  with_tools: {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: "Please create a todo list for project tasks"
      }
    ],
    tools: [
      {
        name: "TodoWrite",
        description: "Create and manage todo items",
        input_schema: {
          type: "object",
          properties: {
            todos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  content: { type: "string" },
                  status: { type: "string", enum: ["pending", "completed"] },
                  priority: { type: "string", enum: ["high", "medium", "low"] }
                },
                required: ["content", "status", "priority"]
              }
            }
          },
          required: ["todos"]
        }
      }
    ],
    stream: false
  }
};

class PacketCaptureComparison {
  constructor() {
    this.outputDir = CONFIG.OUTPUT_DIR;
    this.results = {
      demo2: {},
      router: {},
      comparison: {},
      timestamp: new Date().toISOString()
    };
    
    this.setupOutputDirectory();
  }

  setupOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    // 创建调试数据目录
    const debugDataDir = CONFIG.DEBUG_DATA_DIR.replace('~', os.homedir());
    if (!fs.existsSync(debugDataDir)) {
      fs.mkdirSync(debugDataDir, { recursive: true });
    }
    
    console.log('✅ 输出目录已准备:', this.outputDir);
  }

  /**
   * 启动Demo2服务器并等待就绪
   */
  async startDemo2Server() {
    console.log('\n🚀 启动Demo2服务器...');
    
    return new Promise((resolve, reject) => {
      const demo2Process = spawn('./demo2', ['server', '8080'], {
        cwd: CONFIG.DEMO2_PATH,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let isReady = false;

      demo2Process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log('Demo2:', text.trim());
        
        if (text.includes('启动Anthropic API代理服务器') || text.includes('监听端口: 8080')) {
          if (!isReady) {
            isReady = true;
            console.log('✅ Demo2服务器已启动');
            resolve(demo2Process);
          }
        }
      });

      demo2Process.stderr.on('data', (data) => {
        console.error('Demo2 Error:', data.toString());
      });

      demo2Process.on('error', (error) => {
        console.error('Demo2启动失败:', error);
        reject(error);
      });

      // 10秒超时
      setTimeout(() => {
        if (!isReady) {
          demo2Process.kill();
          reject(new Error('Demo2服务器启动超时'));
        }
      }, 10000);
    });
  }

  /**
   * 检查Router服务器状态
   */
  async checkRouterServer() {
    console.log('\n🔍 检查Router服务器状态...');
    
    try {
      const response = await axios.get(`${CONFIG.ROUTER_URL}/health`, {
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log('✅ Router服务器运行正常');
        return true;
      }
    } catch (error) {
      console.log('❌ Router服务器未运行，请先启动: ./rcc start');
      return false;
    }
  }

  /**
   * 捕获Demo2的HTTP请求
   */
  async captureDemo2Request(testName, testData) {
    console.log(`\n📡 捕获Demo2请求: ${testName}`);
    
    const captureData = {
      testName,
      timestamp: new Date().toISOString(),
      request: null,
      response: null,
      error: null
    };

    try {
      // 使用axios拦截器捕获请求详情
      const axiosInstance = axios.create();
      
      // 请求拦截器
      axiosInstance.interceptors.request.use(request => {
        captureData.request = {
          url: request.url,
          method: request.method,
          headers: request.headers,
          data: request.data,
          timeout: request.timeout
        };
        
        console.log('🔍 Demo2请求详情:');
        console.log('URL:', request.url);
        console.log('Method:', request.method);
        console.log('Headers:', JSON.stringify(request.headers, null, 2));
        console.log('Body:', typeof request.data === 'string' ? request.data : JSON.stringify(request.data, null, 2));
        
        return request;
      });

      // 响应拦截器
      axiosInstance.interceptors.response.use(
        response => {
          captureData.response = {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
          };
          
          console.log('✅ Demo2响应:', response.status, response.statusText);
          return response;
        },
        error => {
          captureData.error = {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
            headers: error.response?.headers,
            data: error.response?.data
          };
          
          console.log('❌ Demo2错误:', error.response?.status, error.message);
          return Promise.reject(error);
        }
      );

      // 发送请求到Demo2
      const response = await axiosInstance.post(`${CONFIG.DEMO2_URL}/v1/messages`, testData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      console.log('✅ Demo2请求成功完成');
      
    } catch (error) {
      console.log('⚠️  Demo2请求失败（这是预期的，我们主要需要捕获请求数据）');
    }

    // 保存捕获数据
    const outputFile = path.join(this.outputDir, `demo2-${testName}-capture.json`);
    fs.writeFileSync(outputFile, JSON.stringify(captureData, null, 2));
    
    this.results.demo2[testName] = captureData;
    console.log('💾 Demo2捕获数据已保存:', outputFile);
    
    return captureData;
  }

  /**
   * 捕获Router的HTTP请求
   */
  async captureRouterRequest(testName, testData) {
    console.log(`\n📡 捕获Router请求: ${testName}`);
    
    const captureData = {
      testName,
      timestamp: new Date().toISOString(),
      request: null,
      response: null,
      error: null,
      routing: null
    };

    try {
      // 使用axios拦截器捕获请求详情
      const axiosInstance = axios.create();
      
      // 请求拦截器
      axiosInstance.interceptors.request.use(request => {
        captureData.request = {
          url: request.url,
          method: request.method,
          headers: request.headers,
          data: request.data,
          timeout: request.timeout
        };
        
        console.log('🔍 Router请求详情:');
        console.log('URL:', request.url);
        console.log('Method:', request.method);
        console.log('Headers:', JSON.stringify(request.headers, null, 2));
        console.log('Body:', typeof request.data === 'string' ? request.data : JSON.stringify(request.data, null, 2));
        
        return request;
      });

      // 响应拦截器
      axiosInstance.interceptors.response.use(
        response => {
          captureData.response = {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
          };
          
          console.log('✅ Router响应:', response.status, response.statusText);
          return response;
        },
        error => {
          captureData.error = {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
            headers: error.response?.headers,
            data: error.response?.data
          };
          
          console.log('❌ Router错误:', error.response?.status, error.message);
          if (error.response?.data) {
            console.log('错误响应数据:', error.response.data);
          }
          return Promise.reject(error);
        }
      );

      // 发送请求到Router
      const response = await axiosInstance.post(`${CONFIG.ROUTER_URL}/v1/messages`, testData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      console.log('✅ Router请求成功完成');
      
    } catch (error) {
      console.log('⚠️  Router请求失败，错误详情已捕获');
    }

    // 保存捕获数据
    const outputFile = path.join(this.outputDir, `router-${testName}-capture.json`);
    fs.writeFileSync(outputFile, JSON.stringify(captureData, null, 2));
    
    this.results.router[testName] = captureData;
    console.log('💾 Router捕获数据已保存:', outputFile);
    
    return captureData;
  }

  /**
   * 逐字节对比两个请求
   */
  compareRequests(testName, demo2Data, routerData) {
    console.log(`\n🔍 对比分析: ${testName}`);
    
    const comparison = {
      testName,
      timestamp: new Date().toISOString(),
      differences: [],
      summary: {},
      verdict: 'unknown'
    };

    // 对比请求URL
    if (demo2Data.request?.url !== routerData.request?.url) {
      comparison.differences.push({
        type: 'url',
        demo2: demo2Data.request?.url,
        router: routerData.request?.url,
        impact: 'critical'
      });
    }

    // 对比请求方法
    if (demo2Data.request?.method !== routerData.request?.method) {
      comparison.differences.push({
        type: 'method',
        demo2: demo2Data.request?.method,
        router: routerData.request?.method,
        impact: 'critical'
      });
    }

    // 对比请求头
    const demo2Headers = demo2Data.request?.headers || {};
    const routerHeaders = routerData.request?.headers || {};
    
    const allHeaderKeys = new Set([...Object.keys(demo2Headers), ...Object.keys(routerHeaders)]);
    
    for (const headerKey of allHeaderKeys) {
      const demo2Value = demo2Headers[headerKey];
      const routerValue = routerHeaders[headerKey];
      
      if (demo2Value !== routerValue) {
        comparison.differences.push({
          type: 'header',
          key: headerKey,
          demo2: demo2Value,
          router: routerValue,
          impact: headerKey.toLowerCase().includes('authorization') ? 'critical' : 'minor'
        });
      }
    }

    // 对比请求体
    const demo2Body = demo2Data.request?.data;
    const routerBody = routerData.request?.data;
    
    if (JSON.stringify(demo2Body) !== JSON.stringify(routerBody)) {
      comparison.differences.push({
        type: 'body',
        demo2: demo2Body,
        router: routerBody,
        impact: 'critical'
      });
      
      // 详细对比请求体内容
      if (typeof demo2Body === 'object' && typeof routerBody === 'object') {
        this.compareObjectsDeep('body', demo2Body, routerBody, comparison.differences);
      }
    }

    // 对比响应状态
    const demo2Status = demo2Data.response?.status || demo2Data.error?.status;
    const routerStatus = routerData.response?.status || routerData.error?.status;
    
    if (demo2Status !== routerStatus) {
      comparison.differences.push({
        type: 'response_status',
        demo2: demo2Status,
        router: routerStatus,
        impact: 'critical'
      });
    }

    // 生成总结
    comparison.summary = {
      totalDifferences: comparison.differences.length,
      criticalDifferences: comparison.differences.filter(d => d.impact === 'critical').length,
      demo2Success: !demo2Data.error,
      routerSuccess: !routerData.error,
      demo2Status: demo2Status,
      routerStatus: routerStatus
    };

    // 判断结果
    if (comparison.summary.criticalDifferences === 0 && comparison.summary.demo2Success && comparison.summary.routerSuccess) {
      comparison.verdict = 'identical';
    } else if (comparison.summary.criticalDifferences > 0) {
      comparison.verdict = 'critical_differences';
    } else {
      comparison.verdict = 'minor_differences';
    }

    // 保存对比结果
    const outputFile = path.join(this.outputDir, `comparison-${testName}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(comparison, null, 2));
    
    this.results.comparison[testName] = comparison;
    console.log('💾 对比结果已保存:', outputFile);
    
    // 打印关键差异
    console.log('\n📊 对比结果摘要:');
    console.log(`差异总数: ${comparison.summary.totalDifferences}`);
    console.log(`关键差异: ${comparison.summary.criticalDifferences}`);
    console.log(`Demo2状态: ${demo2Status}`);
    console.log(`Router状态: ${routerStatus}`);
    console.log(`判断结果: ${comparison.verdict}`);
    
    if (comparison.differences.length > 0) {
      console.log('\n🚨 发现的差异:');
      comparison.differences.forEach((diff, index) => {
        console.log(`${index + 1}. [${diff.impact.toUpperCase()}] ${diff.type}:`);
        console.log(`   Demo2: ${JSON.stringify(diff.demo2)}`);
        console.log(`   Router: ${JSON.stringify(diff.router)}`);
      });
    }
    
    return comparison;
  }

  /**
   * 深度对比对象差异
   */
  compareObjectsDeep(parentKey, obj1, obj2, differences) {
    const keys1 = Object.keys(obj1 || {});
    const keys2 = Object.keys(obj2 || {});
    const allKeys = new Set([...keys1, ...keys2]);
    
    for (const key of allKeys) {
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];
      const fullKey = `${parentKey}.${key}`;
      
      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        differences.push({
          type: 'body_field',
          key: fullKey,
          demo2: val1,
          router: val2,
          impact: 'critical'
        });
      }
    }
  }

  /**
   * 生成修复建议
   */
  generateFixSuggestions() {
    console.log('\n🔧 生成修复建议...');
    
    const suggestions = {
      modelMapping: [],
      requestFormat: [],
      authentication: [],
      general: [],
      timestamp: new Date().toISOString()
    };

    // 分析所有对比结果
    for (const [testName, comparison] of Object.entries(this.results.comparison)) {
      for (const diff of comparison.differences) {
        switch (diff.type) {
          case 'body_field':
            if (diff.key.includes('modelId')) {
              suggestions.modelMapping.push({
                test: testName,
                issue: `模型映射错误: ${diff.demo2} vs ${diff.router}`,
                suggestion: '检查MODEL_MAP配置，确保模型名称映射正确'
              });
            } else if (diff.key.includes('userInputMessageContext')) {
              suggestions.requestFormat.push({
                test: testName,
                issue: `userInputMessageContext格式差异`,
                suggestion: '对比demo2的完全忽略工具策略，确保userInputMessageContext为空对象{}'
              });
            }
            break;
            
          case 'header':
            if (diff.key.toLowerCase().includes('authorization')) {
              suggestions.authentication.push({
                test: testName,
                issue: `认证头差异: ${diff.demo2} vs ${diff.router}`,
                suggestion: '检查token获取和格式化逻辑'
              });
            }
            break;
            
          case 'response_status':
            if (diff.router === 400) {
              suggestions.requestFormat.push({
                test: testName,
                issue: `400错误 - 请求格式问题`,
                suggestion: '对比demo2请求体格式，特别注意userInputMessageContext字段'
              });
            }
            break;
        }
      }
    }

    // 保存修复建议
    const outputFile = path.join(this.outputDir, 'fix-suggestions.json');
    fs.writeFileSync(outputFile, JSON.stringify(suggestions, null, 2));
    
    console.log('💾 修复建议已保存:', outputFile);
    
    // 打印修复建议
    console.log('\n📋 修复建议摘要:');
    
    if (suggestions.modelMapping.length > 0) {
      console.log('\n🎯 模型映射问题:');
      suggestions.modelMapping.forEach((s, i) => {
        console.log(`${i + 1}. [${s.test}] ${s.issue}`);
        console.log(`   建议: ${s.suggestion}`);
      });
    }
    
    if (suggestions.requestFormat.length > 0) {
      console.log('\n📝 请求格式问题:');
      suggestions.requestFormat.forEach((s, i) => {
        console.log(`${i + 1}. [${s.test}] ${s.issue}`);
        console.log(`   建议: ${s.suggestion}`);
      });
    }
    
    if (suggestions.authentication.length > 0) {
      console.log('\n🔐 认证问题:');
      suggestions.authentication.forEach((s, i) => {
        console.log(`${i + 1}. [${s.test}] ${s.issue}`);
        console.log(`   建议: ${s.suggestion}`);
      });
    }
    
    return suggestions;
  }

  /**
   * 生成完整的分析报告
   */
  generateReport() {
    console.log('\n📄 生成分析报告...');
    
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        testCases: Object.keys(TEST_CASES).length,
        completedTests: Object.keys(this.results.comparison).length
      },
      executive_summary: {
        totalDifferences: 0,
        criticalDifferences: 0,
        successfulTests: 0,
        failedTests: 0
      },
      detailed_analysis: this.results.comparison,
      raw_captures: {
        demo2: this.results.demo2,
        router: this.results.router
      },
      fix_suggestions: this.generateFixSuggestions()
    };

    // 计算执行摘要
    for (const comparison of Object.values(this.results.comparison)) {
      report.executive_summary.totalDifferences += comparison.summary.totalDifferences;
      report.executive_summary.criticalDifferences += comparison.summary.criticalDifferences;
      
      if (comparison.verdict === 'identical') {
        report.executive_summary.successfulTests++;
      } else {
        report.executive_summary.failedTests++;
      }
    }

    // 保存完整报告
    const reportFile = path.join(this.outputDir, 'packet-comparison-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log('💾 完整报告已保存:', reportFile);
    
    // 打印执行摘要
    console.log('\n📊 执行摘要:');
    console.log(`测试用例: ${report.metadata.testCases}`);
    console.log(`完成测试: ${report.metadata.completedTests}`);
    console.log(`成功测试: ${report.executive_summary.successfulTests}`);
    console.log(`失败测试: ${report.executive_summary.failedTests}`);
    console.log(`总差异数: ${report.executive_summary.totalDifferences}`);
    console.log(`关键差异: ${report.executive_summary.criticalDifferences}`);
    
    return report;
  }

  /**
   * 运行完整的抓包对比测试
   */
  async runFullComparison() {
    console.log('🚀 开始完整的抓包对比测试');
    console.log('=====================================');
    
    try {
      // 1. 检查Router服务器
      const routerReady = await this.checkRouterServer();
      if (!routerReady) {
        throw new Error('Router服务器未运行');
      }

      // 2. 启动Demo2服务器
      const demo2Process = await this.startDemo2Server();
      
      // 等待服务器完全启动
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        // 3. 对每个测试用例进行抓包
        for (const [testName, testData] of Object.entries(TEST_CASES)) {
          console.log(`\n🧪 测试用例: ${testName}`);
          console.log('================================');
          
          // 捕获Demo2请求
          const demo2Capture = await this.captureDemo2Request(testName, testData);
          
          // 等待一下再测试Router
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // 捕获Router请求
          const routerCapture = await this.captureRouterRequest(testName, testData);
          
          // 对比分析
          const comparison = this.compareRequests(testName, demo2Capture, routerCapture);
          
          // 等待一下再进行下一个测试
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // 4. 生成最终报告
        const report = this.generateReport();
        
        console.log('\n🎉 抓包对比测试完成！');
        console.log('=====================================');
        console.log(`报告位置: ${this.outputDir}`);
        
        return report;
        
      } finally {
        // 清理Demo2进程
        if (demo2Process && !demo2Process.killed) {
          console.log('\n🧹 清理Demo2进程...');
          demo2Process.kill();
        }
      }
      
    } catch (error) {
      console.error('❌ 抓包对比测试失败:', error);
      throw error;
    }
  }
}

// 主执行函数
async function main() {
  console.log('🔍 底层抓包对比系统');
  console.log('=====================================');
  console.log('目标: 分析Demo2和Router的CodeWhisperer请求差异');
  console.log('');
  
  const capture = new PacketCaptureComparison();
  
  try {
    const report = await capture.runFullComparison();
    
    console.log('\n✅ 测试完成，请查看以下文件:');
    console.log(`📄 完整报告: ${path.join(CONFIG.OUTPUT_DIR, 'packet-comparison-report.json')}`);
    console.log(`🔧 修复建议: ${path.join(CONFIG.OUTPUT_DIR, 'fix-suggestions.json')}`);
    console.log(`📁 原始数据: ${CONFIG.OUTPUT_DIR}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { PacketCaptureComparison, TEST_CASES, CONFIG };