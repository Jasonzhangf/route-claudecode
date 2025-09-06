/**
 * CLI Module Tests
 */

import { CliModule, createCliModule, CLI_MODULE_VERSION } from '../index';

describe('CLI Module', () => {
  it('should create cli module', () => {
    const module = createCliModule();
    expect(module).toBeDefined();
  });

  it('should execute command', async () => {
    const module = createCliModule();
    await expect(module.executeCommand([])).resolves.toBeUndefined();
  });

  it('should start server', async () => {
    const module = createCliModule();
    await expect(module.startServer({})).resolves.toBeUndefined();
  });

  it('should stop server', async () => {
    const module = createCliModule();
    await expect(module.stopServer({})).resolves.toBeUndefined();
  });

  it('should have correct version', () => {
    expect(CLI_MODULE_VERSION).toBe('4.0.0-zero-interface');
  });
});