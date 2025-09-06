/**
 * Constants Module Tests
 */
import { createConstantsModule, CONSTANTS_MODULE_VERSION } from '../index';

describe('Constants Module', () => {
  it('should create constants module', () => {
    const module = createConstantsModule();
    expect(module).toBeDefined();
  });

  it('should have correct version', () => {
    expect(CONSTANTS_MODULE_VERSION).toBe('4.0.0-zero-interface');
  });
});