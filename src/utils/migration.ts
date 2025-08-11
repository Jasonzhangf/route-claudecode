/**
 * Configuration Migration Utility
 * Migrates configurations and logs from legacy to new path
 * Project owner: Jason Zhang
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, rmSync } from 'fs';
import { join } from 'path';
import { getLegacyConfigPaths, getNewConfigPaths } from './config-paths';
import { logger } from './logger';

export interface MigrationResult {
  success: boolean;
  filesTransferred: number;
  errors: string[];
}

/**
 * Migrate all configurations and logs from legacy to new path
 */
export async function migrateConfiguration(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    filesTransferred: 0,
    errors: []
  };

  try {
    const legacyPaths = getLegacyConfigPaths();
    const newPaths = getNewConfigPaths();

    // Check if legacy directory exists
    if (!existsSync(legacyPaths.configDir)) {
      result.errors.push('Legacy configuration directory does not exist');
      return result;
    }

    // Check if new directory already exists
    if (existsSync(newPaths.configDir)) {
      result.errors.push('New configuration directory already exists');
      return result;
    }

    // Create new configuration directory
    mkdirSync(newPaths.configDir, { recursive: true });
    logger.info('Created new configuration directory', { path: newPaths.configDir });

    // Migrate all files and directories
    await copyDirectoryRecursive(legacyPaths.configDir, newPaths.configDir, result);

    // Mark migration as successful if no errors occurred during copying
    result.success = result.errors.length === 0;

    if (result.success) {
      logger.info('Configuration migration completed successfully', {
        filesTransferred: result.filesTransferred,
        fromPath: legacyPaths.configDir,
        toPath: newPaths.configDir
      });
    } else {
      logger.error('Configuration migration completed with errors', {
        filesTransferred: result.filesTransferred,
        errors: result.errors
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Migration failed: ${errorMessage}`);
    logger.error('Configuration migration failed', { error: errorMessage });
  }

  return result;
}

/**
 * Recursively copy directory contents
 */
async function copyDirectoryRecursive(
  sourceDir: string, 
  targetDir: string, 
  result: MigrationResult
): Promise<void> {
  try {
    const items = readdirSync(sourceDir);

    for (const item of items) {
      const sourcePath = join(sourceDir, item);
      const targetPath = join(targetDir, item);

      const stats = statSync(sourcePath);

      if (stats.isDirectory()) {
        // Create target directory and copy recursively
        mkdirSync(targetPath, { recursive: true });
        await copyDirectoryRecursive(sourcePath, targetPath, result);
      } else if (stats.isFile()) {
        // Copy file
        try {
          copyFileSync(sourcePath, targetPath);
          result.filesTransferred++;
          logger.debug('Migrated file', { from: sourcePath, to: targetPath });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to copy ${sourcePath}: ${errorMessage}`);
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Failed to read directory ${sourceDir}: ${errorMessage}`);
  }
}

/**
 * Remove legacy configuration directory after successful migration
 * WARNING: This permanently deletes the legacy directory
 */
export async function removeLegacyConfiguration(): Promise<boolean> {
  try {
    const legacyPaths = getLegacyConfigPaths();
    
    if (!existsSync(legacyPaths.configDir)) {
      logger.info('Legacy configuration directory does not exist, nothing to remove');
      return true;
    }

    rmSync(legacyPaths.configDir, { recursive: true, force: true });
    logger.info('Legacy configuration directory removed', { path: legacyPaths.configDir });
    
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to remove legacy configuration directory', { error: errorMessage });
    return false;
  }
}

/**
 * Create a backup of legacy configuration before migration
 */
export async function backupLegacyConfiguration(): Promise<string | null> {
  try {
    const legacyPaths = getLegacyConfigPaths();
    
    if (!existsSync(legacyPaths.configDir)) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${legacyPaths.configDir}-backup-${timestamp}`;
    
    const result: MigrationResult = { success: false, filesTransferred: 0, errors: [] };
    await copyDirectoryRecursive(legacyPaths.configDir, backupPath, result);
    
    // Mark as successful if no errors occurred
    result.success = result.errors.length === 0;
    
    if (result.success) {
      logger.info('Legacy configuration backup created', { 
        backupPath,
        filesTransferred: result.filesTransferred 
      });
      return backupPath;
    } else {
      logger.error('Failed to create legacy configuration backup', { errors: result.errors });
      return null;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Backup creation failed', { error: errorMessage });
    return null;
  }
}