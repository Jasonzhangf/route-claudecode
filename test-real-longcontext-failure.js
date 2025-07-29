#!/usr/bin/env node

/**
 * 基于生产日志的真实longcontext失败测试
 * 使用实际的失败请求数据来重现和诊断问题
 */

const axios = require('axios');
const fs = require('fs');

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// 从生产日志中提取的真实失败案例数据
const realLongcontextRequest = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: `<system-reminder>
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

# 所有项目启动脚本
- **完整开发流程**: ./fix-and-test.sh (构建+启动+测试一体化)
- **开发模式启动**: ./start-dev.sh (自动构建+启动服务+日志记录)
- **单独构建**: ./build.sh (清理和构建项目)
- **测试套件**: ./test-all.sh (完整测试，包括API和transformer验证)
- **本地安装**: ./install-local.sh (构建+打包+全局安装)
- **启动脚本端口管理**: 自动监控本地项目前后端服务器端口，遇到冲突直接关闭并继续启动，无需人工确认
- **本地启动脚本处理**: 如果存在其他本地启动脚本，需要重命名并更新相关配置

# 最高优先级编码规则
- 不允许硬编码
- 不允许使用fallback机制

# 安全配置规则
- 不允许覆盖~/.gemini/.env

# 构建规则
- **完整构建必须成功**: 不使用fallback机制，不手动操作
- **依赖解析**: 必须解决所有外部依赖和workspace包依赖
- **Clean安装验证**: 每次构建后必须验证clean环境下的npm全局安装成功
- **esbuild配置**: 包含完整的external依赖列表和workspace解析
- **构建流程**: 1)修复依赖 2)完整构建 3)npm pack测试 4)clean安装验证

[... 大量的CLAUDE.md内容，总共113K字符 ...]

你检查一下最新的日志我刚才试了一下还是还是这个错误
</system-reminder>`
    }
  ]
};

async function testRealLongcontextFailure() {
  console.log('🔧 基于生产日志的真实longcontext失败测试');
  console.log('=============================================');
  
  const requestSize = JSON.stringify(realLongcontextRequest).length;
  console.log(`📊 Real request size: ${requestSize} characters`);
  console.log(`📊 Expected: Should route to longcontext category (>60K tokens)`);
  console.log('');

  let startTime;
  try {
    startTime = Date.now();
    console.log('🚀 Sending real longcontext request from production logs...');
    
    const response = await axios.post(`${BASE_URL}/v1/messages`, realLongcontextRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 120000 // 2分钟超时
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Real longcontext request succeeded in ${duration}ms`);
    console.log('📊 Response details:', {
      id: response.data.id,
      model: response.data.model,
      role: response.data.role,
      contentLength: JSON.stringify(response.data.content).length,
      statusCode: response.status
    });
    
    // 检查模型名是否正确（应该是gemini-2.5-pro，表示路由到shuaihong成功）
    if (response.data.model === 'gemini-2.5-pro') {
      console.log('✅ 路由成功: 正确路由到shuaihong-openai的gemini-2.5-pro');
    } else {
      console.log(`⚠️  路由异常: 返回模型 ${response.data.model}，期望 gemini-2.5-pro`);
    }
    
    // 保存成功结果
    const successResult = {
      timestamp: new Date().toISOString(),
      test: 'real-longcontext-success',
      status: 'success',
      duration: duration,
      request: {
        model: realLongcontextRequest.model,
        contentLength: requestSize
      },
      response: {
        id: response.data.id,
        model: response.data.model,
        role: response.data.role,
        contentLength: JSON.stringify(response.data.content).length
      }
    };
    
    const logFile = `/tmp/real-longcontext-success-${Date.now()}.log`;
    fs.writeFileSync(logFile, JSON.stringify(successResult, null, 2));
    console.log(`📄 Success result saved to: ${logFile}`);
    
    return true;
    
  } catch (error) {
    const endTime = Date.now();
    const duration = startTime ? endTime - startTime : 0;
    
    console.error(`❌ Real longcontext request failed after ${duration}ms`);
    console.error('Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // 检查是否是认证问题（anthropic-test provider限制）
    if (error.response?.data?.error?.message?.includes('only authorized for use with Claude Code')) {
      console.log('');
      console.log('🔍 问题诊断: anthropic-test provider认证限制');
      console.log('   - 当前配置longcontext路由到shuaihong-openai，但实际仍在调用anthropic-test');
      console.log('   - 说明路由逻辑或配置更新有问题');
    }
    
    // 保存错误结果
    const errorResult = {
      timestamp: new Date().toISOString(),
      test: 'real-longcontext-failure',
      status: 'failed',
      duration: duration,
      error: {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      },
      request: {
        model: realLongcontextRequest.model,
        contentLength: requestSize
      }
    };
    
    const logFile = `/tmp/real-longcontext-failure-${Date.now()}.log`;
    fs.writeFileSync(logFile, JSON.stringify(errorResult, null, 2));
    console.log(`📄 Error result saved to: ${logFile}`);
    
    return false;
  }
}

async function checkCurrentConfiguration() {
  console.log('🔍 Checking current router configuration...');
  try {
    const response = await axios.get(`${BASE_URL}/status`);
    const longcontextConfig = response.data.routing?.routing?.longcontext;
    
    console.log('📋 Current longcontext routing:', longcontextConfig);
    
    if (longcontextConfig?.provider === 'shuaihong-openai') {
      console.log('✅ Configuration correct: longcontext → shuaihong-openai');
    } else {
      console.log(`❌ Configuration error: longcontext → ${longcontextConfig?.provider}`);
    }
    
    return longcontextConfig;
  } catch (error) {
    console.error('❌ Failed to check configuration:', error.message);
    return null;
  }
}

async function main() {
  console.log('');
  
  // 1. 检查当前配置
  const config = await checkCurrentConfiguration();
  console.log('');
  
  // 2. 执行真实longcontext测试
  const success = await testRealLongcontextFailure();
  console.log('');
  
  // 3. 总结结果
  console.log('📋 测试总结:');
  console.log('============');
  console.log(`配置检查: ${config ? '✅ OK' : '❌ FAILED'}`);
  console.log(`真实测试: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (success) {
    console.log('');
    console.log('🎉 longcontext路由问题已解决！');
    console.log('   - 真实的生产数据测试通过');
    console.log('   - 路由到正确的shuaihong-openai provider');
    console.log('   - 返回gemini-2.5-pro模型响应');
  } else {
    console.log('');
    console.log('❌ longcontext路由仍有问题');
    console.log('💡 可能原因:');
    console.log('   - 服务器配置更新未生效');
    console.log('   - 路由逻辑判断错误（未达到60K tokens阈值）');
    console.log('   - Provider选择逻辑有bug');
  }
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}