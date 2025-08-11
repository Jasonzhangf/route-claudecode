/**
 * 🔧 Debug System - v3.0 Architecture Master Controller
 * 
 * Comprehensive debug recording system integrating all debug capabilities
 * Implements Requirements: 2.2, 2.3, 2.5 from Kiro specifications
 * 
 * Features:
 * - Unified interface for all debug operations
 * - Automatic layer integration and wrapping
 * - Real-time debug monitoring and control
 * - Complete session management
 * 
 * @author Jason Zhang
 * @version v3.0-refactor
 * @created 2025-08-11
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

import DebugRecorder, { LayerDebugWrapper } from './debug-recorder.js';
import AuditTrailSystem from './audit-trail-system.js';
import ReplaySystem from './replay-system.js';
import PerformanceMetricsCollector, { PerformanceWrapper } from './performance-metrics.js';

/**
 * Comprehensive Debug System - Master controller for all debug operations
 */
export class DebugSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.sessionId = uuidv4();
        this.options = {
            enableRecording: true,
            enableAuditTrail: true,
            enableReplay: true,
            enablePerformanceMetrics: true,
            autoFlush: true,
            flushInterval: 30000, // 30 seconds
            ...options
        };
        
        this.databasePath = path.join(os.homedir(), '.route-claudecode', 'database');
        this.debugComponents = {};
        this.layerWrappers = new Map();
        this.activeOperations = new Map();
        this.debugEnabled = true;
        
        this.initializeDebugSystem();
    }
    
    /**
     * Initialize complete debug system
     */
    initializeDebugSystem() {
        console.log('🔧 Initializing Debug System v3.0...');
        
        // Initialize core debug components
        this.initializeComponents();
        
        // Set up debug session tracking
        this.initializeSessionTracking();
        
        // Start auto-flush if enabled
        if (this.options.autoFlush) {
            this.startAutoFlush();
        }
        
        console.log(`✅ Debug System initialized with session ID: ${this.sessionId}`);
    }
    
    /**
     * Initialize all debug components
     */
    initializeComponents() {
        try {
            // Initialize debug recorder
            if (this.options.enableRecording) {
                this.debugComponents.recorder = new DebugRecorder();
                console.log('✅ Debug Recorder initialized');
            }
            
            // Initialize audit trail system
            if (this.options.enableAuditTrail) {
                this.debugComponents.auditTrail = new AuditTrailSystem();
                console.log('✅ Audit Trail System initialized');
            }
            
            // Initialize replay system
            if (this.options.enableReplay) {
                this.debugComponents.replaySystem = new ReplaySystem();
                this.setupReplayEventHandlers();
                console.log('✅ Replay System initialized');
            }
            
            // Initialize performance metrics
            if (this.options.enablePerformanceMetrics) {
                this.debugComponents.performanceMetrics = new PerformanceMetricsCollector();
                this.debugComponents.performanceWrapper = new PerformanceWrapper(
                    this.debugComponents.performanceMetrics
                );
                console.log('✅ Performance Metrics initialized');
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize debug components:', error);
            throw error;
        }
    }
    
    /**
     * Initialize session tracking
     */
    initializeSessionTracking() {
        const sessionData = {
            sessionId: this.sessionId,
            startTime: new Date().toISOString(),
            options: this.options,
            components: Object.keys(this.debugComponents),
            databasePath: this.databasePath,
            version: 'v3.0-refactor'
        };
        
        const sessionFile = path.join(this.databasePath, `debug-session-${this.sessionId}.json`);
        fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
    }
    
    /**
     * Wrap a layer with comprehensive debug capabilities
     * @param {object} layer - Layer instance to wrap
     * @param {string} layerName - Layer name for identification
     * @returns {object} Debug-wrapped layer
     */
    wrapLayer(layer, layerName) {
        if (this.layerWrappers.has(layerName)) {
            console.warn(`Layer ${layerName} already wrapped, returning existing wrapper`);
            return this.layerWrappers.get(layerName);
        }
        
        console.log(`🔧 Wrapping layer: ${layerName}`);
        
        const wrappedLayer = {
            _originalLayer: layer,
            _layerName: layerName,
            _debugSystem: this
        };
        
        // Wrap all methods of the original layer
        const methodNames = this.getLayerMethods(layer);
        
        methodNames.forEach(methodName => {
            wrappedLayer[methodName] = this.createDebugWrappedMethod(
                layer,
                layerName,
                methodName,
                layer[methodName]
            );
        });
        
        // Add debug-specific methods
        wrappedLayer.getDebugInfo = () => this.getLayerDebugInfo(layerName);
        wrappedLayer.enableDebug = () => this.enableLayerDebug(layerName);
        wrappedLayer.disableDebug = () => this.disableLayerDebug(layerName);
        
        this.layerWrappers.set(layerName, wrappedLayer);
        
        console.log(`✅ Layer ${layerName} wrapped with debug capabilities`);
        
        return wrappedLayer;
    }
    
    /**
     * Create debug-wrapped method
     * @param {object} layer - Original layer
     * @param {string} layerName - Layer name
     * @param {string} methodName - Method name
     * @param {function} originalMethod - Original method
     * @returns {function} Debug-wrapped method
     */
    createDebugWrappedMethod(layer, layerName, methodName, originalMethod) {
        return (...args) => {
            if (!this.debugEnabled) {
                return originalMethod.apply(layer, args);
            }
            
            const operationId = `${layerName}-${methodName}-${Date.now()}`;
            const startTime = Date.now();
            
            // Start comprehensive debug tracking
            const debugContext = this.startOperationDebug(
                operationId,
                layerName,
                methodName,
                args
            );
            
            try {
                // Execute original method - handle both sync and async
                const result = originalMethod.apply(layer, args);
                
                // Check if result is a promise (async method)
                if (result && typeof result.then === 'function') {
                    return result
                        .then(async (asyncResult) => {
                            await this.completeOperationDebug(
                                debugContext,
                                asyncResult,
                                'success'
                            );
                            return asyncResult;
                        })
                        .catch(async (error) => {
                            await this.completeOperationDebug(
                                debugContext,
                                { error: error.message, stack: error.stack },
                                'error'
                            );
                            throw error;
                        });
                } else {
                    // Synchronous method
                    this.completeOperationDebug(
                        debugContext,
                        result,
                        'success'
                    );
                    return result;
                }
                
            } catch (error) {
                // Handle error debug tracking
                this.completeOperationDebug(
                    debugContext,
                    { error: error.message, stack: error.stack },
                    'error'
                );
                
                throw error;
            }
        };
    }
    
    /**
     * Start comprehensive debug tracking for an operation
     * @param {string} operationId - Operation identifier
     * @param {string} layerName - Layer name
     * @param {string} methodName - Method name
     * @param {array} args - Method arguments
     * @returns {object} Debug context
     */
    startOperationDebug(operationId, layerName, methodName, args) {
        const debugContext = {
            operationId,
            layerName,
            methodName,
            startTime: Date.now(),
            components: {}
        };
        
        // Record with debug recorder
        if (this.debugComponents.recorder) {
            debugContext.components.recorderId = this.debugComponents.recorder.recordLayerIO(
                layerName,
                'input',
                args,
                { method: methodName, operationId }
            );
        }
        
        // Start audit trail
        if (this.debugComponents.auditTrail) {
            debugContext.components.traceId = this.debugComponents.auditTrail.startLayerTrace(
                layerName,
                methodName,
                args
            );
        }
        
        // Start performance timing
        if (this.debugComponents.performanceMetrics) {
            debugContext.components.timerId = this.debugComponents.performanceMetrics.startTiming(
                operationId,
                layerName,
                methodName,
                { argumentCount: args.length }
            );
        }
        
        // Store active operation
        this.activeOperations.set(operationId, debugContext);
        
        // Emit debug event
        this.emit('operationStarted', {
            operationId,
            layerName,
            methodName,
            timestamp: new Date().toISOString()
        });
        
        return debugContext;
    }
    
    /**
     * Complete comprehensive debug tracking for an operation
     * @param {object} debugContext - Debug context from start
     * @param {any} result - Operation result
     * @param {string} status - Operation status
     */
    async completeOperationDebug(debugContext, result, status) {
        const { operationId, layerName, methodName } = debugContext;
        
        try {
            // Complete debug recording
            if (this.debugComponents.recorder && debugContext.components.recorderId) {
                this.debugComponents.recorder.recordLayerIO(
                    layerName,
                    'output',
                    result,
                    { 
                        method: methodName,
                        operationId,
                        inputRecordId: debugContext.components.recorderId,
                        status
                    }
                );
            }
            
            // Complete audit trail
            if (this.debugComponents.auditTrail && debugContext.components.traceId) {
                this.debugComponents.auditTrail.completeLayerTrace(
                    debugContext.components.traceId,
                    result,
                    status,
                    { operationId }
                );
            }
            
            // Complete performance timing
            if (this.debugComponents.performanceMetrics && debugContext.components.timerId) {
                this.debugComponents.performanceMetrics.endTiming(
                    debugContext.components.timerId,
                    { status, resultType: typeof result }
                );
            }
            
            // Remove from active operations
            this.activeOperations.delete(operationId);
            
            // Emit completion event
            this.emit('operationCompleted', {
                operationId,
                layerName,
                methodName,
                status,
                duration: Date.now() - debugContext.startTime,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error completing debug tracking:', error);
        }
    }
    
    /**
     * Create replay scenario from current session
     * @param {string} scenarioName - Name for the scenario
     * @param {object} config - Scenario configuration
     * @returns {Promise<string>} Scenario ID
     */
    async createReplayScenario(scenarioName, config = {}) {
        if (!this.debugComponents.replaySystem) {
            throw new Error('Replay system not enabled');
        }
        
        return this.debugComponents.replaySystem.createScenario(scenarioName, config);
    }
    
    /**
     * Start replay of a scenario
     * @param {string} scenarioName - Scenario name to replay
     * @param {object} options - Replay options
     * @returns {Promise<object>} Replay results
     */
    async startReplay(scenarioName, options = {}) {
        if (!this.debugComponents.replaySystem) {
            throw new Error('Replay system not enabled');
        }
        
        return this.debugComponents.replaySystem.startReplay(scenarioName, options);
    }
    
    /**
     * Get comprehensive debug system status
     * @returns {object} Debug system status
     */
    getDebugStatus() {
        return {
            sessionId: this.sessionId,
            debugEnabled: this.debugEnabled,
            components: Object.keys(this.debugComponents),
            activeOperations: this.activeOperations.size,
            wrappedLayers: Array.from(this.layerWrappers.keys()),
            uptime: Date.now() - (this.sessionStartTime || Date.now()),
            options: this.options,
            replayStatus: this.debugComponents.replaySystem?.getReplayStatus() || null,
            performanceMetrics: this.debugComponents.performanceMetrics?.getCurrentMetrics() || null
        };
    }
    
    /**
     * Generate comprehensive debug report
     * @returns {object} Complete debug report
     */
    generateDebugReport() {
        const report = {
            sessionId: this.sessionId,
            generatedAt: new Date().toISOString(),
            summary: this.getDebugStatus(),
            recordingSummary: this.debugComponents.recorder?.getSessionSummary() || null,
            auditSummary: this.debugComponents.auditTrail?.getAuditSummary() || null,
            performanceAnalysis: this.debugComponents.performanceMetrics?.generateAnalysisReport() || null,
            availableScenarios: this.debugComponents.replaySystem?.getAvailableScenarios() || []
        };
        
        // Save report
        const reportFile = path.join(this.databasePath, `debug-report-${this.sessionId}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        return report;
    }
    
    /**
     * Enable debug for the system
     */
    enableDebug() {
        this.debugEnabled = true;
        this.emit('debugEnabled');
        console.log('🔧 Debug system enabled');
    }
    
    /**
     * Disable debug for the system
     */
    disableDebug() {
        this.debugEnabled = false;
        this.emit('debugDisabled');
        console.log('🔧 Debug system disabled');
    }
    
    /**
     * Finalize debug session and cleanup
     * @returns {object} Final debug report
     */
    finalize() {
        console.log('🔧 Finalizing debug session...');
        
        // Generate final report
        const finalReport = this.generateDebugReport();
        
        // Finalize all components
        if (this.debugComponents.performanceMetrics) {
            this.debugComponents.performanceMetrics.finalize();
        }
        
        // Stop auto-flush
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        
        // Emit finalization event
        this.emit('debugFinalized', finalReport);
        
        console.log('✅ Debug session finalized');
        
        return finalReport;
    }
    
    // Helper methods
    
    /**
     * Get all methods from a layer object
     * @param {object} layer - Layer object
     * @returns {array} Method names
     */
    getLayerMethods(layer) {
        const methods = [];
        let obj = layer;
        
        while (obj && obj !== Object.prototype) {
            Object.getOwnPropertyNames(obj).forEach(name => {
                if (typeof layer[name] === 'function' && name !== 'constructor') {
                    if (!methods.includes(name)) {
                        methods.push(name);
                    }
                }
            });
            obj = Object.getPrototypeOf(obj);
        }
        
        return methods;
    }
    
    /**
     * Setup replay event handlers
     */
    setupReplayEventHandlers() {
        const replaySystem = this.debugComponents.replaySystem;
        
        replaySystem.on('replayStarted', (session) => {
            this.emit('replayStarted', session);
        });
        
        replaySystem.on('replayCompleted', (session) => {
            this.emit('replayCompleted', session);
        });
        
        replaySystem.on('replayFailed', (data) => {
            this.emit('replayFailed', data);
        });
        
        replaySystem.on('replayProgress', (progress) => {
            this.emit('replayProgress', progress);
        });
    }
    
    /**
     * Start auto-flush mechanism
     */
    startAutoFlush() {
        this.flushInterval = setInterval(() => {
            this.flushDebugData();
        }, this.options.flushInterval);
    }
    
    /**
     * Flush debug data to disk
     */
    flushDebugData() {
        try {
            // Flush performance metrics buffer
            if (this.debugComponents.performanceMetrics) {
                this.debugComponents.performanceMetrics.flushMetricsBuffer();
            }
            
            // Update session tracking
            this.updateSessionTracking();
            
        } catch (error) {
            console.error('Error flushing debug data:', error);
        }
    }
    
    /**
     * Update session tracking file
     */
    updateSessionTracking() {
        const sessionFile = path.join(this.databasePath, `debug-session-${this.sessionId}.json`);
        
        if (fs.existsSync(sessionFile)) {
            const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            sessionData.lastUpdate = new Date().toISOString();
            sessionData.activeOperations = this.activeOperations.size;
            sessionData.wrappedLayers = Array.from(this.layerWrappers.keys());
            
            fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
        }
    }
    
    /**
     * Get debug info for a specific layer
     * @param {string} layerName - Layer name
     * @returns {object} Layer debug information
     */
    getLayerDebugInfo(layerName) {
        return {
            layerName,
            isWrapped: this.layerWrappers.has(layerName),
            debugEnabled: this.debugEnabled,
            activeOperations: Array.from(this.activeOperations.values())
                .filter(op => op.layerName === layerName)
                .map(op => ({
                    operationId: op.operationId,
                    methodName: op.methodName,
                    startTime: op.startTime,
                    duration: Date.now() - op.startTime
                }))
        };
    }
    
    /**
     * Enable debug for specific layer
     * @param {string} layerName - Layer name
     */
    enableLayerDebug(layerName) {
        console.log(`🔧 Debug enabled for layer: ${layerName}`);
        this.emit('layerDebugEnabled', { layerName });
    }
    
    /**
     * Disable debug for specific layer
     * @param {string} layerName - Layer name
     */
    disableLayerDebug(layerName) {
        console.log(`🔧 Debug disabled for layer: ${layerName}`);
        this.emit('layerDebugDisabled', { layerName });
    }
}

export default DebugSystem;