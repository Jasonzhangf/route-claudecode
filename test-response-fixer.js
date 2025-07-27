/**
 * Test Response Fixer - 测试响应修复机制
 * 验证修复机制在处理各种问题响应时的效果
 */

// 模拟导入 - 实际会从构建后的文件导入
const { fixResponse } = require('./dist/utils/response-fixer');

function testResponseFixer() {
  console.log('🧪 开始测试响应修复机制\n');

  // 测试1: 修复空的工具输入
  console.log('=== 测试1: 修复空的工具输入 ===');
  const response1 = {
    content: [
      {
        type: 'tool_use',
        id: 'tool_123',
        name: 'LS',
        input: {}
      },
      {
        type: 'text',
        text: 'I will list the directory contents.'
      }
    ]
  };

  const fixed1 = fixResponse(response1, 'test-1');
  console.log('修复前:', JSON.stringify(response1.content[0].input));
  console.log('修复后:', JSON.stringify(fixed1.content[0].input));
  console.log('应用的修复:', fixed1.fixes_applied);
  console.log();

  // 测试2: 从文本中提取工具调用
  console.log('=== 测试2: 从文本中提取工具调用 ===');
  const response2 = {
    content: [
      {
        type: 'text',
        text: 'I will help you list files. Tool call: LS({"path": "/tmp"}) This will show the directory contents.'
      }
    ]
  };

  const fixed2 = fixResponse(response2, 'test-2');
  console.log('原始内容块数量:', response2.content.length);
  console.log('修复后内容块数量:', fixed2.content.length);
  console.log('修复后内容:');
  fixed2.content.forEach((block, index) => {
    console.log(`  块 ${index + 1}: ${block.type}`);
    if (block.type === 'tool_use') {
      console.log(`    工具: ${block.name}`);
      console.log(`    输入: ${JSON.stringify(block.input)}`);
    } else if (block.type === 'text') {
      console.log(`    文本: "${block.text}"`);
    }
  });
  console.log('应用的修复:', fixed2.fixes_applied);
  console.log();

  // 测试3: 复杂场景 - 多个问题
  console.log('=== 测试3: 复杂场景 - 多个问题 ===');
  const response3 = {
    content: [
      {
        type: 'tool_use',
        id: '',  // 空ID
        name: '',  // 空名称
        input: null  // null输入
      },
      {
        type: 'text',
        text: 'First I will read a file. Tool call: Read({"file_path": "/etc/hosts"}) Then I will list files. Tool call: LS({"path": "/home"}) Done.'
      }
    ]
  };

  const fixed3 = fixResponse(response3, 'test-3');
  console.log('原始内容块数量:', response3.content.length);
  console.log('修复后内容块数量:', fixed3.content.length);
  console.log('修复后内容:');
  fixed3.content.forEach((block, index) => {
    console.log(`  块 ${index + 1}: ${block.type}`);
    if (block.type === 'tool_use') {
      console.log(`    工具: ${block.name}`);
      console.log(`    ID: ${block.id}`);
      console.log(`    输入: ${JSON.stringify(block.input)}`);
    } else if (block.type === 'text') {
      console.log(`    文本: "${block.text}"`);
    }
  });
  console.log('应用的修复:', fixed3.fixes_applied);
  console.log();

  console.log('✅ 响应修复机制测试完成');
}

// 检查是否可以访问修复函数
try {
  // 尝试直接使用Node.js require
  delete require.cache[require.resolve('./dist/utils/response-fixer')];
  const responseFixer = require('./dist/utils/response-fixer');
  
  if (responseFixer.fixResponse) {
    console.log('✅ 成功加载响应修复模块');
    testResponseFixer();
  } else {
    console.log('❌ 响应修复函数未找到');
  }
} catch (error) {
  console.log('❌ 无法加载响应修复模块:', error.message);
  console.log('请确保项目已构建 (npm run build)');
}