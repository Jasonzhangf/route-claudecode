#!/usr/bin/env node

/**
 * 直接测试OpenAI Input Processor的content处理逻辑修复
 * 目标：验证object格式的content能否正确转换
 */

// 模拟OpenAI Input Processor的convertMessageContent方法
function convertMessageContent(msg) {
  const content = [];

  // Add text content (修复后的逻辑)
  if (msg.content) {
    if (typeof msg.content === 'string') {
      content.push({ type: 'text', text: msg.content });
    } else if (Array.isArray(msg.content)) {
      // Handle complex content (images, etc.)
      msg.content.forEach(block => {
        if (block.type === 'text') {
          content.push({ type: 'text', text: block.text });
        } else {
          content.push(block); // Pass through other types
        }
      });
    } else if (typeof msg.content === 'object' && msg.content !== null) {
      // 🔧 Handle object content format (e.g., { type: "text", text: "..." })
      const contentObj = msg.content;
      if (contentObj.type === 'text' && contentObj.text) {
        content.push({ type: 'text', text: contentObj.text });
      } else {
        // Convert object to text content
        content.push({ type: 'text', text: JSON.stringify(msg.content) });
      }
    }
  }

  // Return single text if only one text block
  if (content.length === 1 && content[0].type === 'text') {
    return content[0].text;
  }

  return content.length > 0 ? content : '';
}

console.log('🧪 Testing OpenAI Input Processor content handling fix...\n');

// 测试用例1：对象格式content（我们修复的场景）
console.log('📋 Test Case 1: Object content format');
const testMessage1 = {
  role: "user",
  content: {
    type: "text", 
    text: "This is a test message with object content format"
  }
};

const result1 = convertMessageContent(testMessage1);
console.log('Input:', JSON.stringify(testMessage1.content, null, 2));
console.log('Output:', JSON.stringify(result1, null, 2));
console.log('Expected: "This is a test message with object content format"');
console.log('✅ Success:', result1 === "This is a test message with object content format");
console.log();

// 测试用例2：字符串格式content（正常场景）
console.log('📋 Test Case 2: String content format');
const testMessage2 = {
  role: "user",
  content: "This is a normal string content"
};

const result2 = convertMessageContent(testMessage2);
console.log('Input:', JSON.stringify(testMessage2.content, null, 2));
console.log('Output:', JSON.stringify(result2, null, 2));
console.log('Expected: "This is a normal string content"');
console.log('✅ Success:', result2 === "This is a normal string content");
console.log();

// 测试用例3：数组格式content
console.log('📋 Test Case 3: Array content format');
const testMessage3 = {
  role: "user",
  content: [
    { type: "text", text: "First part" },
    { type: "text", text: "Second part" }
  ]
};

const result3 = convertMessageContent(testMessage3);
console.log('Input:', JSON.stringify(testMessage3.content, null, 2));
console.log('Output:', JSON.stringify(result3, null, 2));
console.log('Expected: Array with both text blocks');
console.log('✅ Success:', Array.isArray(result3) && result3.length === 2);
console.log();

// 测试用例4：无效对象格式content
console.log('📋 Test Case 4: Invalid object content format');
const testMessage4 = {
  role: "user",
  content: {
    someField: "someValue",
    anotherField: 123
  }
};

const result4 = convertMessageContent(testMessage4);
console.log('Input:', JSON.stringify(testMessage4.content, null, 2));
console.log('Output:', JSON.stringify(result4, null, 2));
console.log('Expected: JSON string of the object');
console.log('✅ Success:', typeof result4 === 'string' && result4.includes('someField'));
console.log();

console.log('🎯 Summary:');
console.log('- Test Case 1 (Object format): ', result1 === "This is a test message with object content format" ? '✅ PASS' : '❌ FAIL');
console.log('- Test Case 2 (String format): ', result2 === "This is a normal string content" ? '✅ PASS' : '❌ FAIL');
console.log('- Test Case 3 (Array format): ', Array.isArray(result3) && result3.length === 2 ? '✅ PASS' : '❌ FAIL');
console.log('- Test Case 4 (Invalid object): ', typeof result4 === 'string' && result4.includes('someField') ? '✅ PASS' : '❌ FAIL');

const allPassed = 
  result1 === "This is a test message with object content format" &&
  result2 === "This is a normal string content" &&
  Array.isArray(result3) && result3.length === 2 &&
  typeof result4 === 'string' && result4.includes('someField');

console.log('\n🏁 Overall Result:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');

if (allPassed) {
  console.log('\n🎉 修复成功！OpenAI Input Processor现在可以正确处理object格式的content了');
  console.log('这应该解决API 400错误中的"content cannot be object"问题');
} else {
  console.log('\n⚠️ 修复可能有问题，需要进一步检查');
}