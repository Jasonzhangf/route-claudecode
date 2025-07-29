#!/usr/bin/env node

/**
 * 基于生产日志真实longcontext失败案例的测试
 * 从ccr-session-2025-07-28T10-49-14.log中提取的实际失败数据
 */

const axios = require('axios');
const fs = require('fs');

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// 根据生产日志构建真实大小的longcontext请求
// 原始日志显示Content-Length: 113246字节
function createRealSizeLongcontextRequest() {
  // 基础内容模板
  const baseContent = `<system-reminder>
As you answer the user's questions, you can use the following context:
# claudeMd
Codebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written.

Contents of /Users/fanzhang/.claude/CLAUDE.md (user's private global instructions for all projects):

- 请以后运行终端命令时使用&，让命令可以后台无阻塞执行

# 虚拟环境管理规则
- 虚拟环境路径统一为项目根目录下的 ./venv
- 运行任何命令前，必须先激活虚拟环境：source ./venv/bin/activate
- 创建虚拟环境的命令：python3 -m venv ./venv
- 在虚拟环境中运行所有开发、测试和部署命令
- 每次运行npm, yarn, pip等包管理命令前，确保虚拟环境已激活

# Claude Code Router Enhanced 统一脚本规范
## 服务端口配置  
- **Claude Code Router**: 3456 (主要API端点)
- **日志监控**: /tmp/ccr-dev.log
## 项目启动规范
- **统一使用**: ./fix-and-test.sh 进行开发调试
- **服务监控**: tail -f /tmp/ccr-dev.log
- **状态检查**: node dist/cli.js status

你检查一下最新的日志我刚才试了一下还是还是这个错误

`;

  // 重复基础内容直到达到目标大小（约113KB）
  let fullContent = baseContent;
  const targetSize = 110000; // 目标110KB，留一些JSON结构的空间
  
  while (fullContent.length < targetSize) {
    fullContent += baseContent;
  }
  
  // 截断到精确大小
  fullContent = fullContent.substring(0, targetSize);
  fullContent += `
</system-reminder>`;

  return {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: fullContent
      }
    ]
  };
}

// 创建真实大小的longcontext请求
const realProductionLongcontextRequest = createRealSizeLongcontextRequest();

async function testProductionLongcontextFailure() {
  console.log('🔧 生产环境真实longcontext失败案例测试');
  console.log('==========================================');
  
  const requestSize = JSON.stringify(realProductionLongcontextRequest).length;
  console.log(`📊 实际请求大小: ${requestSize} 字符 (与生产日志的113,246字节接近)`);
  console.log(`📊 预期: 应该路由到longcontext类别 (>60K tokens)`);
  console.log(`📊 生产日志显示: 原始请求被路由到CodeWhisperer (400错误)`);
  console.log('');

  let startTime;
  try {
    startTime = Date.now();
    console.log('🚀 发送生产环境真实longcontext请求...');
    
    const response = await axios.post(`${BASE_URL}/v1/messages`, realProductionLongcontextRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 180000 // 3分钟超时
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ 生产longcontext请求成功 - 耗时${duration}ms`);
    console.log('📊 响应详情:', {
      id: response.data.id,
      model: response.data.model,
      role: response.data.role,
      contentLength: JSON.stringify(response.data.content).length,
      statusCode: response.status
    });
    
    // 分析路由结果
    if (response.data.model === 'gemini-2.5-pro') {
      console.log('✅ 路由正确: 成功路由到longcontext类别 → shuaihong-openai → gemini-2.5-pro');
    } else if (response.data.model === 'qwen3-coder') {
      console.log('⚠️  路由到default类别: shuaihong-openai → qwen3-coder (未达到longcontext阈值)');
    } else if (response.data.model.includes('CLAUDE_SONNET_4')) {
      console.log('❌ 路由错误: 路由到CodeWhisperer，这会导致生产环境的400错误');
    } else {
      console.log(`🔍 未知路由: ${response.data.model}`);
    }
    
    // 保存成功结果用于分析
    const successResult = {
      timestamp: new Date().toISOString(),
      test: 'production-longcontext-success',
      status: 'success',
      duration: duration,
      request: {
        model: realProductionLongcontextRequest.model,
        contentLength: requestSize,
        expectedCategory: 'longcontext'
      },
      response: {
        id: response.data.id,
        model: response.data.model,
        role: response.data.role,
        contentLength: JSON.stringify(response.data.content).length
      },
      routing: {
        expectedProvider: 'shuaihong-openai',
        expectedModel: 'gemini-2.5-pro',
        actualProvider: response.data.model === 'gemini-2.5-pro' ? 'shuaihong-openai' : 
                       response.data.model === 'qwen3-coder' ? 'shuaihong-openai' : 'unknown',
        actualCategory: response.data.model === 'gemini-2.5-pro' ? 'longcontext' :
                       response.data.model === 'qwen3-coder' ? 'default' : 'unknown'
      }
    };
    
    const logFile = `/tmp/production-longcontext-success-${Date.now()}.log`;
    fs.writeFileSync(logFile, JSON.stringify(successResult, null, 2));
    console.log(`📄 成功结果保存到: ${logFile}`);
    
    return true;
    
  } catch (error) {
    const endTime = Date.now();
    const duration = startTime ? endTime - startTime : 0;
    
    console.error(`❌ 生产longcontext请求失败 - 耗时${duration}ms`);
    console.error('错误详情:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // 分析失败原因
    if (error.response?.status === 400) {
      console.log('');
      console.log('🔍 问题诊断: 400错误 - 与生产日志一致');
      console.log('   - 可能是被路由到了CodeWhisperer provider');
      console.log('   - CodeWhisperer对某些请求格式返回400错误');
      console.log('   - 需要检查路由逻辑是否正确识别为longcontext');
    }
    
    // 保存错误结果用于分析
    const errorResult = {
      timestamp: new Date().toISOString(),
      test: 'production-longcontext-failure',
      status: 'failed',
      duration: duration,
      error: {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      },
      request: {
        model: realProductionLongcontextRequest.model,
        contentLength: requestSize,
        expectedCategory: 'longcontext'
      },
      analysis: {
        matchesProductionLog: error.response?.status === 400,
        suspectedCause: error.response?.status === 400 ? 'Routed to CodeWhisperer instead of shuaihong' : 'Unknown'
      }
    };
    
    const logFile = `/tmp/production-longcontext-failure-${Date.now()}.log`;
    fs.writeFileSync(logFile, JSON.stringify(errorResult, null, 2));
    console.log(`📄 错误结果保存到: ${logFile}`);
    
    return false;
  }
}

async function checkRoutingConfig() {
  console.log('🔍 检查当前路由配置...');
  try {
    const response = await axios.get(`${BASE_URL}/status`);
    const routingConfig = response.data.routing?.routing;
    
    console.log('📋 当前路由配置:');
    console.log('   default:', routingConfig?.default);
    console.log('   longcontext:', routingConfig?.longcontext);
    console.log('   background:', routingConfig?.background);
    
    return routingConfig;
  } catch (error) {
    console.error('❌ 获取路由配置失败:', error.message);
    return null;
  }
}

async function main() {
  console.log('');
  
  // 1. 检查当前路由配置
  const config = await checkRoutingConfig();
  console.log('');
  
  // 2. 运行生产longcontext失败测试
  const success = await testProductionLongcontextFailure();
  console.log('');
  
  // 3. 总结分析
  console.log('📋 测试分析总结:');
  console.log('================');
  console.log(`路由配置检查: ${config ? '✅ OK' : '❌ FAILED'}`);
  console.log(`生产案例重现: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (success) {
    console.log('');
    console.log('🎉 生产longcontext问题可能已解决！');
    console.log('   - 真实生产数据测试通过');
    console.log('   - 请检查路由到的具体provider和model');
    console.log('   - 如果是gemini-2.5-pro则完美解决');
    console.log('   - 如果是qwen3-coder则需要调整longcontext阈值');
  } else {
    console.log('');
    console.log('❌ 生产longcontext问题仍然存在');
    console.log(`💡 ${success ? '配置正确但' : ''}可能原因:`);
    console.log('   - longcontext阈值设置过高（60K tokens）');
    console.log('   - 请求内容未达到longcontext触发条件');
    console.log('   - 路由逻辑存在bug');
    console.log('   - token计算不准确');
  }
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}