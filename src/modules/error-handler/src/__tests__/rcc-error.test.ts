/**
 * RCC Error Types Tests
 */

import { RCCError, ValidationError, TransformError, AuthError, ERROR_CODES } from '../../types/error';

describe('RCCError Types', () => {
  describe('RCCError Base Class', () => {
    it('should create RCCError with default values', () => {
      const error = new RCCError('Test error message');
      
      expect(error).toBeInstanceOf(RCCError);
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('RCCError');
      expect(error.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      expect(error.severity).toBe('medium');
      expect(error.moduleId).toBeUndefined();
      expect(error.context).toBeUndefined();
      expect(error.timestamp).toBeDefined();
    });

    it('should create RCCError with custom values', () => {
      const context = { test: 'value' };
      const error = new RCCError(
        'Custom error message',
        ERROR_CODES.PIPELINE_INIT_FAILED,
        'test-module',
        'high',
        context
      );
      
      expect(error.message).toBe('Custom error message');
      expect(error.code).toBe(ERROR_CODES.PIPELINE_INIT_FAILED);
      expect(error.moduleId).toBe('test-module');
      expect(error.severity).toBe('high');
      expect(error.context).toEqual(context);
    });

    it('should create error with context using static method', () => {
      const context = { field: 'test-field' };
      const error = RCCError.withContext(
        'Context error message',
        ERROR_CODES.VALIDATION_FAILED,
        'validation-module',
        context
      );
      
      expect(error.message).toBe('Context error message');
      expect(error.code).toBe(ERROR_CODES.VALIDATION_FAILED);
      expect(error.moduleId).toBe('validation-module');
      expect(error.severity).toBe('medium');
      expect(error.context).toEqual(context);
    });

    it('should create critical error using static method', () => {
      const error = RCCError.critical(
        'Critical error message',
        ERROR_CODES.AUTHENTICATION_FAILED,
        'auth-module'
      );
      
      expect(error.message).toBe('Critical error message');
      expect(error.code).toBe(ERROR_CODES.AUTHENTICATION_FAILED);
      expect(error.moduleId).toBe('auth-module');
      expect(error.severity).toBe('critical');
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with default values', () => {
      const error = new ValidationError('Validation failed');
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(RCCError);
      expect(error.message).toBe('Validation failed');
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe(ERROR_CODES.VALIDATION_FAILED);
      expect(error.severity).toBe('medium');
    });

    it('should create ValidationError with custom values', () => {
      const context = { field: 'username', constraint: 'required' };
      const error = new ValidationError(
        'Username is required',
        'user-module',
        context
      );
      
      expect(error.message).toBe('Username is required');
      expect(error.moduleId).toBe('user-module');
      expect(error.context).toEqual(context);
    });
  });

  describe('TransformError', () => {
    it('should create TransformError with default values', () => {
      const error = new TransformError('Transform failed');
      
      expect(error).toBeInstanceOf(TransformError);
      expect(error).toBeInstanceOf(RCCError);
      expect(error.message).toBe('Transform failed');
      expect(error.name).toBe('TransformError');
      expect(error.code).toBe(ERROR_CODES.TRANSFORM_FAILED);
      expect(error.severity).toBe('high');
    });

    it('should create TransformError with custom values', () => {
      const context = { source: 'anthropic', target: 'openai', field: 'tools' };
      const error = new TransformError(
        'Failed to transform tools format',
        'transformer-module',
        context
      );
      
      expect(error.message).toBe('Failed to transform tools format');
      expect(error.moduleId).toBe('transformer-module');
      expect(error.context).toEqual(context);
    });
  });

  describe('AuthError', () => {
    it('should create AuthError with default values', () => {
      const error = new AuthError('Authentication failed');
      
      expect(error).toBeInstanceOf(AuthError);
      expect(error).toBeInstanceOf(RCCError);
      expect(error.message).toBe('Authentication failed');
      expect(error.name).toBe('AuthError');
      expect(error.code).toBe(ERROR_CODES.AUTHENTICATION_FAILED);
      expect(error.severity).toBe('high');
    });

    it('should create AuthError with custom values', () => {
      const context = { provider: 'openai', apiKey: 'sk-***' };
      const error = new AuthError(
        'Invalid API key',
        'auth-module',
        context
      );
      
      expect(error.message).toBe('Invalid API key');
      expect(error.moduleId).toBe('auth-module');
      expect(error.context).toEqual(context);
    });
  });

  describe('ERROR_CODES Enum', () => {
    it('should have all required error codes', () => {
      expect(ERROR_CODES.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
      expect(ERROR_CODES.INVALID_CONFIGURATION).toBe('INVALID_CONFIGURATION');
      expect(ERROR_CODES.MODULE_NOT_FOUND).toBe('MODULE_NOT_FOUND');
      expect(ERROR_CODES.PIPELINE_INIT_FAILED).toBe('PIPELINE_INIT_FAILED');
      expect(ERROR_CODES.TRANSFORM_FAILED).toBe('TRANSFORM_FAILED');
      expect(ERROR_CODES.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
      expect(ERROR_CODES.AUTHENTICATION_FAILED).toBe('AUTHENTICATION_FAILED');
    });

    it('should have unique error codes', () => {
      const codes = Object.values(ERROR_CODES);
      const uniqueCodes = [...new Set(codes)];
      expect(codes.length).toBe(uniqueCodes.length);
    });
  });
});