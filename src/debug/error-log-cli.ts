#!/usr/bin/env node

/**
 * 错误日志CLI工具
 * 
 * 提供命令行界面来查看和管理错误日志
 * 
 * 使用方法:
 * npm run error-logs summary
 * npm run error-logs stats
 * npm run error-logs pipelines
 * npm run error-logs cleanup --days 7
 * 
 * @author RCC v4.0 - Debug System Enhancement
 */

import { program } from 'commander';
import { getErrorLogManager, ErrorType } from './error-log-manager';
import { getEnhancedErrorHandler } from './enhanced-error-handler';
import { JQJsonHandler } from '../utils/jq-json-handler';
import { secureLogger } from '../utils/secure-logger';

program
  .name('rcc4-error-logs')
  .description('RCC4 错误日志管理工具')
  .version('1.0.0');

// 安全的输出函数（用于CLI显示）
function cliOutput(message: string): void {
  process.stdout.write(message + '\n');
}

function cliError(message: string): void {
  process.stderr.write('❌ ' + message + '\n');
}

// 显示错误统计
program
  .command('stats')
  .description('显示错误统计信息')
  .option('-d, --days <number>', '统计天数', '1')
  .action(async (options) => {
    const handler = getEnhancedErrorHandler();
    const stats = handler.getErrorStatistics();
    
    if (!stats) {
      cliError('错误日志管理器未启用');
      secureLogger.warn('Error log manager not enabled for stats command');
      process.exit(1);
      return;
    }

    cliOutput('\n📊 错误统计信息');
    cliOutput('==================');
    cliOutput(`总错误数: ${stats.totalErrors}`);
    
    cliOutput('\n按类型分类:');
    Object.entries(stats.errorsByType).forEach(([type, count]) => {
      if (typeof count === 'number' && count > 0) {
        cliOutput(`  ${getTypeIcon(type as ErrorType)} ${type}: ${count}`);
      }
    });

    cliOutput('\n按流水线分类:');
    Object.entries(stats.errorsByPipeline)
      .sort((a, b) => (typeof b[1] === 'number' ? b[1] : 0) - (typeof a[1] === 'number' ? a[1] : 0))
      .slice(0, 10)
      .forEach(([pipeline, count]) => {
        cliOutput(`  🔧 ${pipeline}: ${count}`);
      });

    secureLogger.info('Error stats command completed', {
      totalErrors: stats.totalErrors,
      uniquePipelines: Object.keys(stats.errorsByPipeline).length
    });
  });

// 生成错误摘要报告
program
  .command('summary')
  .description('生成错误摘要报告')
  .option('-h, --hours <number>', '报告时间范围(小时)', '24')
  .option('-s, --save', '保存报告到文件')
  .action(async (options) => {
    const handler = getEnhancedErrorHandler();
    const hours = parseInt(options.hours);
    const endTime = Date.now();
    const startTime = endTime - (hours * 60 * 60 * 1000);

    cliOutput(`\n🔍 正在生成 ${hours} 小时错误摘要报告...`);
    
    const report = await handler.generateErrorSummary(startTime, endTime);
    
    cliOutput('\n📋 错误摘要报告');
    cliOutput('================');
    cliOutput(`报告ID: ${report.reportId}`);
    cliOutput(`时间范围: ${new Date(report.timeRange.startTime).toLocaleString()} - ${new Date(report.timeRange.endTime).toLocaleString()}`);
    cliOutput(`总错误数: ${report.statistics.totalErrors}`);

    // 显示按类型分类的错误
    cliOutput('\n📈 错误分类统计:');
    Object.entries(report.statistics.errorsByType).forEach(([type, count]) => {
      if (typeof count === 'number' && count > 0) {
        cliOutput(`  ${getTypeIcon(type as ErrorType)} ${type}: ${count}`);
      }
    });

    // 显示TOP错误
    if (report.statistics.topErrors.length > 0) {
      cliOutput('\n🔥 高频错误 (TOP 5):');
      report.statistics.topErrors.slice(0, 5).forEach((error, index) => {
        cliOutput(`  ${index + 1}. ${error.message.substring(0, 60)}... (${error.count}次)`);
      });
    }

    // 显示问题流水线
    if (report.statistics.problemPipelines.length > 0) {
      cliOutput('\n⚠️  问题流水线:');
      report.statistics.problemPipelines.forEach(pipeline => {
        cliOutput(`  🔧 ${pipeline.pipelineId}: ${pipeline.errorCount}错误 (${(pipeline.errorRate * 100).toFixed(1)}%)`);
      });
    }

    // 显示建议
    if (report.recommendations.length > 0) {
      cliOutput('\n💡 处理建议:');
      report.recommendations.forEach((rec, index) => {
        const priorityIcon = rec.priority === 'high' ? '🚨' : rec.priority === 'medium' ? '⚠️' : 'ℹ️';
        cliOutput(`  ${index + 1}. ${priorityIcon} [${rec.type}] ${rec.message}`);
        if (rec.affectedPipelines?.length) {
          cliOutput(`     影响流水线: ${rec.affectedPipelines.join(', ')}`);
        }
      });
    }

    // 保存报告
    if (options.save) {
      const fs = require('fs').promises;
      const filename = `error-report-${Date.now()}.json`;
      await fs.writeFile(filename, JQJsonHandler.stringifyJson(report, false));
      cliOutput(`\n💾 报告已保存: ${filename}`);
      
      secureLogger.info('Error report saved', {
        filename,
        reportId: report.reportId,
        totalErrors: report.statistics.totalErrors
      });
    }

    secureLogger.info('Error summary command completed', {
      reportId: report.reportId,
      hours,
      totalErrors: report.statistics.totalErrors
    });
  });

// 显示流水线健康状况
program
  .command('pipelines')
  .description('显示流水线错误状况')
  .option('-t, --threshold <number>', '错误阈值', '5')
  .action(async (options) => {
    const handler = getEnhancedErrorHandler();
    const stats = handler.getErrorStatistics();
    
    if (!stats) {
      cliError('错误日志管理器未启用');
      secureLogger.warn('Error log manager not enabled for pipelines command');
      process.exit(1);
      return;
    }

    const threshold = parseInt(options.threshold);
    
    cliOutput('\n🏥 流水线健康状况');
    cliOutput('==================');

    const problemPipelines = Object.entries(stats.errorsByPipeline)
      .filter(([, count]) => typeof count === 'number' && count >= threshold)
      .sort((a, b) => (typeof b[1] === 'number' ? b[1] : 0) - (typeof a[1] === 'number' ? a[1] : 0));

    if (problemPipelines.length === 0) {
      cliOutput(`✅ 没有发现错误数超过 ${threshold} 的流水线`);
      secureLogger.info('No problematic pipelines found', { threshold });
      return;
    }

    cliOutput(`⚠️  发现 ${problemPipelines.length} 个问题流水线 (错误数 >= ${threshold}):\n`);

    problemPipelines.forEach(([pipelineId, errorCount], index) => {
      const count = typeof errorCount === 'number' ? errorCount : 0;
      const status = count >= 20 ? '🚨 严重' : count >= 10 ? '⚠️ 警告' : '💡 关注';
      cliOutput(`${index + 1}. ${status} ${pipelineId}`);
      cliOutput(`   错误数: ${count}`);
      cliOutput(`   建议: ${getSuggestion(count)}\n`);
    });

    secureLogger.info('Pipelines health check completed', {
      threshold,
      problemPipelinesCount: problemPipelines.length,
      problemPipelines: problemPipelines.map(([id, count]) => ({ id, errorCount: count }))
    });
  });

// 清理过期日志
program
  .command('cleanup')
  .description('清理过期错误日志')
  .option('-d, --days <number>', '保留天数', '7')
  .action(async (options) => {
    const handler = getEnhancedErrorHandler();
    const days = parseInt(options.days);
    
    cliOutput(`\n🧹 正在清理 ${days} 天前的错误日志...`);
    
    const cleanedCount = await handler.cleanupLogs(days);
    
    cliOutput(`✅ 清理完成，删除了 ${cleanedCount} 条过期记录`);

    secureLogger.info('Error log cleanup completed', {
      retentionDays: days,
      cleanedRecords: cleanedCount
    });
  });

// 获取错误类型图标
function getTypeIcon(type: ErrorType): string {
  const icons: Record<ErrorType, string> = {
    [ErrorType.SERVER_ERROR]: '🖥️',
    [ErrorType.FILTER_ERROR]: '🔍',
    [ErrorType.SOCKET_ERROR]: '🔌',
    [ErrorType.TIMEOUT_ERROR]: '⏰',
    [ErrorType.PIPELINE_ERROR]: '🔧',
    [ErrorType.CONNECTION_ERROR]: '🌐',
    [ErrorType.TRANSFORM_ERROR]: '🔄',
    [ErrorType.AUTH_ERROR]: '🔑',
    [ErrorType.VALIDATION_ERROR]: '✅',
    [ErrorType.RATE_LIMIT_ERROR]: '🚦',
    [ErrorType.UNKNOWN_ERROR]: '❓'
  };
  
  return icons[type] || '❓';
}

// 获取建议
function getSuggestion(errorCount: number): string {
  if (errorCount >= 50) {
    return '立即停用此流水线并检查配置';
  } else if (errorCount >= 20) {
    return '考虑临时拉黑此流水线';
  } else if (errorCount >= 10) {
    return '需要调查错误原因';
  } else {
    return '密切监控错误趋势';
  }
}

// 如果直接运行此脚本，则解析命令行参数
if (require.main === module) {
  program.parse();
}

export { program };