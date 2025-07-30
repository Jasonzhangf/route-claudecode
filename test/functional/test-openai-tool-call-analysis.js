#!/usr/bin/env node

/**
 * OpenAI Tool Call Analysis Test
 * 分析OpenAI provider中tool call被错误处理为文本的问题
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add the project root to module paths
const projectRoot = path.join(__dirname, '..', '..');

// Import the analyzer
const { analyzeAllCapturedFiles, generateAnalysisReport } = await import(path.join(projectRoot, 'src', 'providers', 'openai', 'tool-call-analyzer.js'));

async function runTest() {
  console.log('🔍 OpenAI Tool Call Analysis Test');
  console.log('=====================================');
  
  try {
    // 分析所有捕获的文件
    console.log('\nAnalyzing captured OpenAI requests...');
    const analyses = analyzeAllCapturedFiles();
    
    console.log(`\nFound ${analyses.length} potential tool call issues`);
    
    // 生成分析报告
    const report = generateAnalysisReport(analyses);
    
    // 保存报告到文件
    const reportPath = path.join(__dirname, 'test-openai-tool-call-analysis-report.md');
    fs.writeFileSync(reportPath, report);
    
    console.log(`\n✅ Analysis report saved to: ${reportPath}`);
    
    // 打印摘要
    console.log('\n📋 Summary:');
    const toolAsTextIssues = analyses.filter(a => a.issueType === 'tool_as_text').length;
    const missingParsingIssues = analyses.filter(a => a.issueType === 'missing_tool_parsing').length;
    
    console.log(`- Tool calls as text: ${toolAsTextIssues}`);
    console.log(`- Missing tool parsing: ${missingParsingIssues}`);
    
    if (analyses.length > 0) {
      console.log('\n⚠️  Issues found! Check the detailed report for recommendations.');
      
      // 显示前几个问题的详细信息
      const showCount = Math.min(3, analyses.length);
      console.log(`\n🔍 Top ${showCount} issues:`);
      
      for (let i = 0; i < showCount; i++) {
        const analysis = analyses[i];
        console.log(`\nIssue ${i + 1}:`);
        console.log(`  Request ID: ${analysis.requestId}`);
        console.log(`  Provider: ${analysis.provider}`);
        console.log(`  Issue Type: ${analysis.issueType}`);
        console.log(`  Has tools in request: ${analysis.hasToolCallsInRequest}`);
        console.log(`  Has tools in response: ${analysis.hasToolCallsInResponse}`);
        console.log(`  Text contains tool call pattern: ${analysis.textContainsToolCallPattern}`);
        
        if (analysis.extractedToolCalls.length > 0) {
          console.log(`  Extracted tool calls: ${analysis.extractedToolCalls.length}`);
          for (const toolCall of analysis.extractedToolCalls.slice(0, 2)) {
            console.log(`    - ${toolCall.name}`);
          }
        }
      }
    } else {
      console.log('\n✅ No tool call issues found! All tool calls are properly handled.');
    }
    
    // 保存JSON格式的详细结果
    const jsonPath = path.join(__dirname, 'test-openai-tool-call-analysis-results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(analyses, null, 2));
    console.log(`\n💾 Detailed results saved to: ${jsonPath}`);
    
    return analyses.length === 0 ? 0 : 1;
    
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