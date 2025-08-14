/**
 * Claude Code Router - Main Entry Point
 * Exports all core functionality for programmatic use
 */

// Core components
export { RouterServer } from './server';

// Input processors
export { AnthropicInputProcessor } from './input/anthropic';

// Routing engine
export { RoutingEngine } from './routing';

// Output processors
export { AnthropicOutputProcessor } from './output/anthropic';

// Providers
export { CodeWhispererClient, CodeWhispererAuth, CodeWhispererConverter } from './providers/codewhisperer';
// OpenAI Provider exports - unified client architecture
export { UnifiedOpenAIClient, createOpenAIClient } from './providers/openai';

// Types
export * from './types';

// Utilities
export { calculateTokenCount, calculateDetailedTokenCount } from './utils';