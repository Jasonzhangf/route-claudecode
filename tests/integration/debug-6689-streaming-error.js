/**
 * 6689端口streaming error诊断脚本
 * 分析反复出现的streaming错误问题
 */

const fs = require('fs').promises;
const path = require('path');

async function analyze6689StreamingErrors() {
  console.log('🔍 分析6689端口streaming错误...\n');

  const logDir = path.join(process.env.HOME, '.route-claude-code', 'logs', 'port-6689');
  
  try {
    // 获取最新的日志目录
    const dirs = await fs.readdir(logDir);
    const latestDir = dirs.filter(d => d.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/)).sort().pop();
    
    if (!latestDir) {
      console.log('❌ 没有找到有效的日志目录');
      return;
    }

    const latestLogDir = path.join(logDir, latestDir);
    console.log(`📁 分析日志目录: ${latestDir}`);

    // 分析错误日志
    const errorLogPath = path.join(latestLogDir, 'error.log');
    try {
      const errorContent = await fs.readFile(errorLogPath, 'utf-8');
      const errorLines = errorContent.trim().split('\n').filter(line => line.trim());
      
      console.log(`\n📊 错误统计:`);
      console.log(`总错误数: ${errorLines.length}`);

      // 分析错误类型
      const errorTypes = {};
      const httpCodes = {};
      const providers = {};
      const requestIds = new Set();

      for (const line of errorLines) {
        try {
          const entry = JSON.parse(line);
          
          // 收集请求ID
          if (entry.requestId) {
            requestIds.add(entry.requestId);
          }

          // 分析错误数据
          if (entry.data && entry.data.error) {
            const error = entry.data.error;
            
            // HTTP状态码统计
            if (error.status) {
              httpCodes[error.status] = (httpCodes[error.status] || 0) + 1;
            }

            // 提供商统计
            if (error.provider) {
              providers[error.provider] = (providers[error.provider] || 0) + 1;
            }

            // 错误代码统计
            if (error.code) {
              errorTypes[error.code] = (errorTypes[error.code] || 0) + 1;
            }

            // 分析具体错误信息
            if (error.message && error.message.includes('ERR_BAD_REQUEST')) {
              console.log(`\n🚨 发现ERR_BAD_REQUEST错误:`);
              console.log(`时间: ${entry.beijingTime}`);
              console.log(`请求ID: ${entry.requestId}`);
              console.log(`提供商: ${error.provider}`);
              console.log(`HTTP状态: ${error.status}`);
              
              // 检查是否有超长payload
              if (error.message.length > 1000) {
                console.log(`⚠️  错误消息异常长 (${error.message.length} 字符)`);
                console.log(`消息开头: ${error.message.substring(0, 200)}...`);
                
                // 检查是否包含工具定义
                if (error.message.includes('function') && error.message.includes('parameters')) {
                  console.log(`🔧 错误消息包含工具定义，可能是payload过大问题`);
                }
              }
            }
          }
        } catch (parseError) {
          // 忽略解析错误
        }
      }

      console.log(`\n📈 错误类型分布:`);
      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}次`);
      });

      console.log(`\n🌐 HTTP状态码分布:`);
      Object.entries(httpCodes).forEach(([code, count]) => {
        console.log(`  ${code}: ${count}次`);
      });

      console.log(`\n🏢 提供商错误分布:`);
      Object.entries(providers).forEach(([provider, count]) => {
        console.log(`  ${provider}: ${count}次`);
      });

      console.log(`\n🆔 影响的请求数: ${requestIds.size}`);

    } catch (error) {
      console.log(`❌ 无法读取错误日志: ${error.message}`);
    }

    // 分析系统日志
    const systemLogPath = path.join(latestLogDir, 'system.log');
    try {
      const systemContent = await fs.readFile(systemLogPath, 'utf-8');
      const systemLines = systemContent.trim().split('\n').filter(line => line.trim());
      
      console.log(`\n📋 系统日志分析:`);
      console.log(`系统日志条数: ${systemLines.length}`);

      // 查找streaming相关的日志
      const streamingLogs = systemLines.filter(line => 
        line.includes('streaming') || line.includes('stream') || line.includes('SSE')
      );

      if (streamingLogs.length > 0) {
        console.log(`🌊 Streaming相关日志: ${streamingLogs.length}条`);
        
        // 显示最近的几条streaming日志
        console.log(`\n最近的streaming日志:`);
        streamingLogs.slice(-3).forEach((log, index) => {
          try {
            const entry = JSON.parse(log);
            console.log(`  ${index + 1}. [${entry.beijingTime}] ${entry.message}`);
            if (entry.data) {
              console.log(`     数据: ${JSON.stringify(entry.data).substring(0, 100)}...`);
            }
          } catch (error) {
            console.log(`  ${index + 1}. ${log.substring(0, 100)}...`);
          }
        });
      }

    } catch (error) {
      console.log(`⚠️  无法读取系统日志: ${error.message}`);
    }

    // 检查请求日志
    const requestLogPath = path.join(latestLogDir, 'request.log');
    try {
      const requestContent = await fs.readFile(requestLogPath, 'utf-8');
      const requestLines = requestContent.trim().split('\n').filter(line => line.trim());
      
      console.log(`\n📨 请求日志分析:`);
      console.log(`请求日志条数: ${requestLines.length}`);

      // 分析最近的请求
      const recentRequests = requestLines.slice(-5);
      console.log(`\n最近的请求:`);
      
      recentRequests.forEach((log, index) => {
        try {
          const entry = JSON.parse(log);
          console.log(`  ${index + 1}. [${entry.beijingTime}] ${entry.message}`);
          if (entry.data && entry.data.model) {
            console.log(`     模型: ${entry.data.model}`);
          }
          if (entry.data && entry.data.tools) {
            console.log(`     工具数量: ${entry.data.tools.length}`);
            
            // 检查工具定义大小
            const toolsSize = JSON.stringify(entry.data.tools).length;
            if (toolsSize > 10000) {
              console.log(`     ⚠️  工具定义过大: ${toolsSize} 字符`);
            }
          }
        } catch (error) {
          console.log(`  ${index + 1}. ${log.substring(0, 100)}...`);
        }
      });

    } catch (error) {
      console.log(`⚠️  无法读取请求日志: ${error.message}`);
    }

  } catch (error) {
    console.log(`❌ 分析失败: ${error.message}`);
  }

  console.log(`\n💡 问题诊断建议:`);
  console.log(`1. 检查工具定义是否过大，可能导致请求payload超限`);
  console.log(`2. 验证shuaihong-openai提供商的endpoint是否正常`);
  console.log(`3. 检查streaming请求的格式是否符合OpenAI API规范`);
  console.log(`4. 考虑添加请求大小限制和工具定义优化`);
  
  console.log(`\n🔧 建议的修复步骤:`);
  console.log(`1. 测试shuaihong-openai endpoint的可用性`);
  console.log(`2. 检查工具调用payload的大小限制`);
  console.log(`3. 添加更好的错误处理和重试机制`);
  console.log(`4. 优化工具定义，减少不必要的描述文本`);
}

// 运行分析
analyze6689StreamingErrors().catch(console.error);