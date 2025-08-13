#!/usr/bin/env node

/**
 * Claude Code Router - Obsolete Documentation Cleanup Script
 * 
 * Identifies and removes obsolete documentation files and updates references
 * to maintain a clean documentation structure aligned with current architecture.
 * 
 * @author Jason Zhang
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function cleanupObsoleteDocs() {
    console.log('🧹 Starting obsolete documentation cleanup...');
    console.log('================================================================\n');

    const projectRoot = path.resolve(__dirname, '../');
    const docsDir = path.join(projectRoot, 'docs');
    
    const cleanupResults = {
        obsoleteFiles: [],
        retainedFiles: [],
        updatedFiles: [],
        errors: []
    };

    try {
        // Define obsolete patterns and files
        const obsoletePatterns = [
            // Version-specific obsolete patterns
            /v2\.6\.0/,
            /v2\.5\.0/,
            /enhanced-format-conversion\.md/,
            /tool-call-error-detection-system-summary\.md/, // Superseded by v2.7.0
            
            // Empty or placeholder files
            /placeholder/i,
            /todo/i,
            /draft/i
        ];

        // Files to explicitly keep (current architecture)
        const keepFiles = [
            'provider-interface.md',
            'provider-usage-examples.md', 
            'provider-integration-guide.md',
            'configuration-management.md',
            'build-deployment-system.md',
            'user-config-example.json'
        ];

        // Scan docs directory
        await scanAndCleanDirectory(docsDir, obsoletePatterns, keepFiles, cleanupResults);

        // Generate cleanup report
        await generateCleanupReport(cleanupResults);

        // Create updated documentation index
        await createUpdatedDocumentationIndex(docsDir, cleanupResults.retainedFiles);

    } catch (error) {
        console.error('💥 Cleanup failed:', error.message);
        cleanupResults.errors.push(error.message);
    }

    return cleanupResults;
}

async function scanAndCleanDirectory(dirPath, obsoletePatterns, keepFiles, results) {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                // Recursively scan subdirectories
                await scanAndCleanDirectory(fullPath, obsoletePatterns, keepFiles, results);
                
                // Check if directory is now empty and should be removed
                const remaining = await fs.readdir(fullPath);
                if (remaining.length === 0) {
                    console.log(`📁 Removing empty directory: ${path.relative(process.cwd(), fullPath)}`);
                    await fs.rmdir(fullPath);
                    results.obsoleteFiles.push({
                        type: 'directory',
                        path: path.relative(process.cwd(), fullPath),
                        reason: 'Empty directory after cleanup'
                    });
                }
            } else {
                // Check if file should be kept explicitly
                if (keepFiles.includes(entry.name)) {
                    console.log(`✅ Keeping: ${entry.name}`);
                    results.retainedFiles.push({
                        name: entry.name,
                        path: path.relative(process.cwd(), fullPath),
                        reason: 'Explicitly retained (current architecture)'
                    });
                    continue;
                }

                // Check if file matches obsolete patterns
                let shouldRemove = false;
                let removalReason = '';

                for (const pattern of obsoletePatterns) {
                    if (pattern.test(entry.name) || pattern.test(fullPath)) {
                        shouldRemove = true;
                        removalReason = `Matches obsolete pattern: ${pattern.toString()}`;
                        break;
                    }
                }

                // Check if file is empty
                if (!shouldRemove) {
                    try {
                        const stats = await fs.stat(fullPath);
                        if (stats.size === 0) {
                            shouldRemove = true;
                            removalReason = 'Empty file (0 bytes)';
                        }
                    } catch (error) {
                        console.warn(`⚠️ Could not check file size: ${fullPath}`);
                    }
                }

                // Check file content for version indicators
                if (!shouldRemove && entry.name.endsWith('.md')) {
                    try {
                        const content = await fs.readFile(fullPath, 'utf8');
                        
                        // Check for outdated version references
                        if (content.includes('v2.6.0') || content.includes('v2.5.0')) {
                            // Check if it's just a historical reference or actual obsolete content
                            const lines = content.split('\n');
                            const versionReferences = lines.filter(line => 
                                line.includes('v2.6.0') || line.includes('v2.5.0')
                            ).length;
                            
                            // If more than 3 references, likely obsolete
                            if (versionReferences > 3) {
                                shouldRemove = true;
                                removalReason = `Contains outdated version references (${versionReferences} references)`;
                            }
                        }

                        // Check for placeholder content
                        if (content.length < 100 && (
                            content.includes('TODO') || 
                            content.includes('PLACEHOLDER') ||
                            content.includes('Draft')
                        )) {
                            shouldRemove = true;
                            removalReason = 'Placeholder or draft content';
                        }
                    } catch (error) {
                        console.warn(`⚠️ Could not read file content: ${fullPath}`);
                    }
                }

                if (shouldRemove) {
                    console.log(`🗑️ Removing obsolete: ${entry.name} (${removalReason})`);
                    await fs.unlink(fullPath);
                    results.obsoleteFiles.push({
                        type: 'file',
                        name: entry.name,
                        path: path.relative(process.cwd(), fullPath),
                        reason: removalReason
                    });
                } else {
                    console.log(`✅ Retaining: ${entry.name}`);
                    results.retainedFiles.push({
                        name: entry.name,
                        path: path.relative(process.cwd(), fullPath),
                        reason: 'Current documentation'
                    });
                }
            }
        }
    } catch (error) {
        console.error(`❌ Error scanning directory ${dirPath}: ${error.message}`);
        results.errors.push(`Directory scan error: ${dirPath} - ${error.message}`);
    }
}

async function generateCleanupReport(results) {
    const reportContent = `# Documentation Cleanup Report

## Summary

**Cleanup Date**: ${new Date().toISOString()}
**Total Files Processed**: ${results.obsoleteFiles.length + results.retainedFiles.length}
**Files Removed**: ${results.obsoleteFiles.length}
**Files Retained**: ${results.retainedFiles.length}
**Errors**: ${results.errors.length}

## Removed Files

${results.obsoleteFiles.map(file => 
    `- **${file.name}** (${file.type})
  - Path: \`${file.path}\`
  - Reason: ${file.reason}`
).join('\n\n')}

## Retained Files

${results.retainedFiles.map(file => 
    `- **${file.name}**
  - Path: \`${file.path}\`
  - Reason: ${file.reason}`
).join('\n\n')}

${results.errors.length > 0 ? `## Errors

${results.errors.map(error => `- ${error}`).join('\n')}` : ''}

## Next Steps

1. **Review Retained Files**: Check if retained files need updates for v3.0 architecture
2. **Update References**: Update any broken references to removed files  
3. **Create Missing Docs**: Identify and create any missing documentation for new v3.0 features
4. **Validate Links**: Check all internal documentation links

---
*Generated by Documentation Cleanup Script v3.0.0*
`;

    const reportPath = path.join(process.cwd(), 'docs-cleanup-report.md');
    await fs.writeFile(reportPath, reportContent);
    console.log(`📊 Cleanup report saved to: ${reportPath}`);
}

async function createUpdatedDocumentationIndex(docsDir, retainedFiles) {
    const indexContent = `# Claude Code Router Documentation

## Current Documentation (v3.0 Architecture)

This documentation reflects the current v3.0 architecture refactoring state and provides comprehensive guides for developers and users.

## Core Documentation

${retainedFiles
  .filter(file => file.name.endsWith('.md'))
  .map(file => `- [${file.name.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}](${file.name})`)
  .join('\n')}

## Configuration Examples

${retainedFiles
  .filter(file => file.name.endsWith('.json'))
  .map(file => `- [${file.name}](${file.name})`)
  .join('\n')}

## Architecture Status

- **Current Production**: v2.7.0 (Stable)
- **Development Branch**: v3.0.0 (Refactoring)
- **Architecture**: Six-layer plugin architecture
- **Documentation Status**: Active maintenance

## Documentation Guidelines

1. **Current Architecture Focus**: All documentation should reflect v3.0 architecture
2. **Zero-Fallback Principle**: Documentation must not include fallback mechanisms
3. **Preprocessing-Only Changes**: Provider modifications limited to preprocessing layer
4. **Comprehensive Testing**: All documented features must include test coverage

---
*Last Updated: ${new Date().toISOString()}*
*Documentation Version: 3.0.0*
`;

    const indexPath = path.join(docsDir, 'README.md');
    await fs.writeFile(indexPath, indexContent);
    console.log(`📚 Updated documentation index created: ${path.relative(process.cwd(), indexPath)}`);
}

// Execute cleanup if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    cleanupObsoleteDocs()
        .then(results => {
            console.log('\n================================================================');
            console.log('🎯 Documentation cleanup completed successfully!');
            console.log(`📊 Results: ${results.obsoleteFiles.length} removed, ${results.retainedFiles.length} retained`);
            
            if (results.errors.length > 0) {
                console.log(`⚠️ Errors encountered: ${results.errors.length}`);
                process.exit(1);
            } else {
                process.exit(0);
            }
        })
        .catch(error => {
            console.error('💥 Cleanup failed:', error);
            process.exit(1);
        });
}

export { cleanupObsoleteDocs };