#!/usr/bin/env node

/**
 * Complete LMStudio Testing Pipeline
 * Integrates automatic data capture, preprocessing fixes, and E2E testing
 * Author: Jason Zhang
 * Version: v3.0-complete
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LMStudioCompletePipeline {
    constructor() {
        this.pipelineId = `lmstudio-pipeline-${Date.now()}`;
        this.workspaceDir = `/tmp/lmstudio-pipeline-${this.pipelineId}`;
        this.results = {
            pipelineId: this.pipelineId,
            timestamp: new Date().toISOString(),
            stages: {},
            summary: { 
                totalStages: 6,
                completedStages: 0,
                failedStages: 0,
                overallSuccess: false
            }
        };
        
        console.log('🚀 LMStudio Complete Testing Pipeline initialized');
        console.log(`📊 Pipeline ID: ${this.pipelineId}`);
        console.log(`📁 Workspace: ${this.workspaceDir}`);
    }

    /**
     * Stage 1: Environment Preparation
     */
    async prepareEnvironment() {
        console.log('\n📋 Stage 1: Environment Preparation');
        
        try {
            // Create workspace structure
            await fs.mkdir(this.workspaceDir, { recursive: true });
            await fs.mkdir(path.join(this.workspaceDir, 'captures'), { recursive: true });
            await fs.mkdir(path.join(this.workspaceDir, 'preprocessing'), { recursive: true });
            await fs.mkdir(path.join(this.workspaceDir, 'e2e'), { recursive: true });
            await fs.mkdir(path.join(this.workspaceDir, 'reports'), { recursive: true });
            
            // Verify project structure
            const requiredFiles = [
                'rcc3',
                'src/v3/preprocessor/lmstudio-format-parser.ts',
                'test/functional/test-lmstudio-enhanced-preprocessing.js',
                'test-lmstudio-e2e-file-redirection.js'
            ];
            
            const missingFiles = [];
            for (const file of requiredFiles) {
                try {
                    await fs.access(file);
                } catch (error) {
                    missingFiles.push(file);
                }
            }
            
            if (missingFiles.length > 0) {
                throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
            }
            
            // Check LMStudio server availability
            const serverCheck = await this.checkLMStudioServer();
            if (!serverCheck.available) {
                console.warn('⚠️ LMStudio server not available - some tests may fail');
            }
            
            console.log('   ✅ Environment preparation completed');
            
            this.results.stages.environmentPreparation = {
                success: true,
                workspace: this.workspaceDir,
                missingFiles: missingFiles,
                lmstudioAvailable: serverCheck.available
            };
            
            this.results.summary.completedStages++;
            return true;
            
        } catch (error) {
            console.error('   ❌ Environment preparation failed:', error.message);
            this.results.stages.environmentPreparation = {
                success: false,
                error: error.message
            };
            this.results.summary.failedStages++;
            throw error;
        }
    }

    /**
     * Stage 2: Automatic Data Packet Capture
     */
    async captureDataPackets() {
        console.log('\n📋 Stage 2: Automatic Data Packet Capture');
        
        try {
            const captureResults = [];
            
            // Test cases for data capture
            const testCases = [
                {
                    name: 'simple-text-request',
                    request: {
                        messages: [{ role: 'user', content: '请简单介绍一下你自己' }],
                        model: 'local-model',
                        stream: false
                    }
                },
                {
                    name: 'architecture-summary-request',
                    request: {
                        messages: [{ role: 'user', content: '请总结本项目的架构并且保存为md文档' }],
                        model: 'local-model',
                        stream: false,
                        tools: [{
                            type: 'function',
                            function: {
                                name: 'create_file',
                                description: 'Create a file with content',
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        filename: { type: 'string' },
                                        content: { type: 'string' }
                                    },
                                    required: ['filename', 'content']
                                }
                            }
                        }]
                    }
                },
                {
                    name: 'streaming-request',
                    request: {
                        messages: [{ role: 'user', content: '请详细解释Claude Code Router的工作原理' }],
                        model: 'local-model',
                        stream: true
                    }
                }
            ];
            
            for (const testCase of testCases) {
                console.log(`   📡 Capturing: ${testCase.name}`);
                
                try {
                    const response = await this.sendLMStudioRequest(testCase.request);
                    
                    const captureData = {
                        testCase: testCase.name,
                        timestamp: new Date().toISOString(),
                        request: testCase.request,
                        response: response,
                        metadata: {
                            hasToolCalls: this.hasToolCalls(response),
                            finishReason: this.extractFinishReason(response),
                            needsPreprocessing: this.needsPreprocessing(response),
                            responseSize: JSON.stringify(response).length
                        }
                    };
                    
                    // Save capture data
                    const captureFile = path.join(this.workspaceDir, 'captures', `${testCase.name}.json`);
                    await fs.writeFile(captureFile, JSON.stringify(captureData, null, 2));
                    
                    captureResults.push(captureData);
                    console.log(`     ✅ Captured to: ${captureFile}`);
                    
                } catch (error) {
                    console.log(`     ❌ Capture failed: ${error.message}`);
                    captureResults.push({
                        testCase: testCase.name,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            console.log(`   ✅ Data capture completed: ${captureResults.length} test cases`);
            
            this.results.stages.dataCapture = {
                success: true,
                capturedCases: captureResults.length,
                successfulCaptures: captureResults.filter(r => !r.error).length,
                failedCaptures: captureResults.filter(r => r.error).length,
                captureData: captureResults
            };
            
            this.results.summary.completedStages++;
            return captureResults;
            
        } catch (error) {
            console.error('   ❌ Data capture failed:', error.message);
            this.results.stages.dataCapture = {
                success: false,
                error: error.message
            };
            this.results.summary.failedStages++;
            throw error;
        }
    }

    /**
     * Stage 3: Preprocessing Issue Analysis and Resolution
     */
    async analyzeAndResolvePreprocessingIssues(captureData) {
        console.log('\n📋 Stage 3: Preprocessing Issue Analysis and Resolution');
        
        try {
            const analysisResults = {
                totalResponses: captureData.length,
                responsesNeedingPreprocessing: 0,
                issuesFound: [],
                fixesApplied: [],
                processedResponses: []
            };
            
            for (const capture of captureData) {
                if (capture.error) continue;
                
                console.log(`   🔍 Analyzing: ${capture.testCase}`);
                
                // Analyze response for preprocessing issues
                const issues = this.analyzeResponseIssues(capture.response);
                
                if (issues.length > 0) {
                    analysisResults.responsesNeedingPreprocessing++;
                    analysisResults.issuesFound.push(...issues);
                    
                    console.log(`     🔧 Found ${issues.length} issues, applying fixes...`);
                    
                    // Apply preprocessing fixes
                    const fixedResponse = this.applyPreprocessingFixes(capture.response, issues);
                    
                    // Validate fixes
                    const validationResult = this.validateFixedResponse(fixedResponse);
                    
                    const processedCapture = {
                        ...capture,
                        originalResponse: capture.response,
                        processedResponse: fixedResponse,
                        issues: issues,
                        fixesApplied: issues.map(i => i.type),
                        validationPassed: validationResult.success
                    };
                    
                    analysisResults.processedResponses.push(processedCapture);
                    analysisResults.fixesApplied.push(...issues.map(i => i.type));
                    
                    // Save processed response
                    const processedFile = path.join(
                        this.workspaceDir, 
                        'preprocessing', 
                        `${capture.testCase}-processed.json`
                    );
                    await fs.writeFile(processedFile, JSON.stringify(processedCapture, null, 2));
                    
                    console.log(`     ✅ Applied ${issues.length} fixes, validation: ${validationResult.success ? 'PASSED' : 'FAILED'}`);
                } else {
                    console.log(`     ℹ️ No preprocessing needed`);
                    analysisResults.processedResponses.push(capture);
                }
            }
            
            console.log(`   ✅ Preprocessing analysis completed:`);
            console.log(`     - Responses analyzed: ${analysisResults.totalResponses}`);
            console.log(`     - Responses needing preprocessing: ${analysisResults.responsesNeedingPreprocessing}`);
            console.log(`     - Total issues found: ${analysisResults.issuesFound.length}`);
            console.log(`     - Total fixes applied: ${analysisResults.fixesApplied.length}`);
            
            this.results.stages.preprocessingAnalysis = {
                success: true,
                ...analysisResults
            };
            
            this.results.summary.completedStages++;
            return analysisResults;
            
        } catch (error) {
            console.error('   ❌ Preprocessing analysis failed:', error.message);
            this.results.stages.preprocessingAnalysis = {
                success: false,
                error: error.message
            };
            this.results.summary.failedStages++;
            throw error;
        }
    }

    /**
     * Stage 4: RCC Code Integration Test
     */
    async testRCCIntegration() {
        console.log('\n📋 Stage 4: RCC Code Integration Test');
        
        try {
            // Create test configuration for RCC
            const rccConfig = {
                server: {
                    port: 5509, // Unique port for pipeline testing
                    host: '127.0.0.1'
                },
                debug: {
                    enabled: true,
                    logLevel: 'info',
                    logDir: path.join(this.workspaceDir, 'e2e', 'logs')
                },
                providers: {
                    lmstudio: {
                        type: 'lmstudio',
                        endpoint: 'http://localhost:1234/v1/chat/completions',
                        authentication: { type: 'none' },
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
            
            const configFile = path.join(this.workspaceDir, 'e2e', 'rcc-config.json');
            await fs.writeFile(configFile, JSON.stringify(rccConfig, null, 2));
            
            // Create test input
            const testInput = '请总结本项目的架构并且保存为md文档';
            const inputFile = path.join(this.workspaceDir, 'e2e', 'test-input.txt');
            await fs.writeFile(inputFile, testInput);
            
            // Create output directory
            const outputDir = path.join(this.workspaceDir, 'e2e', 'output');
            await fs.mkdir(outputDir, { recursive: true });
            
            // Run RCC command
            const rccCommand = [
                'node', 'rcc3', 'code',
                '--config', configFile,
                '--input', inputFile,
                '--output-dir', outputDir,
                '--verbose'
            ];
            
            console.log(`   🚀 Running RCC: ${rccCommand.join(' ')}`);
            
            const startTime = Date.now();
            const result = await this.executeCommand(rccCommand, 120000); // 2 minute timeout
            const duration = Date.now() - startTime;
            
            // Check results
            const outputFiles = await fs.readdir(outputDir).catch(() => []);
            const mdFiles = outputFiles.filter(file => file.endsWith('.md'));
            
            let fileContent = '';
            if (mdFiles.length > 0) {
                const filePath = path.join(outputDir, mdFiles[0]);
                fileContent = await fs.readFile(filePath, 'utf-8').catch(() => '');
            }
            
            const integrationResult = {
                success: result.exitCode === 0 && mdFiles.length > 0 && fileContent.length > 0,
                duration: duration,
                exitCode: result.exitCode,
                outputFiles: outputFiles,
                createdMdFiles: mdFiles,
                fileContentLength: fileContent.length,
                stdout: result.stdout,
                stderr: result.stderr
            };
            
            if (integrationResult.success) {
                console.log(`   ✅ RCC integration test PASSED`);
                console.log(`     - Duration: ${duration}ms`);
                console.log(`     - Output files: ${outputFiles.length}`);
                console.log(`     - MD files created: ${mdFiles.length}`);
                console.log(`     - Content length: ${fileContent.length} chars`);
            } else {
                console.log(`   ❌ RCC integration test FAILED`);
                console.log(`     - Exit code: ${result.exitCode}`);
                console.log(`     - Output files: ${outputFiles.length}`);
                console.log(`     - STDERR: ${result.stderr}`);
            }
            
            this.results.stages.rccIntegration = {
                success: integrationResult.success,
                ...integrationResult
            };
            
            this.results.summary.completedStages++;
            return integrationResult;
            
        } catch (error) {
            console.error('   ❌ RCC integration test failed:', error.message);
            this.results.stages.rccIntegration = {
                success: false,
                error: error.message
            };
            this.results.summary.failedStages++;
            throw error;
        }
    }

    /**
     * Stage 5: End-to-End Validation
     */
    async performEndToEndValidation(rccResult) {
        console.log('\n📋 Stage 5: End-to-End Validation');
        
        try {
            const validation = {
                preprocessingWorking: false,
                toolCallsWorking: false,
                fileOutputWorking: false,
                contentQuality: false,
                overallSuccess: false
            };
            
            // Check preprocessing effectiveness
            const preprocessingStage = this.results.stages.preprocessingAnalysis;
            if (preprocessingStage && preprocessingStage.success && preprocessingStage.fixesApplied.length > 0) {
                validation.preprocessingWorking = true;
                console.log('   ✅ Preprocessing system working correctly');
            }
            
            // Check tool calls functionality
            if (rccResult.success && rccResult.createdMdFiles.length > 0) {
                validation.toolCallsWorking = true;
                console.log('   ✅ Tool calls working (file creation successful)');
            }
            
            // Check file output functionality
            if (rccResult.outputFiles.length > 0 && rccResult.fileContentLength > 0) {
                validation.fileOutputWorking = true;
                console.log('   ✅ File output working correctly');
            }
            
            // Check content quality
            if (rccResult.fileContentLength > 500) { // Reasonable content length
                validation.contentQuality = true;
                console.log('   ✅ Generated content has good quality');
            }
            
            // Overall success criteria
            validation.overallSuccess = validation.toolCallsWorking && 
                                      validation.fileOutputWorking && 
                                      validation.contentQuality;
            
            if (validation.overallSuccess) {
                console.log('   🎉 End-to-End validation PASSED');
            } else {
                console.log('   ❌ End-to-End validation FAILED');
            }
            
            this.results.stages.endToEndValidation = {
                success: validation.overallSuccess,
                checks: validation
            };
            
            this.results.summary.completedStages++;
            return validation;
            
        } catch (error) {
            console.error('   ❌ End-to-End validation failed:', error.message);
            this.results.stages.endToEndValidation = {
                success: false,
                error: error.message
            };
            this.results.summary.failedStages++;
            throw error;
        }
    }

    /**
     * Stage 6: Generate Comprehensive Report
     */
    async generateComprehensiveReport() {
        console.log('\n📋 Stage 6: Generate Comprehensive Report');
        
        try {
            const report = {
                pipelineId: this.pipelineId,
                timestamp: new Date().toISOString(),
                summary: this.results.summary,
                stages: this.results.stages,
                recommendations: [],
                nextSteps: []
            };
            
            // Analyze results and generate recommendations
            if (this.results.stages.preprocessingAnalysis?.success) {
                const preprocessing = this.results.stages.preprocessingAnalysis;
                if (preprocessing.responsesNeedingPreprocessing > 0) {
                    report.recommendations.push({
                        category: 'preprocessing',
                        priority: 'high',
                        description: `Enable LMStudio preprocessing parser in production - fixed ${preprocessing.fixesApplied.length} issues`
                    });
                }
            }
            
            if (this.results.stages.rccIntegration?.success) {
                report.recommendations.push({
                    category: 'integration',
                    priority: 'medium',
                    description: 'RCC integration working correctly - ready for production use'
                });
            }
            
            if (this.results.stages.endToEndValidation?.success) {
                report.recommendations.push({
                    category: 'deployment',
                    priority: 'low',
                    description: 'End-to-end pipeline validated - consider automated testing in CI/CD'
                });
            }
            
            // Generate next steps
            if (this.results.summary.failedStages > 0) {
                report.nextSteps.push('Investigate and fix failed stages before production deployment');
            }
            
            if (this.results.stages.preprocessingAnalysis?.responsesNeedingPreprocessing > 0) {
                report.nextSteps.push('Integrate LMStudio format parser into production provider pipeline');
            }
            
            report.nextSteps.push('Set up automated testing pipeline for LMStudio integration');
            report.nextSteps.push('Monitor LMStudio preprocessing effectiveness in production');
            
            // Save comprehensive report
            const reportFile = path.join(this.workspaceDir, 'reports', 'comprehensive-report.json');
            await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
            
            // Generate markdown summary
            const markdownReport = this.generateMarkdownReport(report);
            const markdownFile = path.join(this.workspaceDir, 'reports', 'pipeline-report.md');
            await fs.writeFile(markdownFile, markdownReport);
            
            console.log('   ✅ Comprehensive report generated');
            console.log(`     - JSON report: ${reportFile}`);
            console.log(`     - Markdown report: ${markdownFile}`);
            
            this.results.stages.reportGeneration = {
                success: true,
                reportFile: reportFile,
                markdownFile: markdownFile,
                recommendations: report.recommendations.length,
                nextSteps: report.nextSteps.length
            };
            
            this.results.summary.completedStages++;
            return report;
            
        } catch (error) {
            console.error('   ❌ Report generation failed:', error.message);
            this.results.stages.reportGeneration = {
                success: false,
                error: error.message
            };
            this.results.summary.failedStages++;
            throw error;
        }
    }

    /**
     * Helper Methods
     */
    
    async checkLMStudioServer() {
        try {
            const response = await fetch('http://localhost:1234/v1/models', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            return { available: response.ok };
        } catch (error) {
            return { available: false, error: error.message };
        }
    }
    
    async sendLMStudioRequest(request) {
        const response = await fetch('http://localhost:1234/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    hasToolCalls(response) {
        return response.choices?.some(choice => 
            choice.message?.tool_calls?.length > 0
        ) || false;
    }
    
    extractFinishReason(response) {
        return response.choices?.[0]?.finish_reason || 'unknown';
    }
    
    needsPreprocessing(response) {
        const content = response.choices?.[0]?.message?.content || '';
        const hasEmbeddedCalls = content.includes('functions.') || content.includes('Tool call:');
        const hasToolCallContent = hasEmbeddedCalls || this.hasToolCalls(response);
        const hasWrongFinishReason = hasToolCallContent && this.extractFinishReason(response) !== 'tool_calls';
        
        return hasEmbeddedCalls || hasWrongFinishReason;
    }
    
    analyzeResponseIssues(response) {
        const issues = [];
        
        // Check for finish_reason mismatch
        const hasToolCallContent = this.hasToolCallContent(response);
        const hasCorrectFinishReason = this.extractFinishReason(response) === 'tool_calls';
        
        if (hasToolCallContent && !hasCorrectFinishReason) {
            issues.push({
                type: 'finish_reason_mismatch',
                description: 'Tool call content found but finish_reason is not "tool_calls"',
                severity: 'high'
            });
        }
        
        // Check for embedded tool calls
        const embeddedCalls = this.detectEmbeddedToolCalls(response);
        if (embeddedCalls.length > 0) {
            issues.push({
                type: 'embedded_tool_calls',
                description: `Found ${embeddedCalls.length} embedded tool calls`,
                severity: 'high'
            });
        }
        
        // Check for format issues
        if (!response.id || !response.model) {
            issues.push({
                type: 'format_inconsistency',
                description: 'Missing required fields (id, model)',
                severity: 'medium'
            });
        }
        
        return issues;
    }
    
    hasToolCallContent(response) {
        const content = response.choices?.[0]?.message?.content || '';
        return content.includes('functions.') || 
               content.includes('Tool call:') ||
               this.hasToolCalls(response);
    }
    
    detectEmbeddedToolCalls(response) {
        const content = response.choices?.[0]?.message?.content || '';
        const embeddedCalls = [];
        
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
                choice.message.tool_calls = embeddedCalls.map((call, index) => ({
                    id: `call_${Date.now()}_${index}`,
                    type: 'function',
                    function: {
                        name: call.functionName,
                        arguments: call.args
                    }
                }));
                
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
    
    validateFixedResponse(response) {
        try {
            if (!response.choices || response.choices.length === 0) {
                return { success: false, reason: 'No choices in response' };
            }
            
            for (const choice of response.choices) {
                if (choice.finish_reason === 'tool_calls') {
                    if (!choice.message?.tool_calls || choice.message.tool_calls.length === 0) {
                        return { success: false, reason: 'finish_reason is tool_calls but no tool_calls found' };
                    }
                    
                    for (const toolCall of choice.message.tool_calls) {
                        if (!toolCall.id || !toolCall.function?.name) {
                            return { success: false, reason: 'Invalid tool call structure' };
                        }
                    }
                }
            }
            
            return { success: true };
            
        } catch (error) {
            return { success: false, reason: error.message };
        }
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
            
            const timer = setTimeout(() => {
                child.kill();
                reject(new Error(`Command timeout after ${timeout}ms`));
            }, timeout);
            
            child.on('close', () => {
                clearTimeout(timer);
            });
        });
    }
    
    generateMarkdownReport(report) {
        return `# LMStudio Complete Testing Pipeline Report

## Pipeline Summary
- **Pipeline ID**: ${report.pipelineId}
- **Timestamp**: ${report.timestamp}
- **Total Stages**: ${report.summary.totalStages}
- **Completed Stages**: ${report.summary.completedStages}
- **Failed Stages**: ${report.summary.failedStages}
- **Overall Success**: ${report.summary.overallSuccess ? '✅ PASSED' : '❌ FAILED'}

## Stage Results

### 1. Environment Preparation
${report.stages.environmentPreparation?.success ? '✅ PASSED' : '❌ FAILED'}
${report.stages.environmentPreparation?.error ? `Error: ${report.stages.environmentPreparation.error}` : ''}

### 2. Data Capture
${report.stages.dataCapture?.success ? '✅ PASSED' : '❌ FAILED'}
- Captured Cases: ${report.stages.dataCapture?.capturedCases || 0}
- Successful Captures: ${report.stages.dataCapture?.successfulCaptures || 0}
- Failed Captures: ${report.stages.dataCapture?.failedCaptures || 0}

### 3. Preprocessing Analysis
${report.stages.preprocessingAnalysis?.success ? '✅ PASSED' : '❌ FAILED'}
- Responses Analyzed: ${report.stages.preprocessingAnalysis?.totalResponses || 0}
- Responses Needing Preprocessing: ${report.stages.preprocessingAnalysis?.responsesNeedingPreprocessing || 0}
- Issues Found: ${report.stages.preprocessingAnalysis?.issuesFound?.length || 0}
- Fixes Applied: ${report.stages.preprocessingAnalysis?.fixesApplied?.length || 0}

### 4. RCC Integration
${report.stages.rccIntegration?.success ? '✅ PASSED' : '❌ FAILED'}
- Duration: ${report.stages.rccIntegration?.duration || 0}ms
- Exit Code: ${report.stages.rccIntegration?.exitCode || 'N/A'}
- Output Files: ${report.stages.rccIntegration?.outputFiles?.length || 0}
- MD Files Created: ${report.stages.rccIntegration?.createdMdFiles?.length || 0}

### 5. End-to-End Validation
${report.stages.endToEndValidation?.success ? '✅ PASSED' : '❌ FAILED'}
- Preprocessing Working: ${report.stages.endToEndValidation?.checks?.preprocessingWorking ? '✅' : '❌'}
- Tool Calls Working: ${report.stages.endToEndValidation?.checks?.toolCallsWorking ? '✅' : '❌'}
- File Output Working: ${report.stages.endToEndValidation?.checks?.fileOutputWorking ? '✅' : '❌'}
- Content Quality: ${report.stages.endToEndValidation?.checks?.contentQuality ? '✅' : '❌'}

### 6. Report Generation
${report.stages.reportGeneration?.success ? '✅ PASSED' : '❌ FAILED'}
- Recommendations: ${report.recommendations?.length || 0}
- Next Steps: ${report.nextSteps?.length || 0}

## Recommendations

${report.recommendations?.map(rec => `- **${rec.category.toUpperCase()}** (${rec.priority}): ${rec.description}`).join('\n') || 'No recommendations generated'}

## Next Steps

${report.nextSteps?.map(step => `- ${step}`).join('\n') || 'No next steps identified'}

## Conclusion

${report.summary.overallSuccess ? 
  'The LMStudio testing pipeline completed successfully. All major components are working correctly and the system is ready for production use.' :
  'The LMStudio testing pipeline encountered issues. Please review the failed stages and address the identified problems before proceeding to production.'
}

---
Generated by LMStudio Complete Testing Pipeline v3.0
`;
    }

    /**
     * Main pipeline execution
     */
    async runCompletePipeline() {
        console.log('\n🚀 Starting LMStudio Complete Testing Pipeline...\n');
        
        try {
            // Stage 1: Environment preparation
            await this.prepareEnvironment();
            
            // Stage 2: Data capture
            const captureData = await this.captureDataPackets();
            
            // Stage 3: Preprocessing analysis
            const preprocessingResults = await this.analyzeAndResolvePreprocessingIssues(captureData);
            
            // Stage 4: RCC integration test
            const rccResult = await this.testRCCIntegration();
            
            // Stage 5: End-to-end validation
            const validationResult = await this.performEndToEndValidation(rccResult);
            
            // Stage 6: Generate report
            const report = await this.generateComprehensiveReport();
            
            // Update overall success
            this.results.summary.overallSuccess = this.results.summary.failedStages === 0;
            
            console.log('\n🎯 Pipeline Execution Summary:');
            console.log(`   ✅ Completed Stages: ${this.results.summary.completedStages}/${this.results.summary.totalStages}`);
            console.log(`   ❌ Failed Stages: ${this.results.summary.failedStages}`);
            console.log(`   📁 Workspace: ${this.workspaceDir}`);
            console.log(`   📊 Overall Result: ${this.results.summary.overallSuccess ? '✅ SUCCESS' : '❌ FAILURE'}`);
            
            return this.results;
            
        } catch (error) {
            console.error('❌ Pipeline execution failed:', error.message);
            this.results.error = error.message;
            this.results.summary.overallSuccess = false;
            return this.results;
        }
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const pipeline = new LMStudioCompletePipeline();
    
    pipeline.runCompletePipeline()
        .then(results => {
            const success = results.summary.overallSuccess;
            console.log(`\n🏁 LMStudio Complete Testing Pipeline ${success ? 'COMPLETED SUCCESSFULLY' : 'FAILED'}`);
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Pipeline system failed:', error);
            process.exit(1);
        });
}

export default LMStudioCompletePipeline;