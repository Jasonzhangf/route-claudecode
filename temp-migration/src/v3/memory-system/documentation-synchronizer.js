#!/usr/bin/env node

/**
 * Claude Code Router v3.0 - Documentation Synchronization System
 * 
 * Comprehensive documentation synchronization providing:
 * - Automatic synchronization between code and documentation
 * - Test-documentation alignment system
 * - Architecture documentation management in .claude/ProjectDesign
 * - Long-task memory save and retrieval mechanisms
 * - Real-time documentation updates and validation
 * 
 * @author Jason Zhang
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DocumentationSynchronizer extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            // Base directories
            projectRoot: config.projectRoot || path.resolve(__dirname, '../../../'),
            sourceDir: config.sourceDir || 'src',
            testDir: config.testDir || 'test',
            docsDir: config.docsDir || '.claude/ProjectDesign',
            
            // Synchronization settings
            autoSync: config.autoSync !== false,
            syncInterval: config.syncInterval || 300000, // 5 minutes
            validateSync: config.validateSync !== false,
            
            // Documentation structure
            documentationTypes: {
                'architecture': 'Architecture documentation and system design',
                'interfaces': 'API interfaces and data structures',
                'components': 'Component documentation and usage',
                'testing': 'Test documentation and strategies',
                'memory': 'Memory system and knowledge management',
                'deployment': 'Deployment and infrastructure documentation'
            },
            
            // Long-task memory settings
            longTaskThreshold: config.longTaskThreshold || 600000, // 10 minutes
            memoryRetentionDays: config.memoryRetentionDays || 90,
            taskMemoryCategories: ['long-running-tasks', 'complex-implementations', 'multi-step-processes'],
            
            // File patterns
            sourcePatterns: config.sourcePatterns || ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
            testPatterns: config.testPatterns || ['**/*.test.js', '**/*.spec.js', '**/test-*.js'],
            docPatterns: config.docPatterns || ['**/*.md', '**/*.rst', '**/*.txt'],
            
            ...config
        };

        this.syncState = new Map();
        this.taskMemories = new Map();
        this.documentationIndex = new Map();
        this.syncHistory = [];
        this.initialized = false;
    }

    async initialize() {
        try {
            console.log('📚 Initializing Documentation Synchronization System...');
            
            // Create documentation directories
            await this.createDocumentationStructure();
            
            // Initialize synchronization state
            await this.loadSynchronizationState();
            
            // Build documentation index
            await this.buildDocumentationIndex();
            
            // Load existing task memories
            await this.loadTaskMemories();
            
            // Start automatic synchronization if enabled
            if (this.config.autoSync) {
                this.startAutoSync();
            }
            
            this.initialized = true;
            console.log(`✅ Documentation Synchronization System initialized`);
            console.log(`   Documentation types: ${Object.keys(this.config.documentationTypes).length}`);
            console.log(`   Indexed documents: ${this.documentationIndex.size}`);
            console.log(`   Task memories loaded: ${this.taskMemories.size}`);
            
            return {
                status: 'initialized',
                documentationTypes: Object.keys(this.config.documentationTypes).length,
                indexedDocuments: this.documentationIndex.size,
                taskMemories: this.taskMemories.size,
                autoSyncEnabled: this.config.autoSync
            };
        } catch (error) {
            console.error('❌ Documentation Synchronization initialization failed:', error.message);
            throw error;
        }
    }

    async createDocumentationStructure() {
        const docsBaseDir = path.join(this.config.projectRoot, this.config.docsDir);
        
        // Create main documentation directory
        await fs.mkdir(docsBaseDir, { recursive: true });
        
        // Create subdirectories for each documentation type
        for (const docType of Object.keys(this.config.documentationTypes)) {
            await fs.mkdir(path.join(docsBaseDir, docType), { recursive: true });
        }
        
        // Create utility directories
        const utilityDirs = [
            'sync-history',     // Synchronization history and logs
            'task-memories',    // Long-task memory storage
            'templates',        // Documentation templates
            'generated',        // Auto-generated documentation
            'drafts',           // Draft documentation
            'archives'          // Archived documentation
        ];
        
        for (const dir of utilityDirs) {
            await fs.mkdir(path.join(docsBaseDir, dir), { recursive: true });
        }
        
        console.log(`📂 Documentation structure created at ${docsBaseDir}`);
    }

    async synchronizeCodeAndDocumentation() {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            console.log('🔄 Starting code-documentation synchronization...');
            
            const syncSession = {
                id: this.generateSyncId(),
                timestamp: new Date().toISOString(),
                type: 'full-synchronization',
                results: {
                    filesScanned: 0,
                    documentsUpdated: 0,
                    testsAligned: 0,
                    errorsFound: 0,
                    warnings: []
                }
            };

            // Step 1: Scan source files for changes
            const sourceFiles = await this.scanSourceFiles();
            syncSession.results.filesScanned = sourceFiles.length;
            
            // Step 2: Identify documentation gaps
            const documentationGaps = await this.identifyDocumentationGaps(sourceFiles);
            
            // Step 3: Generate missing documentation
            for (const gap of documentationGaps) {
                try {
                    await this.generateMissingDocumentation(gap);
                    syncSession.results.documentsUpdated++;
                } catch (error) {
                    syncSession.results.errorsFound++;
                    syncSession.results.warnings.push(`Failed to generate documentation for ${gap.file}: ${error.message}`);
                }
            }
            
            // Step 4: Align test documentation
            const testAlignmentResults = await this.alignTestDocumentation();
            syncSession.results.testsAligned = testAlignmentResults.aligned;
            
            // Step 5: Update architecture documentation
            await this.updateArchitectureDocumentation();
            
            // Step 6: Validate synchronization
            const validationResults = await this.validateSynchronization();
            if (!validationResults.valid) {
                syncSession.results.warnings.push(...validationResults.issues);
            }
            
            // Record synchronization session
            this.syncHistory.push(syncSession);
            await this.saveSynchronizationState();
            
            console.log(`✅ Synchronization completed`);
            console.log(`   Files scanned: ${syncSession.results.filesScanned}`);
            console.log(`   Documents updated: ${syncSession.results.documentsUpdated}`);
            console.log(`   Tests aligned: ${syncSession.results.testsAligned}`);
            console.log(`   Errors: ${syncSession.results.errorsFound}`);
            console.log(`   Warnings: ${syncSession.results.warnings.length}`);
            
            this.emit('synchronizationCompleted', syncSession);
            
            return syncSession;
        } catch (error) {
            console.error('❌ Synchronization failed:', error.message);
            throw error;
        }
    }

    async scanSourceFiles() {
        const sourceDir = path.join(this.config.projectRoot, this.config.sourceDir);
        const sourceFiles = [];
        
        // Recursively scan source directory
        await this.scanDirectory(sourceDir, this.config.sourcePatterns, sourceFiles);
        
        console.log(`📁 Scanned ${sourceFiles.length} source files`);
        return sourceFiles;
    }

    async scanDirectory(dir, patterns, results) {
        try {
            const entries = await fs.readdir(dir);
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stats = await fs.stat(fullPath);
                
                if (stats.isDirectory()) {
                    await this.scanDirectory(fullPath, patterns, results);
                } else if (this.matchesPatterns(entry, patterns)) {
                    const content = await fs.readFile(fullPath, 'utf8');
                    results.push({
                        path: fullPath,
                        relativePath: path.relative(this.config.projectRoot, fullPath),
                        name: entry,
                        size: stats.size,
                        modified: stats.mtime,
                        content: content,
                        hash: crypto.createHash('md5').update(content).digest('hex')
                    });
                }
            }
        } catch (error) {
            console.warn(`⚠️ Cannot scan directory ${dir}: ${error.message}`);
        }
    }

    matchesPatterns(filename, patterns) {
        return patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
            return regex.test(filename);
        });
    }

    async identifyDocumentationGaps(sourceFiles) {
        const gaps = [];
        
        for (const sourceFile of sourceFiles) {
            // Check if documentation exists for this source file
            const expectedDocPath = this.getExpectedDocumentationPath(sourceFile);
            
            try {
                await fs.access(expectedDocPath);
                
                // Check if documentation is up-to-date
                const docStats = await fs.stat(expectedDocPath);
                if (sourceFile.modified > docStats.mtime) {
                    gaps.push({
                        type: 'outdated',
                        file: sourceFile.relativePath,
                        expectedDocPath: expectedDocPath,
                        reason: 'Source file newer than documentation'
                    });
                }
            } catch (error) {
                // Documentation doesn't exist
                gaps.push({
                    type: 'missing',
                    file: sourceFile.relativePath,
                    expectedDocPath: expectedDocPath,
                    reason: 'No documentation found'
                });
            }
        }
        
        console.log(`🔍 Found ${gaps.length} documentation gaps`);
        return gaps;
    }

    getExpectedDocumentationPath(sourceFile) {
        const docsBaseDir = path.join(this.config.projectRoot, this.config.docsDir);
        
        // Determine documentation type based on source file path
        let docType = 'components'; // default
        
        if (sourceFile.relativePath.includes('architecture')) {
            docType = 'architecture';
        } else if (sourceFile.relativePath.includes('interface') || sourceFile.relativePath.includes('api')) {
            docType = 'interfaces';
        } else if (sourceFile.relativePath.includes('memory')) {
            docType = 'memory';
        } else if (sourceFile.relativePath.includes('test')) {
            docType = 'testing';
        }
        
        const docName = path.basename(sourceFile.name, path.extname(sourceFile.name)) + '.md';
        return path.join(docsBaseDir, docType, docName);
    }

    async generateMissingDocumentation(gap) {
        console.log(`📝 Generating documentation for ${gap.file}`);
        
        // Read source file to analyze
        const sourceContent = await fs.readFile(path.join(this.config.projectRoot, gap.file), 'utf8');
        
        // Extract documentation information from source
        const docInfo = this.extractDocumentationInfo(sourceContent, gap.file);
        
        // Generate documentation content
        const docContent = this.generateDocumentationContent(docInfo);
        
        // Write documentation file
        await fs.writeFile(gap.expectedDocPath, docContent);
        
        console.log(`✅ Generated documentation: ${gap.expectedDocPath}`);
    }

    extractDocumentationInfo(sourceContent, filePath) {
        const info = {
            title: this.extractTitle(filePath),
            description: this.extractDescription(sourceContent),
            classes: this.extractClasses(sourceContent),
            functions: this.extractFunctions(sourceContent),
            exports: this.extractExports(sourceContent),
            imports: this.extractImports(sourceContent),
            author: this.extractAuthor(sourceContent),
            version: this.extractVersion(sourceContent)
        };
        
        return info;
    }

    extractTitle(filePath) {
        const filename = path.basename(filePath, path.extname(filePath));
        return filename.split(/[-_]/).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    extractDescription(content) {
        // Look for JSDoc style comments or module description
        const docCommentMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\s*\n[\s\S]*?\*\//);
        if (docCommentMatch) {
            return docCommentMatch[1];
        }
        
        // Look for single line comments at the top
        const commentMatch = content.match(/^\/\/\s*(.+?)$/m);
        if (commentMatch) {
            return commentMatch[1];
        }
        
        return 'Auto-generated documentation - please update with proper description';
    }

    extractClasses(content) {
        const classes = [];
        const classMatches = content.matchAll(/(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?\s*{/g);
        
        for (const match of classMatches) {
            classes.push({
                name: match[1],
                extends: match[2] || null,
                methods: this.extractMethods(content, match[1])
            });
        }
        
        return classes;
    }

    extractFunctions(content) {
        const functions = [];
        const functionMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g);
        
        for (const match of functionMatches) {
            functions.push({
                name: match[1],
                async: match[0].includes('async'),
                export: match[0].includes('export')
            });
        }
        
        return functions;
    }

    extractMethods(content, className) {
        const methods = [];
        // This is a simplified extraction - in practice, you'd want more sophisticated parsing
        const methodMatches = content.matchAll(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/g);
        
        for (const match of methodMatches) {
            if (match[1] !== className) { // Exclude constructor
                methods.push({
                    name: match[1],
                    async: match[0].includes('async')
                });
            }
        }
        
        return methods;
    }

    extractExports(content) {
        const exports = [];
        const exportMatches = content.matchAll(/export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g);
        
        for (const match of exportMatches) {
            exports.push(match[1]);
        }
        
        return exports;
    }

    extractImports(content) {
        const imports = [];
        const importMatches = content.matchAll(/import\s+.*?from\s+['"](.+?)['"]/g);
        
        for (const match of importMatches) {
            imports.push(match[1]);
        }
        
        return imports;
    }

    extractAuthor(content) {
        const authorMatch = content.match(/@author\s+(.+)/);
        return authorMatch ? authorMatch[1] : 'Unknown';
    }

    extractVersion(content) {
        const versionMatch = content.match(/@version\s+(.+)/);
        return versionMatch ? versionMatch[1] : '1.0.0';
    }

    generateDocumentationContent(docInfo) {
        return `# ${docInfo.title}

## Overview
${docInfo.description}

**Author:** ${docInfo.author}  
**Version:** ${docInfo.version}

## Dependencies
${docInfo.imports.length > 0 ? docInfo.imports.map(imp => `- \`${imp}\``).join('\n') : 'None'}

${docInfo.classes.length > 0 ? `## Classes

${docInfo.classes.map(cls => `### ${cls.name}${cls.extends ? ` extends ${cls.extends}` : ''}

${cls.methods.length > 0 ? `#### Methods

${cls.methods.map(method => `- \`${method.async ? 'async ' : ''}${method.name}()\``).join('\n')}` : ''}
`).join('\n')}` : ''}

${docInfo.functions.length > 0 ? `## Functions

${docInfo.functions.map(func => `### ${func.name}()
${func.async ? 'Async function' : 'Synchronous function'}${func.export ? ' - Exported' : ''}
`).join('\n')}` : ''}

${docInfo.exports.length > 0 ? `## Exports
${docInfo.exports.map(exp => `- \`${exp}\``).join('\n')}` : ''}

## Usage
*Please update this section with usage examples and detailed information.*

---
*This documentation was auto-generated on ${new Date().toISOString()}. Please update with accurate information.*`;
    }

    async alignTestDocumentation() {
        console.log('🧪 Aligning test documentation...');
        
        const testDir = path.join(this.config.projectRoot, this.config.testDir);
        const testFiles = [];
        
        await this.scanDirectory(testDir, this.config.testPatterns, testFiles);
        
        let aligned = 0;
        
        for (const testFile of testFiles) {
            // Check if corresponding .md file exists
            const testDocPath = testFile.path.replace(/\.(js|ts)$/, '.md');
            
            try {
                await fs.access(testDocPath);
                // Update existing documentation if needed
                const testDocContent = await this.generateTestDocumentation(testFile);
                await fs.writeFile(testDocPath, testDocContent);
                aligned++;
            } catch (error) {
                // Test documentation doesn't exist - this might be expected
                console.log(`ℹ️ No documentation found for test: ${testFile.relativePath}`);
            }
        }
        
        console.log(`✅ Aligned ${aligned} test documentation files`);
        return { aligned, total: testFiles.length };
    }

    generateTestDocumentation(testFile) {
        const testName = path.basename(testFile.name, path.extname(testFile.name));
        const content = testFile.content;
        
        // Extract test information
        const testCases = this.extractTestCases(content);
        const testTarget = this.extractTestTarget(content, testName);
        
        return `# Test Documentation: ${testTarget}

## Test Case
${testName.replace(/test-|\.test|\.spec/g, '').replace(/-/g, ' ')}

## Test Target
Auto-detected test target based on file analysis

## Test Execution Records

### Latest Execution: ${new Date().toISOString()}
- **Status**: Auto-generated documentation
- **Test Cases**: ${testCases.length}

${testCases.length > 0 ? `### Test Cases

${testCases.map((testCase, index) => `${index + 1}. **${testCase.name}**
   - ${testCase.description || 'No description available'}`).join('\n')}` : ''}

## Implementation Files
- **Test File**: \`${testFile.relativePath}\`

---
*This test documentation was auto-generated on ${new Date().toISOString()}. Please update with detailed test information.*`;
    }

    extractTestCases(content) {
        const testCases = [];
        
        // Look for common test patterns
        const testPatterns = [
            /(?:test|it)\s*\(\s*['"`](.+?)['"`]/g,
            /describe\s*\(\s*['"`](.+?)['"`]/g
        ];
        
        for (const pattern of testPatterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                testCases.push({
                    name: match[1],
                    description: 'Auto-extracted test case'
                });
            }
        }
        
        return testCases;
    }

    extractTestTarget(content, testName) {
        // Try to determine what is being tested
        if (testName.includes('memory')) return 'Memory System';
        if (testName.includes('service')) return 'Service Management';
        if (testName.includes('config')) return 'Configuration System';
        if (testName.includes('api')) return 'API System';
        
        return testName.replace(/test-|\.test|\.spec/g, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    async updateArchitectureDocumentation() {
        console.log('🏗️ Updating architecture documentation...');
        
        const archDocsDir = path.join(this.config.projectRoot, this.config.docsDir, 'architecture');
        
        // Generate system overview
        await this.generateSystemOverview(archDocsDir);
        
        // Generate component documentation
        await this.generateComponentDocumentation(archDocsDir);
        
        // Generate interface documentation  
        await this.generateInterfaceDocumentation(archDocsDir);
        
        console.log('✅ Architecture documentation updated');
    }

    async generateSystemOverview(archDocsDir) {
        const overviewPath = path.join(archDocsDir, 'system-overview.md');
        
        const overviewContent = `# Claude Code Router v3.0 - System Overview

## Architecture

### Six-Layer Architecture
\`\`\`
Client ↔ Router ↔ Post-processor ↔ Transformer ↔ Provider-Protocol ↔ Preprocessor ↔ Server
\`\`\`

### Core Components
- **Client Layer**: User interaction and request handling
- **Router Layer**: Request routing and provider selection
- **Post-processor Layer**: Response post-processing and formatting
- **Transformer Layer**: Data transformation and format conversion
- **Provider-Protocol Layer**: Provider-specific communication protocols
- **Preprocessor Layer**: Request preprocessing and validation  
- **Server Layer**: Core server infrastructure and service management

### Key Features
- Dynamic module registration and plugin architecture
- Multi-provider support (Anthropic, OpenAI, Gemini, CodeWhisperer)
- Comprehensive debug recording and replay capabilities
- Memory system for knowledge management and decision tracking
- Service management with process control and configuration isolation

## System Status
- **Current Version**: 3.0.0 (Development)
- **Previous Version**: 2.7.0 (Production)
- **Architecture**: Six-layer plugin-based system
- **Supported Providers**: 4 primary providers with multiple account support

---
*Generated on ${new Date().toISOString()} by Documentation Synchronization System*`;

        await fs.writeFile(overviewPath, overviewContent);
    }

    async generateComponentDocumentation(archDocsDir) {
        const componentsPath = path.join(archDocsDir, 'components.md');
        
        const componentsContent = `# Component Documentation

## Core Components

### Service Management
- **Location**: \`src/v3/service-management/\`
- **Purpose**: Service process control and configuration management
- **Key Files**:
  - \`service-controller.js\`: Service type distinction and safe control
  - \`config-isolation.js\`: Configuration isolation with read-only enforcement

### Memory System  
- **Location**: \`src/v3/memory-system/\`
- **Purpose**: Project memory architecture and knowledge management
- **Key Files**:
  - \`project-memory-manager.js\`: Core memory management system
  - \`documentation-synchronizer.js\`: Documentation synchronization

### Testing Framework
- **Location**: \`test/\`
- **Purpose**: Comprehensive testing with 8-step pipeline
- **Structure**:
  - \`functional/\`: Functional testing
  - \`integration/\`: Integration testing
  - \`pipeline/\`: Pipeline testing
  - \`performance/\`: Performance testing

## Component Interaction

### Memory System ↔ Documentation Synchronizer
- Real-time documentation updates
- Test-documentation alignment
- Architecture documentation generation

### Service Management ↔ Configuration System
- Read-only configuration enforcement
- Service status reporting
- Process isolation and control

---
*Generated on ${new Date().toISOString()} by Documentation Synchronization System*`;

        await fs.writeFile(componentsPath, componentsContent);
    }

    async generateInterfaceDocumentation(archDocsDir) {
        const interfacesPath = path.join(archDocsDir, 'interfaces.md');
        
        const interfacesContent = `# Interface Documentation

## Core Interfaces

### ProjectMemoryManager
\`\`\`javascript
class ProjectMemoryManager {
    async initialize()
    async saveMemoryEntry(data)
    async searchMemory(query, options)
    async getMemoryEntry(entryId)
    async runCLI(args)
}
\`\`\`

### DocumentationSynchronizer
\`\`\`javascript
class DocumentationSynchronizer {
    async initialize()
    async synchronizeCodeAndDocumentation()
    async saveTaskMemory(taskId, data)
    async retrieveTaskMemory(taskId)
    async runCLI(args)
}
\`\`\`

### ServiceController
\`\`\`javascript
class ServiceController {
    async initialize()
    async discoverServices()
    async stopService(pid, options)
    async startHealthMonitoring()
    async runCLI(args)
}
\`\`\`

### ConfigurationIsolation
\`\`\`javascript
class ConfigurationIsolation {
    async initialize()
    async validateServiceStartup(port, overrides)
    async getServiceStatusReport()
    async runCLI(args)
}
\`\`\`

## Data Structures

### Memory Entry
\`\`\`javascript
{
    id: string,
    timestamp: string,
    category: string,
    type: string,
    title: string,
    summary: string,
    content: string,
    metadata: object,
    context: object,
    experience: object,
    references: object
}
\`\`\`

### Synchronization Session
\`\`\`javascript
{
    id: string,
    timestamp: string,
    type: string,
    results: {
        filesScanned: number,
        documentsUpdated: number,
        testsAligned: number,
        errorsFound: number,
        warnings: array
    }
}
\`\`\`

---
*Generated on ${new Date().toISOString()} by Documentation Synchronization System*`;

        await fs.writeFile(interfacesPath, interfacesContent);
    }

    async saveTaskMemory(taskId, taskData) {
        const taskMemory = {
            id: taskId,
            timestamp: new Date().toISOString(),
            duration: taskData.duration || null,
            status: taskData.status || 'in-progress',
            type: taskData.type || 'long-running-task',
            category: this.categorizeTask(taskData),
            
            // Task details
            title: taskData.title || `Task ${taskId}`,
            description: taskData.description || '',
            steps: taskData.steps || [],
            progress: taskData.progress || 0,
            
            // Context information
            context: {
                component: taskData.component || null,
                files: taskData.files || [],
                dependencies: taskData.dependencies || [],
                environment: taskData.environment || 'development'
            },
            
            // Memory data
            decisions: taskData.decisions || [],
            challenges: taskData.challenges || [],
            solutions: taskData.solutions || [],
            lessons: taskData.lessons || [],
            
            // References
            references: {
                codeFiles: taskData.codeFiles || [],
                documentation: taskData.documentation || [],
                relatedTasks: taskData.relatedTasks || []
            }
        };

        // Store in memory
        this.taskMemories.set(taskId, taskMemory);
        
        // Persist to disk
        const taskMemoryDir = path.join(this.config.projectRoot, this.config.docsDir, 'task-memories');
        const taskMemoryFile = path.join(taskMemoryDir, `${taskId}.json`);
        await fs.writeFile(taskMemoryFile, JSON.stringify(taskMemory, null, 2));
        
        // Also create markdown version
        const markdownContent = this.generateTaskMemoryMarkdown(taskMemory);
        const markdownFile = path.join(taskMemoryDir, `${taskId}.md`);
        await fs.writeFile(markdownFile, markdownContent);
        
        console.log(`💾 Task memory saved: ${taskId}`);
        return taskMemory;
    }

    categorizeTask(taskData) {
        const content = `${taskData.title || ''} ${taskData.description || ''} ${taskData.type || ''}`.toLowerCase();
        
        if (content.includes('implement') || content.includes('develop') || content.includes('build')) {
            return 'complex-implementations';
        } else if (content.includes('test') || content.includes('validate') || content.includes('verify')) {
            return 'testing-processes';
        } else {
            return 'long-running-tasks';
        }
    }

    generateTaskMemoryMarkdown(taskMemory) {
        return `# Task Memory: ${taskMemory.title}

## Task Details
**ID:** ${taskMemory.id}  
**Status:** ${taskMemory.status}  
**Type:** ${taskMemory.type}  
**Category:** ${taskMemory.category}  
**Created:** ${taskMemory.timestamp}  
${taskMemory.duration ? `**Duration:** ${taskMemory.duration}ms` : ''}

## Description
${taskMemory.description || 'No description provided'}

${taskMemory.steps.length > 0 ? `## Steps
${taskMemory.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}` : ''}

${taskMemory.progress > 0 ? `## Progress
${Math.round(taskMemory.progress * 100)}% complete` : ''}

${taskMemory.decisions.length > 0 ? `## Decisions Made
${taskMemory.decisions.map(decision => `- ${decision}`).join('\n')}` : ''}

${taskMemory.challenges.length > 0 ? `## Challenges Encountered
${taskMemory.challenges.map(challenge => `- ${challenge}`).join('\n')}` : ''}

${taskMemory.solutions.length > 0 ? `## Solutions Applied
${taskMemory.solutions.map(solution => `- ${solution}`).join('\n')}` : ''}

${taskMemory.lessons.length > 0 ? `## Lessons Learned
${taskMemory.lessons.map(lesson => `- ${lesson}`).join('\n')}` : ''}

## Context
${Object.entries(taskMemory.context)
    .filter(([_, value]) => value !== null && (Array.isArray(value) ? value.length > 0 : true))
    .map(([key, value]) => `- **${key}:** ${Array.isArray(value) ? value.join(', ') : value}`)
    .join('\n')}

${taskMemory.references.codeFiles.length > 0 ? `## Code Files
${taskMemory.references.codeFiles.map(file => `- ${file}`).join('\n')}` : ''}

${taskMemory.references.documentation.length > 0 ? `## Documentation
${taskMemory.references.documentation.map(doc => `- ${doc}`).join('\n')}` : ''}

${taskMemory.references.relatedTasks.length > 0 ? `## Related Tasks
${taskMemory.references.relatedTasks.map(task => `- ${task}`).join('\n')}` : ''}

---
*Task memory generated on ${taskMemory.timestamp}*`;
    }

    async retrieveTaskMemory(taskId) {
        // First check in-memory storage
        if (this.taskMemories.has(taskId)) {
            return this.taskMemories.get(taskId);
        }
        
        // Try to load from disk
        const taskMemoryFile = path.join(this.config.projectRoot, this.config.docsDir, 'task-memories', `${taskId}.json`);
        
        try {
            const content = await fs.readFile(taskMemoryFile, 'utf8');
            const taskMemory = JSON.parse(content);
            this.taskMemories.set(taskId, taskMemory);
            return taskMemory;
        } catch (error) {
            throw new Error(`Task memory '${taskId}' not found`);
        }
    }

    async loadTaskMemories() {
        const taskMemoryDir = path.join(this.config.projectRoot, this.config.docsDir, 'task-memories');
        
        try {
            const files = await fs.readdir(taskMemoryDir);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            
            for (const file of jsonFiles) {
                try {
                    const content = await fs.readFile(path.join(taskMemoryDir, file), 'utf8');
                    const taskMemory = JSON.parse(content);
                    this.taskMemories.set(taskMemory.id, taskMemory);
                } catch (error) {
                    console.warn(`⚠️ Failed to load task memory ${file}:`, error.message);
                }
            }
            
            console.log(`📚 Loaded ${this.taskMemories.size} task memories`);
        } catch (error) {
            console.log('📂 No existing task memory directory found');
        }
    }

    async validateSynchronization() {
        const issues = [];
        
        // Check for orphaned documentation
        const docsDir = path.join(this.config.projectRoot, this.config.docsDir);
        const docFiles = [];
        await this.scanDirectory(docsDir, ['**/*.md'], docFiles);
        
        for (const docFile of docFiles) {
            // Check if corresponding source file exists
            const possibleSourcePaths = this.getPossibleSourcePaths(docFile);
            let sourceExists = false;
            
            for (const sourcePath of possibleSourcePaths) {
                try {
                    await fs.access(sourcePath);
                    sourceExists = true;
                    break;
                } catch (error) {
                    // Source doesn't exist
                }
            }
            
            if (!sourceExists && !docFile.path.includes('architecture') && !docFile.path.includes('task-memories')) {
                issues.push(`Orphaned documentation: ${docFile.relativePath}`);
            }
        }
        
        return {
            valid: issues.length === 0,
            issues: issues
        };
    }

    getPossibleSourcePaths(docFile) {
        const baseName = path.basename(docFile.name, '.md');
        const possibleExtensions = ['.js', '.ts', '.jsx', '.tsx'];
        const sourceDir = path.join(this.config.projectRoot, this.config.sourceDir);
        
        return possibleExtensions.map(ext => 
            path.join(sourceDir, 'v3', 'components', baseName + ext)
        );
    }

    generateSyncId() {
        return `sync-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    }

    async buildDocumentationIndex() {
        const docsDir = path.join(this.config.projectRoot, this.config.docsDir);
        const docFiles = [];
        
        try {
            await this.scanDirectory(docsDir, this.config.docPatterns, docFiles);
            
            for (const docFile of docFiles) {
                this.documentationIndex.set(docFile.relativePath, {
                    path: docFile.path,
                    modified: docFile.modified,
                    size: docFile.size,
                    hash: docFile.hash
                });
            }
        } catch (error) {
            console.log('📂 No existing documentation directory found');
        }
    }

    async loadSynchronizationState() {
        const syncStateFile = path.join(this.config.projectRoot, this.config.docsDir, 'sync-history', 'sync-state.json');
        
        try {
            const content = await fs.readFile(syncStateFile, 'utf8');
            const state = JSON.parse(content);
            this.syncHistory = state.history || [];
            console.log(`📊 Loaded synchronization history: ${this.syncHistory.length} sessions`);
        } catch (error) {
            console.log('📂 No existing synchronization state found');
        }
    }

    async saveSynchronizationState() {
        const syncStateFile = path.join(this.config.projectRoot, this.config.docsDir, 'sync-history', 'sync-state.json');
        const state = {
            lastUpdated: new Date().toISOString(),
            history: this.syncHistory.slice(-50) // Keep last 50 sync sessions
        };
        
        await fs.writeFile(syncStateFile, JSON.stringify(state, null, 2));
    }

    startAutoSync() {
        console.log(`⏰ Starting automatic synchronization (${this.config.syncInterval / 1000}s intervals)`);
        
        setInterval(async () => {
            try {
                await this.synchronizeCodeAndDocumentation();
            } catch (error) {
                console.error('❌ Auto-sync error:', error.message);
            }
        }, this.config.syncInterval);
    }

    // CLI Interface
    async runCLI(args = []) {
        const command = args[0];
        
        switch (command) {
            case 'sync':
                return await this.handleSyncCommand(args.slice(1));
            case 'memory':
                return await this.handleMemoryCommand(args.slice(1));
            case 'docs':
                return await this.handleDocsCommand(args.slice(1));
            case 'status':
                return await this.handleStatusCommand(args.slice(1));
            case 'help':
            default:
                return this.showHelp();
        }
    }

    async handleSyncCommand(args) {
        if (!this.initialized) await this.initialize();
        
        try {
            const syncResult = await this.synchronizeCodeAndDocumentation();
            
            console.log(`\n📚 Documentation Synchronization Complete`);
            console.log(`Sync ID: ${syncResult.id}`);
            console.log(`Files Scanned: ${syncResult.results.filesScanned}`);
            console.log(`Documents Updated: ${syncResult.results.documentsUpdated}`);
            console.log(`Tests Aligned: ${syncResult.results.testsAligned}`);
            console.log(`Errors: ${syncResult.results.errorsFound}`);
            console.log(`Warnings: ${syncResult.results.warnings.length}`);
            
            if (syncResult.results.warnings.length > 0) {
                console.log(`\n⚠️ Warnings:`);
                syncResult.results.warnings.forEach(warning => {
                    console.log(`   ${warning}`);
                });
            }
            
            return syncResult;
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleMemoryCommand(args) {
        const action = args[0];
        
        switch (action) {
            case 'save':
                const taskId = args.find(arg => arg.startsWith('--task='))?.substring(7);
                const title = args.find(arg => arg.startsWith('--title='))?.substring(8);
                const description = args.find(arg => arg.startsWith('--description='))?.substring(14);
                
                if (!taskId || !title) {
                    console.log('Usage: memory save --task=taskId --title="Task Title" [--description="Description"]');
                    return { error: 'Task ID and title are required' };
                }
                
                const taskMemory = await this.saveTaskMemory(taskId, { title, description });
                console.log(`✅ Task memory saved: ${taskMemory.id}`);
                return { status: 'saved', taskId: taskMemory.id };
                
            case 'retrieve':
                const retrieveTaskId = args.find(arg => !arg.startsWith('--'));
                if (!retrieveTaskId) {
                    console.log('Usage: memory retrieve <task-id>');
                    return { error: 'Task ID is required' };
                }
                
                try {
                    const memory = await this.retrieveTaskMemory(retrieveTaskId);
                    console.log(`\n📄 Task Memory: ${memory.title}`);
                    console.log(`ID: ${memory.id}`);
                    console.log(`Status: ${memory.status}`);
                    console.log(`Type: ${memory.type}`);
                    console.log(`Created: ${memory.timestamp}`);
                    if (memory.description) {
                        console.log(`Description: ${memory.description}`);
                    }
                    return { memory };
                } catch (error) {
                    console.error(`❌ Error: ${error.message}`);
                    return { error: error.message };
                }
                
            case 'list':
                if (!this.initialized) await this.initialize();
                
                console.log(`\n📋 Task Memories (${this.taskMemories.size})\n`);
                
                for (const [taskId, memory] of this.taskMemories) {
                    console.log(`${memory.title}`);
                    console.log(`  ID: ${taskId} | Status: ${memory.status} | Type: ${memory.type}`);
                    console.log(`  Created: ${memory.timestamp}`);
                    console.log('');
                }
                
                return { memories: this.taskMemories.size };
                
            default:
                console.log('Usage: memory <save|retrieve|list> [options]');
                return { error: 'Unknown memory command' };
        }
    }

    async handleDocsCommand(args) {
        if (!this.initialized) await this.initialize();
        
        const action = args[0] || 'status';
        
        switch (action) {
            case 'status':
                console.log(`\n📚 Documentation Status\n`);
                console.log(`Documentation Types: ${Object.keys(this.config.documentationTypes).length}`);
                console.log(`Indexed Documents: ${this.documentationIndex.size}`);
                console.log(`Sync History: ${this.syncHistory.length} sessions`);
                
                const lastSync = this.syncHistory[this.syncHistory.length - 1];
                if (lastSync) {
                    console.log(`\nLast Synchronization:`);
                    console.log(`  Time: ${lastSync.timestamp}`);
                    console.log(`  Files Scanned: ${lastSync.results.filesScanned}`);
                    console.log(`  Documents Updated: ${lastSync.results.documentsUpdated}`);
                    console.log(`  Status: ${lastSync.results.errorsFound === 0 ? 'Success' : 'Partial'}`);
                }
                
                return { 
                    documentationTypes: Object.keys(this.config.documentationTypes).length,
                    indexedDocuments: this.documentationIndex.size,
                    syncHistory: this.syncHistory.length 
                };
                
            case 'types':
                console.log(`\n📂 Documentation Types\n`);
                for (const [type, description] of Object.entries(this.config.documentationTypes)) {
                    console.log(`${type.padEnd(15)} ${description}`);
                }
                return { types: Object.keys(this.config.documentationTypes) };
                
            default:
                console.log('Usage: docs <status|types>');
                return { error: 'Unknown docs command' };
        }
    }

    async handleStatusCommand(args) {
        if (!this.initialized) await this.initialize();
        
        console.log(`\n📚 Documentation Synchronization System Status\n`);
        console.log(`System: ${this.initialized ? 'Initialized' : 'Not Initialized'}`);
        console.log(`Auto-sync: ${this.config.autoSync ? 'Enabled' : 'Disabled'}`);
        console.log(`Sync Interval: ${this.config.syncInterval / 1000}s`);
        console.log(`Documentation Types: ${Object.keys(this.config.documentationTypes).length}`);
        console.log(`Indexed Documents: ${this.documentationIndex.size}`);
        console.log(`Task Memories: ${this.taskMemories.size}`);
        console.log(`Sync History: ${this.syncHistory.length} sessions`);
        
        return {
            initialized: this.initialized,
            autoSync: this.config.autoSync,
            documentationTypes: Object.keys(this.config.documentationTypes).length,
            indexedDocuments: this.documentationIndex.size,
            taskMemories: this.taskMemories.size,
            syncHistory: this.syncHistory.length
        };
    }

    showHelp() {
        console.log(`
📚 Claude Code Router v3.0 - Documentation Synchronization System

Usage: documentation-synchronizer.js <command> [options]

Commands:
  sync                      Start full documentation synchronization
  
  memory                    Manage task memories
    save                    Save task memory
      --task=taskId         Task identifier (required)
      --title="Title"       Task title (required)
      --description="Desc"  Task description (optional)
    retrieve <task-id>      Retrieve task memory
    list                    List all task memories
  
  docs                      Documentation management
    status                  Show documentation status
    types                   List documentation types
  
  status                    Show system status
  
  help                      Show this help message

Documentation Types:
  architecture             Architecture documentation and system design
  interfaces               API interfaces and data structures
  components               Component documentation and usage
  testing                  Test documentation and strategies
  memory                   Memory system and knowledge management
  deployment               Deployment and infrastructure documentation

Features:
  - Automatic code-documentation synchronization
  - Test-documentation alignment system
  - Architecture documentation generation
  - Long-task memory save and retrieval
  - Real-time documentation updates

Examples:
  documentation-synchronizer.js sync
  documentation-synchronizer.js memory save --task=task-12-1 --title="Memory System Implementation"
  documentation-synchronizer.js memory retrieve task-12-1
  documentation-synchronizer.js docs status
  documentation-synchronizer.js status
        `);
        
        return { command: 'help' };
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const synchronizer = new DocumentationSynchronizer();
    
    synchronizer.runCLI(process.argv.slice(2))
        .then(result => {
            if (result.status) {
                console.log(`\n✅ Command completed: ${result.status}`);
            }
        })
        .catch(error => {
            console.error(`\n❌ Command failed:`, error.message);
            process.exit(1);
        });
}

export default DocumentationSynchronizer;