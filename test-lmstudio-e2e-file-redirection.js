#!/usr/bin/env node

/**
 * LMStudio End-to-End Test with File Redirection
 * Tests the complete flow: input -> preprocessing -> rcc code -> output file
 * Author: Jason Zhang
 * Version: v3.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LMStudioE2EFileRedirectionTest {
    constructor() {
        this.testId = `lmstudio-e2e-${Date.now()}`;
        this.testDir = `/tmp/lmstudio-e2e-test-${this.testId}`;
        this.results = {
            testId: this.testId,
            timestamp: new Date().toISOString(),
            phases: {},
            summary: { passed: 0, failed: 0, total: 0 }
        };
        
        console.log('🧪 LMStudio E2E File Redirection Test initialized');
        console.log(`📁 Test directory: ${this.testDir}`);
    }

    /**
     * Phase 1: Setup Test Environment
     */
    async setupTestEnvironment() {
        console.log('\n📋 Phase 1: Setup Test Environment');
        
        try {
            // Create test directory structure
            await fs.mkdir(this.testDir, { recursive: true });
            await fs.mkdir(path.join(this.testDir, 'input'), { recursive: true });
            await fs.mkdir(path.join(this.testDir, 'output'), { recursive: true });
            await fs.mkdir(path.join(this.testDir, 'config'), { recursive: true });
            await fs.mkdir(path.join(this.testDir, 'logs'), { recursive: true });
            
            // Create test configuration
            const testConfig = {
                server: {
                    port: 5508, // Use unique port for E2E testing
                    host: '127.0.0.1'
                },
                debug: {
                    enabled: true,
                    logLevel: 'info',
                    logDir: path.join(this.testDir, 'logs')
                },
                providers: {
                    lmstudio: {
                        type: 'lmstudio',
                        endpoint: 'http://localhost:1234/v1/chat/completions',
                        authentication: {
                            type: 'none'
                        },
                        models: ['local-model'],
                        timeout: 60000,
                        preprocessing: {
                            enabled: true,
                            parser: 'lmstudio-format-parser'
                        }
                    }
                },
                routing: {
                    default: {
                        provider: 'lmstudio',
                        model: 'local-model'
                    }
                },
                features: {
                    fileOutput: true,
                    toolCalls: true,
                    streaming: false
                }
            };
            
            const configFile = path.join(this.testDir, 'config', 'test-config.json');
            await fs.writeFile(configFile, JSON.stringify(testConfig, null, 2));
            
            // Create test input file
            const testInput = '请总结本项目的架构并且保存为md文档';
            const inputFile = path.join(this.testDir, 'input', 'test-request.txt');
            await fs.writeFile(inputFile, testInput);
            
            console.log('   ✅ Test environment setup completed');
            
            this.results.phases.setup = {
                success: true,
                testDir: this.testDir,
                configFile: configFile,
                inputFile: inputFile
            };
            
            return {
                testDir: this.testDir,
                configFile: configFile,
                inputFile: inputFile
            };
            
        } catch (error) {
            console.error('   ❌ Setup failed:', error.message);
            this.results.phases.setup = {
                success: false,
                error: error.message
            };
            throw error;
        }
    }

    /**
     * Phase 2: Verify LMStudio Server
     */
    async verifyLMStudioServer() {
        console.log('\n📋 Phase 2: Verify LMStudio Server');
        
        try {
            // Check if LMStudio server is running
            const response = await fetch('http://localhost:1234/v1/models', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`LMStudio server not responding: ${response.status}`);
            }
            
            const models = await response.json();
            console.log(`   ✅ LMStudio server running with ${models.data?.length || 0} models`);
            
            // Test basic completion
            const testResponse = await fetch('http://localhost:1234/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'local-model',
                    messages: [{ role: 'user', content: 'Hello, test message' }],
                    max_tokens: 50
                })
            });
            
            if (!testResponse.ok) {
                throw new Error(`LMStudio completion test failed: ${testResponse.status}`);
            }
            
            const completion = await testResponse.json();
            console.log('   ✅ LMStudio completion test successful');
            
            this.results.phases.serverVerification = {
                success: true,
                modelsAvailable: models.data?.length || 0,
                completionTest: 'passed'
            };
            
            return true;
            
        } catch (error) {
            console.error('   ❌ LMStudio server verification failed:', error.message);
            console.error('   ⚠️ Please ensure LMStudio is running on port 1234');
            
            this.results.phases.serverVerification = {
                success: false,
                error: error.message
            };
            
            throw error;
        }
    }

    /**
     * Phase 3: Test Preprocessing with Captured Data
     */
    async testPreprocessingWithCapturedData() {
        console.log('\n📋 Phase 3: Test Preprocessing with Captured Data');
        
        try {
            // Send test request to capture raw response
            const testRequest = {
                model: 'local-model',
                messages: [{ 
                    role: 'user', 
                    content: '请总结本项目的架构并且保存为md文档' 
                }],
                tools: [{
                    type: 'function',
                    function: {
                        name: 'create_file',
                        description: 'Create a file with content',
                        parameters: {
                            type: 'object',
                            properties: {
                                filename: { type: 'string', description: 'Name of the file to create' },
                                content: { type: 'string', description: 'Content to write to the file' }
                            },
                            required: ['filename', 'content']
                        }
                    }
                }],
                stream: false
            };
            
            console.log('   📡 Sending test request to LMStudio...');
            
            const response = await fetch('http://localhost:1234/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testRequest)
            });
            
            if (!response.ok) {
                throw new Error(`Request failed: ${response.status} ${response.statusText}`);
            }
            
            const rawResponse = await response.json();
            
            // Save raw response for analysis
            const rawResponseFile = path.join(this.testDir, 'logs', 'raw-response.json');
            await fs.writeFile(rawResponseFile, JSON.stringify(rawResponse, null, 2));
            
            console.log('   ✅ Raw response captured');
            
            // Analyze response for preprocessing needs
            const analysisResult = this.analyzeResponseForPreprocessing(rawResponse);
            
            // Apply preprocessing if needed
            let processedResponse = rawResponse;
            if (analysisResult.needsPreprocessing) {
                console.log('   🔧 Applying preprocessing fixes...');
                processedResponse = this.applyPreprocessingFixes(rawResponse, analysisResult.issues);
                
                // Save processed response
                const processedResponseFile = path.join(this.testDir, 'logs', 'processed-response.json');
                await fs.writeFile(processedResponseFile, JSON.stringify(processedResponse, null, 2));
                
                console.log(`   ✅ Applied ${analysisResult.issues.length} preprocessing fixes`);
            } else {
                console.log('   ℹ️ No preprocessing needed');
            }
            
            this.results.phases.preprocessing = {
                success: true,
                rawResponse: rawResponseFile,
                needsPreprocessing: analysisResult.needsPreprocessing,
                issuesFound: analysisResult.issues.length,
                fixesApplied: analysisResult.needsPreprocessing ? analysisResult.issues.length : 0
            };
            
            return {
                rawResponse: rawResponse,
                processedResponse: processedResponse,
                analysisResult: analysisResult
            };
            
        } catch (error) {
            console.error('   ❌ Preprocessing test failed:', error.message);
            this.results.phases.preprocessing = {
                success: false,
                error: error.message
            };
            throw error;
        }
    }

    /**
     * Phase 4: Run RCC Code with File Redirection
     */
    async runRCCWithFileRedirection(setupResult) {
        console.log('\n📋 Phase 4: Run RCC Code with File Redirection');
        
        try {
            const { configFile, inputFile } = setupResult;
            const outputDir = path.join(this.testDir, 'output');
            
            // Prepare RCC command
            const rccCommand = [
                'node', 'rcc3', 'code',
                '--config', configFile,
                '--input', inputFile,
                '--output-dir', outputDir,
                '--verbose'
            ];
            
            console.log(`   🚀 Running RCC command: ${rccCommand.join(' ')}`);
            
            const startTime = Date.now();
            const result = await this.executeCommand(rccCommand, 120000); // 2 minute timeout
            const duration = Date.now() - startTime;
            
            console.log(`   ⏱️ RCC execution completed in ${duration}ms`);
            
            // Check execution result
            if (result.exitCode !== 0) {
                console.error('   ❌ RCC execution failed');
                console.error('   📝 STDOUT:', result.stdout);
                console.error('   📝 STDERR:', result.stderr);
                
                throw new Error(`RCC failed with exit code ${result.exitCode}`);
            }
            
            console.log('   ✅ RCC execution successful');
            
            // Check for output files
            const outputFiles = await fs.readdir(outputDir);
            console.log(`   📁 Output files created: ${outputFiles.length}`);
            
            // Look for the expected architecture summary file
            const expectedFiles = ['architecture-summary.md', 'project-architecture.md', 'README.md'];
            let createdFile = null;
            let fileContent = '';
            
            for (const expectedFile of expectedFiles) {
                if (outputFiles.includes(expectedFile)) {
                    createdFile = expectedFile;
                    const filePath = path.join(outputDir, expectedFile);
                    fileContent = await fs.readFile(filePath, 'utf-8');
                    break;
                }
            }
            
            // If no expected file found, check if any .md file was created
            if (!createdFile) {
                const mdFiles = outputFiles.filter(file => file.endsWith('.md'));
                if (mdFiles.length > 0) {
                    createdFile = mdFiles[0];
                    const filePath = path.join(outputDir, createdFile);
                    fileContent = await fs.readFile(filePath, 'utf-8');
                }
            }
            
            this.results.phases.rccExecution = {
                success: true,
                duration: duration,
                exitCode: result.exitCode,
                outputFiles: outputFiles,
                createdFile: createdFile,
                fileContentLength: fileContent.length,
                stdout: result.stdout,
                stderr: result.stderr
            };
            
            return {
                success: true,
                outputFiles: outputFiles,
                createdFile: createdFile,
                fileContent: fileContent,
                duration: duration
            };
            
        } catch (error) {
            console.error('   ❌ RCC execution failed:', error.message);
            this.results.phases.rccExecution = {
                success: false,
                error: error.message
            };
            throw error;
        }
    }

    /**
     * Phase 5: Validate Output and Results
     */
    async validateOutputAndResults(rccResult) {
        console.log('\n📋 Phase 5: Validate Output and Results');
        
        try {
            const validation = {
                fileCreated: false,
                contentValid: false,
                architectureContent: false,
                markdownFormat: false,
                toolCallsWorked: false,
                overallSuccess: false
            };
            
            // Check if file was created
            if (rccResult.createdFile && rccResult.fileContent.length > 0) {
                validation.fileCreated = true;
                console.log(`   ✅ File created: ${rccResult.createdFile} (${rccResult.fileContent.length} chars)`);
                
                // Check content validity
                if (rccResult.fileContent.length > 100) {
                    validation.contentValid = true;
                    console.log('   ✅ Content has reasonable length');
                }
                
                // Check for architecture-related content
                const architectureKeywords = [
                    'architecture', 'provider', 'router', 'claude', 'code',
                    '架构', '提供商', '路由', '模块', '系统'
                ];
                
                const contentLower = rccResult.fileContent.toLowerCase();
                const foundKeywords = architectureKeywords.filter(keyword => 
                    contentLower.includes(keyword.toLowerCase())
                );
                
                if (foundKeywords.length >= 3) {
                    validation.architectureContent = true;
                    console.log(`   ✅ Architecture content detected (${foundKeywords.length} keywords)`);
                }
                
                // Check markdown format
                if (rccResult.createdFile.endsWith('.md') && 
                    (rccResult.fileContent.includes('#') || rccResult.fileContent.includes('##'))) {
                    validation.markdownFormat = true;
                    console.log('   ✅ Valid markdown format detected');
                }
                
                // Check if tool calls worked (file creation indicates tool call success)
                if (validation.fileCreated && validation.contentValid) {
                    validation.toolCallsWorked = true;
                    console.log('   ✅ Tool calls worked (file creation successful)');
                }
                
            } else {
                console.log('   ❌ No output file created');
            }
            
            // Overall success criteria
            validation.overallSuccess = validation.fileCreated && 
                                      validation.contentValid && 
                                      validation.toolCallsWorked;
            
            if (validation.overallSuccess) {
                console.log('   🎉 E2E test validation PASSED');
            } else {
                console.log('   ❌ E2E test validation FAILED');
            }
            
            this.results.phases.validation = {
                success: validation.overallSuccess,
                checks: validation,
                createdFile: rccResult.createdFile,
                contentPreview: rccResult.fileContent.substring(0, 200) + '...'
            };
            
            return validation;
            
        } catch (error) {
            console.error('   ❌ Validation failed:', error.message);
            this.results.phases.validation = {
                success: false,
                error: error.message
            };
            throw error;
        }
    }

    /**
     * Helper Methods
     */
    
    analyzeResponseForPreprocessing(response) {
        const issues = [];
        let needsPreprocessing = false;
        
        // Check for finish_reason mismatch
        const hasToolCallContent = this.hasToolCallContent(response);
        const hasCorrectFinishReason = response.choices?.[0]?.finish_reason === 'tool_calls';
        
        if (hasToolCallContent && !hasCorrectFinishReason) {
            issues.push({
                type: 'finish_reason_mismatch',
                description: 'Tool call content found but finish_reason is not "tool_calls"',
                fixable: true
            });
            needsPreprocessing = true;
        }
        
        // Check for embedded tool calls
        const embeddedCalls = this.detectEmbeddedToolCalls(response);
        if (embeddedCalls.length > 0) {
            issues.push({
                type: 'embedded_tool_calls',
                description: `Found ${embeddedCalls.length} embedded tool calls`,
                fixable: true
            });
            needsPreprocessing = true;
        }
        
        // Check for format issues
        if (!response.id || !response.model) {
            issues.push({
                type: 'format_inconsistency',
                description: 'Missing required fields (id, model)',
                fixable: true
            });
            needsPreprocessing = true;
        }
        
        return { needsPreprocessing, issues };
    }
    
    hasToolCallContent(response) {
        const content = response.choices?.[0]?.message?.content || '';
        return content.includes('functions.') || 
               content.includes('Tool call:') ||
               response.choices?.[0]?.message?.tool_calls?.length > 0;
    }
    
    detectEmbeddedToolCalls(response) {
        const content = response.choices?.[0]?.message?.content || '';
        const embeddedCalls = [];
        
        // Pattern: functions.FunctionName
        const functionsPattern = /functions\.(\w+)\s*\n\s*(\{.*?\})/gs;
        let match;
        
        while ((match = functionsPattern.exec(content)) !== null) {
            embeddedCalls.push({
                functionName: match[1],
                args: match[2]
            });
        }
        
        return embeddedCalls;
    }
    
    applyPreprocessingFixes(response, issues) {
        let fixed = JSON.parse(JSON.stringify(response));
        
        for (const issue of issues) {
            switch (issue.type) {
                case 'finish_reason_mismatch':
                    if (fixed.choices && fixed.choices.length > 0) {
                        fixed.choices[0].finish_reason = 'tool_calls';
                    }
                    break;
                    
                case 'embedded_tool_calls':
                    fixed = this.extractEmbeddedToolCalls(fixed);
                    break;
                    
                case 'format_inconsistency':
                    if (!fixed.id) fixed.id = `lmstudio-${Date.now()}`;
                    if (!fixed.model) fixed.model = 'local-model';
                    if (!fixed.object) fixed.object = 'chat.completion';
                    break;
            }
        }
        
        return fixed;
    }
    
    extractEmbeddedToolCalls(response) {
        const fixed = JSON.parse(JSON.stringify(response));
        
        if (fixed.choices && fixed.choices.length > 0) {
            const choice = fixed.choices[0];
            const content = choice.message?.content || '';
            const embeddedCalls = this.detectEmbeddedToolCalls(response);
            
            if (embeddedCalls.length > 0) {
                // Create standard tool_calls
                choice.message.tool_calls = embeddedCalls.map((call, index) => ({
                    id: `call_${Date.now()}_${index}`,
                    type: 'function',
                    function: {
                        name: call.functionName,
                        arguments: call.args
                    }
                }));
                
                // Clean content
                let cleanedContent = content;
                embeddedCalls.forEach(call => {
                    const pattern = new RegExp(`functions\\.${call.functionName}\\s*\\n\\s*\\{.*?\\}`, 'gs');
                    cleanedContent = cleanedContent.replace(pattern, '');
                });
                
                choice.message.content = cleanedContent.trim() || null;
                choice.finish_reason = 'tool_calls';
            }
        }
        
        return fixed;
    }
    
    async executeCommand(command, timeout = 60000) {
        return new Promise((resolve, reject) => {
            const [cmd, ...args] = command;
            const child = spawn(cmd, args, { 
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });
            
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            child.on('close', (code) => {
                resolve({
                    exitCode: code,
                    stdout: stdout,
                    stderr: stderr
                });
            });
            
            child.on('error', (error) => {
                reject(error);
            });
            
            // Set timeout
            const timer = setTimeout(() => {
                child.kill();
                reject(new Error(`Command timeout after ${timeout}ms`));
            }, timeout);
            
            child.on('close', () => {
                clearTimeout(timer);
            });
        });
    }

    /**
     * Main test execution
     */
    async runFullE2ETest() {
        console.log('\n🚀 Starting LMStudio E2E File Redirection Test...\n');
        
        try {
            // Phase 1: Setup
            const setupResult = await this.setupTestEnvironment();
            this.results.summary.total++;
            if (this.results.phases.setup.success) this.results.summary.passed++;
            else this.results.summary.failed++;
            
            // Phase 2: Verify server
            await this.verifyLMStudioServer();
            this.results.summary.total++;
            if (this.results.phases.serverVerification.success) this.results.summary.passed++;
            else this.results.summary.failed++;
            
            // Phase 3: Test preprocessing
            const preprocessingResult = await this.testPreprocessingWithCapturedData();
            this.results.summary.total++;
            if (this.results.phases.preprocessing.success) this.results.summary.passed++;
            else this.results.summary.failed++;
            
            // Phase 4: Run RCC
            const rccResult = await this.runRCCWithFileRedirection(setupResult);
            this.results.summary.total++;
            if (this.results.phases.rccExecution.success) this.results.summary.passed++;
            else this.results.summary.failed++;
            
            // Phase 5: Validate
            const validationResult = await this.validateOutputAndResults(rccResult);
            this.results.summary.total++;
            if (this.results.phases.validation.success) this.results.summary.passed++;
            else this.results.summary.failed++;
            
            // Save results
            await this.saveResults();
            
            return this.results;
            
        } catch (error) {
            console.error('❌ E2E test execution failed:', error.message);
            this.results.error = error.message;
            this.results.summary.failed = this.results.summary.total;
            return this.results;
        }
    }
    
    async saveResults() {
        const resultsFile = path.join(this.testDir, `${this.testId}-results.json`);
        await fs.writeFile(resultsFile, JSON.stringify(this.results, null, 2));
        
        console.log(`\n💾 E2E test results saved: ${resultsFile}`);
        
        // Print summary
        console.log('\n📊 E2E Test Summary:');
        console.log(`   ✅ Passed: ${this.results.summary.passed}/${this.results.summary.total}`);
        console.log(`   ❌ Failed: ${this.results.summary.failed}/${this.results.summary.total}`);
        console.log(`   📁 Test directory: ${this.testDir}`);
        
        const success = this.results.summary.failed === 0;
        console.log(`\n🎯 Overall Result: ${success ? '✅ PASSED' : '❌ FAILED'}`);
        
        return success;
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new LMStudioE2EFileRedirectionTest();
    
    tester.runFullE2ETest()
        .then(results => {
            const success = results.summary.failed === 0;
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 E2E test system failed:', error);
            process.exit(1);
        });
}

export default LMStudioE2EFileRedirectionTest;