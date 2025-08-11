/**
 * Configuration Path Management
 * Handles priority-based configuration path resolution
 * Project owner: Jason Zhang
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ConfigPaths {
  configDir: string;
  configFile: string;
  logsDir: string;
  releaseConfigFile: string;
}

/**
 * Get configuration paths with priority order:
 * 1. ~/.route-claude-code/ (new preferred path)
 * 2. ~/.claude-code-router/ (legacy path)
 */
export function getConfigPaths(): ConfigPaths {
  const homeDir = homedir();
  
  // New preferred path
  const newConfigDir = join(homeDir, '.route-claude-code');
  const newConfigExists = existsSync(newConfigDir);
  
  // Legacy path
  const legacyConfigDir = join(homeDir, '.claude-code-router');
  const legacyConfigExists = existsSync(legacyConfigDir);
  
  // Priority: new path if exists, otherwise legacy, otherwise create new
  const configDir = newConfigExists ? newConfigDir : 
                   legacyConfigExists ? legacyConfigDir : 
                   newConfigDir;
  
  // Ensure config directory exists
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  
  // Ensure logs directory exists
  const logsDir = join(configDir, 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  
  return {
    configDir,
    configFile: join(configDir, 'config.json'),
    logsDir,
    releaseConfigFile: join(configDir, 'config.release.json')
  };
}

/**
 * Check if migration is needed from legacy to new path
 */
export function needsMigration(): boolean {
  const homeDir = homedir();
  const newConfigDir = join(homeDir, '.route-claude-code');
  const legacyConfigDir = join(homeDir, '.claude-code-router');
  
  return existsSync(legacyConfigDir) && !existsSync(newConfigDir);
}

/**
 * Get legacy configuration paths for migration
 */
export function getLegacyConfigPaths(): ConfigPaths {
  const homeDir = homedir();
  const configDir = join(homeDir, '.claude-code-router');
  
  return {
    configDir,
    configFile: join(configDir, 'config.json'),
    logsDir: join(configDir, 'logs'),
    releaseConfigFile: join(configDir, 'config.release.json')
  };
}

/**
 * Get new configuration paths for migration
 */
export function getNewConfigPaths(): ConfigPaths {
  const homeDir = homedir();
  const configDir = join(homeDir, '.route-claude-code');
  
  return {
    configDir,
    configFile: join(configDir, 'config.json'),
    logsDir: join(configDir, 'logs'),
    releaseConfigFile: join(configDir, 'config.release.json')
  };
}