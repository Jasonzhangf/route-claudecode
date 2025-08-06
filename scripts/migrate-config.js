#!/usr/bin/env node

/**
 * Configuration Migration Script
 * Migrates from ~/.claude-code-router to ~/.route-claude-code
 * Project owner: Jason Zhang
 */

const { existsSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

// Simple migration implementation without TypeScript dependencies
async function migrateConfig() {
  const homeDir = homedir();
  const legacyPath = join(homeDir, '.claude-code-router');
  const newPath = join(homeDir, '.route-claude-code');

  console.log('🔄 Route Claude Code Configuration Migration');
  console.log('==========================================');

  // Check if legacy directory exists
  if (!existsSync(legacyPath)) {
    console.log('✅ No legacy configuration found - nothing to migrate');
    return;
  }

  // Check if new directory already exists
  if (existsSync(newPath)) {
    console.log('⚠️  New configuration directory already exists');
    console.log(`   Legacy: ${legacyPath}`);
    console.log(`   New:    ${newPath}`);
    console.log('');
    console.log('Manual action required:');
    console.log('1. Review configurations in both directories');
    console.log('2. Manually merge any differences');
    console.log('3. Remove legacy directory when satisfied');
    return;
  }

  // Use built-in migration from the compiled application
  try {
    // Import and run the TypeScript migration
    const { migrateConfiguration, backupLegacyConfiguration } = require('./dist/utils/migration');
    
    console.log('🔍 Creating backup of legacy configuration...');
    const backupPath = await backupLegacyConfiguration();
    
    if (backupPath) {
      console.log(`✅ Backup created: ${backupPath}`);
    }
    
    console.log('🚀 Starting migration...');
    const result = await migrateConfiguration();
    
    if (result.success) {
      console.log('✅ Migration completed successfully!');
      console.log(`   Files transferred: ${result.filesTransferred}`);
      console.log(`   From: ${legacyPath}`);
      console.log(`   To:   ${newPath}`);
      console.log('');
      console.log('🎉 Your configuration is now using the new path!');
      console.log('');
      console.log('Optional cleanup:');
      console.log(`   rm -rf "${legacyPath}"`);
    } else {
      console.log('❌ Migration failed with errors:');
      result.errors.forEach(error => console.log(`   • ${error}`));
      console.log('');
      console.log('Please check the logs and try again, or migrate manually.');
    }
    
  } catch (error) {
    // Fallback to simple copy if TypeScript modules not available
    console.log('⚠️  Advanced migration not available, using simple copy...');
    
    const { execSync } = require('child_process');
    
    try {
      // Simple directory copy using system commands
      if (process.platform === 'win32') {
        execSync(`xcopy "${legacyPath}" "${newPath}" /E /I /H`, { stdio: 'inherit' });
      } else {
        execSync(`cp -r "${legacyPath}" "${newPath}"`, { stdio: 'inherit' });
      }
      
      console.log('✅ Basic migration completed!');
      console.log(`   From: ${legacyPath}`);
      console.log(`   To:   ${newPath}`);
      console.log('');
      console.log('Please verify the migration and remove the legacy directory:');
      console.log(`   rm -rf "${legacyPath}"`);
      
    } catch (copyError) {
      console.log('❌ Migration failed:', copyError.message);
      console.log('');
      console.log('Manual migration required:');
      console.log(`1. Copy: ${legacyPath}`);
      console.log(`2. To:   ${newPath}`);
      console.log(`3. Remove legacy directory when satisfied`);
    }
  }
}

// Run migration
migrateConfig().catch(error => {
  console.error('❌ Migration script failed:', error.message);
  process.exit(1);
});