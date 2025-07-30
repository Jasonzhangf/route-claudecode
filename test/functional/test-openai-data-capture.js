#!/usr/bin/env node

/**
 * OpenAI Data Capture Test
 * 测试OpenAI provider的数据捕获功能
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add the project root to module paths
const projectRoot = path.join(__dirname, '..', '..');

// Import the data capture module from compiled JS
const { listCapturedFiles, loadCapturedData } = await import(path.join(projectRoot, 'dist', 'providers', 'openai', 'data-capture.js'));

async function runTest() {
  console.log('🔍 OpenAI Data Capture Test');
  console.log('=========================');
  
  try {
    // 列出所有捕获的文件
    console.log('\nListing captured OpenAI requests...');
    const files = listCapturedFiles();
    
    console.log(`\nFound ${files.length} captured files`);
    
    if (files.length === 0) {
      console.log('⚠️  No captured files found. Run some OpenAI requests with data capture enabled first.');
      return 0;
    }
    
    // 显示最新的几个文件
    const showCount = Math.min(5, files.length);
    console.log(`\n📋 Latest ${showCount} captured files:`);
    
    for (let i = 0; i < showCount; i++) {
      const file = files[files.length - 1 - i];
      console.log(`  ${i + 1}. ${file}`);
    }
    
    // 加载并显示最新的捕获数据
    console.log('\n📄 Latest capture details:');
    const latestFile = files[files.length - 1];
    const captureData = loadCapturedData(latestFile);
    
    if (captureData) {
      console.log(`  Request ID: ${captureData.requestId}`);
      console.log(`  Provider: ${captureData.provider}`);
      console.log(`  Model: ${captureData.model}`);
      console.log(`  Timestamp: ${captureData.timestamp}`);
      console.log(`  Has request: ${!!captureData.request}`);
      console.log(`  Has response: ${!!captureData.response}`);
      console.log(`  Has error: ${!!captureData.error}`);
      
      // 保存详细信息到文件
      const detailsPath = path.join(__dirname, 'test-openai-data-capture-latest.json');
      fs.writeFileSync(detailsPath, JSON.stringify(captureData, null, 2));
      console.log(`\n💾 Latest capture details saved to: ${detailsPath}`);
    }
    
    // 统计信息
    console.log('\n📊 Statistics:');
    const providerStats = {};
    const modelStats = {};
    
    for (const file of files) {
      const data = loadCapturedData(file);
      if (data) {
        // 统计provider
        if (data.provider) {
          providerStats[data.provider] = (providerStats[data.provider] || 0) + 1;
        }
        
        // 统计model
        if (data.model) {
          modelStats[data.model] = (modelStats[data.model] || 0) + 1;
        }
      }
    }
    
    console.log('  Providers:');
    for (const [provider, count] of Object.entries(providerStats)) {
      console.log(`    ${provider}: ${count}`);
    }
    
    console.log('  Models:');
    for (const [model, count] of Object.entries(modelStats)) {
      console.log(`    ${model}: ${count}`);
    }
    
    // 保存统计信息
    const statsPath = path.join(__dirname, 'test-openai-data-capture-stats.json');
    fs.writeFileSync(statsPath, JSON.stringify({
      totalFiles: files.length,
      providers: providerStats,
      models: modelStats,
      files: files
    }, null, 2));
    
    console.log(`\n📈 Statistics saved to: ${statsPath}`);
    
    console.log('\n✅ Data capture test completed successfully!');
    
    return 0;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return 1;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runTest().then(exitCode => {
    process.exit(exitCode);
  });
}