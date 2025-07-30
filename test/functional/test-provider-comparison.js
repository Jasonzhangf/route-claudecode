/**
 * Provider Comparison Test Suite
 * 发送相同请求到两个 provider 并对比响应差异
 * Project owner: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  localRouterUrl: 'http://localhost:3456',
  testCases: [
    {
      name: 'simple-text-generation',
      request: {
        model: 'claude-sonnet-4-20250514',
        messages: [
          { role: 'user', content: 'Write a simple hello world function in Python.' }
        ],
        max_tokens: 500,
        stream: false
      }
    },
    {
      name: 'complex-reasoning',
      request: {
        model: 'claude-sonnet-4-20250514',
        messages: [
          { 
            role: 'user', 
            content: 'Explain the difference between async/await and Promises in JavaScript. Provide code examples.' 
          }
        ],
        max_tokens: 1000,
        stream: false
      }
    },
    {
      name: 'tool-calling-test',
      request: {
        model: 'claude-sonnet-4-20250514',  
        messages: [
          { role: 'user', content: 'What is the current time?' }
        ],
        tools: [
          {
            name: 'get_current_time',
            description: 'Get the current time',
            input_schema: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        ],
        max_tokens: 300,
        stream: false
      }
    },
    {
      name: 'long-context-test',
      request: {
        model: 'claude-sonnet-4-20250514',
        messages: [
          { 
            role: 'user', 
            content: 'Analyze this long text and provide a summary:\n' + 
                    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(500) +
                    '\n\nWhat are the key themes in this text?'
          }
        ],
        max_tokens: 800,
        stream: false
      }
    }
  ],
  outputDir: '/tmp/provider-comparison-test',
  timeout: 30000
};

class ProviderComparisonTest {
  constructor() {
    this.results = [];
    this.setupOutputDirectory();
  }

  setupOutputDirectory() {
    if (!fs.existsSync(TEST_CONFIG.outputDir)) {
      fs.mkdirSync(TEST_CONFIG.outputDir, { recursive: true });
    }
  }

  async runAllTests() {
    console.log(`🚀 Starting Provider Comparison Test Suite`);
    console.log(`📁 Output directory: ${TEST_CONFIG.outputDir}`);
    console.log(`📋 Test cases: ${TEST_CONFIG.testCases.length}`);
    console.log('');

    const startTime = Date.now();

    for (let i = 0; i < TEST_CONFIG.testCases.length; i++) {
      const testCase = TEST_CONFIG.testCases[i];
      console.log(`📝 Running test case ${i + 1}/${TEST_CONFIG.testCases.length}: ${testCase.name}`);
      
      try {
        const result = await this.runComparisonTest(testCase);
        this.results.push(result);
        
        console.log(`✅ Test case ${testCase.name} completed`);
        console.log(`   📊 Quality Score: ${result.qualityScore?.overall || 'N/A'}`);
        console.log(`   🔧 Corrections Applied: ${result.correctionResults?.appliedCorrections?.length || 0}`);
        console.log('');

      } catch (error) {
        console.error(`❌ Test case ${testCase.name} failed:`, error.message);
        this.results.push({
          testCase,
          error: error.message,
          timestamp: new Date(),
          success: false
        });
        console.log('');
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Generate comprehensive report
    await this.generateReport(duration);
    
    // Print summary
    this.printSummary(duration);
  }

  async runComparisonTest(testCase) {
    const testResult = {
      testCase,
      timestamp: new Date(),
      success: false,
      codewhispererResponse: null,
      openaiResponse: null,
      comparisonAnalysis: null,
      correctionResults: null,
      errors: [],
      metrics: {
        codewhispererTime: 0,
        openaiTime: 0,
        totalTime: 0
      }
    };

    const startTime = Date.now();

    try {
      // Step 1: Send request to CodeWhisperer (via router with default routing)
      console.log(`   🔄 Sending request to CodeWhisperer...`);
      const cwStartTime = Date.now();
      
      const codewhispererResponse = await this.sendRequest({
        ...testCase.request,
        metadata: { forcedProvider: 'codewhisperer-primary' }
      });
      
      testResult.codewhispererResponse = codewhispererResponse;
      testResult.metrics.codewhispererTime = Date.now() - cwStartTime;

      // Step 2: Send same request to OpenAI provider
      console.log(`   🔄 Sending request to OpenAI...`);
      const oaiStartTime = Date.now();
      
      const openaiResponse = await this.sendRequest({
        ...testCase.request,
        metadata: { forcedProvider: 'shuaihong-openai' }
      });
      
      testResult.openaiResponse = openaiResponse;
      testResult.metrics.openaiTime = Date.now() - oaiStartTime;

      // Step 3: Perform comparison analysis
      console.log(`   🔍 Analyzing response differences...`);
      const comparisonAnalysis = await this.performComparisonAnalysis(
        testCase.request,
        codewhispererResponse,
        openaiResponse
      );
      
      testResult.comparisonAnalysis = comparisonAnalysis;

      // Step 4: Apply corrections if needed
      if (comparisonAnalysis.differences && comparisonAnalysis.differences.length > 0) {
        console.log(`   🔧 Applying corrections (${comparisonAnalysis.differences.length} differences found)...`);
        const correctionResults = await this.applyCorrectionEngine(
          testCase.request,
          codewhispererResponse,
          openaiResponse,
          comparisonAnalysis
        );
        
        testResult.correctionResults = correctionResults;
      }

      testResult.metrics.totalTime = Date.now() - startTime;
      testResult.success = true;

      // Save detailed results for this test case
      await this.saveTestCaseResults(testCase.name, testResult);

    } catch (error) {
      testResult.errors.push(error.message);
      throw error;
    }

    return testResult;
  }

  async sendRequest(request) {
    try {
      const response = await axios.post(
        `${TEST_CONFIG.localRouterUrl}/v1/messages`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'provider-comparison-test/1.0.0'
          },
          timeout: TEST_CONFIG.timeout
        }
      );

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error('No response received from server');
      } else {
        throw new Error(`Request setup error: ${error.message}`);
      }
    }
  }

  async performComparisonAnalysis(request, codewhispererResponse, openaiResponse) {
    // This is a simplified analysis - in a real implementation, 
    // this would use the ComparisonAnalysisEngine
    
    const analysis = {
      requestId: `comparison_${Date.now()}`,
      timestamp: new Date(),
      request,
      responses: {
        codewhisperer: {
          response: codewhispererResponse,
          metadata: {
            responseTime: 0, // Would be calculated from actual metrics
            tokenCount: {
              input: codewhispererResponse.usage?.input_tokens || 0,
              output: codewhispererResponse.usage?.output_tokens || 0
            },
            errors: [],
            warnings: []
          }
        },
        openai: {
          response: openaiResponse,
          metadata: {
            responseTime: 0,
            tokenCount: {
              input: openaiResponse.usage?.input_tokens || 0,
              output: openaiResponse.usage?.output_tokens || 0
            },
            errors: [],
            warnings: []
          }
        }
      },
      differences: [],
      qualityScore: null
    };

    // Analyze content differences
    const cwContent = this.extractTextContent(codewhispererResponse);
    const oaiContent = this.extractTextContent(openaiResponse);

    if (cwContent !== oaiContent) {
      analysis.differences.push({
        type: 'content',
        severity: this.assessContentDifferenceSeverity(cwContent, oaiContent),
        description: 'Response content differs between providers',
        codewhispererValue: cwContent.substring(0, 200) + '...',
        openaiValue: oaiContent.substring(0, 200) + '...',
        impact: 'User experience may vary depending on provider',
        fixable: true
      });
    }

    // Analyze structure differences
    const cwStructure = this.analyzeResponseStructure(codewhispererResponse);
    const oaiStructure = this.analyzeResponseStructure(openaiResponse);

    if (JSON.stringify(cwStructure) !== JSON.stringify(oaiStructure)) {
      analysis.differences.push({
        type: 'structure',
        severity: 'major',
        description: 'Response structure differs between providers',
        codewhispererValue: cwStructure,
        openaiValue: oaiStructure,
        impact: 'Response parsing may behave differently',
        fixable: true
      });
    }

    // Analyze tool call differences
    const cwTools = this.extractToolCalls(codewhispererResponse);
    const oaiTools = this.extractToolCalls(openaiResponse);

    if (JSON.stringify(cwTools) !== JSON.stringify(oaiTools)) {
      analysis.differences.push({
        type: 'tools',
        severity: 'critical',
        description: 'Tool calls differ between providers',
        codewhispererValue: cwTools,
        openaiValue: oaiTools,
        impact: 'Tool execution results will differ',
        fixable: true
      });
    }

    // Calculate quality score
    analysis.qualityScore = this.calculateQualityScore(analysis);

    return analysis;
  }

  async applyCorrectionEngine(request, codewhispererResponse, openaiResponse, comparisonAnalysis) {
    // Simplified correction logic - in real implementation, 
    // this would use the CorrectionEngine
    
    const correctionResult = {
      requestId: comparisonAnalysis.requestId,
      timestamp: new Date(),
      originalResponse: { ...codewhispererResponse },
      referenceResponse: { ...openaiResponse },
      correctedResponse: { ...codewhispererResponse },
      appliedCorrections: [],
      correctionMetrics: {
        totalCorrections: 0,
        successfulCorrections: 0,
        failedCorrections: 0,
        confidenceScore: 0,
        improvementScore: 0,
        processingTime: 0
      },
      success: false,
      errors: []
    };

    const startTime = Date.now();

    try {
      for (const difference of comparisonAnalysis.differences) {
        if (!difference.fixable) continue;

        // Apply simple corrections based on difference type
        switch (difference.type) {
          case 'content':
            if (difference.severity === 'critical' || difference.severity === 'major') {
              // Use OpenAI content as reference
              const oaiContent = this.extractTextContent(openaiResponse);
              const cwContent = this.extractTextContent(codewhispererResponse);
              
              if (oaiContent.length > cwContent.length * 1.2) {
                correctionResult.correctedResponse.content = openaiResponse.content;
                correctionResult.appliedCorrections.push({
                  type: 'content',
                  description: 'Replaced with more complete reference content',
                  originalValue: cwContent.substring(0, 100) + '...',
                  correctedValue: oaiContent.substring(0, 100) + '...',
                  confidence: 0.8,
                  method: 'reference-content-adoption'
                });
              }
            }
            break;

          case 'structure':
            // Add missing fields from reference
            if (openaiResponse.type && !codewhispererResponse.type) {
              correctionResult.correctedResponse.type = openaiResponse.type;
              correctionResult.appliedCorrections.push({
                type: 'structure',
                description: 'Added missing type field',
                originalValue: null,
                correctedValue: openaiResponse.type,
                confidence: 0.9,
                method: 'structure-field-addition'
              });
            }
            break;

          case 'tools':
            // Correct tool call format
            const oaiTools = this.extractToolCalls(openaiResponse);
            if (oaiTools.length > 0) {
              const toolIndex = correctionResult.correctedResponse.content.findIndex(item => item.type === 'tool_use');
              if (toolIndex !== -1) {
                correctionResult.correctedResponse.content[toolIndex] = oaiTools[0];
                correctionResult.appliedCorrections.push({
                  type: 'tools',
                  description: 'Corrected tool call format',
                  originalValue: difference.codewhispererValue,
                  correctedValue: oaiTools[0],
                  confidence: 0.85,
                  method: 'reference-tool-format-adoption'
                });
              }
            }
            break;
        }
      }

      correctionResult.correctionMetrics.totalCorrections = correctionResult.appliedCorrections.length;
      correctionResult.correctionMetrics.successfulCorrections = correctionResult.appliedCorrections.length;
      correctionResult.correctionMetrics.processingTime = Date.now() - startTime;

      if (correctionResult.appliedCorrections.length > 0) {
        correctionResult.correctionMetrics.confidenceScore = correctionResult.appliedCorrections
          .reduce((sum, c) => sum + c.confidence, 0) / correctionResult.appliedCorrections.length;
      }

      correctionResult.success = correctionResult.errors.length === 0;

    } catch (error) {
      correctionResult.errors.push(error.message);
      correctionResult.success = false;
    }

    return correctionResult;
  }

  // Helper methods

  extractTextContent(response) {
    if (!response.content || !Array.isArray(response.content)) {
      return '';
    }
    return response.content
      .filter(item => item.type === 'text')
      .map(item => item.text || '')
      .join(' ');
  }

  extractToolCalls(response) {
    if (!response.content || !Array.isArray(response.content)) {
      return [];
    }
    return response.content.filter(item => item.type === 'tool_use');
  }

  analyzeResponseStructure(response) {
    return {
      hasId: !!response.id,
      hasType: !!response.type,
      hasModel: !!response.model,
      hasRole: !!response.role,
      contentLength: response.content?.length || 0,
      contentTypes: response.content?.map(item => item.type) || [],
      hasUsage: !!response.usage,
      hasStopReason: !!response.stop_reason
    };
  }

  assessContentDifferenceSeverity(content1, content2) {
    const similarity = this.calculateContentSimilarity(content1, content2);
    if (similarity < 0.3) return 'critical';
    if (similarity < 0.6) return 'major';
    return 'minor';
  }

  calculateContentSimilarity(content1, content2) {
    const words1 = content1.toLowerCase().split(/\\s+/);
    const words2 = content2.toLowerCase().split(/\\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = [...new Set([...words1, ...words2])];
    return commonWords.length / Math.max(totalWords.length, 1);
  }

  calculateQualityScore(analysis) {
    const criticalCount = analysis.differences.filter(d => d.severity === 'critical').length;
    const majorCount = analysis.differences.filter(d => d.severity === 'major').length;
    const minorCount = analysis.differences.filter(d => d.severity === 'minor').length;

    let overall = 100;
    overall -= criticalCount * 30;
    overall -= majorCount * 15;
    overall -= minorCount * 5;

    overall = Math.max(0, overall);

    let recommendation;
    if (criticalCount > 0 || majorCount > 2) {
      recommendation = 'needs_correction';
    } else if (overall >= 85) {
      recommendation = 'equivalent';
    } else {
      recommendation = 'use_openai';
    }

    return {
      overall,
      dimensions: {
        completeness: Math.max(0, 100 - criticalCount * 25),
        accuracy: Math.max(0, 100 - majorCount * 20),
        consistency: Math.max(0, 100 - analysis.differences.length * 10),
        performance: 75 // Default performance score
      },
      recommendation
    };
  }

  async saveTestCaseResults(testName, result) {
    const filename = `${testName}-${Date.now()}.json`;
    const filepath = path.join(TEST_CONFIG.outputDir, filename);
    
    await fs.promises.writeFile(
      filepath,
      JSON.stringify(result, null, 2),
      'utf8'
    );

    console.log(`   💾 Detailed results saved: ${filepath}`);
  }

  async generateReport(duration) {
    const report = {
      metadata: {
        timestamp: new Date(),
        duration,
        totalTests: TEST_CONFIG.testCases.length,
        successfulTests: this.results.filter(r => r.success).length,
        failedTests: this.results.filter(r => !r.success).length
      },
      summary: {
        averageQualityScore: 0,
        totalDifferencesFound: 0,
        totalCorrectionsApplied: 0,
        commonIssues: [],
        performanceComparison: {
          averageCodewhispererTime: 0,
          averageOpenaiTime: 0
        }
      },
      testResults: this.results,
      recommendations: []
    };

    // Calculate summary statistics
    const successfulResults = this.results.filter(r => r.success && r.comparisonAnalysis);
    
    if (successfulResults.length > 0) {
      report.summary.averageQualityScore = successfulResults
        .reduce((sum, r) => sum + (r.comparisonAnalysis.qualityScore?.overall || 0), 0) / successfulResults.length;

      report.summary.totalDifferencesFound = successfulResults
        .reduce((sum, r) => sum + (r.comparisonAnalysis.differences?.length || 0), 0);

      report.summary.totalCorrectionsApplied = successfulResults
        .reduce((sum, r) => sum + (r.correctionResults?.appliedCorrections?.length || 0), 0);

      // Performance comparison
      const validMetrics = this.results.filter(r => r.metrics);
      if (validMetrics.length > 0) {
        report.summary.performanceComparison.averageCodewhispererTime = validMetrics
          .reduce((sum, r) => sum + r.metrics.codewhispererTime, 0) / validMetrics.length;

        report.summary.performanceComparison.averageOpenaiTime = validMetrics
          .reduce((sum, r) => sum + r.metrics.openaiTime, 0) / validMetrics.length;
      }

      // Identify common issues
      const allDifferences = successfulResults.flatMap(r => r.comparisonAnalysis.differences || []);
      const issueFrequency = allDifferences.reduce((acc, diff) => {
        acc[diff.description] = (acc[diff.description] || 0) + 1;
        return acc;
      }, {});

      report.summary.commonIssues = Object.entries(issueFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([issue, count]) => ({ issue, count }));
    }

    // Generate recommendations
    if (report.summary.averageQualityScore < 70) {
      report.recommendations.push('Consider implementing automatic correction for most responses');
    }
    if (report.summary.totalDifferencesFound > report.metadata.successfulTests * 2) {
      report.recommendations.push('High number of differences detected - review provider configurations');
    }
    if (report.summary.performanceComparison.averageCodewhispererTime > report.summary.performanceComparison.averageOpenaiTime * 2) {
      report.recommendations.push('CodeWhisperer response times are significantly slower');
    }

    // Save comprehensive report
    const reportPath = path.join(TEST_CONFIG.outputDir, `comparison-report-${Date.now()}.json`);
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log(`📊 Comprehensive report saved: ${reportPath}`);
    return report;
  }

  printSummary(duration) {
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    console.log('');
    console.log('🎯 Provider Comparison Test Summary');
    console.log('=' * 50);
    console.log(`⏱️  Total Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📋 Total Tests: ${TEST_CONFIG.testCases.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Success Rate: ${((successful / TEST_CONFIG.testCases.length) * 100).toFixed(1)}%`);

    if (successful > 0) {
      const successfulResults = this.results.filter(r => r.success && r.comparisonAnalysis);
      const avgQuality = successfulResults.length > 0 
        ? successfulResults.reduce((sum, r) => sum + (r.comparisonAnalysis.qualityScore?.overall || 0), 0) / successfulResults.length
        : 0;
      
      const totalDifferences = successfulResults.reduce((sum, r) => sum + (r.comparisonAnalysis.differences?.length || 0), 0);
      const totalCorrections = successfulResults.reduce((sum, r) => sum + (r.correctionResults?.appliedCorrections?.length || 0), 0);

      console.log(`🎯 Average Quality Score: ${avgQuality.toFixed(1)}/100`);
      console.log(`🔍 Total Differences Found: ${totalDifferences}`);
      console.log(`🔧 Total Corrections Applied: ${totalCorrections}`);
    }

    console.log('');
    console.log(`📁 Detailed results saved in: ${TEST_CONFIG.outputDir}`);
    console.log('');

    if (failed > 0) {
      console.log('❌ Failed Test Cases:');
      this.results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.testCase.name}: ${r.error}`);
      });
      console.log('');
    }

    // Quick recommendations
    if (successful > 0) {
      const successfulResults = this.results.filter(r => r.success && r.comparisonAnalysis);
      const avgQuality = successfulResults.length > 0 
        ? successfulResults.reduce((sum, r) => sum + (r.comparisonAnalysis.qualityScore?.overall || 0), 0) / successfulResults.length
        : 0;

      console.log('💡 Quick Recommendations:');
      if (avgQuality < 70) {
        console.log('   - Consider implementing automatic correction for most responses');
      }
      if (avgQuality >= 85) {
        console.log('   - Response quality is good, minor corrections may be sufficient');
      }
      console.log('   - Review detailed report for specific improvement areas');
      console.log('');
    }
  }
}

// Main execution
async function main() {
  try {
    const test = new ProviderComparisonTest();
    await test.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Export for use as module
module.exports = { ProviderComparisonTest, TEST_CONFIG };

// Run if called directly
if (require.main === module) {
  main();
}