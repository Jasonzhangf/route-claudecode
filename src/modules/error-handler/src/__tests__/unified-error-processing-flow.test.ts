/**
 * Unified error processing flow tests
 */

import { getUnifiedErrorProcessingFlow } from '../unified-error-processing-flow';
import { ErrorContext } from '../../../../interfaces/core/error-coordination-center';
import { RCCError, ERROR_CODES } from '../../types/error';

describe('UnifiedErrorProcessingFlow', () => {
  let errorFlow: any;
  
  beforeEach(() => {
    errorFlow = getUnifiedErrorProcessingFlow();
  });
  
  test('initialization', async () => {
    await expect(errorFlow.initialize()).resolves.not.toThrow();
  });
  
  test('RCC error handling', async () => {
    const error = new RCCError(
      'test error message',
      ERROR_CODES.UNKNOWN_ERROR,
      'test-module',
      'medium'
    );
    const context: ErrorContext = {
      requestId: 'test-123',
      pipelineId: 'test-pipeline',
      layerName: 'test-layer'
    };
    
    const result = await errorFlow.handleRCCError(error, context);
    expect(result).toBeDefined();
  });
});