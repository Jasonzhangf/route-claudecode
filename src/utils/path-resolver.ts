/**
 * Path resolution utilities
 */

import { resolve } from 'path';
import { homedir } from 'os';

/**
 * Resolve path with tilde expansion
 * Handles both regular paths and paths starting with ~/
 */
export function resolvePath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return resolve(homedir(), filePath.slice(2));
  }
  return resolve(filePath);
}