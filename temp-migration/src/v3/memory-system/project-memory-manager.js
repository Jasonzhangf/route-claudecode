#!/usr/bin/env node

/**
 * Claude Code Router v3.0 - Project Memory Architecture System
 * 
 * Comprehensive project memory management with:
 * - Memory directory structure in ~/.route-claude-code/memory
 * - Architectural decision recording (ADR) system
 * - Problem-solution mapping and correlation system
 * - Experience documentation with automatic categorization
 * - Long-task memory save and retrieval mechanisms
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

export class ProjectMemoryManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            // Memory directory structure
            baseDir: config.baseDir || path.resolve(process.env.HOME, '.route-claude-code'),
            memoryDir: config.memoryDir || 'memory',
            
            // Memory categories
            categories: {
                'architectural-decisions': 'ADRs - Major architectural decisions and rationale',
                'problem-solutions': 'Documented problems and their solutions',
                'implementation-patterns': 'Reusable implementation patterns and best practices',
                'debugging-sessions': 'Complex debugging sessions and resolutions',
                'performance-optimizations': 'Performance improvements and benchmarking',
                'refactoring-experiences': 'Major refactoring efforts and lessons learned',
                'integration-challenges': 'Provider integration challenges and solutions',
                'testing-strategies': 'Testing approaches and validation methods',
                'deployment-experiences': 'Deployment challenges and infrastructure decisions',
                'user-feedback': 'User feedback integration and feature decisions'
            },
            
            // Memory entry templates
            templates: {
                'adr': 'architectural-decision-record',
                'problem-solution': 'problem-solution-mapping',
                'experience': 'experience-documentation',
                'debugging': 'debugging-session',
                'pattern': 'implementation-pattern'
            },
            
            // Categorization settings
            autoCategorization: config.autoCategorization !== false,
            keywordWeighting: config.keywordWeighting || 'balanced', // strict, balanced, loose
            correlationThreshold: config.correlationThreshold || 0.7,
            
            // Storage settings
            maxEntriesPerCategory: config.maxEntriesPerCategory || 1000,
            archiveAfterDays: config.archiveAfterDays || 365,
            searchIndexing: config.searchIndexing !== false,
            
            ...config
        };

        this.memoryEntries = new Map();
        this.categoryIndex = new Map();
        this.correlationMatrix = new Map();
        this.searchIndex = new Map();
        this.initialized = false;
    }

    async initialize() {
        try {
            console.log('🧠 Initializing Project Memory Manager...');
            
            // Create memory directory structure
            await this.createMemoryDirectories();
            
            // Load existing memory entries
            await this.loadExistingMemory();
            
            // Build search and correlation indices
            await this.buildIndices();
            
            // Start periodic maintenance
            this.startMaintenance();
            
            this.initialized = true;
            console.log(`✅ Project Memory Manager initialized`);
            console.log(`   Memory entries loaded: ${this.memoryEntries.size}`);
            console.log(`   Categories active: ${this.categoryIndex.size}`);
            console.log(`   Search index entries: ${this.searchIndex.size}`);
            
            return {
                status: 'initialized',
                memoryEntries: this.memoryEntries.size,
                categories: this.categoryIndex.size,
                searchEntries: this.searchIndex.size,
                baseDir: path.join(this.config.baseDir, this.config.memoryDir)
            };
        } catch (error) {
            console.error('❌ Project Memory Manager initialization failed:', error.message);
            throw error;
        }
    }

    async createMemoryDirectories() {
        const memoryBaseDir = path.join(this.config.baseDir, this.config.memoryDir);
        
        // Create main memory directory
        await fs.mkdir(memoryBaseDir, { recursive: true });
        
        // Create category directories
        for (const category of Object.keys(this.config.categories)) {
            await fs.mkdir(path.join(memoryBaseDir, category), { recursive: true });
        }
        
        // Create utility directories
        const utilityDirs = [
            'templates',      // Memory entry templates
            'indices',        // Search and correlation indices
            'archives',       // Archived old entries
            'exports',        // Memory exports and backups
            'correlations',   // Problem-solution correlations
            'search-cache'    // Search result caching
        ];
        
        for (const dir of utilityDirs) {
            await fs.mkdir(path.join(memoryBaseDir, dir), { recursive: true });
        }
        
        console.log(`📂 Memory directory structure created at ${memoryBaseDir}`);
    }

    async saveMemoryEntry(data) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const memoryEntry = await this.createMemoryEntry(data);
            
            // Store in memory
            this.memoryEntries.set(memoryEntry.id, memoryEntry);
            
            // Update category index
            this.updateCategoryIndex(memoryEntry);
            
            // Save to filesystem
            await this.persistMemoryEntry(memoryEntry);
            
            // Update search index
            if (this.config.searchIndexing) {
                await this.updateSearchIndex(memoryEntry);
            }
            
            // Update correlations
            await this.updateCorrelations(memoryEntry);
            
            this.emit('memoryEntryCreated', memoryEntry);
            
            console.log(`💾 Memory entry saved: ${memoryEntry.title} (${memoryEntry.category})`);
            
            return memoryEntry;
        } catch (error) {
            console.error('❌ Failed to save memory entry:', error.message);
            throw error;
        }
    }

    async createMemoryEntry(data) {
        const timestamp = new Date().toISOString();
        const id = this.generateMemoryId(data.title || data.summary || 'memory-entry');
        
        // Auto-categorize if not provided
        const category = data.category || await this.categorizeContent(data);
        
        const memoryEntry = {
            id,
            timestamp,
            category,
            type: data.type || this.inferEntryType(data, category),
            title: data.title || this.generateTitle(data),
            summary: data.summary || this.generateSummary(data),
            content: data.content || data.description || '',
            
            // Structured data
            metadata: {
                project: 'claude-code-router',
                version: '3.0.0',
                author: data.author || 'Project Memory System',
                priority: data.priority || 'medium',
                status: data.status || 'active',
                tags: data.tags || [],
                correlatedEntries: [],
                ...data.metadata
            },
            
            // Context information
            context: {
                task: data.task || null,
                component: data.component || null,
                provider: data.provider || null,
                environment: data.environment || 'development',
                session: data.session || null,
                ...data.context
            },
            
            // Problem-solution mapping (if applicable)
            problemSolution: data.problemSolution || null,
            
            // Architectural decision record (if applicable)
            architecturalDecision: data.architecturalDecision || null,
            
            // Experience documentation
            experience: {
                difficulty: data.experience?.difficulty || 'medium',
                timeSpent: data.experience?.timeSpent || null,
                successRate: data.experience?.successRate || null,
                lessonsLearned: data.experience?.lessonsLearned || [],
                recommendedActions: data.experience?.recommendedActions || [],
                ...data.experience
            },
            
            // References and links
            references: {
                codeFiles: data.references?.codeFiles || [],
                documentation: data.references?.documentation || [],
                externalLinks: data.references?.externalLinks || [],
                relatedTasks: data.references?.relatedTasks || [],
                ...data.references
            }
        };

        return memoryEntry;
    }

    async categorizeContent(data) {
        if (!this.config.autoCategorization) {
            throw new Error('Auto-categorization is disabled and no explicit category provided. Zero-fallback principle requires explicit categorization.');
        }

        const content = (data.content || data.summary || data.title || '').toLowerCase();
        const keywords = this.extractKeywords(content);
        
        // Category keyword mapping
        const categoryKeywords = {
            'architectural-decisions': ['architecture', 'design', 'adr', 'decision', 'pattern', 'structure'],
            'problem-solutions': ['problem', 'issue', 'bug', 'error', 'fix', 'solution', 'resolve'],
            'debugging-sessions': ['debug', 'trace', 'investigate', 'diagnose', 'troubleshoot', 'root cause'],
            'performance-optimizations': ['performance', 'optimize', 'speed', 'memory', 'cpu', 'benchmark'],
            'refactoring-experiences': ['refactor', 'cleanup', 'reorganize', 'restructure', 'improve'],
            'integration-challenges': ['integration', 'provider', 'api', 'connector', 'interface'],
            'testing-strategies': ['test', 'testing', 'validation', 'verify', 'qa', 'quality'],
            'deployment-experiences': ['deploy', 'deployment', 'production', 'release', 'infrastructure'],
            'implementation-patterns': ['implement', 'code', 'develop', 'build', 'create']
        };

        // Score each category
        const categoryScores = {};
        for (const [category, categoryKeywordList] of Object.entries(categoryKeywords)) {
            let score = 0;
            for (const keyword of keywords) {
                if (categoryKeywordList.some(ckw => keyword.includes(ckw) || ckw.includes(keyword))) {
                    score++;
                }
            }
            categoryScores[category] = score;
        }

        // Find best matching category
        const bestCategory = Object.entries(categoryScores)
            .sort(([,a], [,b]) => b - a)[0];

        if (!bestCategory || bestCategory[1] === 0) {
            throw new Error(`Unable to categorize content. Keywords found: ${keywords.join(', ')}. Zero-fallback principle requires successful categorization.`);
        }
        
        return bestCategory[0];
    }

    extractKeywords(text) {
        return text.toLowerCase()
            .split(/\W+/)
            .filter(word => word.length > 2)
            .filter(word => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'way', 'who', 'oil', 'sit', 'set'].includes(word));
    }

    inferEntryType(data, category) {
        // Infer entry type based on category and content
        const typeMapping = {
            'architectural-decisions': 'adr',
            'problem-solutions': 'problem-solution',
            'debugging-sessions': 'debugging',
            'implementation-patterns': 'pattern'
        };

        return typeMapping[category] || 'experience';
    }

    generateTitle(data) {
        if (data.title) return data.title;
        
        const summary = data.summary || data.content || '';
        if (summary.length > 0) {
            // Extract first meaningful sentence as title
            const sentences = summary.split(/[.!?]/);
            const firstSentence = sentences[0].trim();
            return firstSentence.length > 5 ? firstSentence.substring(0, 80) + '...' : 'Memory Entry';
        }
        
        return `Memory Entry - ${new Date().toLocaleDateString()}`;
    }

    generateSummary(data) {
        if (data.summary) return data.summary;
        
        const content = data.content || data.description || '';
        if (content.length > 200) {
            return content.substring(0, 200) + '...';
        }
        
        return content || 'No summary available';
    }

    generateMemoryId(title) {
        const timestamp = Date.now();
        const hash = crypto.createHash('md5').update(title + timestamp).digest('hex').substring(0, 8);
        return `mem-${timestamp}-${hash}`;
    }

    updateCategoryIndex(memoryEntry) {
        if (!this.categoryIndex.has(memoryEntry.category)) {
            this.categoryIndex.set(memoryEntry.category, new Set());
        }
        this.categoryIndex.get(memoryEntry.category).add(memoryEntry.id);
    }

    async persistMemoryEntry(memoryEntry) {
        const memoryBaseDir = path.join(this.config.baseDir, this.config.memoryDir);
        const categoryDir = path.join(memoryBaseDir, memoryEntry.category);
        const fileName = `${memoryEntry.id}.json`;
        const filePath = path.join(categoryDir, fileName);
        
        await fs.writeFile(filePath, JSON.stringify(memoryEntry, null, 2));
        
        // Also create a markdown version for human readability
        const markdownContent = this.generateMarkdownFormat(memoryEntry);
        const markdownPath = path.join(categoryDir, `${memoryEntry.id}.md`);
        await fs.writeFile(markdownPath, markdownContent);
    }

    generateMarkdownFormat(memoryEntry) {
        return `# ${memoryEntry.title}

## Summary
${memoryEntry.summary}

## Details
**Category:** ${memoryEntry.category}  
**Type:** ${memoryEntry.type}  
**Created:** ${memoryEntry.timestamp}  
**Priority:** ${memoryEntry.metadata.priority}  
**Status:** ${memoryEntry.metadata.status}

${memoryEntry.metadata.tags.length > 0 ? `**Tags:** ${memoryEntry.metadata.tags.join(', ')}` : ''}

## Content
${memoryEntry.content}

${memoryEntry.problemSolution ? `## Problem-Solution Mapping
**Problem:** ${memoryEntry.problemSolution.problem}
**Solution:** ${memoryEntry.problemSolution.solution}
**Result:** ${memoryEntry.problemSolution.result}` : ''}

${memoryEntry.architecturalDecision ? `## Architectural Decision
**Context:** ${memoryEntry.architecturalDecision.context}
**Decision:** ${memoryEntry.architecturalDecision.decision}
**Rationale:** ${memoryEntry.architecturalDecision.rationale}
**Consequences:** ${memoryEntry.architecturalDecision.consequences}` : ''}

## Experience
- **Difficulty:** ${memoryEntry.experience.difficulty}
${memoryEntry.experience.timeSpent ? `- **Time Spent:** ${memoryEntry.experience.timeSpent}` : ''}
${memoryEntry.experience.lessonsLearned.length > 0 ? `
### Lessons Learned
${memoryEntry.experience.lessonsLearned.map(lesson => `- ${lesson}`).join('\n')}` : ''}

${memoryEntry.experience.recommendedActions.length > 0 ? `
### Recommended Actions
${memoryEntry.experience.recommendedActions.map(action => `- ${action}`).join('\n')}` : ''}

## Context
${Object.entries(memoryEntry.context)
    .filter(([_, value]) => value !== null)
    .map(([key, value]) => `- **${key}:** ${value}`)
    .join('\n')}

## References
${memoryEntry.references.codeFiles.length > 0 ? `
### Code Files
${memoryEntry.references.codeFiles.map(file => `- ${file}`).join('\n')}` : ''}

${memoryEntry.references.documentation.length > 0 ? `
### Documentation
${memoryEntry.references.documentation.map(doc => `- ${doc}`).join('\n')}` : ''}

${memoryEntry.references.externalLinks.length > 0 ? `
### External Links
${memoryEntry.references.externalLinks.map(link => `- ${link}`).join('\n')}` : ''}

---
*Memory ID: ${memoryEntry.id}*  
*Generated by Project Memory Manager v3.0.0*
`;
    }

    async updateSearchIndex(memoryEntry) {
        const searchableContent = [
            memoryEntry.title,
            memoryEntry.summary,
            memoryEntry.content,
            memoryEntry.metadata.tags.join(' '),
            Object.values(memoryEntry.context).join(' ')
        ].join(' ').toLowerCase();

        const keywords = this.extractKeywords(searchableContent);
        
        for (const keyword of keywords) {
            if (!this.searchIndex.has(keyword)) {
                this.searchIndex.set(keyword, new Set());
            }
            this.searchIndex.get(keyword).add(memoryEntry.id);
        }
    }

    async updateCorrelations(memoryEntry) {
        // Find correlations with existing entries
        const correlatedEntries = await this.findCorrelatedEntries(memoryEntry);
        
        if (correlatedEntries.length > 0) {
            memoryEntry.metadata.correlatedEntries = correlatedEntries;
            
            // Update correlation matrix
            for (const correlatedId of correlatedEntries) {
                const key = `${memoryEntry.id}-${correlatedId}`;
                this.correlationMatrix.set(key, {
                    entries: [memoryEntry.id, correlatedId],
                    strength: this.calculateCorrelationStrength(memoryEntry, this.memoryEntries.get(correlatedId)),
                    type: 'content-similarity',
                    createdAt: new Date().toISOString()
                });
            }
        }
    }

    async findCorrelatedEntries(memoryEntry) {
        const correlatedEntries = [];
        const entryKeywords = this.extractKeywords(
            `${memoryEntry.title} ${memoryEntry.summary} ${memoryEntry.content}`.toLowerCase()
        );

        for (const [existingId, existingEntry] of this.memoryEntries) {
            if (existingId === memoryEntry.id) continue;

            const existingKeywords = this.extractKeywords(
                `${existingEntry.title} ${existingEntry.summary} ${existingEntry.content}`.toLowerCase()
            );

            const similarity = this.calculateSimilarity(entryKeywords, existingKeywords);
            
            if (similarity >= this.config.correlationThreshold) {
                correlatedEntries.push(existingId);
            }
        }

        return correlatedEntries.slice(0, 5); // Limit to top 5 correlations
    }

    calculateSimilarity(keywords1, keywords2) {
        const set1 = new Set(keywords1);
        const set2 = new Set(keywords2);
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return union.size > 0 ? intersection.size / union.size : 0;
    }

    calculateCorrelationStrength(entry1, entry2) {
        if (!entry2) return 0;
        
        const titleSimilarity = this.calculateSimilarity(
            this.extractKeywords(entry1.title.toLowerCase()),
            this.extractKeywords(entry2.title.toLowerCase())
        );
        
        const contentSimilarity = this.calculateSimilarity(
            this.extractKeywords(entry1.content.toLowerCase()),
            this.extractKeywords(entry2.content.toLowerCase())
        );
        
        const categorySimilarity = entry1.category === entry2.category ? 1 : 0;
        
        return (titleSimilarity * 0.3 + contentSimilarity * 0.5 + categorySimilarity * 0.2);
    }

    async searchMemory(query, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const searchResults = [];
        const queryKeywords = this.extractKeywords(query.toLowerCase());
        const limit = options.limit || 20;
        const category = options.category || null;

        // Search through entries
        for (const [entryId, entry] of this.memoryEntries) {
            if (category && entry.category !== category) continue;

            const entryKeywords = this.extractKeywords(
                `${entry.title} ${entry.summary} ${entry.content}`.toLowerCase()
            );

            const relevance = this.calculateSimilarity(queryKeywords, entryKeywords);
            
            if (relevance > 0) {
                searchResults.push({
                    entry,
                    relevance,
                    matchedKeywords: queryKeywords.filter(kw => entryKeywords.includes(kw))
                });
            }
        }

        // Sort by relevance and apply limit
        return searchResults
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit);
    }

    async getMemoryEntry(entryId) {
        if (!this.initialized) {
            await this.initialize();
        }

        const entry = this.memoryEntries.get(entryId);
        if (!entry) {
            throw new Error(`Memory entry '${entryId}' not found`);
        }

        return entry;
    }

    async getMemoryByCategory(category, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const categoryEntries = this.categoryIndex.get(category);
        if (!categoryEntries) {
            return [];
        }

        const entries = Array.from(categoryEntries)
            .map(entryId => this.memoryEntries.get(entryId))
            .filter(entry => entry) // Filter out any missing entries
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by newest first

        const limit = options.limit || entries.length;
        return entries.slice(0, limit);
    }

    async loadExistingMemory() {
        const memoryBaseDir = path.join(this.config.baseDir, this.config.memoryDir);
        
        try {
            await fs.access(memoryBaseDir);
        } catch {
            console.log('📂 No existing memory directory found');
            return;
        }

        let loadedEntries = 0;
        
        for (const category of Object.keys(this.config.categories)) {
            const categoryDir = path.join(memoryBaseDir, category);
            
            try {
                const files = await fs.readdir(categoryDir);
                const jsonFiles = files.filter(f => f.endsWith('.json'));
                
                for (const file of jsonFiles) {
                    try {
                        const filePath = path.join(categoryDir, file);
                        const content = await fs.readFile(filePath, 'utf8');
                        const memoryEntry = JSON.parse(content);
                        
                        this.memoryEntries.set(memoryEntry.id, memoryEntry);
                        this.updateCategoryIndex(memoryEntry);
                        loadedEntries++;
                    } catch (error) {
                        console.error(`❌ Failed to load memory entry ${file}:`, error.message);
                        throw new Error(`Critical memory system failure: Unable to load memory entry ${file}. ${error.message}`);
                    }
                }
            } catch (error) {
                // Category directory doesn't exist yet
            }
        }

        console.log(`📚 Loaded ${loadedEntries} existing memory entries`);
    }

    async buildIndices() {
        console.log('🔍 Building search and correlation indices...');
        
        // Clear existing indices
        this.searchIndex.clear();
        this.correlationMatrix.clear();
        
        // Build search index
        for (const memoryEntry of this.memoryEntries.values()) {
            if (this.config.searchIndexing) {
                await this.updateSearchIndex(memoryEntry);
            }
        }
        
        // Build correlation matrix
        for (const memoryEntry of this.memoryEntries.values()) {
            await this.updateCorrelations(memoryEntry);
        }
        
        console.log(`📊 Indices built: ${this.searchIndex.size} search terms, ${this.correlationMatrix.size} correlations`);
    }

    startMaintenance() {
        // Periodic maintenance tasks
        setInterval(async () => {
            try {
                await this.performMaintenance();
            } catch (error) {
                console.error('❌ Memory maintenance error:', error.message);
            }
        }, 3600000); // Run every hour
    }

    async performMaintenance() {
        console.log('🔧 Performing memory maintenance...');
        
        // Archive old entries if needed
        await this.archiveOldEntries();
        
        // Rebuild indices periodically
        if (this.memoryEntries.size > 0) {
            await this.buildIndices();
        }
        
        // Save indices to disk for persistence
        await this.saveIndices();
    }

    async archiveOldEntries() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.archiveAfterDays);

        let archivedCount = 0;
        
        for (const [entryId, entry] of this.memoryEntries) {
            if (new Date(entry.timestamp) < cutoffDate) {
                await this.archiveEntry(entry);
                this.memoryEntries.delete(entryId);
                archivedCount++;
            }
        }

        if (archivedCount > 0) {
            console.log(`📦 Archived ${archivedCount} old memory entries`);
        }
    }

    async archiveEntry(entry) {
        const memoryBaseDir = path.join(this.config.baseDir, this.config.memoryDir);
        const archiveDir = path.join(memoryBaseDir, 'archives', entry.category);
        
        await fs.mkdir(archiveDir, { recursive: true });
        
        const archivePath = path.join(archiveDir, `${entry.id}.json`);
        await fs.writeFile(archivePath, JSON.stringify(entry, null, 2));
    }

    async saveIndices() {
        const memoryBaseDir = path.join(this.config.baseDir, this.config.memoryDir);
        const indicesDir = path.join(memoryBaseDir, 'indices');
        
        // Save search index
        const searchIndexData = {};
        for (const [keyword, entryIds] of this.searchIndex) {
            searchIndexData[keyword] = Array.from(entryIds);
        }
        
        await fs.writeFile(
            path.join(indicesDir, 'search-index.json'),
            JSON.stringify(searchIndexData, null, 2)
        );
        
        // Save correlation matrix
        const correlationData = {};
        for (const [key, correlation] of this.correlationMatrix) {
            correlationData[key] = correlation;
        }
        
        await fs.writeFile(
            path.join(indicesDir, 'correlations.json'),
            JSON.stringify(correlationData, null, 2)
        );
    }

    // CLI Interface
    async runCLI(args = []) {
        const command = args[0];
        
        switch (command) {
            case 'save':
                return await this.handleSaveCommand(args.slice(1));
            case 'search':
                return await this.handleSearchCommand(args.slice(1));
            case 'list':
                return await this.handleListCommand(args.slice(1));
            case 'show':
                return await this.handleShowCommand(args.slice(1));
            case 'categories':
                return await this.handleCategoriesCommand(args.slice(1));
            case 'correlations':
                return await this.handleCorrelationsCommand(args.slice(1));
            case 'help':
            default:
                return this.showHelp();
        }
    }

    async handleSaveCommand(args) {
        // Interactive memory entry creation
        const title = args.find(arg => arg.startsWith('--title='))?.substring(8);
        const category = args.find(arg => arg.startsWith('--category='))?.substring(11);
        const content = args.find(arg => arg.startsWith('--content='))?.substring(10);

        if (!title || !content) {
            console.log('Usage: save --title="Entry Title" --content="Entry content" [--category=category]');
            return { error: 'Title and content are required' };
        }

        try {
            const memoryEntry = await this.saveMemoryEntry({
                title,
                category,
                content,
                type: 'experience'
            });

            console.log(`✅ Memory entry saved: ${memoryEntry.id}`);
            console.log(`   Title: ${memoryEntry.title}`);
            console.log(`   Category: ${memoryEntry.category}`);
            
            return { status: 'saved', entry: memoryEntry };
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleSearchCommand(args) {
        const query = args.find(arg => !arg.startsWith('--')) || '';
        const category = args.find(arg => arg.startsWith('--category='))?.substring(11);
        const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.substring(8) || '10');

        if (!query) {
            console.log('Usage: search <query> [--category=category] [--limit=N]');
            return { error: 'Search query is required' };
        }

        try {
            const results = await this.searchMemory(query, { category, limit });

            console.log(`\n🔍 Search Results for "${query}"`);
            console.log(`Found ${results.length} entries\n`);

            results.forEach((result, index) => {
                console.log(`${index + 1}. ${result.entry.title}`);
                console.log(`   Category: ${result.entry.category}`);
                console.log(`   Relevance: ${(result.relevance * 100).toFixed(1)}%`);
                console.log(`   ID: ${result.entry.id}`);
                console.log(`   Summary: ${result.entry.summary.substring(0, 100)}...`);
                console.log('');
            });

            return { results: results.length, query };
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleListCommand(args) {
        const category = args.find(arg => arg.startsWith('--category='))?.substring(11);
        const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.substring(8) || '20');

        try {
            let entries;
            if (category) {
                entries = await this.getMemoryByCategory(category, { limit });
                console.log(`\n📋 Memory Entries in "${category}" (${entries.length})\n`);
            } else {
                entries = Array.from(this.memoryEntries.values())
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, limit);
                console.log(`\n📋 Recent Memory Entries (${entries.length})\n`);
            }

            entries.forEach((entry, index) => {
                console.log(`${index + 1}. ${entry.title}`);
                console.log(`   Category: ${entry.category} | Type: ${entry.type}`);
                console.log(`   Created: ${entry.timestamp}`);
                console.log(`   ID: ${entry.id}`);
                console.log('');
            });

            return { entries: entries.length, category };
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleShowCommand(args) {
        const entryId = args.find(arg => !arg.startsWith('--'));

        if (!entryId) {
            console.log('Usage: show <entry-id>');
            return { error: 'Entry ID is required' };
        }

        try {
            const entry = await this.getMemoryEntry(entryId);

            console.log(`\n📄 Memory Entry: ${entry.title}`);
            console.log(`ID: ${entry.id}`);
            console.log(`Category: ${entry.category} | Type: ${entry.type}`);
            console.log(`Created: ${entry.timestamp}`);
            console.log(`Priority: ${entry.metadata.priority} | Status: ${entry.metadata.status}`);
            console.log(`\n📝 Summary:`);
            console.log(entry.summary);
            console.log(`\n📋 Content:`);
            console.log(entry.content);

            if (entry.metadata.correlatedEntries.length > 0) {
                console.log(`\n🔗 Correlated Entries:`);
                entry.metadata.correlatedEntries.forEach(correlatedId => {
                    const correlatedEntry = this.memoryEntries.get(correlatedId);
                    if (correlatedEntry) {
                        console.log(`   - ${correlatedEntry.title} (${correlatedId})`);
                    }
                });
            }

            return { entry: entry.id };
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return { error: error.message };
        }
    }

    async handleCategoriesCommand(args) {
        if (!this.initialized) await this.initialize();

        console.log(`\n📂 Memory Categories\n`);

        for (const [category, description] of Object.entries(this.config.categories)) {
            const entryCount = this.categoryIndex.get(category)?.size || 0;
            console.log(`${category.padEnd(25)} ${entryCount.toString().padStart(4)} entries`);
            console.log(`  ${description}`);
            console.log('');
        }

        console.log(`📊 Total Categories: ${Object.keys(this.config.categories).length}`);
        console.log(`📚 Total Entries: ${this.memoryEntries.size}`);

        return { categories: Object.keys(this.config.categories).length };
    }

    async handleCorrelationsCommand(args) {
        const entryId = args.find(arg => !arg.startsWith('--'));

        if (entryId) {
            // Show correlations for specific entry
            try {
                const entry = await this.getMemoryEntry(entryId);
                
                console.log(`\n🔗 Correlations for: ${entry.title}\n`);

                if (entry.metadata.correlatedEntries.length === 0) {
                    console.log('No correlations found for this entry.');
                    return { correlations: 0 };
                }

                entry.metadata.correlatedEntries.forEach(correlatedId => {
                    const correlatedEntry = this.memoryEntries.get(correlatedId);
                    if (correlatedEntry) {
                        const correlationKey = `${entry.id}-${correlatedId}`;
                        const correlation = this.correlationMatrix.get(correlationKey);
                        const strength = correlation ? (correlation.strength * 100).toFixed(1) + '%' : 'N/A';
                        
                        console.log(`• ${correlatedEntry.title}`);
                        console.log(`  Strength: ${strength} | Category: ${correlatedEntry.category}`);
                        console.log(`  ID: ${correlatedId}`);
                        console.log('');
                    }
                });

                return { correlations: entry.metadata.correlatedEntries.length };
            } catch (error) {
                console.error(`❌ Error: ${error.message}`);
                return { error: error.message };
            }
        } else {
            // Show overall correlation statistics
            console.log(`\n📊 Memory Correlation Statistics\n`);
            console.log(`Total Correlations: ${this.correlationMatrix.size}`);
            
            // Show top correlated entries
            const correlationCounts = new Map();
            for (const [_, correlation] of this.correlationMatrix) {
                for (const entryId of correlation.entries) {
                    correlationCounts.set(entryId, (correlationCounts.get(entryId) || 0) + 1);
                }
            }

            const topCorrelated = Array.from(correlationCounts.entries())
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10);

            console.log(`\nTop Correlated Entries:`);
            topCorrelated.forEach(([entryId, count], index) => {
                const entry = this.memoryEntries.get(entryId);
                if (entry) {
                    console.log(`${index + 1}. ${entry.title} (${count} correlations)`);
                }
            });

            return { totalCorrelations: this.correlationMatrix.size };
        }
    }

    showHelp() {
        console.log(`
🧠 Claude Code Router v3.0 - Project Memory Manager

Usage: project-memory-manager.js <command> [options]

Commands:
  save                      Save a new memory entry
    --title="Entry Title"   Memory entry title (required)
    --content="Content"     Memory entry content (required)  
    --category=category     Memory category (optional, auto-detected)
    
  search <query>            Search memory entries
    --category=category     Limit search to specific category
    --limit=N               Limit number of results (default: 10)
    
  list                      List memory entries
    --category=category     Show entries from specific category
    --limit=N               Limit number of entries (default: 20)
    
  show <entry-id>           Show detailed memory entry
  
  categories                List all memory categories and entry counts
  
  correlations [entry-id]   Show correlations
                           Without entry-id: show correlation statistics
                           With entry-id: show correlations for specific entry
  
  help                      Show this help message

Memory Categories:
  architectural-decisions   ADRs and major architectural decisions
  problem-solutions         Documented problems and solutions
  implementation-patterns   Reusable implementation patterns
  debugging-sessions        Complex debugging sessions and resolutions
  performance-optimizations Performance improvements and benchmarking
  refactoring-experiences   Major refactoring efforts and lessons
  integration-challenges    Provider integration challenges
  testing-strategies        Testing approaches and validation methods
  deployment-experiences    Deployment challenges and infrastructure
  user-feedback             User feedback integration and decisions

Examples:
  project-memory-manager.js save --title="API Rate Limiting Issue" --content="Solved rate limiting by implementing exponential backoff"
  project-memory-manager.js search "authentication error" --category=problem-solutions
  project-memory-manager.js list --category=architectural-decisions --limit=5
  project-memory-manager.js show mem-1754900000000-a1b2c3d4
  project-memory-manager.js correlations mem-1754900000000-a1b2c3d4
        `);
        
        return { command: 'help' };
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const memoryManager = new ProjectMemoryManager();
    
    memoryManager.runCLI(process.argv.slice(2))
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

export default ProjectMemoryManager;