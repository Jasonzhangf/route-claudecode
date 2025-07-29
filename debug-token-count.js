#!/usr/bin/env node

/**
 * Debug script to check actual token count of our test request
 */

const { calculateTokenCount } = require('./dist/utils');

// Same content as the test script
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

// Replicate same logic as test script
let fullContent = baseContent;
const targetSize = 110000;

while (fullContent.length < targetSize) {
  fullContent += baseContent;
}

fullContent = fullContent.substring(0, targetSize);
fullContent += '\n</system-reminder>';

const testRequest = {
  model: "claude-sonnet-4-20250514", 
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: fullContent
    }
  ]
};

console.log('🔍 分析测试请求的token计算');
console.log('=================================');
console.log(`📊 字符数: ${fullContent.length}`);
console.log(`📊 JSON大小: ${JSON.stringify(testRequest).length}`);

try {
  const tokenCount = calculateTokenCount(
    testRequest.messages,
    testRequest.system,
    testRequest.tools
  );
  
  console.log(`📊 实际token数: ${tokenCount}`);
  console.log(`📊 longcontext阈值: 60,000 tokens`);
  console.log(`📊 是否达到longcontext: ${tokenCount > 60000 ? '✅ YES' : '❌ NO'}`);
  
  if (tokenCount <= 60000) {
    console.log('');
    console.log('🔧 问题诊断:');
    console.log(`   当前token数 (${tokenCount}) 未达到longcontext阈值 (60,000)`);
    console.log('   这解释了为什么请求被路由到default类别而不是longcontext');
    console.log('');
    console.log('💡 解决方案:');
    console.log('   1. 降低longcontext阈值 (例如：40,000 tokens)');
    console.log('   2. 或增加测试内容使其达到60K+ tokens');
    
    // Calculate how much content needed for 60K tokens
    const tokensPerChar = tokenCount / fullContent.length;
    const charsNeededFor60K = Math.ceil(60000 / tokensPerChar);
    console.log(`   3. 需要约${charsNeededFor60K}字符才能达到60K tokens`);
  }
  
} catch (error) {
  console.error('❌ Token计算失败:', error.message);
  
  // Fallback estimation
  const estimatedTokens = Math.floor(fullContent.length / 4); // rough estimate
  console.log(`📊 预估token数: ~${estimatedTokens} (按4字符/token估算)`);
  console.log(`📊 是否达到longcontext: ${estimatedTokens > 60000 ? '✅ YES' : '❌ NO'}`);
}