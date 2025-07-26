#!/usr/bin/env node

/**
 * 节点数据捕获系统
 * 为每个流水线节点保存完整的输入输出数据
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const { homedir } = require('os');

class NodeDataCapture {
  constructor() {
    this.debugDir = path.join(homedir(), '.claude-code-router', 'debug');
    this.ensureDebugDirectories();
  }

  ensureDebugDirectories() {
    const dirs = [
      path.join(this.debugDir, 'input'),
      path.join(this.debugDir, 'routing'), 
      path.join(this.debugDir, 'converter'),
      path.join(this.debugDir, 'provider'),
      path.join(this.debugDir, 'output')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  captureNodeData(nodeType, requestId, input, output, metadata = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${nodeType}-${requestId}-${timestamp}.json`;
    const filepath = path.join(this.debugDir, nodeType, filename);

    const data = {
      requestId,
      timestamp: new Date().toISOString(),
      nodeType,
      input,
      output,
      metadata: {
        duration: Date.now() - (metadata.startTime || Date.now()),
        success: metadata.success !== false,
        error: metadata.error || null,
        ...metadata
      }
    };

    try {
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
      console.log(`📊 [${nodeType.toUpperCase()}] 数据已保存: ${filename}`);
      return filepath;
    } catch (error) {
      console.error(`❌ 保存${nodeType}节点数据失败:`, error.message);
      return null;
    }
  }

  captureProviderData(requestId, provider, request, rawResponse, parsedResponse, metadata = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 保存结构化数据
    const structuredFile = `provider-${provider}-${requestId}-${timestamp}.json`;
    const structuredPath = path.join(this.debugDir, 'provider', structuredFile);
    
    const structuredData = {
      requestId,
      timestamp: new Date().toISOString(),
      nodeType: 'provider',
      provider,
      apiCall: {
        request,
        parsedResponse,
        httpStatus: metadata.httpStatus || null,
        headers: metadata.headers || {}
      },
      timing: {
        requestSent: metadata.requestSent || null,
        responseReceived: metadata.responseReceived || null,
        totalDuration: metadata.totalDuration || null
      },
      success: metadata.success !== false,
      error: metadata.error || null
    };

    // 保存原始二进制响应
    if (rawResponse) {
      const binaryFile = `provider-raw-${provider}-${requestId}-${timestamp}.bin`;
      const binaryPath = path.join(this.debugDir, 'provider', binaryFile);
      
      try {
        fs.writeFileSync(binaryPath, rawResponse);
        structuredData.rawResponseFile = binaryFile;
        console.log(`💾 [PROVIDER] 原始响应已保存: ${binaryFile} (${rawResponse.length} bytes)`);
      } catch (error) {
        console.error(`❌ 保存原始响应失败:`, error.message);
      }
    }

    try {
      fs.writeFileSync(structuredPath, JSON.stringify(structuredData, null, 2));
      console.log(`📊 [PROVIDER] 结构化数据已保存: ${structuredFile}`);
      return { structuredPath, binaryPath: rawResponse ? path.join(this.debugDir, 'provider', structuredData.rawResponseFile) : null };
    } catch (error) {
      console.error(`❌ 保存提供商数据失败:`, error.message);
      return null;
    }
  }

  getNodeDataFiles(requestId, nodeType = null) {
    const searchDirs = nodeType ? [nodeType] : ['input', 'routing', 'converter', 'provider', 'output'];
    const files = [];

    searchDirs.forEach(dir => {
      const dirPath = path.join(this.debugDir, dir);
      if (fs.existsSync(dirPath)) {
        const dirFiles = fs.readdirSync(dirPath)
          .filter(file => file.includes(requestId))
          .map(file => ({
            nodeType: dir,
            filename: file,
            filepath: path.join(dirPath, file),
            timestamp: this.extractTimestamp(file)
          }));
        files.push(...dirFiles);
      }
    });

    return files.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  extractTimestamp(filename) {
    const match = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
    return match ? match[1].replace(/-/g, ':').replace(/T(\d{2}):(\d{2}):(\d{2}):(\d{3})Z/, 'T$1:$2:$3.$4Z') : null;
  }

  analyzePipelineData(requestId) {
    console.log(`🔍 分析请求 ${requestId} 的流水线数据...\n`);
    
    const files = this.getNodeDataFiles(requestId);
    if (files.length === 0) {
      console.log(`❌ 未找到请求 ${requestId} 的数据文件`);
      return null;
    }

    const analysis = {
      requestId,
      totalFiles: files.length,
      nodes: {},
      timeline: [],
      issues: []
    };

    files.forEach(file => {
      try {
        const data = JSON.parse(fs.readFileSync(file.filepath, 'utf8'));
        
        if (!analysis.nodes[file.nodeType]) {
          analysis.nodes[file.nodeType] = [];
        }
        analysis.nodes[file.nodeType].push(data);

        analysis.timeline.push({
          timestamp: data.timestamp,
          nodeType: file.nodeType,
          success: data.metadata?.success || data.success,
          duration: data.metadata?.duration || data.timing?.totalDuration,
          error: data.metadata?.error || data.error
        });

        // 检查问题
        if (data.metadata?.success === false || data.success === false) {
          analysis.issues.push({
            nodeType: file.nodeType,
            error: data.metadata?.error || data.error,
            timestamp: data.timestamp
          });
        }

      } catch (error) {
        console.error(`❌ 解析文件失败 ${file.filename}:`, error.message);
      }
    });

    // 按时间排序
    analysis.timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    this.printAnalysis(analysis);
    return analysis;
  }

  printAnalysis(analysis) {
    console.log(`📊 流水线数据分析结果:`);
    console.log(`   请求ID: ${analysis.requestId}`);
    console.log(`   数据文件数: ${analysis.totalFiles}`);
    console.log(`   涉及节点: ${Object.keys(analysis.nodes).join(', ')}`);
    console.log(`   发现问题: ${analysis.issues.length}个\n`);

    if (analysis.issues.length > 0) {
      console.log(`❌ 发现的问题:`);
      analysis.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. [${issue.nodeType.toUpperCase()}] ${issue.error}`);
      });
      console.log();
    }

    console.log(`⏱️ 时间线:`);
    analysis.timeline.forEach((event, index) => {
      const status = event.success ? '✅' : '❌';
      const duration = event.duration ? `(${event.duration}ms)` : '';
      console.log(`   ${index + 1}. ${status} [${event.nodeType.toUpperCase()}] ${duration}`);
    });
  }

  cleanup(olderThanHours = 24) {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    let cleaned = 0;

    ['input', 'routing', 'converter', 'provider', 'output'].forEach(nodeType => {
      const dir = path.join(this.debugDir, nodeType);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filepath = path.join(dir, file);
          const stat = fs.statSync(filepath);
          if (stat.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filepath);
            cleaned++;
          }
        });
      }
    });

    console.log(`🧹 清理了${cleaned}个旧的调试文件`);
  }
}

// 创建单例实例
const nodeDataCapture = new NodeDataCapture();

// CLI使用方式
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const requestId = args[1];

  switch (command) {
    case 'analyze':
      if (!requestId) {
        console.error('用法: node debug-node-data-capture.js analyze <requestId>');
        process.exit(1);
      }
      nodeDataCapture.analyzePipelineData(requestId);
      break;

    case 'cleanup':
      const hours = parseInt(args[1]) || 24;
      nodeDataCapture.cleanup(hours);
      break;

    case 'list':
      if (!requestId) {
        console.error('用法: node debug-node-data-capture.js list <requestId>');
        process.exit(1);
      }
      const files = nodeDataCapture.getNodeDataFiles(requestId);
      console.log(`找到${files.length}个数据文件:`);
      files.forEach(file => {
        console.log(`  ${file.nodeType}: ${file.filename}`);
      });
      break;

    default:
      console.log('用法:');
      console.log('  node debug-node-data-capture.js analyze <requestId>  - 分析流水线数据');
      console.log('  node debug-node-data-capture.js list <requestId>     - 列出数据文件');
      console.log('  node debug-node-data-capture.js cleanup [hours]     - 清理旧文件');
  }
}

module.exports = { NodeDataCapture, nodeDataCapture };