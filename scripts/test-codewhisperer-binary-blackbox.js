#!/usr/bin/env node

/**
 * CodeWhisperer二进制数据黑盒测试脚本
 * 使用捕获的二进制数据与demo3进行交叉对比分析
 * 不消耗token，纯离线分析
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 黑盒测试配置
const BLACKBOX_TEST_CONFIG = {
  binaryDataDir: '/tmp/codewhisperer-binary-data',
  demo3Endpoint: 'http://localhost:3000/v1/chat/completions',
  logDir: '/tmp/codewhisperer-blackbox-test',
  timeout: 30000,
  
  // 分析配置
  analysis: {
    maxBinarySize: 10 * 1024 * 1024, // 10MB
    textEncodings: ['utf8', 'ascii', 'latin1'],
    binaryPatterns: [
      // AWS Event Stream格式特征
      { name: 'aws_event_stream_header', pattern: /\x00\x00\x00.{4}\x00\x00\x00/g },
      // JSON片段
      { name: 'json_fragment', pattern: /\{[^}]*"[^"]*"[^}]*\}/g },
      // 工具调用模式
      { name: 'tool_call_pattern', pattern: /"toolUseId"|"tool_use"|"function"/g },
      // 文本内容模式
      { name: 'content_pattern', pattern: /"content"|"text"|"delta"/g }
    ]
  }
};

// 确保必要目录存在
if (!fs.existsSync(BLACKBOX_TEST_CONFIG.logDir)) {
  fs.mkdirSync(BLACKBOX_TEST_CONFIG.logDir, { recursive: true });
}

/**
 * 扫描二进制数据文件
 */
function scanBinaryDataFiles() {
  const binaryDir = BLACKBOX_TEST_CONFIG.binaryDataDir;
  
  if (!fs.existsSync(binaryDir)) {
    console.log(`❌ 二进制数据目录不存在: ${binaryDir}`);
    console.log('请先运行健康检查脚本捕获二进制数据:');
    console.log('  ./scripts/test-codewhisperer-health-check.js');
    return [];
  }
  
  const files = fs.readdirSync(binaryDir)
    .filter(file => file.endsWith('.bin'))
    .map(file => {
      const filePath = path.join(binaryDir, file);
      const stats = fs.statSync(filePath);
      
      // 从文件名解析信息
      const nameParts = file.replace('.bin', '').split('-');
      const testCase = nameParts[0];
      const isError = nameParts.includes('error');
      
      return {
        name: file,
        path: filePath,
        size: stats.size,
        testCase,
        isError,
        timestamp: stats.mtime
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp); // 按时间倒序
  
  console.log(`📁 发现 ${files.length} 个二进制数据文件`);
  return files;
}

/**
 * 分析单个二进制文件
 */
function analyzeBinaryFile(binaryFile) {
  console.log(`\n🔍 分析二进制文件: ${binaryFile.name}`);
  console.log(`  📊 大小: ${binaryFile.size} bytes`);
  console.log(`  🧪 测试用例: ${binaryFile.testCase}`);
  console.log(`  ❌ 错误响应: ${binaryFile.isError ? '是' : '否'}`);
  
  const analysis = {
    file: binaryFile,
    rawData: null,
    textAttempts: [],
    patterns: [],
    structure: null,
    demo3Comparison: null
  };
  
  try {
    // 读取原始二进制数据
    analysis.rawData = fs.readFileSync(binaryFile.path);
    
    // 尝试不同编码解析为文本
    for (const encoding of BLACKBOX_TEST_CONFIG.analysis.textEncodings) {
      try {
        const textData = analysis.rawData.toString(encoding);
        const attempt = {
          encoding,
          success: true,
          length: textData.length,
          preview: textData.substring(0, 200),
          isReadable: /^[\x20-\x7E\s]*$/.test(textData.substring(0, 100))
        };
        
        analysis.textAttempts.push(attempt);
        
        if (attempt.isReadable) {
          console.log(`  ✅ ${encoding} 编码可读`);
        }
      } catch (error) {
        analysis.textAttempts.push({
          encoding,
          success: false,
          error: error.message
        });
      }
    }
    
    // 查找二进制模式
    const bestTextAttempt = analysis.textAttempts.find(a => a.success && a.isReadable) || 
                           analysis.textAttempts.find(a => a.success);
    
    if (bestTextAttempt) {
      const textData = analysis.rawData.toString(bestTextAttempt.encoding);
      
      for (const pattern of BLACKBOX_TEST_CONFIG.analysis.binaryPatterns) {
        const matches = textData.match(pattern.pattern);
        if (matches) {
          analysis.patterns.push({
            name: pattern.name,
            count: matches.length,
            samples: matches.slice(0, 3) // 前3个匹配示例
          });
          
          console.log(`  🔍 发现模式 ${pattern.name}: ${matches.length} 个匹配`);
        }
      }
    }
    
    // 尝试解析AWS Event Stream结构
    analysis.structure = parseAWSEventStream(analysis.rawData);
    
    return analysis;
    
  } catch (error) {
    console.log(`  ❌ 分析失败: ${error.message}`);
    analysis.error = error.message;
    return analysis;
  }
}

/**
 * 解析AWS Event Stream格式
 */
function parseAWSEventStream(buffer) {
  const events = [];
  let offset = 0;
  
  console.log(`  🔧 尝试解析AWS Event Stream格式...`);
  
  while (offset < buffer.length) {
    // 检查是否有足够的字节读取帧头
    if (buffer.length - offset < 12) {
      break;
    }
    
    try {
      // 读取总长度和头部长度
      const totalLen = buffer.readUInt32BE(offset);
      const headerLen = buffer.readUInt32BE(offset + 4);
      
      // 验证长度合理性
      if (totalLen > buffer.length - offset + 8 || totalLen < 12) {
        break;
      }
      
      const event = {
        totalLength: totalLen,
        headerLength: headerLen,
        offset: offset
      };
      
      offset += 8;
      
      // 跳过头部
      if (headerLen > 0) {
        event.header = buffer.subarray(offset, offset + headerLen);
        offset += headerLen;
      }
      
      // 读取payload
      const payloadLen = totalLen - headerLen - 12;
      if (payloadLen > 0) {
        event.payload = buffer.subarray(offset, offset + payloadLen);
        offset += payloadLen;
        
        // 尝试解析payload为文本
        try {
          let payloadStr = event.payload.toString('utf8');
          
          // 移除"vent"前缀（如果存在）
          if (payloadStr.startsWith('vent')) {
            payloadStr = payloadStr.substring(4);
          }
          
          event.payloadText = payloadStr;
          
          // 尝试解析为JSON
          try {
            event.payloadJson = JSON.parse(payloadStr);
          } catch (jsonError) {
            // JSON解析失败，保留文本
          }
        } catch (textError) {
          // 文本解析失败
        }
      }
      
      // 跳过CRC32
      offset += 4;
      
      events.push(event);
      
    } catch (parseError) {
      console.log(`    ⚠️  解析事件失败: ${parseError.message}`);
      break;
    }
  }
  
  if (events.length > 0) {
    console.log(`  ✅ 成功解析 ${events.length} 个AWS Event Stream事件`);
    return {
      format: 'aws_event_stream',
      eventCount: events.length,
      events: events.slice(0, 5), // 只保留前5个事件用于分析
      totalParsedBytes: offset
    };
  } else {
    console.log(`  ❌ 不是有效的AWS Event Stream格式`);
    return null;
  }
}

/**
 * 与demo3进行对比测试
 */
async function compareWithDemo3(analysis) {
  if (!analysis.structure || !analysis.structure.events) {
    console.log(`  ⏭️  跳过demo3对比 (无有效结构)`);
    return null;
  }
  
  console.log(`  🔄 与demo3进行对比测试...`);
  
  try {
    // 构建对比请求（基于原始测试用例）
    let testRequest;
    
    if (analysis.file.testCase === 'simple_request') {
      testRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello, this is a health check test.' }
        ],
        max_tokens: 100
      };
    } else if (analysis.file.testCase === 'tool_request') {
      testRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'What time is it?' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_current_time',
              description: 'Get the current time',
              parameters: {
                type: 'object',
                properties: {},
                required: []
              }
            }
          }
        ],
        max_tokens: 200
      };
    } else {
      console.log(`    ⏭️  不支持的测试用例类型: ${analysis.file.testCase}`);
      return null;
    }
    
    // 发送请求到demo3
    const response = await axios.post(
      BLACKBOX_TEST_CONFIG.demo3Endpoint,
      testRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        timeout: BLACKBOX_TEST_CONFIG.timeout
      }
    );
    
    const comparison = {
      demo3Response: response.data,
      statusCode: response.status,
      headers: response.headers,
      differences: []
    };
    
    // 对比分析
    console.log(`    ✅ demo3响应成功 (状态码: ${response.status})`);
    
    // 分析CodeWhisperer事件中的内容
    const cwContent = [];
    const cwToolCalls = [];
    
    for (const event of analysis.structure.events) {
      if (event.payloadJson) {
        if (event.payloadJson.content) {
          cwContent.push(event.payloadJson.content);
        }
        if (event.payloadJson.toolUseId && event.payloadJson.name) {
          cwToolCalls.push({
            id: event.payloadJson.toolUseId,
            name: event.payloadJson.name,
            input: event.payloadJson.input
          });
        }
      }
    }
    
    // 对比内容
    const demo3Content = response.data.choices?.[0]?.message?.content || '';
    const cwContentStr = cwContent.join('');
    
    if (demo3Content && cwContentStr) {
      const contentSimilarity = calculateSimilarity(demo3Content, cwContentStr);
      comparison.contentSimilarity = contentSimilarity;
      
      if (contentSimilarity < 0.5) {
        comparison.differences.push(`内容相似度较低: ${(contentSimilarity * 100).toFixed(1)}%`);
      }
    }
    
    // 对比工具调用
    const demo3ToolCalls = response.data.choices?.[0]?.message?.tool_calls || [];
    
    if (demo3ToolCalls.length !== cwToolCalls.length) {
      comparison.differences.push(`工具调用数量不同: demo3=${demo3ToolCalls.length}, cw=${cwToolCalls.length}`);
    }
    
    console.log(`    📊 内容相似度: ${comparison.contentSimilarity ? (comparison.contentSimilarity * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`    🔧 工具调用: demo3=${demo3ToolCalls.length}, cw=${cwToolCalls.length}`);
    
    return comparison;
    
  } catch (error) {
    console.log(`    ❌ demo3对比失败: ${error.message}`);
    return {
      error: error.message,
      available: false
    };
  }
}

/**
 * 计算文本相似度（简单的Jaccard相似度）
 */
function calculateSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * 生成黑盒测试报告
 */
function generateBlackboxReport(analyses) {
  const timestamp = new Date().toISOString();
  const reportFile = path.join(BLACKBOX_TEST_CONFIG.logDir, `blackbox-report-${timestamp.replace(/[:.]/g, '-')}.md`);
  
  let report = `# CodeWhisperer二进制数据黑盒测试报告\n\n`;
  report += `**分析时间**: ${timestamp}\n`;
  report += `**分析文件数**: ${analyses.length}\n`;
  report += `**数据来源**: 健康检查捕获的二进制响应\n\n`;
  
  // 总体分析
  const successfulAnalyses = analyses.filter(a => !a.error && a.structure);
  const demo3Comparisons = analyses.filter(a => a.demo3Comparison && !a.demo3Comparison.error);
  
  report += `## 📊 总体分析\n\n`;
  report += `- **成功解析**: ${successfulAnalyses.length}/${analyses.length}\n`;
  report += `- **demo3对比**: ${demo3Comparisons.length}个\n`;
  report += `- **AWS Event Stream格式**: ${successfulAnalyses.length > 0 ? '✅ 检测到' : '❌ 未检测到'}\n\n`;
  
  // 详细分析结果
  report += `## 🔍 详细分析结果\n\n`;
  
  for (const analysis of analyses) {
    report += `### ${analysis.file.name}\n\n`;
    report += `- **测试用例**: ${analysis.file.testCase}\n`;
    report += `- **文件大小**: ${analysis.file.size} bytes\n`;
    report += `- **错误响应**: ${analysis.file.isError ? '是' : '否'}\n`;
    
    if (analysis.error) {
      report += `- **分析状态**: ❌ 失败 - ${analysis.error}\n\n`;
      continue;
    }
    
    // 文本编码尝试
    const readableAttempts = analysis.textAttempts.filter(a => a.success && a.isReadable);
    if (readableAttempts.length > 0) {
      report += `- **可读编码**: ${readableAttempts.map(a => a.encoding).join(', ')}\n`;
    }
    
    // 发现的模式
    if (analysis.patterns.length > 0) {
      report += `- **发现的模式**:\n`;
      for (const pattern of analysis.patterns) {
        report += `  - ${pattern.name}: ${pattern.count}个匹配\n`;
      }
    }
    
    // 结构分析
    if (analysis.structure) {
      report += `- **结构格式**: ${analysis.structure.format}\n`;
      report += `- **事件数量**: ${analysis.structure.eventCount}\n`;
      report += `- **解析字节**: ${analysis.structure.totalParsedBytes}/${analysis.file.size}\n`;
      
      // 事件内容示例
      if (analysis.structure.events && analysis.structure.events.length > 0) {
        const firstEvent = analysis.structure.events[0];
        if (firstEvent.payloadJson) {
          report += `- **首个事件内容**: \`${JSON.stringify(firstEvent.payloadJson).substring(0, 100)}...\`\n`;
        }
      }
    }
    
    // demo3对比
    if (analysis.demo3Comparison) {
      if (analysis.demo3Comparison.error) {
        report += `- **demo3对比**: ❌ 失败 - ${analysis.demo3Comparison.error}\n`;
      } else {
        report += `- **demo3对比**: ✅ 成功\n`;
        if (analysis.demo3Comparison.contentSimilarity !== undefined) {
          report += `- **内容相似度**: ${(analysis.demo3Comparison.contentSimilarity * 100).toFixed(1)}%\n`;
        }
        if (analysis.demo3Comparison.differences.length > 0) {
          report += `- **主要差异**:\n`;
          for (const diff of analysis.demo3Comparison.differences) {
            report += `  - ${diff}\n`;
          }
        }
      }
    }
    
    report += `\n`;
  }
  
  // 问题诊断
  report += `## 🔧 问题诊断\n\n`;
  
  if (successfulAnalyses.length === 0) {
    report += `### ❌ 严重问题：无法解析任何二进制数据\n\n`;
    report += `**可能原因**:\n`;
    report += `- CodeWhisperer返回的不是标准AWS Event Stream格式\n`;
    report += `- 数据损坏或截断\n`;
    report += `- 编码问题\n\n`;
    report += `**建议**:\n`;
    report += `- 检查CodeWhisperer API调用是否正确\n`;
    report += `- 验证响应头的Content-Type\n`;
    report += `- 尝试不同的数据捕获方式\n`;
  } else {
    report += `### ✅ 数据格式正常\n\n`;
    report += `成功解析了AWS Event Stream格式的数据，说明CodeWhisperer的响应格式基本正确。\n\n`;
    
    if (demo3Comparisons.length > 0) {
      const avgSimilarity = demo3Comparisons
        .filter(a => a.demo3Comparison.contentSimilarity !== undefined)
        .reduce((sum, a) => sum + a.demo3Comparison.contentSimilarity, 0) / demo3Comparisons.length;
      
      if (avgSimilarity < 0.5) {
        report += `### ⚠️ 内容质量问题\n\n`;
        report += `平均内容相似度: ${(avgSimilarity * 100).toFixed(1)}%\n\n`;
        report += `**可能原因**:\n`;
        report += `- CodeWhisperer和demo3使用不同的模型\n`;
        report += `- 请求格式转换有问题\n`;
        report += `- 响应解析逻辑有误\n`;
      } else {
        report += `### ✅ 内容质量良好\n\n`;
        report += `平均内容相似度: ${(avgSimilarity * 100).toFixed(1)}%\n`;
      }
    }
  }
  
  // 修复建议
  report += `\n## 🛠️ 修复建议\n\n`;
  
  if (successfulAnalyses.length > 0) {
    report += `### 基于分析结果的建议\n\n`;
    
    // 检查是否有工具调用相关的问题
    const hasToolCallPatterns = analyses.some(a => 
      a.patterns && a.patterns.some(p => p.name === 'tool_call_pattern' && p.count > 0)
    );
    
    if (hasToolCallPatterns) {
      report += `1. **工具调用处理**: 检测到工具调用模式，验证工具调用解析逻辑\n`;
    }
    
    // 检查内容处理
    const hasContentPatterns = analyses.some(a => 
      a.patterns && a.patterns.some(p => p.name === 'content_pattern' && p.count > 0)
    );
    
    if (hasContentPatterns) {
      report += `2. **内容处理**: 检测到内容模式，验证文本内容提取逻辑\n`;
    }
    
    report += `3. **Parser优化**: 基于AWS Event Stream格式优化解析器\n`;
    report += `4. **格式转换**: 确保CodeWhisperer到Anthropic格式的转换正确\n`;
  } else {
    report += `### 基础修复建议\n\n`;
    report += `1. **数据捕获**: 重新捕获二进制数据，确保完整性\n`;
    report += `2. **格式验证**: 验证CodeWhisperer API返回的数据格式\n`;
    report += `3. **编码处理**: 检查数据编码和解码逻辑\n`;
  }
  
  report += `\n---\n`;
  report += `**报告生成时间**: ${timestamp}\n`;
  report += `**分析工具**: CodeWhisperer Binary Blackbox Test v1.0\n`;
  
  fs.writeFileSync(reportFile, report);
  console.log(`\n📄 黑盒测试报告已生成: ${reportFile}`);
  
  return reportFile;
}

/**
 * 主函数
 */
async function main() {
  console.log('🕵️ 开始CodeWhisperer二进制数据黑盒测试');
  console.log(`📁 二进制数据目录: ${BLACKBOX_TEST_CONFIG.binaryDataDir}`);
  console.log(`📁 日志目录: ${BLACKBOX_TEST_CONFIG.logDir}`);
  console.log(`💡 这是离线分析，不消耗token`);
  
  // 扫描二进制数据文件
  const binaryFiles = scanBinaryDataFiles();
  
  if (binaryFiles.length === 0) {
    console.log('\n❌ 没有找到二进制数据文件');
    console.log('请先运行健康检查脚本:');
    console.log('  ./scripts/test-codewhisperer-health-check.js');
    process.exit(1);
  }
  
  const analyses = [];
  
  // 分析每个二进制文件
  for (const binaryFile of binaryFiles) {
    const analysis = analyzeBinaryFile(binaryFile);
    
    // 如果解析成功，尝试与demo3对比
    if (analysis.structure && !analysis.error) {
      analysis.demo3Comparison = await compareWithDemo3(analysis);
    }
    
    analyses.push(analysis);
  }
  
  // 生成报告
  const reportFile = generateBlackboxReport(analyses);
  
  // 输出总结
  console.log('\n🎯 黑盒测试总结:');
  const successfulAnalyses = analyses.filter(a => !a.error && a.structure);
  const demo3Comparisons = analyses.filter(a => a.demo3Comparison && !a.demo3Comparison.error);
  
  console.log(`  📊 成功解析: ${successfulAnalyses.length}/${analyses.length}`);
  console.log(`  🔄 demo3对比: ${demo3Comparisons.length}个`);
  console.log(`  📄 详细报告: ${reportFile}`);
  
  if (successfulAnalyses.length > 0) {
    console.log('\n✅ 数据格式分析成功！');
    console.log('   CodeWhisperer返回的是有效的AWS Event Stream格式');
    console.log('   可以基于分析结果优化parser实现');
  } else {
    console.log('\n❌ 数据格式分析失败');
    console.log('   需要检查数据捕获和解析逻辑');
  }
  
  // 根据结果设置退出码
  const overallSuccess = successfulAnalyses.length > 0;
  process.exit(overallSuccess ? 0 : 1);
}

// 执行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 黑盒测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  scanBinaryDataFiles,
  analyzeBinaryFile,
  parseAWSEventStream,
  compareWithDemo3,
  generateBlackboxReport
};