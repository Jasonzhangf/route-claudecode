#!/usr/bin/env node

/**
 * Claude Code Router v3.0 - Unified Error Handler
 * 
 * Provides consistent error handling across all system components
 * with zero-fallback compliance and explicit failure reporting.
 * 
 * @author Jason Zhang
 * @version 3.0.0
 */

export class ErrorHandler {
    constructor(context = 'UnknownComponent') {
        this.context = context;
        this.errorCount = 0;
        this.lastError = null;
    }

    /**
     * Handle critical errors that should stop execution
     * Zero-fallback principle: Always throw, never continue with degraded state
     */
    handleCriticalError(error, operation, details = {}) {
        this.errorCount++;
        this.lastError = {
            timestamp: new Date().toISOString(),
            operation,
            error: error.message,
            context: this.context,
            details
        };

        const errorMessage = `❌ CRITICAL FAILURE in ${this.context}:${operation} - ${error.message}`;
        
        console.error(errorMessage);
        console.error(`Context: ${JSON.stringify(details, null, 2)}`);
        
        // Zero-fallback: Always throw, never continue
        throw new Error(`${errorMessage}. Zero-fallback principle: System cannot continue with degraded functionality.`);
    }

    /**
     * Handle validation errors with explicit requirements
     */
    handleValidationError(field, value, requirements) {
        const errorMessage = `Validation failed for ${field}: "${value}". Requirements: ${requirements}`;
        
        console.error(`❌ ${this.context}: ${errorMessage}`);
        
        throw new Error(`${this.context} validation failure: ${errorMessage}. Zero-fallback principle requires explicit validation success.`);
    }

    /**
     * Handle configuration errors
     */
    handleConfigurationError(configPath, issue, requiredAction) {
        const errorMessage = `Configuration error in ${configPath}: ${issue}. Required action: ${requiredAction}`;
        
        console.error(`❌ ${this.context}: ${errorMessage}`);
        
        throw new Error(`${this.context} configuration failure: ${errorMessage}. Zero-fallback principle requires valid configuration.`);
    }

    /**
     * Handle file operation errors
     */
    handleFileOperationError(operation, filePath, error) {
        const errorMessage = `File ${operation} failed: ${filePath} - ${error.message}`;
        
        console.error(`❌ ${this.context}: ${errorMessage}`);
        
        throw new Error(`${this.context} file operation failure: ${errorMessage}. Zero-fallback principle requires successful file operations.`);
    }

    /**
     * Handle missing dependencies
     */
    handleMissingDependency(dependency, requiredBy) {
        const errorMessage = `Missing required dependency: ${dependency} (required by ${requiredBy})`;
        
        console.error(`❌ ${this.context}: ${errorMessage}`);
        
        throw new Error(`${this.context} dependency failure: ${errorMessage}. Zero-fallback principle requires all dependencies to be available.`);
    }

    /**
     * Handle network/external service errors
     */
    handleExternalServiceError(service, operation, error, retryable = false) {
        const errorMessage = `External service failure: ${service}:${operation} - ${error.message}`;
        
        console.error(`❌ ${this.context}: ${errorMessage}`);
        console.error(`Retryable: ${retryable}`);
        
        throw new Error(`${this.context} external service failure: ${errorMessage}. Zero-fallback principle: External service failures are not masked.`);
    }

    /**
     * Validate condition and throw if false (zero-fallback assertion)
     */
    assert(condition, message, details = {}) {
        if (!condition) {
            this.handleCriticalError(
                new Error(`Assertion failed: ${message}`),
                'assertion',
                details
            );
        }
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        return {
            context: this.context,
            errorCount: this.errorCount,
            lastError: this.lastError,
            hasErrors: this.errorCount > 0
        };
    }

    /**
     * Reset error counter (for testing)
     */
    reset() {
        this.errorCount = 0;
        this.lastError = null;
    }
}

/**
 * Factory function to create context-specific error handlers
 */
export function createErrorHandler(context) {
    return new ErrorHandler(context);
}

/**
 * Global error handler instance for emergency use
 */
export const globalErrorHandler = new ErrorHandler('GlobalSystem');

export default ErrorHandler;