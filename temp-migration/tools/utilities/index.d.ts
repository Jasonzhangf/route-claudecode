/**
 * MOCKUP IMPLEMENTATION - Utilities Tool
 * This is a placeholder implementation for the utilities system
 * All functionality is mocked and should be replaced with real implementations
 */
export declare class MockupUtilities {
    constructor();
    validateConfiguration(configPath: string): Promise<any>;
    cleanupLogs(olderThanDays?: number): Promise<any>;
    backupDatabase(): Promise<any>;
    restoreDatabase(backupId: string): Promise<any>;
    optimizeDatabase(): Promise<any>;
    generateHealthReport(): Promise<string>;
    testProviderConnections(): Promise<any>;
}
export default MockupUtilities;
//# sourceMappingURL=index.d.ts.map