/**
 * V3.0 Debug System
 * Project owner: Jason Zhang
 */

import { v4 as uuidv4 } from 'uuid';
import { DebugRecorder } from './debug-recorder.js';

export class DebugSystem {
  public debugComponents?: any;
  private sessionId: string;
  private config: any;
  private activeOperations: Set<string>;
  private wrappedLayers: Set<string>;

  constructor(config: any) {
    console.log('🔧 V3 DebugSystem initialized', config);
    
    this.sessionId = uuidv4();
    this.config = config;
    this.activeOperations = new Set();
    this.wrappedLayers = new Set();
    
    // Initialize real debug recorder (not mock)
    try {
      const recorder = new DebugRecorder();
      this.debugComponents = {
        recorder: {
          recordLayerIO: (layer: string, type: string, data: any, metadata: any) => {
            try {
              // Record to real files and also console log
              recorder.recordLayerIO(layer, type, data, metadata);
              console.log(`🐛 [${metadata?.requestId}] ${layer}:${type}`, data);
            } catch (error) {
              console.error('Failed to record layer I/O:', error);
              // Fallback to console only if file recording fails
              console.log(`🐛 [${metadata?.requestId}] ${layer}:${type}`, data);
            }
          }
        }
      };
    } catch (error) {
      console.error('Failed to initialize DebugRecorder, falling back to mock:', error);
      // Fallback to mock if real recorder fails
      this.debugComponents = {
        recorder: {
          recordLayerIO: (layer: string, type: string, data: any, metadata: any) => {
            console.log(`🐛 [${metadata?.requestId}] ${layer}:${type}`, data);
          }
        }
      };
    }
  }

  /**
   * Get current debug system status
   */
  getDebugStatus() {
    return {
      sessionId: this.sessionId,
      components: Object.keys(this.debugComponents),
      activeOperations: Array.from(this.activeOperations),
      wrappedLayers: Array.from(this.wrappedLayers),
      debugEnabled: true,
      config: this.config
    };
  }

  /**
   * Add active operation
   */
  addActiveOperation(operationId: string) {
    this.activeOperations.add(operationId);
  }

  /**
   * Remove active operation
   */
  removeActiveOperation(operationId: string) {
    this.activeOperations.delete(operationId);
  }

  /**
   * Add wrapped layer
   */
  addWrappedLayer(layerName: string) {
    this.wrappedLayers.add(layerName);
  }
}