/**
 * Routes Module Tests
 */

import { RoutesModule, createRoutesModule, ROUTES_MODULE_VERSION } from '../index';

describe('Routes Module', () => {
  it('should create routes module', () => {
    const module = createRoutesModule();
    expect(module).toBeDefined();
  });

  it('should add route', () => {
    const module = createRoutesModule();
    expect(() => module.addRoute({})).not.toThrow();
  });

  it('should match route', () => {
    const module = createRoutesModule();
    const result = module.matchRoute('/test', 'GET');
    expect(result).toBeNull();
  });

  it('should have correct version', () => {
    expect(ROUTES_MODULE_VERSION).toBe('4.0.0-alpha.2');
  });
});