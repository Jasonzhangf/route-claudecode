# Error Handler Module

## Overview

The Error Handler module provides a unified error coordination center implementation that integrates error handling, classification, logging, and response standardization.

## ErrorCoordinationCenter Interface

The `ErrorCoordinationCenter` interface implements all required methods for centralized error management:

- `initialize()` - Initialize the error coordination center
- `handleError()` - Process and log errors with context
- `normalizeErrorResponse()` - Standardize error responses
- `getErrorStatistics()` - Get error statistics and metrics
- `generateErrorSummary()` - Generate error summary reports
- `cleanupLogs()` - Clean up expired log entries
- `isRetryableError()` - Check if an error is retryable
- `getRetryDelay()` - Get suggested retry delay
- `getErrorSeverity()` - Get error severity level

## Usage

```typescript
import { ErrorCoordinationCenter } from './error-handler';

// Create error coordination center instance
const errorCenter = new ErrorCoordinationCenter();

// Handle errors
const error = new Error('Network timeout');
const context = {
  requestId: 'req-123',
  pipelineId: 'pipeline-456',
  provider: 'lmstudio'
};

const result = await errorCenter.handleError(error, context);
```

## Features

- Port-based log classification and storage
- Error classification and categorization
- Standardized error response generation
- Retry mechanism with exponential backoff
- Error severity levels (critical, high, medium, low)
- Log cleanup and retention policies
- Integration with existing error handling systems