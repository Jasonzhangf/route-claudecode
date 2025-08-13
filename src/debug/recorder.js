/**
 * Debug Recorder Module
 * Project owner: Jason Zhang
 */

export { DebugRecorder, LayerDebugWrapper } from '../v3/debug/debug-recorder.js';

// Mock debug recorder for testing
export class MockupDebugRecorder {
  constructor() {
    this.sessionId = 'test-session';
    this.records = [];
  }
  
  recordLayerIO(layer, operation, data, metadata) {
    const record = {
      id: `test-${Date.now()}`,
      layer,
      operation,
      data,
      metadata,
      timestamp: new Date().toISOString()
    };
    this.records.push(record);
    return record.id;
  }
  
  getSessionSummary() {
    return {
      sessionId: this.sessionId,
      recordCount: this.records.length,
      records: this.records
    };
  }
}

// Default export for compatibility
export default MockupDebugRecorder;