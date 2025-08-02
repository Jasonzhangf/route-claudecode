/**
 * Test setup file
 * Global test configuration and utilities
 */

import { jest } from '@jest/globals';

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn()
};