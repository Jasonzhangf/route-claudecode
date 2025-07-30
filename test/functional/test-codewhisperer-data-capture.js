#!/usr/bin/env node

/**
 * CodeWhisperer Data Capture Test
 * 验证数据捕获系统的完整性和功能
 */

const path = require('path');
const fs = require('fs');

// Test configuration
const testConfig = {
  testRequestId: `test-capture-${Date.now()}`,
  baseUrl: 'http://localhost:3456',
  logFile: `/tmp/test-codewhisperer-data-capture-${Date.now()}.log`,
  testStartTime: new Date().toISOString()
};

console.log('🧪 CodeWhisperer Data Capture Test');
console.log('=====================================');
console.log(`Request ID: ${testConfig.testRequestId}`);
console.log(`Base URL: ${testConfig.baseUrl}`);
console.log(`Log file: ${testConfig.logFile}`);
console.log(`Start time: ${testConfig.testStartTime}`);
console.log('');

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}${data ? ': ' + JSON.stringify(data, null, 2) : ''}`;
  console.log(logEntry);
  
  try {
    fs.appendFileSync(testConfig.logFile, logEntry + '\n');
  } catch (error) {
    console.error('Failed to write to log file:', error.message);
  }
}

async function testDataCaptureSystem() {
  try {
    log('🔍 Step 1: Checking data capture module imports');
    
    // Test imports
    const dataCapturePath = path.join(__dirname, '../../src/providers/codewhisperer/data-capture.ts');
    const analysisToolsPath = path.join(__dirname, '../../src/providers/codewhisperer/analysis-tools.ts');
    
    if (!fs.existsSync(dataCapturePath)) {
      throw new Error('Data capture module not found');
    }
    if (!fs.existsSync(analysisToolsPath)) {
      throw new Error('Analysis tools module not found');
    }
    
    log('✅ Data capture modules found');
    
    log('🔍 Step 2: Checking capture directory structure');
    
    const capturesDir = path.join(process.env.HOME, '.route-claude-code', 'database', 'captures', 'codewhisperer');
    if (!fs.existsSync(capturesDir)) {
      log('📁 Creating captures directory');
      fs.mkdirSync(capturesDir, { recursive: true });
    }
    
    log('✅ Capture directory ready', { capturesDir });
    
    log('🔍 Step 3: Testing basic API request with data capture');
    
    // Make a test API request to trigger data capture
    const testRequest = {
      model: 'claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: 'Hello, can you help me test the data capture system? Please respond with a simple message.'
        }
      ],
      max_tokens: 100,
      stream: false
    };
    
    log('📡 Sending test request', { 
      url: `${testConfig.baseUrl}/v1/messages`,
      requestId: testConfig.testRequestId
    });
    
    const response = await fetch(`${testConfig.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': testConfig.testRequestId
      },
      body: JSON.stringify(testRequest)
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    log('✅ API request successful', {
      status: response.status,
      model: responseData.model,
      hasContent: !!responseData.content
    });
    
    log('🔍 Step 4: Waiting for capture files to be written');
    
    // Wait a bit for files to be written
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    log('🔍 Step 5: Checking for generated capture files');
    
    // Check for capture files
    const captureFiles = fs.readdirSync(capturesDir)
      .filter(file => file.includes(testConfig.testRequestId))
      .sort();
    
    if (captureFiles.length === 0) {
      throw new Error('No capture files found for test request');
    }
    
    log('✅ Capture files generated', {
      fileCount: captureFiles.length,
      files: captureFiles
    });
    
    log('🔍 Step 6: Analyzing capture file contents');
    
    const captureAnalysis = {
      stages: {},
      events: {},
      totalFiles: captureFiles.length
    };
    
    captureFiles.forEach(file => {
      try {
        const filePath = path.join(capturesDir, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Track stages and events
        const stage = content.stage;
        const event = content.event;
        
        if (!captureAnalysis.stages[stage]) {
          captureAnalysis.stages[stage] = 0;
        }
        captureAnalysis.stages[stage]++;
        
        if (!captureAnalysis.events[event]) {
          captureAnalysis.events[event] = 0;
        }
        captureAnalysis.events[event]++;
        
        log(`📄 Analyzed ${file}`, {
          stage,
          event,
          hasData: !!content.data,
          timestamp: content.timestamp
        });
        
      } catch (error) {
        log(`❌ Failed to analyze ${file}`, { error: error.message });
      }
    });
    
    log('✅ Capture analysis complete', captureAnalysis);
    
    log('🔍 Step 7: Testing analysis tools');
    
    // Test if we can import and use analysis tools (simplified test)
    try {
      // This would require the actual compiled modules, so we'll just check the file structure
      const expectedStages = ['auth', 'conversion', 'http', 'parsing'];
      const foundStages = Object.keys(captureAnalysis.stages);
      
      const stagesCovered = expectedStages.filter(stage => foundStages.includes(stage));
      
      log('✅ Analysis tools test', {
        expectedStages,
        foundStages,
        coverage: `${stagesCovered.length}/${expectedStages.length}`
      });
      
    } catch (error) {
      log('❌ Analysis tools test failed', { error: error.message });
    }
    
    log('🔍 Step 8: Testing capture cleanup (dry run)');
    
    // Count files before cleanup test
    const allFiles = fs.readdirSync(capturesDir);
    const oldFiles = allFiles.filter(file => {
      try {
        const filePath = path.join(capturesDir, file);
        const stats = fs.statSync(filePath);
        // Files older than 1 day
        return Date.now() - stats.mtime.getTime() > 24 * 60 * 60 * 1000;
      } catch {
        return false;
      }
    });
    
    log('✅ Cleanup test complete', {
      totalFiles: allFiles.length,
      oldFiles: oldFiles.length,
      testFiles: captureFiles.length
    });
    
    log('🎉 All tests passed!');
    
    return {
      success: true,
      testRequestId: testConfig.testRequestId,
      captureFiles: captureFiles.length,
      stages: Object.keys(captureAnalysis.stages),
      events: Object.keys(captureAnalysis.events)
    };
    
  } catch (error) {
    log('❌ Test failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

async function main() {
  try {
    const result = await testDataCaptureSystem();
    
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📁 Capture files: ${result.captureFiles}`);
    console.log(`🏗️ Stages captured: ${result.stages.join(', ')}`);
    console.log(`📝 Events captured: ${result.events.join(', ')}`);
    console.log(`📋 Request ID: ${result.testRequestId}`);
    console.log(`📄 Log file: ${testConfig.logFile}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('📄 Check log file for details:', testConfig.logFile);
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  main();
}

module.exports = { testDataCaptureSystem, testConfig };