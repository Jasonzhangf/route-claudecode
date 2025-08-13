export declare class UnifiedErrorHandler {
    static handle(error: Error, context?: any): { error: string; context: any; };
    static validateErrorHandling(error: Error, reply: any, context?: any): void;
}

export declare function handleProviderError(error: Error, reply: any, context?: any): void;
export declare function handleStreamingError(error: Error, reply: any, context?: any): void;
export declare function handleRoutingError(error: Error, reply: any, context?: any): void;
export declare function handleInputError(error: Error, reply: any, context?: any): void;
export declare function handleOutputError(error: Error, reply: any, context?: any): void;

export declare function createErrorHandler(component: string): {
    handleError: (error: Error, method: string, context?: any) => void;
};