/**
 * Test imports for real implementations - NO MOCKUPS
 * Project owner: Jason Zhang
 */

import { describe, it, expect } from 'vitest';

describe('Real Implementation Import Tests', () => {
  it('should import ServiceController correctly', async () => {
    const { ServiceController } = await import('../../src/service/index.js');
    expect(ServiceController).toBeDefined();
    expect(typeof ServiceController).toBe('function');
    
    const instance = new ServiceController();
    expect(instance).toBeDefined();
  });

  it('should import ServiceController as default', async () => {
    const ServiceController = (await import('../../src/service/index.js')).default;
    expect(ServiceController).toBeDefined();
    expect(typeof ServiceController).toBe('function');
    
    const instance = new ServiceController();
    expect(instance).toBeDefined();
  });

  it('should import DebugRecorder correctly', async () => {
    const { DebugRecorder } = await import('../../src/debug/recorder.js');
    expect(DebugRecorder).toBeDefined();
    expect(typeof DebugRecorder).toBe('function');
    
    const instance = new DebugRecorder();
    expect(instance).toBeDefined();
    expect(instance.sessionId).toBeDefined();
  });

  it('should import DebugRecorder as default', async () => {
    const DebugRecorder = (await import('../../src/debug/recorder.js')).default;
    expect(DebugRecorder).toBeDefined();
    expect(typeof DebugRecorder).toBe('function');
    
    const instance = new DebugRecorder();
    expect(instance).toBeDefined();
    expect(instance.sessionId).toBeDefined();
  });
});