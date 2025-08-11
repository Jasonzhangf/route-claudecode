/**
 * Path resolution utilities
 */

import { resolve, join, basename } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

/**
 * Resolve path with tilde expansion and project config directory search
 * Handles both regular paths and paths starting with ~/
 * Also searches in project config directories if file not found at specified path
 */
export function resolvePath(filePath: string): string {
  // Handle tilde expansion first
  let resolvedPath = filePath;
  if (filePath.startsWith('~/')) {
    resolvedPath = resolve(homedir(), filePath.slice(2));
  } else {
    resolvedPath = resolve(filePath);
  }
  
  // If file exists at the resolved path, return it
  if (existsSync(resolvedPath)) {
    return resolvedPath;
  }
  
  // If file doesn't exist, try to find it in project config directories
  const configDir = join(homedir(), '.route-claude-code');
  const configReleaseDir = join(homedir(), '.claude-code-router');
  
  // Try .route-claude-code directory first
  const configPath = join(configDir, basename(filePath));
  if (existsSync(configPath)) {
    return configPath;
  }
  
  // Try legacy .claude-code-router directory
  const legacyConfigPath = join(configReleaseDir, basename(filePath));
  if (existsSync(legacyConfigPath)) {
    return legacyConfigPath;
  }
  
  // If not found in config directories, return original resolved path
  return resolvedPath;
}