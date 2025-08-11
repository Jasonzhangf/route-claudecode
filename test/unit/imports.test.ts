/**
 * Test imports to debug the issue
 */

import { describe, it, expect } from 'vitest';

describe('Import Tests', () => {
  it('should import service manager correctly', async () => {
    const { MockupServiceManager } = await import('../../src/service/index.js');
    expect(MockupServiceManager).toBeDefined();
    expect(typeof MockupServiceManager).toBe('function');
    
    const instance = new MockupServiceManager();
    expect(instance).toBeDefined();
  });

  it('should import service manager as default', async () => {
    const MockupServiceManager = (await import('../../src/service/index.js')).default;
    expect(MockupServiceManager).toBeDefined();
    expect(typeof MockupServiceManager).toBe('function');
    
    const instance = new MockupServiceManager();
    expect(instance).toBeDefined();
  });

  it('should import debug recorder correctly', async () => {
    const { MockupDebugRecorder } = await import('../../src/debug/recorder.js');
    expect(MockupDebugRecorder).toBeDefined();
    expect(typeof MockupDebugRecorder).toBe('function');
    
    const instance = new MockupDebugRecorder();
    expect(instance).toBeDefined();
  });

  it('should import debug recorder as default', async () => {
    const MockupDebugRecorder = (await import('../../src/debug/recorder.js')).default;
    expect(MockupDebugRecorder).toBeDefined();
    expect(typeof MockupDebugRecorder).toBe('function');
    
    const instance = new MockupDebugRecorder();
    expect(instance).toBeDefined();
  });
});