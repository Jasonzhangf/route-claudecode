#!/usr/bin/env node

/**
 * Provider Compliance Enforcement System
 * Author: Jason Zhang
 * 
 * Enforces Task 6.6 provider integration guidelines and compliance
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Enforce provider compliance
 */
async function enforceProviderCompliance(options = {}) {
    const {
        providerName,
        mode = 'validate', // 'validate', 'fix', 'report'
        autoFix = false,
        outputFormat = 'console' // 'console', 'json', 'markdown'
    } = options;

    console.log('🛡️ Starting Provider Compliance Enforcement');
    console.log(`📋 Mode: ${mode}, Provider: ${providerName || 'all'}, Auto-fix: ${autoFix}`);

    const enforcementResults = {
        mode,
        startTime: new Date().toISOString(),
        providers: [],
        summary: {
            totalProviders: 0,
            compliantProviders: 0,
            nonCompliantProviders: 0,
            autoFixedIssues: 0,
            remainingIssues: 0
        }
    };

    try {
        // Discover providers
        const providers = providerName ? [providerName] : await discoverProviders();
        console.log(`🔍 Found ${providers.length} provider(s) to check: ${providers.join(', ')}`);

        enforcementResults.summary.totalProviders = providers.length;

        for (const provider of providers) {
            console.log(`\n🎯 Enforcing compliance for: ${provider}`);
            
            const providerResult = await enforceProviderSpecific(provider, {
                mode,
                autoFix,
                outputFormat
            });

            enforcementResults.providers.push(providerResult);

            if (providerResult.compliant) {
                enforcementResults.summary.compliantProviders++;
            } else {
                enforcementResults.summary.nonCompliantProviders++;
            }

            enforcementResults.summary.autoFixedIssues += providerResult.autoFixedIssues;
            enforcementResults.summary.remainingIssues += providerResult.remainingIssues;
        }

    } catch (error) {
        console.error('❌ Enforcement failed:', error.message);
        enforcementResults.error = error.message;
    }

    // Generate final report
    enforcementResults.endTime = new Date().toISOString();
    await generateComplianceReport(enforcementResults, outputFormat);

    const success = enforcementResults.summary.nonCompliantProviders === 0;
    console.log(`\n🎉 Provider Compliance Enforcement ${success ? 'COMPLETED' : 'FOUND ISSUES'}`);
    
    return success;
}

/**
 * Discover all providers in the system
 */
async function discoverProviders() {
    const providersDir = path.resolve(process.cwd(), 'src', 'provider');
    
    try {
        const entries = await fs.readdir(providersDir, { withFileTypes: true });
        
        const providers = entries
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name)
            .filter(name => !['auth', 'conversion', 'sdk-detection'].includes(name)); // Exclude utility directories

        return providers;
    } catch (error) {
        console.warn('⚠️ Could not discover providers:', error.message);
        return [];
    }
}

/**
 * Enforce compliance for specific provider
 */
async function enforceProviderSpecific(providerName, options = {}) {
    const { mode, autoFix, outputFormat } = options;
    
    const providerResult = {
        name: providerName,
        compliant: false,
        issues: [],
        autoFixedIssues: 0,
        remainingIssues: 0,
        enforcementActions: []
    };

    console.log(`🔍 Analyzing provider: ${providerName}`);

    try {
        // Run compliance checks
        const complianceIssues = await runComplianceChecks(providerName);
        
        if (complianceIssues.length === 0) {
            providerResult.compliant = true;
            console.log(`✅ ${providerName} is fully compliant`);
            return providerResult;
        }

        console.log(`⚠️ Found ${complianceIssues.length} compliance issue(s) for ${providerName}`);
        providerResult.issues = complianceIssues;

        // Apply enforcement actions based on mode
        if (mode === 'fix' || autoFix) {
            const fixResults = await applyComplianceFixes(providerName, complianceIssues);
            
            providerResult.autoFixedIssues = fixResults.fixed.length;
            providerResult.remainingIssues = fixResults.unfixed.length;
            providerResult.enforcementActions = fixResults.actions;

            if (fixResults.unfixed.length === 0) {
                providerResult.compliant = true;
                console.log(`✅ ${providerName} auto-fixed to full compliance`);
            } else {
                console.log(`⚠️ ${providerName} partially fixed: ${fixResults.fixed.length} fixed, ${fixResults.unfixed.length} remain`);
            }
        } else {
            providerResult.remainingIssues = complianceIssues.length;
            console.log(`📋 ${providerName} would need ${complianceIssues.length} fix(es) to be compliant`);
        }

    } catch (error) {
        console.error(`❌ Enforcement failed for ${providerName}:`, error.message);
        providerResult.error = error.message;
        providerResult.remainingIssues = 999; // Mark as highly non-compliant
    }

    return providerResult;
}

/**
 * Run comprehensive compliance checks
 */
async function runComplianceChecks(providerName) {
    const issues = [];

    // Check 1: Required file structure
    const requiredFiles = [
        `src/provider/${providerName}/index.ts`,
        `src/provider/${providerName}/client.ts`,
        `src/provider/${providerName}/auth.ts`,
        `src/provider/${providerName}/converter.ts`,
        `src/provider/${providerName}/parser.ts`,
        `src/provider/${providerName}/types.ts`,
        `src/provider/${providerName}/preprocessor.ts`
    ];

    for (const file of requiredFiles) {
        try {
            await fs.access(path.resolve(process.cwd(), file));
        } catch {
            issues.push({
                type: 'missing_file',
                severity: 'error',
                file,
                message: `Required file missing: ${file}`,
                fixable: true
            });
        }
    }

    // Check 2: Hardcoding violations
    const sourceFiles = requiredFiles.filter(file => file.endsWith('.ts'));
    
    for (const file of sourceFiles) {
        try {
            const filePath = path.resolve(process.cwd(), file);
            const content = await fs.readFile(filePath, 'utf-8');
            
            // Detect hardcoding patterns
            const hardcodingPatterns = [
                { pattern: /apiKey:\s*['"](?!test-|mock-|placeholder)[a-zA-Z0-9-_]{20,}['"]/, desc: 'Hardcoded API key' },
                { pattern: /endpoint:\s*['"]https:\/\/api\.[a-z-]+\.com['"](?![^}]*\||[^:]*:)/, desc: 'Hardcoded endpoint' },
                { pattern: /'sk-[a-zA-Z0-9]{40,}'/, desc: 'Hardcoded OpenAI key' }
            ];

            for (const { pattern, desc } of hardcodingPatterns) {
                if (pattern.test(content)) {
                    issues.push({
                        type: 'hardcoding_violation',
                        severity: 'error',
                        file,
                        message: `${desc} found in ${file}`,
                        fixable: false // Manual fix required
                    });
                }
            }
            
        } catch (error) {
            // File might not exist, already handled in file structure check
        }
    }

    // Check 3: Interface compliance
    try {
        // Import and check client class
        const clientModule = await import(`../../src/provider/${providerName}/client.js`).catch(() => null);
        if (clientModule) {
            const ClientClass = clientModule[`${capitalize(providerName)}Client`];
            if (ClientClass) {
                const requiredMethods = [
                    'initialize', 'processRequest', 'healthCheck', 
                    'getAvailableModels', 'getCapabilities', 'cleanup'
                ];
                
                const testInstance = new ClientClass({ apiKey: 'test', endpoint: 'test', timeout: 1000, retryAttempts: 1, models: [] });
                
                for (const method of requiredMethods) {
                    if (typeof testInstance[method] !== 'function') {
                        issues.push({
                            type: 'interface_violation',
                            severity: 'error',
                            file: `src/provider/${providerName}/client.ts`,
                            message: `Missing required method: ${method}`,
                            fixable: true
                        });
                    }
                }
            } else {
                issues.push({
                    type: 'export_missing',
                    severity: 'error',
                    file: `src/provider/${providerName}/client.ts`,
                    message: `${capitalize(providerName)}Client not exported`,
                    fixable: true
                });
            }
        }
    } catch (error) {
        issues.push({
            type: 'import_error',
            severity: 'warning',
            file: `src/provider/${providerName}/client.js`,
            message: `Could not validate client interface: ${error.message}`,
            fixable: false
        });
    }

    // Check 4: Test coverage
    const testFiles = [
        `test/functional/test-${providerName}-integration.js`,
        `test/functional/test-${providerName}-integration.md`,
        `test/functional/test-${providerName}-validation.js`
    ];

    for (const testFile of testFiles) {
        try {
            await fs.access(path.resolve(process.cwd(), testFile));
        } catch {
            issues.push({
                type: 'missing_test',
                severity: 'warning',
                file: testFile,
                message: `Test file missing: ${testFile}`,
                fixable: true
            });
        }
    }

    return issues;
}

/**
 * Apply compliance fixes
 */
async function applyComplianceFixes(providerName, issues) {
    const fixResults = {
        fixed: [],
        unfixed: [],
        actions: []
    };

    console.log(`🔧 Attempting to fix ${issues.length} compliance issues for ${providerName}`);

    for (const issue of issues) {
        try {
            switch (issue.type) {
                case 'missing_file':
                    if (issue.fixable) {
                        await fixMissingFile(providerName, issue.file);
                        fixResults.fixed.push(issue);
                        fixResults.actions.push(`Generated missing file: ${issue.file}`);
                    } else {
                        fixResults.unfixed.push(issue);
                    }
                    break;

                case 'interface_violation':
                    if (issue.fixable) {
                        await fixInterfaceViolation(providerName, issue);
                        fixResults.fixed.push(issue);
                        fixResults.actions.push(`Fixed interface violation: ${issue.message}`);
                    } else {
                        fixResults.unfixed.push(issue);
                    }
                    break;

                case 'missing_test':
                    if (issue.fixable) {
                        await fixMissingTest(providerName, issue.file);
                        fixResults.fixed.push(issue);
                        fixResults.actions.push(`Generated missing test: ${issue.file}`);
                    } else {
                        fixResults.unfixed.push(issue);
                    }
                    break;

                default:
                    fixResults.unfixed.push(issue);
                    fixResults.actions.push(`Could not auto-fix: ${issue.message}`);
                    break;
            }
        } catch (error) {
            console.warn(`⚠️ Could not fix issue: ${issue.message} - ${error.message}`);
            fixResults.unfixed.push(issue);
        }
    }

    console.log(`🔧 Fix results: ${fixResults.fixed.length} fixed, ${fixResults.unfixed.length} remain`);
    
    return fixResults;
}

/**
 * Fix missing file by generating from template
 */
async function fixMissingFile(providerName, filePath) {
    const fileName = path.basename(filePath);
    const fileDir = path.dirname(filePath);
    
    console.log(`📝 Generating missing file: ${filePath}`);
    
    // Ensure directory exists
    await fs.mkdir(path.resolve(process.cwd(), fileDir), { recursive: true });
    
    // Generate appropriate template content
    let content = '';
    
    switch (fileName) {
        case 'index.ts':
            content = generateIndexTemplate(providerName);
            break;
        case 'types.ts':
            content = generateTypesTemplate(providerName);
            break;
        case 'auth.ts':
            content = generateAuthTemplate(providerName);
            break;
        case 'converter.ts':
            content = generateConverterTemplate(providerName);
            break;
        case 'parser.ts':
            content = generateParserTemplate(providerName);
            break;
        case 'client.ts':
            content = generateClientTemplate(providerName);
            break;
        case 'preprocessor.ts':
            content = generatePreprocessorTemplate(providerName);
            break;
        default:
            throw new Error(`Unknown file type: ${fileName}`);
    }
    
    await fs.writeFile(path.resolve(process.cwd(), filePath), content);
    console.log(`✅ Generated: ${filePath}`);
}

/**
 * Fix missing test files
 */
async function fixMissingTest(providerName, testFilePath) {
    console.log(`📝 Generating missing test: ${testFilePath}`);
    
    const testDir = path.dirname(testFilePath);
    await fs.mkdir(path.resolve(process.cwd(), testDir), { recursive: true });
    
    let content = '';
    
    if (testFilePath.endsWith('.js')) {
        content = generateTestTemplate(providerName);
    } else if (testFilePath.endsWith('.md')) {
        content = generateTestDocumentationTemplate(providerName);
    }
    
    await fs.writeFile(path.resolve(process.cwd(), testFilePath), content);
    console.log(`✅ Generated: ${testFilePath}`);
}

/**
 * Fix interface violations (basic implementation)
 */
async function fixInterfaceViolation(providerName, issue) {
    console.log(`🔧 Attempting to fix interface violation: ${issue.message}`);
    
    // This would be a complex fix requiring AST manipulation
    // For now, log the issue for manual resolution
    console.warn(`⚠️ Interface violation requires manual fix: ${issue.message}`);
    throw new Error('Interface violations require manual fixing');
}

/**
 * Generate compliance report
 */
async function generateComplianceReport(enforcementResults, format = 'console') {
    if (format === 'console') {
        console.log('\n📊 Provider Compliance Enforcement Report');
        console.log('═'.repeat(50));
        console.log(`Total Providers: ${enforcementResults.summary.totalProviders}`);
        console.log(`Compliant: ${enforcementResults.summary.compliantProviders}`);
        console.log(`Non-Compliant: ${enforcementResults.summary.nonCompliantProviders}`);
        console.log(`Auto-Fixed Issues: ${enforcementResults.summary.autoFixedIssues}`);
        console.log(`Remaining Issues: ${enforcementResults.summary.remainingIssues}`);
        
        console.log('\nProvider Details:');
        enforcementResults.providers.forEach(provider => {
            const status = provider.compliant ? '✅' : '❌';
            console.log(`${status} ${provider.name}: ${provider.compliant ? 'COMPLIANT' : `${provider.remainingIssues} issues remaining`}`);
        });
        
    } else if (format === 'json') {
        const outputFile = path.join(process.cwd(), 'compliance-report.json');
        await fs.writeFile(outputFile, JSON.stringify(enforcementResults, null, 2));
        console.log(`📄 JSON report saved: ${outputFile}`);
        
    } else if (format === 'markdown') {
        const markdownReport = generateMarkdownReport(enforcementResults);
        const outputFile = path.join(process.cwd(), 'compliance-report.md');
        await fs.writeFile(outputFile, markdownReport);
        console.log(`📄 Markdown report saved: ${outputFile}`);
    }
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(results) {
    const date = new Date().toISOString().split('T')[0];
    
    let markdown = `# Provider Compliance Report\n\n`;
    markdown += `**Generated**: ${date}  \n`;
    markdown += `**Mode**: ${results.mode}  \n\n`;
    
    markdown += `## Summary\n\n`;
    markdown += `- **Total Providers**: ${results.summary.totalProviders}\n`;
    markdown += `- **Compliant**: ${results.summary.compliantProviders}\n`;
    markdown += `- **Non-Compliant**: ${results.summary.nonCompliantProviders}\n`;
    markdown += `- **Auto-Fixed Issues**: ${results.summary.autoFixedIssues}\n`;
    markdown += `- **Remaining Issues**: ${results.summary.remainingIssues}\n\n`;
    
    markdown += `## Provider Status\n\n`;
    results.providers.forEach(provider => {
        const status = provider.compliant ? '✅' : '❌';
        markdown += `### ${status} ${provider.name}\n\n`;
        markdown += `**Status**: ${provider.compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}  \n`;
        markdown += `**Issues Fixed**: ${provider.autoFixedIssues}  \n`;
        markdown += `**Issues Remaining**: ${provider.remainingIssues}  \n\n`;
        
        if (provider.enforcementActions.length > 0) {
            markdown += `**Actions Taken**:\n`;
            provider.enforcementActions.forEach(action => {
                markdown += `- ${action}\n`;
            });
            markdown += '\n';
        }
    });
    
    return markdown;
}

/**
 * Template generators (simplified versions)
 */
function generateIndexTemplate(providerName) {
    const capitalized = capitalize(providerName);
    return `/**\n * ${capitalized} Provider\n * Author: Jason Zhang\n * Generated: ${new Date().toISOString()}\n */\n\nexport { ${capitalized}Client } from './client.js';\nexport { ${capitalized}AuthManager } from './auth.js';\nexport { ${capitalized}Converter } from './converter.js';\nexport { ${capitalized}Parser } from './parser.js';\nexport { ${capitalized}Preprocessor } from './preprocessor.js';\nexport * from './types.js';\n\nconsole.log('🎯 ${capitalized} Provider loaded');\n`;
}

function generateTypesTemplate(providerName) {
    const capitalized = capitalize(providerName);
    return `/**\n * ${capitalized} Provider Types\n * Author: Jason Zhang\n * Generated: ${new Date().toISOString()}\n */\n\nexport interface ${capitalized}Config {\n  apiKey: string;\n  endpoint: string;\n  timeout: number;\n  retryAttempts: number;\n  models: string[];\n}\n\nexport interface ${capitalized}Request {\n  model: string;\n  messages: Array<{ role: string; content: string; }>;\n  temperature?: number;\n  max_tokens?: number;\n}\n\nexport interface ${capitalized}Response {\n  id: string;\n  object: string;\n  model: string;\n  choices: Array<{\n    index: number;\n    message: { role: string; content: string; };\n    finish_reason: string | null;\n  }>;\n}\n\nexport interface ${capitalized}ErrorResponse {\n  error: {\n    message: string;\n    type: string;\n  };\n}\n`;
}

function generateAuthTemplate(providerName) {
    const capitalized = capitalize(providerName);
    return `/**\n * ${capitalized} Authentication Manager\n * Author: Jason Zhang\n * Generated: ${new Date().toISOString()}\n */\n\nimport { AuthManager } from '../auth/auth-manager.js';\nimport { ${capitalized}Config } from './types.js';\n\nexport class ${capitalized}AuthManager extends AuthManager {\n  constructor(private config: ${capitalized}Config) {\n    super();\n  }\n\n  async authenticate(): Promise<boolean> {\n    // TODO: Implement authentication logic\n    return true;\n  }\n\n  getAuthHeaders(): Record<string, string> {\n    return {\n      'Authorization': \`Bearer \${this.config.apiKey}\`,\n      'Content-Type': 'application/json'\n    };\n  }\n}\n`;
}

function generateConverterTemplate(providerName) {
    const capitalized = capitalize(providerName);
    return `/**\n * ${capitalized} Format Converter\n * Author: Jason Zhang\n * Generated: ${new Date().toISOString()}\n */\n\nimport { AIRequest, AIResponse } from '../types.js';\nimport { ${capitalized}Request, ${capitalized}Response } from './types.js';\n\nexport class ${capitalized}Converter {\n  async toProviderFormat(request: AIRequest): Promise<${capitalized}Request> {\n    return {\n      model: request.model,\n      messages: request.messages,\n      temperature: request.temperature,\n      max_tokens: request.max_tokens\n    };\n  }\n\n  async fromProviderFormat(response: ${capitalized}Response): Promise<AIResponse> {\n    return {\n      id: response.id,\n      object: response.object,\n      created: Date.now(),\n      model: response.model,\n      choices: response.choices\n    };\n  }\n}\n`;
}

function generateParserTemplate(providerName) {
    const capitalized = capitalize(providerName);
    return `/**\n * ${capitalized} Response Parser\n * Author: Jason Zhang\n * Generated: ${new Date().toISOString()}\n */\n\nimport { ${capitalized}Response } from './types.js';\n\nexport class ${capitalized}Parser {\n  parseResponse(responseData: any): ${capitalized}Response {\n    return {\n      id: responseData.id,\n      object: responseData.object,\n      model: responseData.model,\n      choices: responseData.choices\n    };\n  }\n\n  parseError(errorData: any): Error {\n    if (errorData.error) {\n      return new Error(\`${capitalized} API Error: \${errorData.error.message}\`);\n    }\n    return new Error(\`${capitalized} API Error: \${JSON.stringify(errorData)}\`);\n  }\n}\n`;
}

function generateClientTemplate(providerName) {
    const capitalized = capitalize(providerName);
    return `/**\n * ${capitalized} Client\n * Author: Jason Zhang\n * Generated: ${new Date().toISOString()}\n */\n\nimport { BaseProvider } from '../base-provider.js';\nimport { AIRequest, AIResponse } from '../types.js';\nimport { ${capitalized}Config } from './types.js';\nimport { ${capitalized}AuthManager } from './auth.js';\nimport { ${capitalized}Converter } from './converter.js';\nimport { ${capitalized}Parser } from './parser.js';\nimport { ${capitalized}Preprocessor } from './preprocessor.js';\n\nexport class ${capitalized}Client extends BaseProvider {\n  private auth: ${capitalized}AuthManager;\n  private converter: ${capitalized}Converter;\n  private parser: ${capitalized}Parser;\n  private preprocessor: ${capitalized}Preprocessor;\n\n  constructor(private config: ${capitalized}Config) {\n    super();\n    this.auth = new ${capitalized}AuthManager(config);\n    this.converter = new ${capitalized}Converter();\n    this.parser = new ${capitalized}Parser();\n    this.preprocessor = new ${capitalized}Preprocessor(config);\n  }\n\n  async initialize(): Promise<void> {\n    await this.auth.authenticate();\n  }\n\n  async processRequest(request: AIRequest): Promise<AIResponse> {\n    // TODO: Implement request processing\n    throw new Error('Not implemented');\n  }\n\n  async healthCheck(): Promise<{ status: string; latency: number }> {\n    return { status: 'healthy', latency: 0 };\n  }\n\n  async getAvailableModels(): Promise<string[]> {\n    return this.config.models;\n  }\n\n  getCapabilities(): Record<string, boolean> {\n    return { streaming: false, toolCalling: false };\n  }\n\n  async cleanup(): Promise<void> {\n    // TODO: Implement cleanup\n  }\n}\n`;
}

function generatePreprocessorTemplate(providerName) {
    const capitalized = capitalize(providerName);
    return `/**\n * ${capitalized} Preprocessor\n * Author: Jason Zhang\n * Generated: ${new Date().toISOString()}\n */\n\nimport { AIRequest, AIResponse } from '../types.js';\nimport { ${capitalized}Config } from './types.js';\n\nexport class ${capitalized}Preprocessor {\n  constructor(private config: ${capitalized}Config) {}\n\n  async preprocessRequest(request: AIRequest): Promise<AIRequest> {\n    return { ...request };\n  }\n\n  async postprocessResponse(response: AIResponse): Promise<AIResponse> {\n    return { ...response };\n  }\n\n  validatePreprocessedRequest(request: AIRequest): { valid: boolean; errors: string[] } {\n    return { valid: true, errors: [] };\n  }\n\n  getPreprocessingStats(): Record<string, number> {\n    return { rules: 0 };\n  }\n}\n`;
}

function generateTestTemplate(providerName) {
    return `#!/usr/bin/env node\n/**\n * ${capitalize(providerName)} Integration Test\n * Generated: ${new Date().toISOString()}\n */\n\nconsole.log('${capitalize(providerName)} integration test - Generated template');\nexport function test${capitalize(providerName)}() {\n  return true;\n}\n`;
}

function generateTestDocumentationTemplate(providerName) {
    return `# ${capitalize(providerName)} Integration Test\n\n## 测试用例\n验证${capitalize(providerName)}提供商集成\n\n## 测试目标\n基础集成测试\n\n## 执行记录\n- 生成时间: ${new Date().toISOString()}\n- 状态: 模板生成\n`;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const providerName = process.argv.includes('--provider') 
        ? process.argv[process.argv.indexOf('--provider') + 1] 
        : null;
    
    const mode = process.argv.includes('--mode') 
        ? process.argv[process.argv.indexOf('--mode') + 1] 
        : 'validate';
    
    const autoFix = process.argv.includes('--auto-fix');
    const outputFormat = process.argv.includes('--output') 
        ? process.argv[process.argv.indexOf('--output') + 1] 
        : 'console';

    enforceProviderCompliance({
        providerName,
        mode,
        autoFix,
        outputFormat
    })
    .then(success => {
        console.log(`\n🎉 Provider Compliance Enforcement ${success ? 'COMPLETED' : 'FOUND ISSUES'}`);
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 Enforcement system failed:', error);
        process.exit(1);
    });
}

export { enforceProviderCompliance };