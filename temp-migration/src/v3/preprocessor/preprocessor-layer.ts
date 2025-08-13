/**
 * Preprocessor Layer Implementation
 * Prepares requests for provider-protocol-specific requirements for the six-layer architecture
 * @author Jason Zhang
 * @version v3.0-refactor
 */

import { BaseLayer, ProcessingContext, LayerCapabilities } from '../shared/layer-interface.js';

export class PreprocessorLayer extends BaseLayer {
  constructor(config: any = {}) {
    super('preprocessor-layer', '1.0.0', 'preprocessor', ['provider-protocol-layer']);
  }

  async process(input: any, context: ProcessingContext): Promise<any> {
    // Prepare requests for provider-protocol-specific requirements
    return {
      ...input,
      preprocessorLayerProcessed: true,
      preprocessorLayerTimestamp: new Date()
    };
  }

  getCapabilities(): LayerCapabilities {
    return {
      supportedOperations: ['request-preparation', 'protocol-adaptation'],
      inputTypes: ['protocol-response'],
      outputTypes: ['prepared-request'],
      dependencies: ['provider-protocol-layer'],
      version: this.version
    };
  }
}