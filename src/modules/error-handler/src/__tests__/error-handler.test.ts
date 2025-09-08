/**
 * Enhanced Error Handler Tests
 */

import { EnhancedErrorHandler } from '../enhanced-error-handler';
import { RCCError, ValidationError, TransformError, AuthError, RCCErrorCode } from '../types/error';
import { ErrorContext } from '../../../../interfaces/core/error-coordination-center';

describe('EnhancedErrorHandler', () => {
  let errorHandler: EnhancedErrorHandler;

  beforeEach(() => {
    errorHandler = new EnhancedErrorHandler();
  });

  it('should create error handler instance', () => {
    expect(errorHandler).toBeDefined();
  });

  it('should implement ErrorCoordinationCenter interface', async () => {
    // Test that all required methods exist
    expect(typeof errorHandler.initialize).toBe('function');
    expect(typeof errorHandler.handleError).toBe('function');
    expect(typeof errorHandler.normalizeErrorResponse).toBe('function');
    expect(typeof errorHandler.getErrorStatistics).toBe('function');
    expect(typeof errorHandler.generateErrorSummary).toBe('function');
    expect(typeof errorHandler.cleanupLogs).toBe('function');
    expect(typeof errorHandler.isRetryableError).toBe('function');
    expect(typeof errorHandler.getRetryDelay).toBe('function');
    expect(typeof errorHandler.getErrorSeverity).toBe('function');
    expect(typeof errorHandler.logError).toBe('function');
    expect(typeof errorHandler.classifyError).toBe('function');
  });

  it('should handle RCCError instances correctly', async () => {
    await errorHandler.initialize();
    
    const rccError = new RCCError(
      'Test RCC Error',
      RCCErrorCode.PIPELINE_ASSEMBLY_FAILED,
      'test-module',
      { details: { severity: 'high', test: 'context' } }
    );
    
    const context: ErrorContext = {
      requestId: 'test-request-123',
      moduleId: 'test-module'
    } as ErrorContext;
    
    const result = await errorHandler.handleError(rccError, context);
    
    expect(result.success).toBe(true);
    expect(result.actionTaken).toBe('Error processed and logged');
  });

  it('should handle ValidationError instances correctly', async () => {
    await errorHandler.initialize();
    
    const validationError = new ValidationError(
      'Test validation error',
      'test-module',
      { field: 'test-field' }
    );
    
    const context: ErrorContext = {
      requestId: 'test-request-124',
      moduleId: 'test-module'
    } as ErrorContext;
    
    const result = await errorHandler.handleError(validationError, context);
    
    expect(result.success).toBe(true);
  });

  it('should handle TransformError instances correctly', async () => {
    await errorHandler.initialize();
    
    const transformError = new TransformError(
      'Test transform error',
      'test-module',
      { source: 'anthropic', target: 'openai' }
    );
    
    const context: ErrorContext = {
      requestId: 'test-request-125',
      moduleId: 'test-module'
    } as ErrorContext;
    
    const result = await errorHandler.handleError(transformError, context);
    
    expect(result.success).toBe(true);
  });

  it('should handle AuthError instances correctly', async () => {
    await errorHandler.initialize();
    
    const authError = new AuthError(
      'Test auth error',
      'test-module',
      { provider: 'openai' }
    );
    
    const context: ErrorContext = {
      requestId: 'test-request-126',
      moduleId: 'test-module'
    } as ErrorContext;
    
    const result = await errorHandler.handleError(authError, context);
    
    expect(result.success).toBe(true);
  });
});