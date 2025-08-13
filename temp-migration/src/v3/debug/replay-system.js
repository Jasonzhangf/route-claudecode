/**
 * ⏯️ Replay System - v3.0 Architecture
 * 
 * Comprehensive scenario replay system for recorded debug data
 * Implements Requirements: 2.3, 2.5 from Kiro specifications
 * 
 * Features:
 * - Selective replay of recorded scenarios
 * - Layer-by-layer data replay with timing control
 * - Scenario management and execution
 * - Real-time replay monitoring and control
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

/**
 * Replay System - Core replay engine
 */
export class ReplaySystem extends EventEmitter {
    constructor() {
        super();
        this.replayId = uuidv4();
        this.databasePath = path.join(os.homedir(), '.route-claudecode', 'database');
        this.replayOutputPath = path.join(this.databasePath, 'replay', 'output');
        this.scenarios = new Map();
        this.replayState = 'idle'; // idle, running, paused, stopped
        this.currentScenario = null;
        this.replaySpeed = 1.0; // 1.0 = real-time
        
        this.initializeReplaySystem();
    }
    
    /**
     * Initialize replay system directories and load scenarios
     */
    initializeReplaySystem() {
        const replayDirs = [
            path.join(this.databasePath, 'replay'),
            path.join(this.databasePath, 'replay', 'scenarios'),
            path.join(this.databasePath, 'replay', 'output'),
            path.join(this.databasePath, 'replay', 'control')
        ];
        
        replayDirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
        
        this.loadAvailableScenarios();
    }
    
    /**
     * Load all available scenarios from database
     */
    loadAvailableScenarios() {
        const scenarioDir = path.join(this.databasePath, 'replay');
        
        if (!fs.existsSync(scenarioDir)) {
            return;
        }
        
        const scenarioFiles = fs.readdirSync(scenarioDir)
            .filter(file => file.startsWith('scenario-') && file.endsWith('.json'));
        
        scenarioFiles.forEach(file => {
            try {
                const scenarioData = JSON.parse(
                    fs.readFileSync(path.join(scenarioDir, file), 'utf8')
                );
                this.scenarios.set(scenarioData.scenarioName, scenarioData);
            } catch (error) {
                console.warn(`Failed to load scenario ${file}:`, error.message);
            }
        });
        
        console.log(`Loaded ${this.scenarios.size} scenarios for replay`);
    }
    
    /**
     * Create new scenario from recorded traces
     * @param {string} scenarioName - Name for the scenario
     * @param {object} config - Scenario configuration
     * @returns {string} Scenario ID
     */
    createScenario(scenarioName, config = {}) {
        const scenarioId = uuidv4();
        const timestamp = new Date().toISOString();
        
        const scenario = {
            scenarioId,
            scenarioName,
            createdAt: timestamp,
            config: {
                description: config.description || '',
                layers: config.layers || [],
                timeRange: config.timeRange || null,
                filters: config.filters || {},
                replayMode: config.replayMode || 'sequential', // sequential, parallel
                preserveTiming: config.preserveTiming !== false,
                ...config
            },
            traces: this.collectTracesForScenario(config),
            metadata: {
                totalTraces: 0,
                totalDuration: 0,
                layersInvolved: [],
                version: 'v3.0-refactor'
            }
        };
        
        // Calculate metadata
        scenario.metadata.totalTraces = scenario.traces.length;
        scenario.metadata.layersInvolved = [...new Set(scenario.traces.map(t => t.layer))];
        scenario.metadata.totalDuration = this.calculateScenarioDuration(scenario.traces);
        
        // Save scenario
        const scenarioFile = path.join(this.databasePath, 'replay', `scenario-${scenarioName}-${Date.now()}.json`);
        fs.writeFileSync(scenarioFile, JSON.stringify(scenario, null, 2));
        
        // Add to loaded scenarios
        this.scenarios.set(scenarioName, scenario);
        
        this.emit('scenarioCreated', { scenarioId, scenarioName });
        
        return scenarioId;
    }
    
    /**
     * Start replay of a scenario
     * @param {string} scenarioName - Name of scenario to replay
     * @param {object} options - Replay options
     * @returns {Promise<object>} Replay results
     */
    async startReplay(scenarioName, options = {}) {
        if (this.replayState !== 'idle') {
            throw new Error(`Cannot start replay: current state is ${this.replayState}`);
        }
        
        if (!this.scenarios.has(scenarioName)) {
            throw new Error(`Scenario '${scenarioName}' not found`);
        }
        
        this.currentScenario = this.scenarios.get(scenarioName);
        this.replayState = 'running';
        this.replaySpeed = options.speed || 1.0;
        
        const replaySession = {
            replayId: this.replayId,
            scenarioName,
            startTime: new Date().toISOString(),
            options,
            progress: {
                currentStep: 0,
                totalSteps: this.currentScenario.traces.length,
                completedTraces: 0,
                failedTraces: 0
            }
        };
        
        this.emit('replayStarted', replaySession);
        
        try {
            const results = await this.executeReplay(this.currentScenario, options);
            
            replaySession.endTime = new Date().toISOString();
            replaySession.results = results;
            replaySession.status = 'completed';
            
            this.replayState = 'idle';
            this.currentScenario = null;
            
            // Save replay session results
            const sessionFile = path.join(this.replayOutputPath, `replay-${this.replayId}.json`);
            fs.writeFileSync(sessionFile, JSON.stringify(replaySession, null, 2));
            
            this.emit('replayCompleted', replaySession);
            
            return replaySession;
            
        } catch (error) {
            replaySession.endTime = new Date().toISOString();
            replaySession.error = error.message;
            replaySession.status = 'failed';
            
            this.replayState = 'idle';
            this.currentScenario = null;
            
            this.emit('replayFailed', { replaySession, error });
            
            throw error;
        }
    }
    
    /**
     * Execute replay scenario
     * @param {object} scenario - Scenario to execute
     * @param {object} options - Execution options
     * @returns {Promise<object>} Execution results
     */
    async executeReplay(scenario, options) {
        const results = {
            replayId: this.replayId,
            scenarioName: scenario.scenarioName,
            executionMode: scenario.config.replayMode,
            traces: [],
            layerResults: {},
            summary: {
                totalExecuted: 0,
                successful: 0,
                failed: 0,
                skipped: 0,
                totalDuration: 0
            }
        };
        
        const startTime = Date.now();
        
        if (scenario.config.replayMode === 'sequential') {
            await this.executeSequentialReplay(scenario, results, options);
        } else {
            await this.executeParallelReplay(scenario, results, options);
        }
        
        results.summary.totalDuration = Date.now() - startTime;
        
        return results;
    }
    
    /**
     * Execute replay in sequential mode
     * @param {object} scenario - Scenario to execute
     * @param {object} results - Results object to populate
     * @param {object} options - Execution options
     */
    async executeSequentialReplay(scenario, results, options) {
        for (let i = 0; i < scenario.traces.length; i++) {
            if (this.replayState === 'stopped') {
                break;
            }
            
            while (this.replayState === 'paused') {
                await this.sleep(100);
            }
            
            const trace = scenario.traces[i];
            const traceResult = await this.replayTrace(trace, options);
            
            results.traces.push(traceResult);
            results.summary.totalExecuted++;
            
            if (traceResult.status === 'success') {
                results.summary.successful++;
            } else {
                results.summary.failed++;
            }
            
            // Update layer results
            if (!results.layerResults[trace.layer]) {
                results.layerResults[trace.layer] = {
                    total: 0,
                    successful: 0,
                    failed: 0,
                    traces: []
                };
            }
            
            results.layerResults[trace.layer].total++;
            results.layerResults[trace.layer].traces.push(traceResult);
            
            if (traceResult.status === 'success') {
                results.layerResults[trace.layer].successful++;
            } else {
                results.layerResults[trace.layer].failed++;
            }
            
            // Emit progress
            this.emit('replayProgress', {
                currentStep: i + 1,
                totalSteps: scenario.traces.length,
                currentTrace: traceResult
            });
            
            // Apply timing delays if preserveTiming is enabled
            if (scenario.config.preserveTiming && i < scenario.traces.length - 1) {
                const nextTrace = scenario.traces[i + 1];
                const delay = this.calculateTimingDelay(trace, nextTrace);
                await this.sleep(delay / this.replaySpeed);
            }
        }
    }
    
    /**
     * Execute replay in parallel mode
     * @param {object} scenario - Scenario to execute
     * @param {object} results - Results object to populate
     * @param {object} options - Execution options
     */
    async executeParallelReplay(scenario, results, options) {
        const maxConcurrency = options.maxConcurrency || 5;
        const chunks = this.chunkArray(scenario.traces, maxConcurrency);
        
        for (const chunk of chunks) {
            if (this.replayState === 'stopped') {
                break;
            }
            
            const chunkPromises = chunk.map(trace => this.replayTrace(trace, options));
            const chunkResults = await Promise.allSettled(chunkPromises);
            
            chunkResults.forEach((result, index) => {
                const trace = chunk[index];
                const traceResult = result.status === 'fulfilled' ? result.value : {
                    traceId: trace.traceId,
                    status: 'failed',
                    error: result.reason?.message || 'Unknown error'
                };
                
                results.traces.push(traceResult);
                results.summary.totalExecuted++;
                
                if (traceResult.status === 'success') {
                    results.summary.successful++;
                } else {
                    results.summary.failed++;
                }
            });
        }
    }
    
    /**
     * Replay a single trace
     * @param {object} trace - Trace to replay
     * @param {object} options - Replay options
     * @returns {Promise<object>} Trace replay result
     */
    async replayTrace(trace, options = {}) {
        const startTime = Date.now();
        
        try {
            // Load original trace data
            const originalTrace = await this.loadTraceData(trace.traceId);
            
            // Execute trace replay
            const replayResult = await this.executeTraceReplay(originalTrace, options);
            
            const endTime = Date.now();
            
            return {
                traceId: trace.traceId,
                layer: trace.layer,
                operation: trace.operation,
                status: 'success',
                startTime,
                endTime,
                duration: endTime - startTime,
                originalData: originalTrace?.inputData,
                replayedData: replayResult?.outputData,
                metadata: {
                    version: 'v3.0-refactor',
                    replayMode: options.mode || 'simulation'
                }
            };
            
        } catch (error) {
            return {
                traceId: trace.traceId,
                layer: trace.layer,
                operation: trace.operation,
                status: 'failed',
                error: error.message,
                startTime,
                endTime: Date.now(),
                duration: Date.now() - startTime
            };
        }
    }
    
    /**
     * Execute individual trace replay
     * @param {object} originalTrace - Original trace data
     * @param {object} options - Execution options
     * @returns {Promise<object>} Execution result
     */
    async executeTraceReplay(originalTrace, options) {
        // For now, this is a simulation
        // In real implementation, this would:
        // 1. Set up the layer with original input
        // 2. Execute the layer operation
        // 3. Compare output with original
        // 4. Return comparison results
        
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    outputData: originalTrace?.outputData || { mockReplayData: true },
                    comparisonResult: 'simulated-match',
                    simulationMode: true
                });
            }, Math.random() * 100);
        });
    }
    
    /**
     * Load trace data from storage
     * @param {string} traceId - Trace ID to load
     * @returns {Promise<object>} Trace data
     */
    async loadTraceData(traceId) {
        const traceFile = path.join(this.databasePath, 'audit', 'traces', `trace-${traceId}.json`);
        
        if (fs.existsSync(traceFile)) {
            return JSON.parse(fs.readFileSync(traceFile, 'utf8'));
        }
        
        throw new Error(`Trace data not found for ID: ${traceId}`);
    }
    
    /**
     * Pause current replay
     */
    pauseReplay() {
        if (this.replayState === 'running') {
            this.replayState = 'paused';
            this.emit('replayPaused', { replayId: this.replayId });
        }
    }
    
    /**
     * Resume paused replay
     */
    resumeReplay() {
        if (this.replayState === 'paused') {
            this.replayState = 'running';
            this.emit('replayResumed', { replayId: this.replayId });
        }
    }
    
    /**
     * Stop current replay
     */
    stopReplay() {
        if (this.replayState === 'running' || this.replayState === 'paused') {
            this.replayState = 'stopped';
            this.emit('replayStopped', { replayId: this.replayId });
        }
    }
    
    /**
     * Set replay speed
     * @param {number} speed - Speed multiplier (1.0 = real-time)
     */
    setReplaySpeed(speed) {
        this.replaySpeed = Math.max(0.1, Math.min(10.0, speed));
        this.emit('replaySpeedChanged', { speed: this.replaySpeed });
    }
    
    /**
     * Get list of available scenarios
     * @returns {array} List of scenario summaries
     */
    getAvailableScenarios() {
        return Array.from(this.scenarios.entries()).map(([name, scenario]) => ({
            scenarioName: name,
            scenarioId: scenario.scenarioId,
            createdAt: scenario.createdAt,
            totalTraces: scenario.metadata?.totalTraces || 0,
            layersInvolved: scenario.metadata?.layersInvolved || [],
            totalDuration: scenario.metadata?.totalDuration || 0,
            description: scenario.config?.description || 'No description available'
        }));
    }
    
    /**
     * Get current replay status
     * @returns {object} Current status information
     */
    getReplayStatus() {
        return {
            replayId: this.replayId,
            state: this.replayState,
            currentScenario: this.currentScenario?.scenarioName || null,
            speed: this.replaySpeed,
            availableScenarios: this.scenarios.size
        };
    }
    
    // Helper methods
    
    /**
     * Collect traces for scenario creation
     * @param {object} config - Scenario configuration
     * @returns {array} Collected traces
     */
    collectTracesForScenario(config) {
        // This would read from audit files based on filters
        // For now, return mock traces
        return [
            {
                traceId: uuidv4(),
                layer: 'client',
                operation: 'validate',
                timestamp: new Date().toISOString()
            },
            {
                traceId: uuidv4(),
                layer: 'router',
                operation: 'route',
                timestamp: new Date().toISOString()
            }
        ];
    }
    
    /**
     * Calculate scenario duration from traces
     * @param {array} traces - Array of traces
     * @returns {number} Total duration in ms
     */
    calculateScenarioDuration(traces) {
        if (traces.length === 0) return 0;
        
        const timestamps = traces.map(t => new Date(t.timestamp).getTime());
        return Math.max(...timestamps) - Math.min(...timestamps);
    }
    
    /**
     * Calculate timing delay between traces
     * @param {object} currentTrace - Current trace
     * @param {object} nextTrace - Next trace
     * @returns {number} Delay in milliseconds
     */
    calculateTimingDelay(currentTrace, nextTrace) {
        const current = new Date(currentTrace.timestamp).getTime();
        const next = new Date(nextTrace.timestamp).getTime();
        return Math.max(0, next - current);
    }
    
    /**
     * Split array into chunks
     * @param {array} array - Array to chunk
     * @param {number} size - Chunk size
     * @returns {array} Array of chunks
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    
    /**
     * Sleep for specified duration
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Sleep promise
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default ReplaySystem;