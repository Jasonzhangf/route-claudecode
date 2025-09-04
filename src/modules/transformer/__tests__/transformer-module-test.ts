/**
 * Transformer Module Test Suite
 */

import { TransformerModule, TransformerType } from '../transformer-module';

describe('TransformerModule', () => {
  let transformerModule: any;

  beforeEach(() => {
    transformerModule = new TransformerModule({
      type: TransformerType.ANTHROPIC_TO_OPENAI,
      enabled: true,
      priority: 1,
      defaultMaxTokens: 4096,
    });
  });

  afterEach(async () => {
    await transformerModule.cleanup();
  });

  test('should create module with correct properties', () => {
    expect(transformerModule.getId()).toBeDefined();
    expect(transformerModule.getName()).toBe('TransformerModule');
  });
});