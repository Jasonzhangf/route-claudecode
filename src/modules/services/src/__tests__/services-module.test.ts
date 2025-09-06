/**
 * Services Module Tests
 */

import { ServicesModule, createServicesModule, SERVICES_MODULE_VERSION } from '../index';

describe('Services Module', () => {
  it('should create services module', () => {
    const module = createServicesModule();
    expect(module).toBeDefined();
  });

  it('should get server manager', () => {
    const module = createServicesModule();
    const manager = module.getServerManager();
    expect(manager).toBeDefined();
  });

  it('should get cache manager', () => {
    const module = createServicesModule();
    const manager = module.getCacheManager();
    expect(manager).toBeDefined();
  });

  it('should have correct version', () => {
    expect(SERVICES_MODULE_VERSION).toBe('4.0.0-alpha.2');
  });
});