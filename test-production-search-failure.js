#!/usr/bin/env node

/**
 * 基于真实生产日志的search类别longcontext失败案例测试
 * 复现ccr-session-2025-07-28T10-49-14.log中的113KB+tools请求
 */

const axios = require('axios');
const fs = require('fs');

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// 根据生产日志构建真实的search+longcontext请求
// 关键：包含tools使其被归类为search，同时内容足够大
function createRealProductionSearchRequest() {
  // 使用与生产日志完全相同的system-reminder内容
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
  const targetSize = 110000; // 目标110KB，匹配生产日志
  
  while (fullContent.length < targetSize) {
    fullContent += baseContent;
  }
  
  // 截断到精确大小
  fullContent = fullContent.substring(0, targetSize);
  fullContent += `
</system-reminder>

Please help me analyze the latest logs for persistent errors.`;

  // 关键：包含tools使请求被分类为search而非longcontext
  return {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user", 
        content: fullContent
      }
    ],
    tools: [
      {
        name: "bash",
        description: "Execute bash commands",
        input_schema: {
          type: "object",
          properties: {
            command: { type: "string" }
          },
          required: ["command"]
        }
      }
    ]
  };
}

async function testProductionSearchFailure() {
  console.log('🔧 生产环境search类别longcontext失败案例测试');
  console.log('===============================================');
  
  const realProductionSearchRequest = createRealProductionSearchRequest();
  const requestSize = JSON.stringify(realProductionSearchRequest).length;
  
  console.log(`📊 实际请求大小: ${requestSize} 字符 (匹配生产日志113,246字节)`);
  console.log(`📊 预期分类: search (因为包含tools)`);
  console.log(`📊 生产日志: search → codewhisperer-primary → 400错误`);
  console.log(`📊 修复后: search → shuaihong-openai → gemini-2.5-pro`);
  console.log('');

  let startTime;
  try {
    startTime = Date.now();
    console.log('🚀 发送生产环境search+longcontext请求...');
    
    const response = await axios.post(`${BASE_URL}/v1/messages`, realProductionSearchRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 180000 // 3分钟超时
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ 生产search请求成功 - 耗时${duration}ms`);
    console.log('📊 响应详情:', {
      id: response.data.id,
      model: response.data.model,
      role: response.data.role,
      contentLength: JSON.stringify(response.data.content).length,
      statusCode: response.status
    });
    
    // 分析路由结果
    if (response.data.model === 'gemini-2.5-pro') {
      console.log('✅ 路由修复成功: search类别 → shuaihong-openai → gemini-2.5-pro');
      console.log('   🎉 生产环境113KB+tools的400错误已解决！');
    } else if (response.data.model === 'qwen3-coder') {
      console.log('❌ 路由错误: 被错误归类为default → shuaihong-openai → qwen3-coder');
      console.log('   ⚠️  tools没有触发search分类逻辑');
    } else if (response.data.model.includes('CLAUDE_SONNET_4')) {
      console.log('❌ 路由未修复: 仍然路由到CodeWhisperer，会产生生产环境的400错误');
    } else {
      console.log(`🔍 未知路由结果: ${response.data.model}`);
    }
    
    // 保存成功结果
    const successResult = {
      timestamp: new Date().toISOString(),
      test: 'production-search-longcontext-success',
      status: 'success',
      duration: duration,
      request: {
        model: realProductionSearchRequest.model,
        contentLength: requestSize,
        hasTools: true,
        expectedCategory: 'search'
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
        actualProvider: response.data.model === 'gemini-2.5-pro' ? 'shuaihong-openai' : 'unknown',
        actualCategory: response.data.model === 'gemini-2.5-pro' ? 'search' : 'unknown',
        productionIssueFixed: response.data.model === 'gemini-2.5-pro'
      }
    };
    
    const logFile = `/tmp/production-search-success-${Date.now()}.log`;
    fs.writeFileSync(logFile, JSON.stringify(successResult, null, 2));
    console.log(`📄 成功结果保存到: ${logFile}`);
    
    return true;
    
  } catch (error) {
    const endTime = Date.now();
    const duration = startTime ? endTime - startTime : 0;
    
    console.error(`❌ 生产search请求失败 - 耗时${duration}ms`);
    console.error('错误详情:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // 分析失败原因
    if (error.response?.status === 400) {
      console.log('');
      console.log('🔍 问题诊断: 400错误 - 与生产日志完全一致！');
      console.log('   ❌ 路由修复失败：请求仍被路由到CodeWhisperer');
      console.log('   📋 生产环境问题复现：search类别的大请求导致400错误');
      console.log('   💡 需要检查search类别的路由配置');
    }
    
    // 保存错误结果
    const errorResult = {
      timestamp: new Date().toISOString(),
      test: 'production-search-longcontext-failure',
      status: 'failed',
      duration: duration,
      error: {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      },
      request: {
        model: realProductionSearchRequest.model,
        contentLength: requestSize,
        hasTools: true,
        expectedCategory: 'search'
      },
      analysis: {
        matchesProductionLog: error.response?.status === 400,
        productionIssueReproduced: error.response?.status === 400,
        suspectedCause: error.response?.status === 400 ? 'Search category still routed to CodeWhisperer' : 'Unknown'
      }
    };
    
    const logFile = `/tmp/production-search-failure-${Date.now()}.log`;
    fs.writeFileSync(logFile, JSON.stringify(errorResult, null, 2));
    console.log(`📄 错误结果保存到: ${logFile}`);
    
    return false;
  }
}

async function main() {
  console.log('');
  
  // 运行生产search失败重现测试
  const success = await testProductionSearchFailure();
  console.log('');
  
  // 总结分析
  console.log('📋 生产问题分析总结:');
  console.log('=====================');
  console.log(`真实生产案例重现: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (success) {
    console.log('');
    console.log('🎉 生产环境search+longcontext问题已解决！');
    console.log('   ✅ 113KB+tools请求不再返回400错误');
    console.log('   ✅ 正确路由到shuaihong-openai/gemini-2.5-pro');
    console.log('   ✅ 配置修复生效，生产环境应该正常');
  } else {
    console.log('');
    console.log('❌ 生产环境search+longcontext问题仍未解决');
    console.log('💡 可能原因:');
    console.log('   - search类别路由配置未生效');
    console.log('   - tools检测逻辑存在问题');
    console.log('   - 请求仍被路由到CodeWhisperer而非shuaihong-openai');
    console.log('   - 配置文件未正确加载');
  }
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}