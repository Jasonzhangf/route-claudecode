/**
 * MOCKUP IMPLEMENTATION - Data Extraction Tool
 * This is a placeholder implementation for the data extraction system
 * All functionality is mocked and should be replaced with real implementations
 */
export declare class MockupDataExtractor {
    private databasePath;
    private outputFormat;
    constructor(databasePath?: string, outputFormat?: 'json' | 'csv' | 'xml');
    extractProviderMetrics(provider: string, timeRange?: {
        start: Date;
        end: Date;
    }): Promise<any>;
    extractRequestPatterns(): Promise<any>;
    extractErrorAnalysis(): Promise<any>;
    exportData(data: any, filename: string): Promise<void>;
    generateDataSummary(): Promise<string>;
}
export default MockupDataExtractor;
//# sourceMappingURL=index.d.ts.map