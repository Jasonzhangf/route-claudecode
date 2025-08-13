#!/usr/bin/env node

/**
 * Claude Code Router v3.0 - Finish Reason Logging and Retrieval System
 * 
 * Comprehensive finish reason tracking across all provider-protocols with:
 * - Categorized logging for different finish reason types
 * - Historical analysis and pattern recognition
 * - Provider-protocol comparison capabilities
 * - Advanced query and filtering interface
 * - Alert system for unusual patterns
 * 
 * @author Jason Zhang
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FinishReasonTracker extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            // Default configuration
            baseDir: config.baseDir || path.resolve(process.env.HOME, '.route-claude-code/finish-reasons'),
            alertThresholds: {
                errorRateHigh: config.alertThresholds?.errorRateHigh || 0.15, // 15% error rate
                unusualPatternDetection: config.alertThresholds?.unusualPatternDetection || 0.3, // 30% deviation
                rateLimitFrequency: config.alertThresholds?.rateLimitFrequency || 10 // 10 rate limits per hour
            },
            categories: config.categories || [
                'stop',           // Normal completion
                'length',         // Token limit reached
                'tool_calls',     // Tool execution triggered
                'error',          // API error occurred
                'timeout',        // Request timeout
                'rate_limit',     // Rate limiting
                'content_filter', // Content filtering
                'unknown'         // Unrecognized finish reason
            ],
            providerProtocols: config.providerProtocols || [
                'anthropic',
                'openai', 
                'gemini',
                'codewhisperer',
                'unknown'
            ],
            retentionDays: config.retentionDays || 30,
            ...config
        };

        this.data = {
            finishReasons: new Map(),
            patterns: new Map(),
            alerts: [],
            statistics: new Map()
        };

        this.initialized = false;
    }

    async initialize() {
        try {
            // Ensure base directory exists
            await fs.mkdir(this.config.baseDir, { recursive: true });
            
            // Create subdirectories for organized storage
            const subdirs = [
                'logs',           // Raw finish reason logs
                'patterns',       // Pattern analysis results
                'reports',        // Generated reports
                'alerts',         // Alert history
                'exports'         // Export files
            ];

            for (const subdir of subdirs) {
                await fs.mkdir(path.join(this.config.baseDir, subdir), { recursive: true });
            }

            // Load existing data
            await this.loadHistoricalData();
            
            this.initialized = true;
            console.log(`✅ FinishReasonTracker initialized at ${this.config.baseDir}`);
            
            return {
                status: 'initialized',
                baseDir: this.config.baseDir,
                categories: this.config.categories,
                providerProtocols: this.config.providerProtocols,
                dataLoaded: this.data.finishReasons.size
            };
        } catch (error) {
            console.error('❌ FinishReasonTracker initialization failed:', error.message);
            throw error;
        }
    }

    async logFinishReason(data) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const logEntry = this.createLogEntry(data);
            
            // Store in memory
            const key = this.generateKey(logEntry);
            this.data.finishReasons.set(key, logEntry);
            
            // Write to disk
            await this.persistLogEntry(logEntry);
            
            // Update statistics
            await this.updateStatistics(logEntry);
            
            // Check for patterns and alerts
            await this.analyzePatterns(logEntry);
            
            this.emit('finishReasonLogged', logEntry);
            
            return {
                status: 'logged',
                id: logEntry.id,
                category: logEntry.category,
                provider: logEntry.provider
            };
        } catch (error) {
            console.error('❌ Failed to log finish reason:', error.message);
            throw error;
        }
    }

    createLogEntry(data) {
        const timestamp = new Date().toISOString();
        const id = this.generateId();
        
        return {
            id,
            timestamp,
            provider: data.provider || 'unknown',
            model: data.model || 'unknown',
            finishReason: data.finishReason || 'unknown',
            category: this.categorizeFinishReason(data.finishReason),
            requestId: data.requestId || null,
            sessionId: data.sessionId || null,
            duration: data.duration || null,
            tokenCount: {
                input: data.tokenCount?.input || null,
                output: data.tokenCount?.output || null,
                total: data.tokenCount?.total || null
            },
            errorDetails: data.errorDetails || null,
            metadata: {
                userAgent: data.metadata?.userAgent || null,
                endpoint: data.metadata?.endpoint || null,
                method: data.metadata?.method || null,
                status: data.metadata?.status || null,
                ...data.metadata
            },
            rawData: data.rawData || null
        };
    }

    categorizeFinishReason(finishReason) {
        if (!finishReason) return 'unknown';
        
        const reason = finishReason.toLowerCase();
        
        // Standard categorization mapping
        const categoryMap = {
            'stop': ['stop', 'end_turn', 'complete', 'finished'],
            'length': ['length', 'max_tokens', 'token_limit', 'max_length'],
            'tool_calls': ['tool_calls', 'function_call', 'tool_use', 'function'],
            'error': ['error', 'failed', 'exception', 'invalid'],
            'timeout': ['timeout', 'timed_out', 'deadline_exceeded'],
            'rate_limit': ['rate_limit', 'rate_limited', 'quota_exceeded', 'throttled'],
            'content_filter': ['content_filter', 'filtered', 'policy_violation', 'unsafe']
        };

        for (const [category, keywords] of Object.entries(categoryMap)) {
            if (keywords.some(keyword => reason.includes(keyword))) {
                return category;
            }
        }

        return 'unknown';
    }

    async queryFinishReasons(query = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            let results = Array.from(this.data.finishReasons.values());

            // Apply filters
            if (query.provider) {
                results = results.filter(entry => entry.provider === query.provider);
            }
            
            if (query.category) {
                results = results.filter(entry => entry.category === query.category);
            }
            
            if (query.dateRange) {
                const start = new Date(query.dateRange.start);
                const end = new Date(query.dateRange.end);
                results = results.filter(entry => {
                    const entryDate = new Date(entry.timestamp);
                    return entryDate >= start && entryDate <= end;
                });
            }

            if (query.finishReason) {
                results = results.filter(entry => 
                    entry.finishReason.toLowerCase().includes(query.finishReason.toLowerCase())
                );
            }

            // Apply sorting
            if (query.sortBy) {
                results.sort((a, b) => {
                    const aVal = a[query.sortBy];
                    const bVal = b[query.sortBy];
                    return query.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
                });
            } else {
                // Default sort by timestamp desc
                results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            }

            // Apply pagination
            const limit = query.limit || 100;
            const offset = query.offset || 0;
            const paginatedResults = results.slice(offset, offset + limit);

            return {
                results: paginatedResults,
                total: results.length,
                offset,
                limit,
                query: query
            };
        } catch (error) {
            console.error('❌ Failed to query finish reasons:', error.message);
            throw error;
        }
    }

    async generateDistributionReport(options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const timeRange = options.timeRange || { hours: 24 };
            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - (timeRange.hours || 24));

            const recentEntries = Array.from(this.data.finishReasons.values())
                .filter(entry => new Date(entry.timestamp) >= cutoffTime);

            // Category distribution
            const categoryDist = {};
            const providerDist = {};
            const finishReasonDist = {};
            const hourlyDist = {};

            recentEntries.forEach(entry => {
                // Category distribution
                categoryDist[entry.category] = (categoryDist[entry.category] || 0) + 1;
                
                // Provider distribution
                providerDist[entry.provider] = (providerDist[entry.provider] || 0) + 1;
                
                // Finish reason distribution
                finishReasonDist[entry.finishReason] = (finishReasonDist[entry.finishReason] || 0) + 1;
                
                // Hourly distribution
                const hour = new Date(entry.timestamp).getHours();
                hourlyDist[hour] = (hourlyDist[hour] || 0) + 1;
            });

            const report = {
                metadata: {
                    generatedAt: new Date().toISOString(),
                    timeRange,
                    totalEntries: recentEntries.length,
                    uniqueProviders: Object.keys(providerDist).length,
                    uniqueCategories: Object.keys(categoryDist).length
                },
                distributions: {
                    byCategory: this.calculatePercentages(categoryDist),
                    byProvider: this.calculatePercentages(providerDist),
                    byFinishReason: this.calculatePercentages(finishReasonDist),
                    byHour: this.calculatePercentages(hourlyDist)
                },
                insights: await this.generateInsights(categoryDist, providerDist, recentEntries)
            };

            // Save report
            const reportPath = path.join(this.config.baseDir, 'reports', 
                `distribution-report-${Date.now()}.json`);
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

            return report;
        } catch (error) {
            console.error('❌ Failed to generate distribution report:', error.message);
            throw error;
        }
    }

    async analyzePatterns(newEntry) {
        try {
            // Pattern detection for unusual finish reason frequencies
            const provider = newEntry.provider;
            const category = newEntry.category;
            
            // Get recent entries for this provider (last hour)
            const oneHourAgo = new Date();
            oneHourAgo.setHours(oneHourAgo.getHours() - 1);
            
            const recentEntries = Array.from(this.data.finishReasons.values())
                .filter(entry => 
                    entry.provider === provider && 
                    new Date(entry.timestamp) >= oneHourAgo
                );

            // Check for rate limit pattern
            const rateLimitCount = recentEntries.filter(entry => 
                entry.category === 'rate_limit'
            ).length;

            if (rateLimitCount >= this.config.alertThresholds.rateLimitFrequency) {
                await this.createAlert('rate_limit_threshold', {
                    provider,
                    count: rateLimitCount,
                    threshold: this.config.alertThresholds.rateLimitFrequency,
                    timeWindow: '1 hour'
                });
            }

            // Check for error rate pattern
            const errorCount = recentEntries.filter(entry => 
                entry.category === 'error'
            ).length;
            
            const errorRate = recentEntries.length > 0 ? errorCount / recentEntries.length : 0;

            if (errorRate >= this.config.alertThresholds.errorRateHigh) {
                await this.createAlert('high_error_rate', {
                    provider,
                    errorRate: (errorRate * 100).toFixed(2) + '%',
                    threshold: (this.config.alertThresholds.errorRateHigh * 100).toFixed(2) + '%',
                    timeWindow: '1 hour'
                });
            }

        } catch (error) {
            console.error('❌ Pattern analysis failed:', error.message);
        }
    }

    async createAlert(type, data) {
        const alert = {
            id: this.generateId(),
            type,
            timestamp: new Date().toISOString(),
            severity: this.getAlertSeverity(type),
            data,
            resolved: false
        };

        this.data.alerts.push(alert);

        // Save alert
        const alertPath = path.join(this.config.baseDir, 'alerts', 
            `alert-${alert.id}.json`);
        await fs.writeFile(alertPath, JSON.stringify(alert, null, 2));

        this.emit('alertCreated', alert);
        
        console.warn(`⚠️ Alert created: ${type} - ${alert.severity} severity`);
        
        return alert;
    }

    getAlertSeverity(type) {
        const severityMap = {
            'rate_limit_threshold': 'high',
            'high_error_rate': 'critical',
            'unusual_pattern': 'medium',
            'provider_unavailable': 'critical'
        };

        return severityMap[type] || 'medium';
    }

    calculatePercentages(distribution) {
        const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
        
        return Object.entries(distribution).map(([key, count]) => ({
            key,
            count,
            percentage: total > 0 ? ((count / total) * 100).toFixed(2) : '0.00'
        })).sort((a, b) => b.count - a.count);
    }

    async generateInsights(categoryDist, providerDist, entries) {
        const insights = [];

        // Most common finish reason
        const topCategory = Object.entries(categoryDist)
            .sort(([,a], [,b]) => b - a)[0];
        if (topCategory) {
            insights.push(`Most common finish reason: ${topCategory[0]} (${topCategory[1]} occurrences)`);
        }

        // Provider performance
        const topProvider = Object.entries(providerDist)
            .sort(([,a], [,b]) => b - a)[0];
        if (topProvider) {
            insights.push(`Most active provider: ${topProvider[0]} (${topProvider[1]} requests)`);
        }

        // Error analysis
        const errorCount = categoryDist.error || 0;
        const errorRate = entries.length > 0 ? (errorCount / entries.length * 100).toFixed(2) : '0.00';
        insights.push(`Error rate: ${errorRate}% (${errorCount} errors out of ${entries.length} total)`);

        return insights;
    }

    async exportFinishReasonData(format = 'json', query = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const queryResults = await this.queryFinishReasons(query);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            let exportData, filePath, fileName;

            switch (format.toLowerCase()) {
                case 'json':
                    exportData = JSON.stringify(queryResults, null, 2);
                    fileName = `finish-reasons-export-${timestamp}.json`;
                    break;
                    
                case 'csv':
                    exportData = this.convertToCSV(queryResults.results);
                    fileName = `finish-reasons-export-${timestamp}.csv`;
                    break;
                    
                case 'summary':
                    const report = await this.generateDistributionReport({ timeRange: { hours: 24 } });
                    exportData = JSON.stringify(report, null, 2);
                    fileName = `finish-reasons-summary-${timestamp}.json`;
                    break;
                    
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }

            filePath = path.join(this.config.baseDir, 'exports', fileName);
            await fs.writeFile(filePath, exportData);

            return {
                status: 'exported',
                format,
                filePath,
                recordCount: queryResults.results.length,
                fileSize: Buffer.byteLength(exportData, 'utf8')
            };
        } catch (error) {
            console.error('❌ Export failed:', error.message);
            throw error;
        }
    }

    convertToCSV(data) {
        if (!data || data.length === 0) {
            return 'No data available';
        }

        const headers = [
            'ID', 'Timestamp', 'Provider', 'Model', 'Finish Reason', 'Category', 
            'Duration (ms)', 'Input Tokens', 'Output Tokens', 'Total Tokens', 
            'Error Details', 'Request ID'
        ];

        const csvRows = [headers.join(',')];

        data.forEach(entry => {
            const row = [
                entry.id || '',
                entry.timestamp || '',
                entry.provider || '',
                entry.model || '',
                entry.finishReason || '',
                entry.category || '',
                entry.duration || '',
                entry.tokenCount?.input || '',
                entry.tokenCount?.output || '',
                entry.tokenCount?.total || '',
                (entry.errorDetails || '').replace(/,/g, ';'),
                entry.requestId || ''
            ];
            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    }

    async loadHistoricalData() {
        try {
            const logsDir = path.join(this.config.baseDir, 'logs');
            
            try {
                const files = await fs.readdir(logsDir);
                const jsonFiles = files.filter(f => f.endsWith('.json'));

                for (const file of jsonFiles.slice(-50)) { // Load last 50 files
                    try {
                        const filePath = path.join(logsDir, file);
                        const content = await fs.readFile(filePath, 'utf8');
                        const entries = JSON.parse(content);
                        
                        if (Array.isArray(entries)) {
                            entries.forEach(entry => {
                                const key = this.generateKey(entry);
                                this.data.finishReasons.set(key, entry);
                            });
                        } else {
                            const key = this.generateKey(entries);
                            this.data.finishReasons.set(key, entries);
                        }
                    } catch (fileError) {
                        console.warn(`⚠️ Failed to load log file ${file}:`, fileError.message);
                    }
                }

                console.log(`📊 Loaded ${this.data.finishReasons.size} historical finish reason entries`);
            } catch (dirError) {
                // Logs directory doesn't exist yet, that's ok
                console.log('📁 No historical data found, starting fresh');
            }
        } catch (error) {
            console.error('❌ Failed to load historical data:', error.message);
        }
    }

    async persistLogEntry(entry) {
        try {
            const date = new Date(entry.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
            const fileName = `finish-reasons-${date}.json`;
            const filePath = path.join(this.config.baseDir, 'logs', fileName);

            let existingData = [];
            try {
                const content = await fs.readFile(filePath, 'utf8');
                existingData = JSON.parse(content);
            } catch (error) {
                // File doesn't exist, start with empty array
            }

            existingData.push(entry);
            await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));
        } catch (error) {
            console.error('❌ Failed to persist log entry:', error.message);
        }
    }

    async updateStatistics(entry) {
        try {
            const provider = entry.provider;
            const category = entry.category;
            
            if (!this.data.statistics.has(provider)) {
                this.data.statistics.set(provider, {
                    total: 0,
                    categories: {},
                    lastUpdated: null
                });
            }

            const providerStats = this.data.statistics.get(provider);
            providerStats.total++;
            providerStats.categories[category] = (providerStats.categories[category] || 0) + 1;
            providerStats.lastUpdated = new Date().toISOString();
        } catch (error) {
            console.error('❌ Failed to update statistics:', error.message);
        }
    }

    generateId() {
        return Math.random().toString(36).substr(2, 8);
    }

    generateKey(entry) {
        return `${entry.provider}-${entry.timestamp}-${entry.id}`;
    }

    // CLI Interface
    async runCLI(args = []) {
        const command = args[0];
        
        switch (command) {
            case 'query':
                return await this.handleQueryCommand(args.slice(1));
            case 'report':
                return await this.handleReportCommand(args.slice(1));
            case 'export':
                return await this.handleExportCommand(args.slice(1));
            case 'alerts':
                return await this.handleAlertsCommand(args.slice(1));
            case 'help':
            default:
                return this.showHelp();
        }
    }

    async handleQueryCommand(args) {
        const query = {};
        
        for (let i = 0; i < args.length; i += 2) {
            const key = args[i]?.replace('--', '');
            const value = args[i + 1];
            
            if (key && value) {
                switch (key) {
                    case 'provider':
                        query.provider = value;
                        break;
                    case 'category': 
                        query.category = value;
                        break;
                    case 'limit':
                        query.limit = parseInt(value);
                        break;
                    case 'hours':
                        const hoursAgo = new Date();
                        hoursAgo.setHours(hoursAgo.getHours() - parseInt(value));
                        query.dateRange = { start: hoursAgo, end: new Date() };
                        break;
                }
            }
        }

        const results = await this.queryFinishReasons(query);
        
        console.log(`\n🔍 Finish Reason Query Results`);
        console.log(`Total entries: ${results.total}`);
        console.log(`Showing: ${results.results.length} entries\n`);
        
        results.results.slice(0, 10).forEach(entry => {
            console.log(`${entry.timestamp} | ${entry.provider.padEnd(12)} | ${entry.category.padEnd(10)} | ${entry.finishReason}`);
        });

        if (results.results.length > 10) {
            console.log(`\n... and ${results.results.length - 10} more entries`);
        }

        return results;
    }

    async handleReportCommand(args) {
        const hours = args.includes('--hours') ? 
            parseInt(args[args.indexOf('--hours') + 1]) || 24 : 24;
            
        const report = await this.generateDistributionReport({ timeRange: { hours } });
        
        console.log(`\n📊 Finish Reason Distribution Report (Last ${hours}h)`);
        console.log(`Generated: ${report.metadata.generatedAt}`);
        console.log(`Total Entries: ${report.metadata.totalEntries}\n`);
        
        console.log('📋 By Category:');
        report.distributions.byCategory.forEach(item => {
            console.log(`  ${item.key.padEnd(15)} ${item.count.toString().padStart(4)} (${item.percentage}%)`);
        });
        
        console.log('\n🔌 By Provider:');
        report.distributions.byProvider.forEach(item => {
            console.log(`  ${item.key.padEnd(15)} ${item.count.toString().padStart(4)} (${item.percentage}%)`);
        });

        console.log('\n💡 Insights:');
        report.insights.forEach(insight => {
            console.log(`  • ${insight}`);
        });

        return report;
    }

    async handleExportCommand(args) {
        const format = args.includes('--format') ? 
            args[args.indexOf('--format') + 1] || 'json' : 'json';
        
        const query = {};
        if (args.includes('--provider')) {
            query.provider = args[args.indexOf('--provider') + 1];
        }
        
        const result = await this.exportFinishReasonData(format, query);
        
        console.log(`\n💾 Export Completed`);
        console.log(`Format: ${result.format}`);
        console.log(`File: ${result.filePath}`);
        console.log(`Records: ${result.recordCount}`);
        console.log(`Size: ${(result.fileSize / 1024).toFixed(2)} KB`);

        return result;
    }

    async handleAlertsCommand(args) {
        const recentAlerts = this.data.alerts
            .filter(alert => !alert.resolved)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10);

        console.log(`\n⚠️ Recent Alerts (${recentAlerts.length} active)`);
        
        if (recentAlerts.length === 0) {
            console.log('No active alerts');
            return { alerts: [] };
        }

        recentAlerts.forEach(alert => {
            console.log(`${alert.timestamp} | ${alert.severity.toUpperCase().padEnd(8)} | ${alert.type}`);
            if (alert.data.provider) {
                console.log(`  Provider: ${alert.data.provider}`);
            }
            if (alert.data.errorRate) {
                console.log(`  Error Rate: ${alert.data.errorRate}`);
            }
            console.log('');
        });

        return { alerts: recentAlerts };
    }

    showHelp() {
        console.log(`
🔧 Claude Code Router - Finish Reason Tracker CLI

Usage: finish-reason-tracker.js <command> [options]

Commands:
  query             Query finish reason logs
    --provider      Filter by provider (anthropic, openai, gemini, etc.)
    --category      Filter by category (stop, length, tool_calls, error, etc.)  
    --hours         Show entries from last N hours
    --limit         Limit number of results

  report            Generate distribution report
    --hours         Time range in hours (default: 24)

  export            Export finish reason data
    --format        Export format (json, csv, summary)
    --provider      Filter by provider

  alerts            Show active alerts

  help              Show this help message

Examples:
  finish-reason-tracker.js query --provider anthropic --hours 24
  finish-reason-tracker.js report --hours 12
  finish-reason-tracker.js export --format csv --provider openai
  finish-reason-tracker.js alerts
        `);
        
        return { command: 'help' };
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const tracker = new FinishReasonTracker();
    
    tracker.runCLI(process.argv.slice(2))
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

export default FinishReasonTracker;