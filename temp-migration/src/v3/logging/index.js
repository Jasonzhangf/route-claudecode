/**
 * V3.0 Logging System
 * Simplified logging for V3 architecture
 */
export function getLogger(port) {
    return {
        info: (...args) => console.log(`[V3:${port}]`, ...args),
        debug: (...args) => console.log(`[V3:${port}] DEBUG:`, ...args),
        warn: (...args) => console.warn(`[V3:${port}] WARN:`, ...args),
        error: (...args) => console.error(`[V3:${port}] ERROR:`, ...args),
        logPipeline: (stage, message, data, requestId) => {
            console.log(`[V3:${port}] 🔄 [${requestId}] ${stage}: ${message}`, data || '');
        },
        logStreaming: (message, data, requestId, type) => {
            console.log(`[V3:${port}] 📡 [${requestId}] ${type}: ${message}`, data || '');
        },
        logFinishReason: (reason, data, requestId, type) => {
            console.log(`[V3:${port}] 🏁 [${requestId}] ${type}: ${reason}`, data || '');
        }
    };
}
export function setDefaultPort(port) {
    console.log(`🔧 V3 Default port set: ${port}`);
}
export function createRequestTracker(port) {
    return {
        track: (id, data) => console.log(`[V3:${port}] 📊 Request:`, id, data)
    };
}
export function createErrorTracker(port) {
    return {
        track: (error, meta) => console.error(`[V3:${port}] ❌ Error:`, error.message, meta)
    };
}
