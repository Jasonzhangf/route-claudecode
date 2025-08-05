#!/usr/bin/env node

/**
 * 修复Legacy日志问题
 * 分析和清理根目录下的legacy日志文件
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const LOGS_DIR = path.join(os.homedir(), '.route-claude-code', 'logs');

async function analyzeLogFiles() {
  console.log('🔍 分析日志文件结构...\n');
  
  try {
    const files = await fs.promises.readdir(LOGS_DIR);
    
    const legacyFiles = [];
    const portDirs = [];
    const otherFiles = [];
    
    for (const file of files) {
      const filePath = path.join(LOGS_DIR, file);
      const stats = await fs.promises.stat(filePath);
      
      if (stats.isDirectory()) {
        if (file.startsWith('port-')) {
          portDirs.push(file);
        } else {
          otherFiles.push(file);
        }
      } else {
        if (file.includes('ccr-session')) {
          legacyFiles.push(file);
        } else {
          otherFiles.push(file);
        }
      }
    }
    
    console.log('📊 日志文件统计:');
    console.log(`  - Legacy日志文件: ${legacyFiles.length}`);
    console.log(`  - 端口目录: ${portDirs.length}`);
    console.log(`  - 其他文件: ${otherFiles.length}`);
    console.log('');
    
    if (legacyFiles.length > 0) {
      console.log('🚨 发现Legacy日志文件:');
      for (const file of legacyFiles) {
        const filePath = path.join(LOGS_DIR, file);
        const stats = await fs.promises.stat(filePath);
        const sizeKB = Math.round(stats.size / 1024);
        console.log(`  - ${file} (${sizeKB}KB, ${stats.mtime.toLocaleString()})`);
      }
      console.log('');
    }
    
    if (portDirs.length > 0) {
      console.log('✅ 端口目录结构:');
      for (const dir of portDirs) {
        const dirPath = path.join(LOGS_DIR, dir);
        const subFiles = await fs.promises.readdir(dirPath);
        console.log(`  - ${dir}/ (${subFiles.length} files)`);
      }
      console.log('');
    }
    
    return { legacyFiles, portDirs, otherFiles };
    
  } catch (error) {
    console.error('❌ 分析日志文件失败:', error.message);
    return null;
  }
}

async function analyzeLegacyLogContent() {
  console.log('🔍 分析Legacy日志内容...\n');
  
  try {
    const files = await fs.promises.readdir(LOGS_DIR);
    const legacyFiles = files.filter(f => f.includes('ccr-session'));
    
    for (const file of legacyFiles) {
      const filePath = path.join(LOGS_DIR, file);
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length > 0) {
        console.log(`📄 ${file}:`);
        
        // 分析第一行和最后一行
        try {
          const firstLine = JSON.parse(lines[0]);
          const lastLine = JSON.parse(lines[lines.length - 1]);
          
          console.log(`  - 时间范围: ${firstLine.timestamp} ~ ${lastLine.timestamp}`);
          
          // 统计serverType
          const serverTypes = new Set();
          for (let i = 0; i < Math.min(10, lines.length); i++) {
            try {
              const log = JSON.parse(lines[i]);
              if (log.data && log.data.serverType) {
                serverTypes.add(log.data.serverType);
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
          
          if (serverTypes.size > 0) {
            console.log(`  - Server类型: ${Array.from(serverTypes).join(', ')}`);
          }
          
          console.log(`  - 总行数: ${lines.length}`);
          
        } catch (e) {
          console.log(`  - 格式: 无法解析JSON`);
          console.log(`  - 总行数: ${lines.length}`);
        }
        
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('❌ 分析Legacy日志内容失败:', error.message);
  }
}

async function identifyLogSource() {
  console.log('🔍 识别日志来源...\n');
  
  try {
    const files = await fs.promises.readdir(LOGS_DIR);
    const legacyFiles = files.filter(f => f.includes('ccr-session'));
    
    for (const file of legacyFiles) {
      const filePath = path.join(LOGS_DIR, file);
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim()).slice(0, 20); // 只看前20行
      
      console.log(`🔍 ${file} 来源分析:`);
      
      const patterns = {
        sessionStart: /session started/i,
        serverType: /serverType.*?(dev|release)/i,
        provider: /provider.*?initialized/i,
        port: /port.*?(\d+)/i,
        dualConfig: /dual.*?config/i
      };
      
      const findings = {};
      
      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          const message = log.message || '';
          const data = log.data || {};
          
          // 检查各种模式
          for (const [key, pattern] of Object.entries(patterns)) {
            if (pattern.test(message) || pattern.test(JSON.stringify(data))) {
              if (!findings[key]) findings[key] = [];
              findings[key].push({ message, data });
            }
          }
          
        } catch (e) {
          // Skip invalid JSON
        }
      }
      
      // 输出发现
      for (const [key, matches] of Object.entries(findings)) {
        console.log(`  - ${key}: ${matches.length} 条记录`);
        if (matches.length > 0 && matches[0].data) {
          const sample = matches[0].data;
          if (sample.serverType) console.log(`    serverType: ${sample.serverType}`);
          if (sample.port) console.log(`    port: ${sample.port}`);
        }
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ 识别日志来源失败:', error.message);
  }
}

async function suggestCleanup() {
  console.log('🧹 清理建议...\n');
  
  try {
    const files = await fs.promises.readdir(LOGS_DIR);
    const legacyFiles = files.filter(f => f.includes('ccr-session'));
    
    if (legacyFiles.length === 0) {
      console.log('✅ 没有发现Legacy日志文件，无需清理');
      return;
    }
    
    let totalSize = 0;
    const oldFiles = [];
    const recentFiles = [];
    
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24小时前
    
    for (const file of legacyFiles) {
      const filePath = path.join(LOGS_DIR, file);
      const stats = await fs.promises.stat(filePath);
      totalSize += stats.size;
      
      if (stats.mtime.getTime() < cutoffTime) {
        oldFiles.push(file);
      } else {
        recentFiles.push(file);
      }
    }
    
    console.log('📊 清理统计:');
    console.log(`  - Legacy文件总数: ${legacyFiles.length}`);
    console.log(`  - 总大小: ${Math.round(totalSize / 1024)}KB`);
    console.log(`  - 超过24小时的文件: ${oldFiles.length}`);
    console.log(`  - 最近24小时的文件: ${recentFiles.length}`);
    console.log('');
    
    if (oldFiles.length > 0) {
      console.log('🗑️ 可以安全删除的文件:');
      for (const file of oldFiles) {
        console.log(`  - ${file}`);
      }
      console.log('');
    }
    
    if (recentFiles.length > 0) {
      console.log('⚠️ 最近创建的文件 (建议检查后删除):');
      for (const file of recentFiles) {
        console.log(`  - ${file}`);
      }
      console.log('');
    }
    
    // 生成清理命令
    if (legacyFiles.length > 0) {
      console.log('🔧 清理命令:');
      console.log('# 删除所有Legacy日志文件');
      for (const file of legacyFiles) {
        console.log(`rm "${path.join(LOGS_DIR, file)}"`);
      }
      console.log('');
      
      console.log('# 或者一次性删除所有');
      console.log(`rm "${LOGS_DIR}"/ccr-session-*.log`);
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ 生成清理建议失败:', error.message);
  }
}

async function checkLogSources() {
  console.log('🔍 检查可能的日志来源...\n');
  
  // 检查CLI中的logger配置
  const cliPath = path.join(__dirname, 'src', 'cli.ts');
  if (fs.existsSync(cliPath)) {
    const cliContent = fs.readFileSync(cliPath, 'utf8');
    
    console.log('📄 CLI中的日志配置:');
    
    // 查找logger.setConfig调用
    const setConfigMatches = cliContent.match(/logger\.setConfig\([^)]+\)/g);
    if (setConfigMatches) {
      console.log(`  - 发现 ${setConfigMatches.length} 个 logger.setConfig 调用`);
      setConfigMatches.forEach(match => console.log(`    ${match}`));
    } else {
      console.log('  - 未发现 logger.setConfig 调用');
    }
    
    // 查找logDir设置
    const logDirMatches = cliContent.match(/logDir.*?=/g);
    if (logDirMatches) {
      console.log(`  - 发现 ${logDirMatches.length} 个 logDir 设置`);
    }
    
    console.log('');
  }
  
  // 检查是否有其他地方创建session日志
  console.log('📄 搜索可能的日志创建代码...');
  
  const searchPatterns = [
    'ccr-session',
    'createLogger',
    'session.*log',
    'debug.*logDir'
  ];
  
  // 这里应该搜索源代码，但为了简化，先输出建议
  console.log('  建议手动检查以下位置:');
  console.log('  - src/cli.ts (logger.setConfig调用)');
  console.log('  - src/server.ts (RouterServer构造函数)');
  console.log('  - src/utils/logger.ts (兼容层)');
  console.log('  - 任何使用serverType参数的地方');
  console.log('');
}

async function main() {
  console.log('🚀 Legacy日志分析和修复工具\n');
  console.log('='.repeat(50));
  console.log('');
  
  // 1. 分析日志文件结构
  const analysis = await analyzeLogFiles();
  if (!analysis) return;
  
  // 2. 分析Legacy日志内容
  if (analysis.legacyFiles.length > 0) {
    await analyzeLegacyLogContent();
    await identifyLogSource();
  }
  
  // 3. 检查日志来源
  await checkLogSources();
  
  // 4. 建议清理
  await suggestCleanup();
  
  console.log('🎯 总结和建议:');
  console.log('');
  
  if (analysis.legacyFiles.length > 0) {
    console.log('❌ 发现Legacy日志问题:');
    console.log('  1. 根目录下仍有ccr-session-*.log文件');
    console.log('  2. 这些文件应该按端口分类到port-*目录下');
    console.log('  3. 需要修复日志系统配置');
    console.log('');
    
    console.log('🔧 修复步骤:');
    console.log('  1. 删除根目录下的legacy日志文件');
    console.log('  2. 检查CLI中的logger.setConfig调用');  
    console.log('  3. 确保所有服务器都使用统一日志系统');
    console.log('  4. 验证端口目录日志正常工作');
    console.log('');
  } else {
    console.log('✅ 未发现Legacy日志问题');
    console.log('  - 所有日志都按端口正确分类');
    console.log('  - 统一日志系统工作正常');
    console.log('');
  }
  
  console.log('✅ 分析完成');
}

// 执行分析
main().catch(error => {
  console.error('❌ 分析失败:', error);
  process.exit(1);
});