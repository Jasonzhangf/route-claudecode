/**
 * 简单的测试运行器
 * 用于运行路由引擎单元测试
 * 
 * @author Jason Zhang
 * @version v3.1.0
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 模拟Jest的describe和it函数
let currentSuite = '';
let testResults = [];
let passedTests = 0;
let failedTests = 0;

global.describe = function(suiteName, suiteFunction) {
  currentSuite = suiteName;
  console.log(`\n🧪 ${suiteName}`);
  suiteFunction();
};

global.it = function(testName, testFunction) {
  const runTest = async () => {
    try {
      await testFunction();
      console.log(`  ✅ ${testName}`);
      passedTests++;
      testResults.push({ suite: currentSuite, test: testName, status: 'PASSED' });
    } catch (error) {
      console.log(`  ❌ ${testName}`);
      console.log(`     Error: ${error.message}`);
      failedTests++;
      testResults.push({ suite: currentSuite, test: testName, status: 'FAILED', error: error.message });
    }
  };
  
  // 将测试函数存储起来，稍后运行
  if (!global.testQueue) {
    global.testQueue = [];
  }
  global.testQueue.push(runTest);
};

global.beforeEach = function(setupFunction) {
  // 在每个测试前运行
  setupFunction();
};

// 模拟expect断言库
global.expect = function(actual) {
  return {
    toBe: function(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
      }
    },
    toHaveProperty: function(property) {
      if (!(property in actual)) {
        throw new Error(`Expected object to have property ${property}`);
      }
    },
    toHaveLength: function(length) {
      if (actual.length !== length) {
        throw new Error(`Expected length ${length}, but got ${actual.length}`);
      }
    },
    toBeLessThan: function(expected) {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toBeDefined: function() {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
    },
    not: {
      toThrow: function() {
        // 用于测试函数不抛出异常
        try {
          if (typeof actual === 'function') {
            actual();
          }
        } catch (error) {
          throw new Error(`Expected function not to throw, but it threw: ${error.message}`);
        }
      }
    },
    toThrow: function() {
      let threw = false;
      try {
        if (typeof actual === 'function') {
          actual();
        }
      } catch (error) {
        threw = true;
      }
      if (!threw) {
        throw new Error('Expected function to throw an error');
      }
    }
  };
};

// 运行测试并显示结果
async function runTests() {
  console.log('🚀 开始运行路由引擎单元测试...\n');
  
  try {
    // 初始化测试队列
    global.testQueue = [];
    
    // 动态导入测试文件
    await import('./routing-engine.test.js');
    
    // 运行所有收集到的测试
    for (const testFunc of global.testQueue) {
      await testFunc();
    }
    
    console.log('\n📊 测试结果统计:');
    console.log(`✅ 通过: ${passedTests}`);
    console.log(`❌ 失败: ${failedTests}`);
    console.log(`📈 通过率: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\n❌ 失败的测试:');
      testResults.filter(r => r.status === 'FAILED').forEach(result => {
        console.log(`  - ${result.suite}: ${result.test}`);
        console.log(`    ${result.error}`);
      });
    }
    
    // 返回测试是否全部通过
    return failedTests === 0;
    
  } catch (error) {
    console.error('❌ 测试运行失败:', error.message);
    return false;
  }
}

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runTests, testResults };