# Error Coordination Center

## Overview

The Error Coordination Center is a unified error handling system that provides centralized management of errors across all modules in the RCC v4.0 architecture. It integrates error handling, classification, logging, and response standardization into a single cohesive interface.

## Key Features

- **Unified Error Interface**: Implements the `ErrorCoordinationCenter` interface for consistent error handling
- **Port-based Log Classification**: Organizes error logs by server port for better isolation
- **Error Classification**: Automatically categorizes errors based on patterns and context
- **Standardized Responses**: Provides consistent error responses across all providers
- **Retry Management**: Intelligent retry mechanisms with exponential backoff
- **Severity Levels**: Classification of errors by criticality (low, medium, high, critical)
- **Statistics and Reporting**: Error metrics and summary reports
- **Log Cleanup**: Automatic cleanup of expired log entries

## Interface Methods

### Core Methods

- `initialize()`: Initialize the error coordination center
- `handleError(error, context)`: Process and log errors with full context
- `classifyError(error, context)`: Classify errors based on type and context
- `logError(error, context, classification)`: Record error details in logs

### Response Management

- `normalizeErrorResponse(error, provider)`: Generate standardized error responses
- `isRetryableError(error)`: Determine if an error should be retried
- `getRetryDelay(error)`: Calculate appropriate retry delay
- `getErrorSeverity(error)`: Assess the severity level of an error

### Analytics and Maintenance

- `getErrorStatistics(timeRangeHours)`: Get error metrics and statistics
- `generateErrorSummary(startTime, endTime)`: Create error summary reports
- `cleanupLogs(retentionDays)`: Remove expired log entries

## Usage Example

```typescript
import { ErrorCoordinationCenter } from 'rcc4';

// Create error coordination center instance
const errorCenter = new ErrorCoordinationCenter();

// Handle an error with full context
const error = new Error('Network timeout');
const context = {
  requestId: 'req-12345',
  pipelineId: 'pipeline-abc',
  provider: 'lmstudio',
  layerName: 'transformer',
  attemptNumber: 1,
  maxAttempts: 3
};

const result = await errorCenter.handleError(error, context);
console.log('Error handled:', result.success);
```

## Error Context Information

The error context provides valuable metadata for error classification and handling:

- `requestId`: Unique identifier for the request
- `pipelineId`: Identifier for the processing pipeline
- `layerName`: Name of the layer where the error occurred
- `provider`: AI provider being used
- `attemptNumber`: Current retry attempt number
- `maxAttempts`: Maximum number of retry attempts allowed

## Error Classification

Errors are automatically classified into the following types:

- `SERVER_ERROR`: Internal server errors
- `SOCKET_ERROR`: Network socket errors
- `CONNECTION_ERROR`: Connection establishment failures
- `TIMEOUT_ERROR`: Request timeout errors
- `PIPELINE_ERROR`: Pipeline processing errors
- `TRANSFORM_ERROR`: Data transformation errors
- `AUTH_ERROR`: Authentication failures
- `VALIDATION_ERROR`: Data validation failures
- `RATE_LIMIT_ERROR`: Rate limiting errors
- `FILTER_ERROR`: Array filtering errors
- `UNKNOWN_ERROR`: Uncategorized errors

## Integration with Existing Systems

The Error Coordination Center seamlessly integrates with:

- Existing error logging infrastructure
- Debug and monitoring systems
- Pipeline management modules
- Provider-specific error handling
- Load balancing and failover mechanisms

## Benefits

1. **Consistency**: Uniform error handling across all modules
2. **Maintainability**: Centralized error management logic
3. **Observability**: Rich error context and statistics
4. **Reliability**: Intelligent retry and failover strategies
5. **Performance**: Efficient error processing and logging