#!/usr/bin/env node

/**
 * CodeWhisperer Debug CLI
 * Command-line interface for data capture analysis and debugging
 * 
 * Project Owner: Jason Zhang
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  getCaptureStats,
  listCapturedFiles,
  findRelatedCaptures,
  cleanupOldCaptures,
  loadCapturedData 
} from './data-capture';
import { 
  generateAnalysisReport,
  generateCaptureSummary,
  saveAnalysisReport 
} from './analysis-tools';

interface CliOptions {
  command: string;
  requestId?: string;
  days?: number;
  output?: string;
  stage?: string;
  verbose?: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    command: args[0] || 'help'
  };
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--request-id' || arg === '-r') {
      options.requestId = args[++i];
    } else if (arg === '--days' || arg === '-d') {
      options.days = parseInt(args[++i]) || 1;
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--stage' || arg === '-s') {
      options.stage = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }
  
  return options;
}

function showHelp(): void {
  console.log(`
CodeWhisperer Debug CLI
=======================

Usage: node debug-cli.js <command> [options]

Commands:
  stats                     Show capture statistics
  list [--stage=<stage>]    List captured files
  analyze --request-id=<id> Generate analysis report for a request
  summary [--days=<n>]      Show summary of recent captures
  cleanup [--days=<n>]      Clean up old capture files
  export --request-id=<id>  Export all data for a request
  help                      Show this help

Options:
  --request-id, -r <id>     Request ID to analyze
  --days, -d <n>           Number of days (default: 1)
  --stage, -s <stage>      Filter by stage (auth|conversion|http|parsing|tool_processing)
  --output, -o <file>      Output file path
  --verbose, -v            Verbose output

Examples:
  node debug-cli.js stats
  node debug-cli.js list --stage=auth
  node debug-cli.js analyze --request-id=req-123
  node debug-cli.js summary --days=7
  node debug-cli.js cleanup --days=30
`);
}

function showStats(): void {
  try {
    const stats = getCaptureStats();
    
    console.log('\nCodeWhisperer Capture Statistics');
    console.log('================================');
    console.log(`Total captures: ${stats.total}`);
    console.log(`Auth captures: ${stats.auth}`);
    console.log(`Conversion captures: ${stats.conversion}`);
    console.log(`HTTP captures: ${stats.http}`);
    console.log(`Parsing captures: ${stats.parsing}`);
    console.log(`Tool processing captures: ${stats.tool_processing}`);
    
    if (stats.total === 0) {
      console.log('\nNo captures found. Start making requests to generate capture data.');
    }
  } catch (error) {
    console.error('Error getting capture statistics:', error);
    process.exit(1);
  }
}

function listFiles(stage?: string): void {
  try {
    const files = listCapturedFiles(stage);
    
    console.log(`\nCaptured Files${stage ? ` (stage: ${stage})` : ''}`);
    console.log('================================');
    
    if (files.length === 0) {
      console.log('No files found.');
      return;
    }
    
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });
    
    console.log(`\nTotal: ${files.length} files`);
  } catch (error) {
    console.error('Error listing files:', error);
    process.exit(1);
  }
}

function analyzeRequest(requestId: string, outputFile?: string): void {
  try {
    console.log(`\nAnalyzing request: ${requestId}`);
    console.log('================================');
    
    const report = generateAnalysisReport(requestId);
    
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`CodeWhisperer captures: ${report.codewhisperer.captures.length}`);
    console.log(`Performance: ${report.codewhisperer.performance.totalTime}ms total`);
    console.log(`Success rate: ${report.codewhisperer.performance.successRate.toFixed(1)}%`);
    console.log(`Issues found: ${report.codewhisperer.issues.length}`);
    
    if (report.openai) {
      console.log(`OpenAI captures: ${report.openai.captures.length}`);
      console.log(`Comparison available: Yes`);
    } else {
      console.log('OpenAI comparison: Not available');
    }
    
    // Show issues
    if (report.codewhisperer.issues.length > 0) {
      console.log('\nIssues:');
      report.codewhisperer.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`);
      });
    }
    
    // Show recommendations
    if (report.recommendations.length > 0) {
      console.log('\nRecommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
    
    // Save report if output specified
    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
      console.log(`\nReport saved to: ${outputFile}`);
    } else {
      const savedPath = saveAnalysisReport(report);
      console.log(`\nReport saved to: ${savedPath}`);
    }
    
  } catch (error) {
    console.error('Error analyzing request:', error);
    process.exit(1);
  }
}

function showSummary(days: number = 1): void {
  try {
    console.log(`\nCapture Summary (${days} day${days > 1 ? 's' : ''})`);
    console.log('================================');
    
    const summary = generateCaptureSummary(days);
    
    console.log(`Total captures: ${summary.totalCaptures}`);
    console.log(`Success rate: ${summary.performance.successRate.toFixed(1)}%`);
    console.log(`Total errors: ${summary.performance.totalErrors}`);
    
    if (summary.performance.averageAuthTime > 0) {
      console.log(`Average auth time: ${summary.performance.averageAuthTime.toFixed(0)}ms`);
    }
    if (summary.performance.averageHttpTime > 0) {
      console.log(`Average HTTP time: ${summary.performance.averageHttpTime.toFixed(0)}ms`);
    }
    if (summary.performance.averageParsingTime > 0) {
      console.log(`Average parsing time: ${summary.performance.averageParsingTime.toFixed(0)}ms`);
    }
    
    console.log('\nBy Stage:');
    Object.entries(summary.stages).forEach(([stage, data]: [string, any]) => {
      console.log(`  ${stage}: ${data.count} captures, avg ${data.averageTime.toFixed(0)}ms`);
      
      Object.entries(data.events).forEach(([event, count]: [string, any]) => {
        console.log(`    ${event}: ${count}`);
      });
    });
    
  } catch (error) {
    console.error('Error generating summary:', error);
    process.exit(1);
  }
}

function cleanupFiles(days: number = 7): void {
  try {
    console.log(`\nCleaning up captures older than ${days} days...`);
    
    const deletedCount = cleanupOldCaptures(days);
    
    console.log(`Deleted ${deletedCount} old capture files.`);
  } catch (error) {
    console.error('Error cleaning up files:', error);
    process.exit(1);
  }
}

function exportRequest(requestId: string, outputFile?: string): void {
  try {
    console.log(`\nExporting data for request: ${requestId}`);
    console.log('================================');
    
    const captures = findRelatedCaptures(requestId);
    
    if (captures.length === 0) {
      console.log('No captures found for this request ID.');
      return;
    }
    
    const exportData = {
      requestId,
      exportTime: new Date().toISOString(),
      captureCount: captures.length,
      captures: captures
    };
    
    const defaultOutput = `export-${requestId}-${new Date().toISOString().split('T')[0]}.json`;
    const output = outputFile || defaultOutput;
    
    fs.writeFileSync(output, JSON.stringify(exportData, null, 2));
    
    console.log(`Exported ${captures.length} captures to: ${output}`);
    
    // Show breakdown
    const stageBreakdown: { [key: string]: number } = {};
    captures.forEach(capture => {
      stageBreakdown[capture.stage] = (stageBreakdown[capture.stage] || 0) + 1;
    });
    
    console.log('\nBreakdown by stage:');
    Object.entries(stageBreakdown).forEach(([stage, count]) => {
      console.log(`  ${stage}: ${count}`);
    });
    
  } catch (error) {
    console.error('Error exporting request data:', error);
    process.exit(1);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showHelp();
    return;
  }
  
  const options = parseArgs(args);
  
  switch (options.command) {
    case 'stats':
      showStats();
      break;
      
    case 'list':
      listFiles(options.stage);
      break;
      
    case 'analyze':
      if (!options.requestId) {
        console.error('Error: --request-id is required for analyze command');
        process.exit(1);
      }
      analyzeRequest(options.requestId, options.output);
      break;
      
    case 'summary':
      showSummary(options.days);
      break;
      
    case 'cleanup':
      cleanupFiles(options.days);
      break;
      
    case 'export':
      if (!options.requestId) {
        console.error('Error: --request-id is required for export command');
        process.exit(1);
      }
      exportRequest(options.requestId, options.output);
      break;
      
    case 'help':
    default:
      showHelp();
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main, parseArgs, showStats, analyzeRequest, showSummary };