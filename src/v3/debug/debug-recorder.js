/**
 * 📊 Debug Recording System - v3.0 Architecture
 * 
 * Comprehensive I/O recording system for all architectural layers
 * Implements Requirements: 2.2, 2.3, 2.5 from Kiro specifications
 * 
 * Features:
 * - Complete I/O recording to ~/.route-claudecode/database
 * - Audit trail system for layer-to-layer traceability
 * - Performance metrics collection
 * - Replay capability for recorded scenarios
 * 
 * @author Jason Zhang
 * @version v3.0-refactor
 * @created 2025-08-11
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

/**
 * Debug Recorder Interface - Core recording contract
 * Implements DebugRecorder interface from design.md
 */
export class DebugRecorder {
    constructor() {
        this.sessionId = uuidv4();
        this.startTime = new Date().toISOString();
        this.databasePath = path.join(os.homedir(), '.route-claudecode', 'database');
        this.auditTrail = [];
        
        // Ensure database directory exists
        this.initializeDatabase();
    }
    
    /**
     * Initialize database directory structure
     */
    initializeDatabase() {
        const directories = [
            this.databasePath,
            path.join(this.databasePath, 'sessions'),
            path.join(this.databasePath, 'layers'),
            path.join(this.databasePath, 'audit'),
            path.join(this.databasePath, 'performance'),
            path.join(this.databasePath, 'replay')
        ];
        
        directories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
    
    /**
     * Record layer input/output data
     * @param {string} layer - Layer name (client, router, post-processor, etc.)
     * @param {string} operation - Operation type (input, output, error)
     * @param {any} data - Data to record
     * @param {object} metadata - Additional metadata
     */
    recordLayerIO(layer, operation, data, metadata = {}) {
        const timestamp = new Date().toISOString();
        const recordId = uuidv4();
        
        const record = {
            recordId,
            sessionId: this.sessionId,
            timestamp,
            layer,
            operation,
            data: this.sanitizeData(data),
            metadata: {
                ...metadata,
                processingTime: metadata.processingTime || 0,
                dataSize: JSON.stringify(data).length,
                version: 'v3.0-refactor'
            }
        };
        
        // Save to layer-specific file
        const layerFile = path.join(this.databasePath, 'layers', `${layer}-${operation}-${Date.now()}.json`);
        fs.writeFileSync(layerFile, JSON.stringify(record, null, 2));
        
        // Add to audit trail
        this.auditTrail.push({
            recordId,
            layer,
            operation,
            timestamp,
            filePath: layerFile
        });
        
        return recordId;
    }
    
    /**
     * Record audit trail entry for cross-layer traceability
     * @param {string} fromLayer - Source layer
     * @param {string} toLayer - Destination layer
     * @param {string} dataId - Data identifier
     * @param {any} transformedData - Data after transformation
     */
    recordAuditTrail(fromLayer, toLayer, dataId, transformedData) {
        const timestamp = new Date().toISOString();
        const auditId = uuidv4();
        
        const auditRecord = {
            auditId,
            sessionId: this.sessionId,
            timestamp,
            fromLayer,
            toLayer,
            dataId,
            transformedData: this.sanitizeData(transformedData),
            traceabilityChain: this.buildTraceabilityChain(dataId)
        };
        
        const auditFile = path.join(this.databasePath, 'audit', `trail-${Date.now()}.json`);
        fs.writeFileSync(auditFile, JSON.stringify(auditRecord, null, 2));
        
        return auditId;
    }
    
    /**
     * Record performance metrics
     * @param {string} layer - Layer name
     * @param {string} operation - Operation name
     * @param {number} startTime - Start timestamp
     * @param {number} endTime - End timestamp
     * @param {object} metrics - Additional metrics
     */
    recordPerformanceMetrics(layer, operation, startTime, endTime, metrics = {}) {
        const timestamp = new Date().toISOString();
        const duration = endTime - startTime;
        
        const performanceRecord = {
            sessionId: this.sessionId,
            timestamp,
            layer,
            operation,
            duration,
            startTime,
            endTime,
            metrics: {
                ...metrics,
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage()
            }
        };
        
        const perfFile = path.join(this.databasePath, 'performance', `${layer}-${operation}-${Date.now()}.json`);
        fs.writeFileSync(perfFile, JSON.stringify(performanceRecord, null, 2));
        
        return performanceRecord;
    }
    
    /**
     * Create replay scenario from recorded data
     * @param {string} scenarioName - Name for the replay scenario
     * @param {array} recordIds - Array of record IDs to include
     */
    createReplayScenario(scenarioName, recordIds) {
        const timestamp = new Date().toISOString();
        
        const scenario = {
            scenarioName,
            sessionId: this.sessionId,
            createdAt: timestamp,
            records: recordIds.map(recordId => {
                // Find corresponding audit trail entry
                const auditEntry = this.auditTrail.find(entry => entry.recordId === recordId);
                return {
                    recordId,
                    layer: auditEntry?.layer,
                    operation: auditEntry?.operation,
                    filePath: auditEntry?.filePath
                };
            }),
            metadata: {
                totalRecords: recordIds.length,
                version: 'v3.0-refactor'
            }
        };
        
        const scenarioFile = path.join(this.databasePath, 'replay', `scenario-${scenarioName}-${Date.now()}.json`);
        fs.writeFileSync(scenarioFile, JSON.stringify(scenario, null, 2));
        
        return scenarioFile;
    }
    
    /**
     * Get session summary with all recorded data
     */
    getSessionSummary() {
        return {
            sessionId: this.sessionId,
            startTime: this.startTime,
            endTime: new Date().toISOString(),
            auditTrail: this.auditTrail,
            recordCount: this.auditTrail.length,
            databasePath: this.databasePath
        };
    }
    
    /**
     * Sanitize data for safe storage (remove sensitive information)
     * @param {any} data - Data to sanitize
     * @returns {any} Sanitized data
     */
    sanitizeData(data) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }
        
        const sanitized = Array.isArray(data) ? [] : {};
        
        for (const [key, value] of Object.entries(data)) {
            // Remove sensitive fields
            if (this.isSensitiveField(key)) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeData(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
    
    /**
     * Check if field contains sensitive information
     * @param {string} fieldName - Field name to check
     * @returns {boolean} True if field is sensitive
     */
    isSensitiveField(fieldName) {
        const sensitivePatterns = [
            /password/i,
            /secret/i,
            /token/i,
            /^api[_-]?key$/i,         // Only exact API key field names
            /^access[_-]?key$/i,      // Only exact access key field names
            /^private[_-]?key$/i,     // Only exact private key field names
            /^session[_-]?key$/i,     // Only exact session key field names
            /^auth[_-]?key$/i,        // Only exact auth key field names
            /auth/i,
            /credential/i,
            /^bearer$/i               // Bearer token field
        ];
        
        return sensitivePatterns.some(pattern => pattern.test(fieldName));
    }
    
    /**
     * Build traceability chain for data flow tracking
     * @param {string} dataId - Data identifier
     * @returns {array} Chain of transformations
     */
    buildTraceabilityChain(dataId) {
        return this.auditTrail
            .filter(entry => entry.recordId === dataId)
            .map(entry => ({
                layer: entry.layer,
                operation: entry.operation,
                timestamp: entry.timestamp
            }));
    }
}

/**
 * Layer Debug Wrapper - Automatic I/O recording for any layer
 */
export class LayerDebugWrapper {
    constructor(layer, debugRecorder) {
        this.layer = layer;
        this.debugRecorder = debugRecorder;
        this.layerName = layer.constructor.name.toLowerCase();
    }
    
    /**
     * Wrap layer method with debug recording
     * @param {string} methodName - Method to wrap
     * @param {function} originalMethod - Original method implementation
     * @returns {function} Wrapped method
     */
    wrapMethod(methodName, originalMethod) {
        return async (...args) => {
            const startTime = Date.now();
            
            // Record input
            const inputRecordId = this.debugRecorder.recordLayerIO(
                this.layerName,
                'input',
                args,
                { method: methodName, startTime }
            );
            
            try {
                // Execute original method
                const result = await originalMethod.apply(this.layer, args);
                const endTime = Date.now();
                
                // Record output
                const outputRecordId = this.debugRecorder.recordLayerIO(
                    this.layerName,
                    'output',
                    result,
                    { method: methodName, inputRecordId, endTime }
                );
                
                // Record performance metrics
                this.debugRecorder.recordPerformanceMetrics(
                    this.layerName,
                    methodName,
                    startTime,
                    endTime
                );
                
                return result;
                
            } catch (error) {
                const endTime = Date.now();
                
                // Record error
                this.debugRecorder.recordLayerIO(
                    this.layerName,
                    'error',
                    { error: error.message, stack: error.stack },
                    { method: methodName, inputRecordId, endTime }
                );
                
                throw error;
            }
        };
    }
}

export default DebugRecorder;