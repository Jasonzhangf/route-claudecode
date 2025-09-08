/**
 * RCC Error Types Tests
 */

import { RCCError, ValidationError, TransformError, AuthError, ERROR_CODES } from '../types/error';

describe('RCCError Types', () => {
  describe('RCCError Base Class', () => {
    it('should create RCCError with default values', () => {
      const error = new RCCError('Test error message');
      
      expect(error).toBeInstanceOf(RCCError);
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('RCCError');
      expect(error.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      expect(error.module).toBe('UNKNOWN');
      expect(error.context).toBeDefined();
      expect(error.timestamp).toBeDefined();
    });

    it('should create RCCError with custom values', () => {
      const context = { details: { test: 'value', severity: 'high' } };
      const error = new RCCError(
        'Custom error message',
        ERROR_CODES.PIPELINE_ASSEMBLY_FAILED,
        'test-module',
        context
      );
      
      expect(error.message).toBe('Custom error message');
      expect(error.code).toBe(ERROR_CODES.PIPELINE_ASSEMBLY_FAILED);
      expect(error.module).toBe('test-module');
      expect(error.context).toEqual(expect.objectContaining(context));
    });

    it('should create error with context using constructor', () => {
      const context = { details: { field: 'test-field' } };
      const error = new RCCError(
        'Context error message',
        ERROR_CODES.VALIDATION_ERROR,
        'validation-module',
        context
      );
      
      expect(error.message).toBe('Context error message');
      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.module).toBe('validation-module');
      expect(error.context).toEqual(expect.objectContaining(context));
    });

    it('should create critical error with severity in context', () => {
      const error = new RCCError(
        'Critical error message',
        ERROR_CODES.INTERNAL_ERROR,
        'auth-module',
        { details: { severity: 'critical' } }
      );
      
      expect(error.message).toBe('Critical error message');
      expect(error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(error.module).toBe('auth-module');
      expect(error.context.details?.severity).toBe('critical');
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with default values', () => {
      const error = new ValidationError('Validation failed');
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Validation failed');
      expect(error.name).toBe('ValidationError');
      expect(error.module).toBe('UNKNOWN');
    });

    it('should create ValidationError with custom values', () => {
      const context = { field: 'username', constraint: 'required' };
      const error = new ValidationError(
        'Username is required',
        'user-module',
        context
      );
      
      expect(error.message).toBe('Username is required');
      expect(error.module).toBe('user-module');
      expect(error.context).toEqual(context);
    });
  });

  describe('TransformError', () => {
    it('should create TransformError with default values', () => {
      const error = new TransformError('Transform failed');
      
      expect(error).toBeInstanceOf(TransformError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Transform failed');
      expect(error.name).toBe('TransformError');
      expect(error.module).toBe('UNKNOWN');
    });

    it('should create TransformError with custom values', () => {
      const context = { source: 'anthropic', target: 'openai', field: 'tools' };
      const error = new TransformError(
        'Failed to transform tools format',
        'transformer-module',
        context
      );
      
      expect(error.message).toBe('Failed to transform tools format');
      expect(error.module).toBe('transformer-module');
      expect(error.context).toEqual(context);
    });
  });

  describe('AuthError', () => {
    it('should create AuthError with default values', () => {
      const error = new AuthError('Authentication failed');
      
      expect(error).toBeInstanceOf(AuthError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Authentication failed');
      expect(error.name).toBe('AuthError');
      expect(error.module).toBe('UNKNOWN');
    });

    it('should create AuthError with custom values', () => {
      const context = { provider: 'openai', apiKey: 'sk-***' };
      const error = new AuthError(
        'Invalid API key',
        'auth-module',
        context
      );
      
      expect(error.message).toBe('Invalid API key');
      expect(error.module).toBe('auth-module');
      expect(error.context).toEqual(context);
    });
  });

  describe('ERROR_CODES Enum', () => {
    it('should have all required error codes', () => {
      expect(ERROR_CODES.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
      expect(ERROR_CODES.CONFIG_INVALID).toBe('CONFIG_INVALID');
      expect(ERROR_CODES.MODULE_NOT_FOUND).toBe('MODULE_NOT_FOUND');
      expect(ERROR_CODES.PIPELINE_ASSEMBLY_FAILED).toBe('PIPELINE_ASSEMBLY_FAILED');
      expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });

    it('should have unique error codes', () => {
      const codes = Object.values(ERROR_CODES);
      const uniqueCodes = [...new Set(codes)];
      expect(codes.length).toBe(uniqueCodes.length);
    });
  });
});