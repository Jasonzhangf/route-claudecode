/**
 * Server Module Tests
 */

import { ServerFactory, HealthChecker, createServerModuleAdapter, getServerModuleInfo } from '../index';

describe('Server Module', () => {
  it('should create server factory', () => {
    const factory = new ServerFactory();
    expect(factory).toBeDefined();
  });

  it('should create server', () => {
    const server = ServerFactory.createServer({ port: 3000, host: 'localhost' });
    expect(server).toBeDefined();
  });

  it('should create health checker', async () => {
    const healthChecker = new HealthChecker();
    const result = await healthChecker.checkHealth();
    expect(result).toBeDefined();
  });

  it('should create server module adapter', () => {
    const adapter = createServerModuleAdapter();
    expect(adapter).toBeDefined();
  });

  it('should get server module info', () => {
    const info = getServerModuleInfo();
    expect(info).toBeDefined();
    expect(info.name).toBe('server-module');
  });
});