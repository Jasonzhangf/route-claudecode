/**
 * Types Module Tests
 */
import { createTypesModule, TYPES_MODULE_VERSION } from '../index';

describe('Types Module', () => {
  it('should create types module', () => {
    const module = createTypesModule();
    expect(module).toBeDefined();
  });

  it('should have correct version', () => {
    expect(TYPES_MODULE_VERSION).toBe('4.0.0-alpha.2');
  });
});