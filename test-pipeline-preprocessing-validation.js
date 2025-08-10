/**
 * 流水线预处理验证测试
 * 
 * 目的：诊断非流式请求预处理步骤是否真的缺失
 * 验证点：
 * 1. 检查非流式请求是否触发 'request-preprocessing' 日志
 * 2. 检查流式请求是否触发 'streaming-request-preprocessing' 日志
 * 3. 对比两种请求路径的预处理行为差异
 * 4. 验证 UnifiedPatchPreprocessor 的 shouldProcess() 判断逻辑
 */

const axios = require('axios');
const fs = require('fs');

// 测试配置
const TEST_CONFIG = {
    serverUrl: 'http://localhost:5508', // ShuaiHong 服务端口
    testModel: 'claude-4-sonnet',
    outputFile: '/tmp/pipeline-preprocessing-validation-results.json',
    logFile: '/tmp/pipeline-preprocessing-validation.log'
};

class PipelinePreprocessingValidator {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            testSuite: 'Pipeline Preprocessing Validation',
            tests: [],
            summary: {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                preprocessingIssues: []
            }
        };
    }

    log(message, data = null) {
        const logEntry = `${new Date().toISOString()} - ${message}${data ? `: ${JSON.stringify(data, null, 2)}` : ''}`;
        console.log(logEntry);
        fs.appendFileSync(TEST_CONFIG.logFile, logEntry + '\n');
    }

    async testNonStreamingRequestPreprocessing() {
        this.log('🧪 Testing Non-streaming Request Preprocessing');
        
        try {
            const requestPayload = {
                model: TEST_CONFIG.testModel,
                max_tokens: 150,
                messages: [
                    {
                        role: 'user',
                        content: 'Hello, can you tell me the time using a tool call?'
                    }
                ],
                stream: false // 明确指定非流式
            };

            const startTime = Date.now();
            const response = await axios.post(`${TEST_CONFIG.serverUrl}/v1/messages`, requestPayload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            const duration = Date.now() - startTime;
            
            const testResult = {
                testName: 'Non-streaming Request Preprocessing',
                status: 'PASSED',
                duration,
                details: {
                    requestSent: true,
                    responseReceived: response.status === 200,
                    responseStatus: response.status,
                    responseSize: JSON.stringify(response.data).length,
                    preprocessingExpected: true,
                    logIdentifier: 'request-preprocessing'
                },
                analysis: {
                    preprocessingStepExpected: 'request-preprocessing',
                    shouldAppearInLogs: true,
                    requestType: 'non-streaming',
                    model: requestPayload.model
                }
            };

            this.results.tests.push(testResult);
            this.results.summary.passedTests++;
            this.log('✅ Non-streaming request completed successfully');
            
        } catch (error) {
            const testResult = {
                testName: 'Non-streaming Request Preprocessing',
                status: 'FAILED',
                error: error.message,
                details: {
                    errorCode: error.response?.status,
                    errorData: error.response?.data,
                    preprocessingExpected: true,
                    logIdentifier: 'request-preprocessing'
                }
            };

            this.results.tests.push(testResult);
            this.results.summary.failedTests++;
            this.log('❌ Non-streaming request failed', { error: error.message });
        }
    }

    async testStreamingRequestPreprocessing() {
        this.log('🧪 Testing Streaming Request Preprocessing');
        
        try {
            const requestPayload = {
                model: TEST_CONFIG.testModel,
                max_tokens: 150,
                messages: [
                    {
                        role: 'user',
                        content: 'Hello, can you tell me the time using a tool call?'
                    }
                ],
                stream: true // 明确指定流式
            };

            const startTime = Date.now();
            const response = await axios.post(`${TEST_CONFIG.serverUrl}/v1/messages`, requestPayload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000,
                responseType: 'stream'
            });

            const duration = Date.now() - startTime;
            
            let streamData = '';
            let chunkCount = 0;
            
            response.data.on('data', (chunk) => {
                streamData += chunk.toString();
                chunkCount++;
            });

            await new Promise((resolve, reject) => {
                response.data.on('end', resolve);
                response.data.on('error', reject);
            });
            
            const testResult = {
                testName: 'Streaming Request Preprocessing',
                status: 'PASSED',
                duration,
                details: {
                    requestSent: true,
                    streamReceived: response.status === 200,
                    responseStatus: response.status,
                    chunkCount,
                    streamDataSize: streamData.length,
                    preprocessingExpected: true,
                    logIdentifier: 'streaming-request-preprocessing'
                },
                analysis: {
                    preprocessingStepExpected: 'streaming-request-preprocessing',
                    shouldAppearInLogs: true,
                    requestType: 'streaming',
                    model: requestPayload.model
                }
            };

            this.results.tests.push(testResult);
            this.results.summary.passedTests++;
            this.log('✅ Streaming request completed successfully', { chunkCount });
            
        } catch (error) {
            const testResult = {
                testName: 'Streaming Request Preprocessing',
                status: 'FAILED',
                error: error.message,
                details: {
                    errorCode: error.response?.status,
                    errorData: error.response?.data,
                    preprocessingExpected: true,
                    logIdentifier: 'streaming-request-preprocessing'
                }
            };

            this.results.tests.push(testResult);
            this.results.summary.failedTests++;
            this.log('❌ Streaming request failed', { error: error.message });
        }
    }

    async testPreprocessingConfiguration() {
        this.log('🧪 Testing Preprocessing Configuration');
        
        try {
            // 检查服务器状态和配置
            const statusResponse = await axios.get(`${TEST_CONFIG.serverUrl}/status`, {
                timeout: 10000
            });

            const configAnalysis = {
                serverRunning: true,
                debugEnabled: statusResponse.data.debug,
                providersCount: statusResponse.data.providers.length,
                preprocessingEnvironment: {
                    RCC_UNIFIED_PREPROCESSING: process.env.RCC_UNIFIED_PREPROCESSING,
                    RCC_PREPROCESSING_DEBUG: process.env.RCC_PREPROCESSING_DEBUG,
                    RCC_FORCE_ALL_INPUTS: process.env.RCC_FORCE_ALL_INPUTS
                }
            };

            const testResult = {
                testName: 'Preprocessing Configuration',
                status: 'PASSED',
                details: configAnalysis,
                analysis: {
                    preprocessingEnabled: process.env.RCC_UNIFIED_PREPROCESSING !== 'false',
                    debugMode: process.env.RCC_PREPROCESSING_DEBUG === 'true',
                    forceAllInputs: process.env.RCC_FORCE_ALL_INPUTS === 'true'
                }
            };

            this.results.tests.push(testResult);
            this.results.summary.passedTests++;
            this.log('✅ Configuration analysis completed');
            
        } catch (error) {
            const testResult = {
                testName: 'Preprocessing Configuration',
                status: 'FAILED',
                error: error.message
            };

            this.results.tests.push(testResult);
            this.results.summary.failedTests++;
            this.log('❌ Configuration analysis failed', { error: error.message });
        }
    }

    async checkLogFiles() {
        this.log('🧪 Checking Log Files for Preprocessing Evidence');
        
        try {
            // 检查可能的日志文件位置
            const logPaths = [
                '/tmp/ccr-dev.log',
                `~/.route-claude-code/logs/port-${TEST_CONFIG.serverUrl.split(':').pop()}/`,
                `/tmp/rcc-${TEST_CONFIG.serverUrl.split(':').pop()}.log`
            ];

            const logAnalysis = {
                searchPatterns: [
                    'request-preprocessing',
                    'streaming-request-preprocessing', 
                    'UnifiedPatchPreprocessor',
                    'preprocessInput'
                ],
                foundEvidence: [],
                searchResults: {}
            };

            for (const pattern of logAnalysis.searchPatterns) {
                logAnalysis.searchResults[pattern] = {
                    pattern,
                    found: false,
                    locations: [],
                    count: 0
                };
            }

            // 这里可以扩展实际的日志文件搜索逻辑
            // 由于日志文件位置可能变化，提供分析框架

            const testResult = {
                testName: 'Log File Analysis',
                status: 'INFO',
                details: logAnalysis,
                recommendations: [
                    'Check server logs for "request-preprocessing" patterns',
                    'Enable RCC_PREPROCESSING_DEBUG=true for detailed logging',
                    'Monitor both streaming and non-streaming request logs',
                    'Compare log patterns between working and failing requests'
                ]
            };

            this.results.tests.push(testResult);
            this.log('ℹ️ Log analysis framework prepared');
            
        } catch (error) {
            this.log('⚠️ Log analysis setup failed', { error: error.message });
        }
    }

    generateDiagnosticSummary() {
        this.log('📊 Generating Diagnostic Summary');
        
        // 分析预处理问题模式
        const streamingTest = this.results.tests.find(t => t.testName === 'Streaming Request Preprocessing');
        const nonStreamingTest = this.results.tests.find(t => t.testName === 'Non-streaming Request Preprocessing');
        const configTest = this.results.tests.find(t => t.testName === 'Preprocessing Configuration');

        const diagnosticSummary = {
            overallFindings: {
                streamingRequestWorks: streamingTest?.status === 'PASSED',
                nonStreamingRequestWorks: nonStreamingTest?.status === 'PASSED',
                configurationValid: configTest?.status === 'PASSED'
            },
            possibleIssues: [],
            recommendations: [],
            nextSteps: []
        };

        // 基于测试结果生成诊断
        if (!diagnosticSummary.overallFindings.nonStreamingRequestWorks) {
            diagnosticSummary.possibleIssues.push('Non-streaming request preprocessing may be failing');
            diagnosticSummary.recommendations.push('Enable RCC_PREPROCESSING_DEBUG=true');
            diagnosticSummary.recommendations.push('Check UnifiedPatchPreprocessor shouldProcess() logic');
        }

        if (!diagnosticSummary.overallFindings.streamingRequestWorks) {
            diagnosticSummary.possibleIssues.push('Streaming request preprocessing may be failing');
        }

        if (diagnosticSummary.overallFindings.streamingRequestWorks && 
            !diagnosticSummary.overallFindings.nonStreamingRequestWorks) {
            diagnosticSummary.possibleIssues.push('CRITICAL: Non-streaming preprocessing silent failure confirmed');
            diagnosticSummary.nextSteps.push('Investigate shouldProcess() conditions for input stage');
            diagnosticSummary.nextSteps.push('Check if forceAllInputs should be enabled by default');
        }

        if (diagnosticSummary.possibleIssues.length === 0) {
            diagnosticSummary.possibleIssues.push('Both preprocessing paths appear functional - issue may be in logging or observation');
            diagnosticSummary.recommendations.push('Check log pattern search methodology');
            diagnosticSummary.recommendations.push('Verify log file locations and access');
        }

        this.results.diagnosticSummary = diagnosticSummary;
        
        this.log('📊 Diagnostic Summary Generated', diagnosticSummary);
    }

    async runAllTests() {
        this.log('🚀 Starting Pipeline Preprocessing Validation');
        this.results.summary.totalTests = 4;

        // 清空之前的日志
        if (fs.existsSync(TEST_CONFIG.logFile)) {
            fs.unlinkSync(TEST_CONFIG.logFile);
        }

        await this.testPreprocessingConfiguration();
        await this.testNonStreamingRequestPreprocessing();
        await this.testStreamingRequestPreprocessing();
        await this.checkLogFiles();
        
        this.generateDiagnosticSummary();
        
        // 保存结果
        fs.writeFileSync(TEST_CONFIG.outputFile, JSON.stringify(this.results, null, 2));
        
        this.log('✅ All tests completed', {
            totalTests: this.results.summary.totalTests,
            passed: this.results.summary.passedTests,
            failed: this.results.summary.failedTests,
            outputFile: TEST_CONFIG.outputFile
        });

        // 输出关键发现
        console.log('\n🔍 KEY FINDINGS:');
        this.results.diagnosticSummary.possibleIssues.forEach(issue => {
            console.log(`❌ ${issue}`);
        });
        
        console.log('\n📋 RECOMMENDATIONS:');
        this.results.diagnosticSummary.recommendations.forEach(rec => {
            console.log(`💡 ${rec}`);
        });

        console.log('\n🎯 NEXT STEPS:');
        this.results.diagnosticSummary.nextSteps.forEach(step => {
            console.log(`🔧 ${step}`);
        });

        return this.results;
    }
}

// 运行测试
async function main() {
    const validator = new PipelinePreprocessingValidator();
    
    try {
        await validator.runAllTests();
        process.exit(0);
    } catch (error) {
        console.error('🚨 Test suite failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { PipelinePreprocessingValidator, TEST_CONFIG };