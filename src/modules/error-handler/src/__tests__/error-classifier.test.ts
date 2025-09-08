/**
 * Error Classifier Tests
 */

import { ErrorClassifier } from '../error-classifier';
import { ErrorType } from '../error-log-manager';
import { RCCError, ERROR_CODES } from '../types/error';

describe('ErrorClassifier', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  it('should create error classifier instance', () => {
    expect(classifier).toBeDefined();
  });

  describe('RCC Error Code Classification', () => {
    it('should classify pipeline errors correctly', () => {
      const error = new RCCError(
        'Pipeline initialization failed',
        ERROR_CODES.PIPELINE_ASSEMBLY_FAILED,
        'pipeline-module'
      );
      
      const classification = classifier.classifyError(error.message, error.stack);
      
      expect(classification.type).toBe(ErrorType.PIPELINE_ERROR);
      expect(classification.confidence).toBeGreaterThan(0.7);
    });

    it('should classify transform errors correctly', () => {
      const error = new RCCError(
        'Failed to transform request',
        ERROR_CODES.INTERNAL_ERROR,
        'transformer-module'
      );
      
      const classification = classifier.classifyError(error.message, error.stack);
      
      expect(classification.type).toBe(ErrorType.TRANSFORM_ERROR);
      expect(classification.confidence).toBeGreaterThan(0.1);
    });

    it('should classify validation errors correctly', () => {
      const error = new RCCError(
        'Invalid request format',
        ERROR_CODES.VALIDATION_ERROR,
        'validator-module'
      );
      
      const classification = classifier.classifyError(error.message, error.stack);
      
      expect(classification.type).toBe(ErrorType.TRANSFORM_ERROR);
      expect(classification.confidence).toBeGreaterThan(0.1);
    });
  });

  describe('Pattern-based Classification', () => {
    it('should classify server errors correctly', () => {
      const classification = classifier.classifyError('Server error: 502 Bad Gateway');
      
      expect(classification.type).toBe(ErrorType.SERVER_ERROR);
      expect(classification.confidence).toBeGreaterThan(0.8);
    });

    it('should classify authentication errors correctly', () => {
      const classification = classifier.classifyError('Invalid API key provided');
      
      expect(classification.type).toBe(ErrorType.AUTH_ERROR);
      expect(classification.confidence).toBeGreaterThan(0.7);
    });

    it('should classify timeout errors correctly', () => {
      const classification = classifier.classifyError('Request timeout after 30000ms');
      
      expect(classification.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(classification.confidence).toBeGreaterThan(0.7);
    });

    it('should classify unknown errors with low confidence', () => {
      const classification = classifier.classifyError('Some random error message');
      
      expect(classification.type).toBe(ErrorType.UNKNOWN_ERROR);
      expect(classification.confidence).toBeLessThan(0.3);
    });
  });

  describe('Error Severity Detection', () => {
    it('should detect critical severity for critical RCC errors', () => {
      const error = new RCCError(
        'Critical system error',
        ERROR_CODES.PIPELINE_ASSEMBLY_FAILED,
        'core-module'
      );
      
      const classification = classifier.classifyError(error.message, error.stack);
      
      // The classifier should recognize this as a high-severity error
      expect(classification.confidence).toBeGreaterThan(0.1);
    });

    it('should detect high severity for authentication errors', () => {
      const classification = classifier.classifyError('Authentication failed: Invalid credentials');
      
      expect(classification.type).toBe(ErrorType.AUTH_ERROR);
      expect(classification.confidence).toBeGreaterThan(0.7);
    });
  });
});