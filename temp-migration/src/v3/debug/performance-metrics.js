/**
 * 📈 Performance Metrics System - v3.0 Architecture
 * 
 * Comprehensive performance monitoring and metrics collection
 * Implements Requirements: 2.5 from Kiro specifications
 * 
 * Features:
 * - Real-time performance metrics collection
 * - Layer-specific timing and performance data
 * - Resource usage monitoring
 * - Historical performance analysis
 * 
 * @author Jason Zhang
 * @version v3.0-refactor
 * @created 2025-08-11
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { performance, PerformanceObserver } from 'perf_hooks';

/**
 * Performance Metrics Collector - Core metrics system
 */
export class PerformanceMetricsCollector {
    constructor() {
        this.sessionId = uuidv4();
        this.databasePath = path.join(os.homedir(), '.route-claudecode', 'database', 'performance');
        this.metricsBuffer = [];
        this.performanceObserver = null;
        this.activeTimers = new Map();
        this.layerMetrics = new Map();
        this.systemMetrics = {
            startTime: Date.now(),
            totalOperations: 0,
            totalDuration: 0
        };
        
        this.initializeMetricsSystem();
    }
    
    /**
     * Initialize performance metrics system
     */
    initializeMetricsSystem() {
        const metricsDirs = [
            this.databasePath,
            path.join(this.databasePath, 'layers'),
            path.join(this.databasePath, 'system'),
            path.join(this.databasePath, 'historical'),
            path.join(this.databasePath, 'analysis')
        ];
        
        metricsDirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
        
        // Set up performance observer
        this.setupPerformanceObserver();
        
        // Start system metrics collection
        this.startSystemMetricsCollection();
    }
    
    /**
     * Set up performance observer for Node.js performance tracking
     */
    setupPerformanceObserver() {
        this.performanceObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach(entry => {
                this.recordPerformanceEntry(entry);
            });
        });
        
        this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] });
    }
    
    /**
     * Start system-level metrics collection
     */
    startSystemMetricsCollection() {
        // Collect system metrics every 5 seconds
        setInterval(() => {
            this.collectSystemMetrics();
        }, 5000);
    }
    
    /**
     * Start timing measurement for an operation
     * @param {string} operationId - Unique operation identifier
     * @param {string} layer - Layer name
     * @param {string} operation - Operation name
     * @param {object} metadata - Additional metadata
     * @returns {string} Timer ID
     */
    startTiming(operationId, layer, operation, metadata = {}) {
        const timerId = `${layer}-${operation}-${Date.now()}`;
        const startTime = performance.now();
        const hrStartTime = process.hrtime();
        
        const timer = {
            timerId,
            operationId,
            layer,
            operation,
            startTime,
            hrStartTime,
            startTimestamp: new Date().toISOString(),
            metadata: {
                ...metadata,
                pid: process.pid,
                sessionId: this.sessionId
            }
        };
        
        this.activeTimers.set(timerId, timer);
        
        // Mark start in performance timeline
        performance.mark(`start-${timerId}`);
        
        return timerId;
    }
    
    /**
     * End timing measurement for an operation
     * @param {string} timerId - Timer ID from startTiming
     * @param {object} resultMetadata - Additional result metadata
     * @returns {object} Performance metrics
     */
    endTiming(timerId, resultMetadata = {}) {
        if (!this.activeTimers.has(timerId)) {
            throw new Error(`Timer ${timerId} not found`);
        }
        
        const timer = this.activeTimers.get(timerId);
        const endTime = performance.now();
        const hrEndTime = process.hrtime(timer.hrStartTime);
        
        // Mark end in performance timeline
        performance.mark(`end-${timerId}`);
        performance.measure(`duration-${timerId}`, `start-${timerId}`, `end-${timerId}`);
        
        const metrics = {
            timerId,
            operationId: timer.operationId,
            layer: timer.layer,
            operation: timer.operation,
            startTime: timer.startTime,
            endTime,
            duration: endTime - timer.startTime,
            hrDuration: hrEndTime[0] * 1000 + hrEndTime[1] / 1e6, // High-resolution duration in ms
            startTimestamp: timer.startTimestamp,
            endTimestamp: new Date().toISOString(),
            metadata: {
                ...timer.metadata,
                ...resultMetadata
            },
            systemMetrics: this.captureSystemSnapshot()
        };
        
        // Remove from active timers
        this.activeTimers.delete(timerId);
        
        // Record metrics
        this.recordOperationMetrics(metrics);
        
        // Update system metrics
        this.systemMetrics.totalOperations++;
        this.systemMetrics.totalDuration += metrics.duration;
        
        return metrics;
    }
    
    /**
     * Record performance metrics for an operation
     * @param {object} metrics - Operation performance metrics
     */
    recordOperationMetrics(metrics) {
        // Add to buffer
        this.metricsBuffer.push(metrics);
        
        // Update layer metrics
        this.updateLayerMetrics(metrics);
        
        // Save individual metric record
        const metricsFile = path.join(
            this.databasePath,
            'layers',
            `${metrics.layer}-${Date.now()}.json`
        );
        
        fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
        
        // Flush buffer if too large
        if (this.metricsBuffer.length > 1000) {
            this.flushMetricsBuffer();
        }
    }
    
    /**
     * Update aggregated layer metrics
     * @param {object} metrics - Operation metrics
     */
    updateLayerMetrics(metrics) {
        const layerKey = metrics.layer;
        
        if (!this.layerMetrics.has(layerKey)) {
            this.layerMetrics.set(layerKey, {
                layer: layerKey,
                totalOperations: 0,
                totalDuration: 0,
                averageDuration: 0,
                minDuration: Infinity,
                maxDuration: 0,
                operations: {},
                lastUpdated: new Date().toISOString()
            });
        }
        
        const layerStats = this.layerMetrics.get(layerKey);
        
        // Update overall layer stats
        layerStats.totalOperations++;
        layerStats.totalDuration += metrics.duration;
        layerStats.averageDuration = layerStats.totalDuration / layerStats.totalOperations;
        layerStats.minDuration = Math.min(layerStats.minDuration, metrics.duration);
        layerStats.maxDuration = Math.max(layerStats.maxDuration, metrics.duration);
        layerStats.lastUpdated = new Date().toISOString();
        
        // Update operation-specific stats
        const opKey = metrics.operation;
        if (!layerStats.operations[opKey]) {
            layerStats.operations[opKey] = {
                operation: opKey,
                count: 0,
                totalDuration: 0,
                averageDuration: 0,
                minDuration: Infinity,
                maxDuration: 0
            };
        }
        
        const opStats = layerStats.operations[opKey];
        opStats.count++;
        opStats.totalDuration += metrics.duration;
        opStats.averageDuration = opStats.totalDuration / opStats.count;
        opStats.minDuration = Math.min(opStats.minDuration, metrics.duration);
        opStats.maxDuration = Math.max(opStats.maxDuration, metrics.duration);
        
        // Save updated layer metrics
        const layerFile = path.join(this.databasePath, 'layers', `${layerKey}-summary.json`);
        fs.writeFileSync(layerFile, JSON.stringify(layerStats, null, 2));
    }
    
    /**
     * Capture current system resource snapshot
     * @returns {object} System metrics snapshot
     */
    captureSystemSnapshot() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            timestamp: new Date().toISOString(),
            memory: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                arrayBuffers: memUsage.arrayBuffers
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            system: {
                uptime: process.uptime(),
                loadavg: os.loadavg(),
                freemem: os.freemem(),
                totalmem: os.totalmem()
            },
            node: {
                version: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
    }
    
    /**
     * Collect system-level performance metrics
     */
    collectSystemMetrics() {
        const systemSnapshot = this.captureSystemSnapshot();
        
        const systemMetrics = {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            ...systemSnapshot,
            activeTimers: this.activeTimers.size,
            totalOperations: this.systemMetrics.totalOperations,
            totalDuration: this.systemMetrics.totalDuration,
            averageDuration: this.systemMetrics.totalOperations > 0 
                ? this.systemMetrics.totalDuration / this.systemMetrics.totalOperations 
                : 0
        };
        
        // Save system metrics
        const systemFile = path.join(
            this.databasePath,
            'system',
            `system-${Date.now()}.json`
        );
        
        fs.writeFileSync(systemFile, JSON.stringify(systemMetrics, null, 2));
    }
    
    /**
     * Record performance entry from Node.js performance observer
     * @param {PerformanceEntry} entry - Performance entry
     */
    recordPerformanceEntry(entry) {
        const entryRecord = {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            entryType: entry.entryType,
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
            detail: entry.detail || null
        };
        
        // Save performance entry
        const entryFile = path.join(
            this.databasePath,
            'system',
            `perf-entry-${Date.now()}.json`
        );
        
        fs.writeFileSync(entryFile, JSON.stringify(entryRecord, null, 2));
    }
    
    /**
     * Flush metrics buffer to disk
     */
    flushMetricsBuffer() {
        if (this.metricsBuffer.length === 0) {
            return;
        }
        
        const bufferFile = path.join(
            this.databasePath,
            `metrics-buffer-${Date.now()}.json`
        );
        
        fs.writeFileSync(bufferFile, JSON.stringify({
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            bufferSize: this.metricsBuffer.length,
            metrics: this.metricsBuffer
        }, null, 2));
        
        // Clear buffer
        this.metricsBuffer = [];
    }
    
    /**
     * Generate performance analysis report
     * @param {object} options - Analysis options
     * @returns {object} Performance analysis report
     */
    generateAnalysisReport(options = {}) {
        const report = {
            sessionId: this.sessionId,
            generatedAt: new Date().toISOString(),
            timeRange: {
                start: new Date(this.systemMetrics.startTime).toISOString(),
                end: new Date().toISOString(),
                duration: Date.now() - this.systemMetrics.startTime
            },
            summary: {
                totalOperations: this.systemMetrics.totalOperations,
                totalDuration: this.systemMetrics.totalDuration,
                averageDuration: this.systemMetrics.totalOperations > 0 
                    ? this.systemMetrics.totalDuration / this.systemMetrics.totalOperations 
                    : 0,
                activeTimers: this.activeTimers.size
            },
            layerAnalysis: this.generateLayerAnalysis(),
            performanceBottlenecks: this.identifyBottlenecks(),
            recommendations: this.generateRecommendations()
        };
        
        // Save analysis report
        const reportFile = path.join(
            this.databasePath,
            'analysis',
            `analysis-report-${Date.now()}.json`
        );
        
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        return report;
    }
    
    /**
     * Generate layer-specific analysis
     * @returns {object} Layer analysis data
     */
    generateLayerAnalysis() {
        const analysis = {};
        
        for (const [layer, metrics] of this.layerMetrics) {
            analysis[layer] = {
                ...metrics,
                efficiency: this.calculateLayerEfficiency(metrics),
                bottleneckRisk: this.assessBottleneckRisk(metrics),
                operationBreakdown: Object.values(metrics.operations)
                    .sort((a, b) => b.averageDuration - a.averageDuration)
            };
        }
        
        return analysis;
    }
    
    /**
     * Identify performance bottlenecks
     * @returns {array} List of identified bottlenecks
     */
    identifyBottlenecks() {
        const bottlenecks = [];
        
        for (const [layer, metrics] of this.layerMetrics) {
            // Check for slow operations
            if (metrics.maxDuration > 1000) { // > 1 second
                bottlenecks.push({
                    type: 'slow_operation',
                    layer,
                    severity: 'high',
                    description: `Layer ${layer} has operations exceeding 1 second`,
                    maxDuration: metrics.maxDuration,
                    recommendation: 'Optimize slow operations or implement caching'
                });
            }
            
            // Check for high variance
            const variance = metrics.maxDuration - metrics.minDuration;
            if (variance > metrics.averageDuration * 2) {
                bottlenecks.push({
                    type: 'high_variance',
                    layer,
                    severity: 'medium',
                    description: `Layer ${layer} has high performance variance`,
                    variance,
                    recommendation: 'Investigate inconsistent performance causes'
                });
            }
        }
        
        return bottlenecks;
    }
    
    /**
     * Generate performance recommendations
     * @returns {array} List of recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        
        // System-level recommendations
        if (this.systemMetrics.averageDuration > 100) {
            recommendations.push({
                category: 'system',
                priority: 'high',
                title: 'High average operation duration detected',
                description: 'Consider optimizing critical paths or implementing async processing',
                impact: 'performance'
            });
        }
        
        // Layer-specific recommendations
        for (const [layer, metrics] of this.layerMetrics) {
            if (metrics.totalOperations > 1000 && metrics.averageDuration > 50) {
                recommendations.push({
                    category: 'layer',
                    priority: 'medium',
                    title: `Optimize ${layer} layer performance`,
                    description: `Layer ${layer} has high operation count with significant duration`,
                    impact: 'throughput',
                    layer
                });
            }
        }
        
        return recommendations;
    }
    
    /**
     * Get current performance metrics summary
     * @returns {object} Current metrics summary
     */
    getCurrentMetrics() {
        return {
            sessionId: this.sessionId,
            systemMetrics: {
                ...this.systemMetrics,
                currentSnapshot: this.captureSystemSnapshot()
            },
            layerMetrics: Object.fromEntries(this.layerMetrics),
            activeTimers: this.activeTimers.size,
            bufferSize: this.metricsBuffer.length
        };
    }
    
    // Helper methods
    
    /**
     * Calculate layer efficiency score
     * @param {object} metrics - Layer metrics
     * @returns {number} Efficiency score (0-100)
     */
    calculateLayerEfficiency(metrics) {
        if (metrics.totalOperations === 0) return 0;
        
        // Simple efficiency calculation based on consistency and speed
        const consistency = 1 - (metrics.maxDuration - metrics.minDuration) / metrics.averageDuration;
        const speed = Math.max(0, 1 - metrics.averageDuration / 1000); // Normalize to 1 second baseline
        
        return Math.round((consistency * 0.4 + speed * 0.6) * 100);
    }
    
    /**
     * Assess bottleneck risk for a layer
     * @param {object} metrics - Layer metrics
     * @returns {string} Risk level (low, medium, high)
     */
    assessBottleneckRisk(metrics) {
        if (metrics.maxDuration > 5000) return 'high';
        if (metrics.maxDuration > 1000 || metrics.averageDuration > 500) return 'medium';
        return 'low';
    }
    
    /**
     * Cleanup and finalize metrics collection
     */
    finalize() {
        // Flush any remaining metrics
        this.flushMetricsBuffer();
        
        // Generate final analysis report
        const finalReport = this.generateAnalysisReport();
        
        // Cleanup performance observer
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
        }
        
        return finalReport;
    }
}

/**
 * Performance Metrics Wrapper - Automatic timing wrapper
 */
export class PerformanceWrapper {
    constructor(metricsCollector) {
        this.metricsCollector = metricsCollector;
    }
    
    /**
     * Wrap a function with automatic performance timing
     * @param {string} layer - Layer name
     * @param {string} operation - Operation name
     * @param {function} fn - Function to wrap
     * @returns {function} Wrapped function
     */
    wrapFunction(layer, operation, fn) {
        return async (...args) => {
            const operationId = `${layer}-${operation}-${Date.now()}`;
            const timerId = this.metricsCollector.startTiming(operationId, layer, operation, {
                argumentCount: args.length
            });
            
            try {
                const result = await fn(...args);
                
                this.metricsCollector.endTiming(timerId, {
                    status: 'success',
                    resultType: typeof result
                });
                
                return result;
            } catch (error) {
                this.metricsCollector.endTiming(timerId, {
                    status: 'error',
                    error: error.message
                });
                
                throw error;
            }
        };
    }
}

export default PerformanceMetricsCollector;