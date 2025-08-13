/**
 * Service Management Module
 * Project owner: Jason Zhang
 */

export { ServiceController } from '../v3/service-management/service-controller.js';
export { ConfigIsolation } from '../v3/service-management/config-isolation.js';

// Mock service manager for testing
export class MockupServiceManager {
  constructor() {
    this.initialized = true;
  }
  
  start() {
    return Promise.resolve();
  }
  
  stop() {
    return Promise.resolve();
  }
  
  getStatus() {
    return { running: true };
  }
}

// Default export for compatibility
export default MockupServiceManager;