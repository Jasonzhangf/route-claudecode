/**
 * Preprocessor Layer - Six-Layer Architecture
 * 
 * This layer handles request preprocessing and request preparation.
 * In v3.0 six-layer architecture, preprocessing is handled by each provider-protocol layer.
 */

// TODO: Implement v3.0 six-layer preprocessor architecture
export interface PreprocessorInterface {
  process(input: any, context: any): Promise<any>;
}