/**
 * Claude Code Router Scripts Directory
 * 
 * This directory contains utility scripts for managing and maintaining
 * the Claude Code Router project.
 * 
 * ## Available Scripts
 * 
 * ### 1. discover-provider-models.js (v1.0)
 * Basic model discovery and configuration update script.
 * 
 * **Features:**
 * - Batch testing of common models
 * - Automatic config file updates
 * - Basic backup functionality
 * 
 * **Usage:**
 * ```bash
 * # Test single provider configuration
 * node scripts/discover-provider-models.js
 * 
 * # Test multi-provider configuration
 * node scripts/discover-provider-models.js --multi-provider
 * ```
 * 
 * ### 2. discover-provider-models-v2.js (v2.0)
 * Enhanced model discovery and configuration update script.
 * 
 * **Features:**
 * - Enhanced automatic backup system
 * - Project memory integration
 * - Automatic model discovery and testing
 * - Advanced logging system
 * - Detailed change tracking
 * 
 * **Usage:**
 * ```bash
 * # Test single provider configuration
 * node scripts/discover-provider-models-v2.js
 * 
 * # Test multi-provider configuration
 * node scripts/discover-provider-models-v2.js --multi-provider
 * ```
 * 
 * **Enhanced Features in v2.0:**
 * 
 * #### Automatic Backup System
 * - Creates timestamped backup directories
 * - Copies original config files before modifications
 * - Preserves backup history with configurable retention
 * 
 * #### Project Memory Integration
 * - Saves execution reports to project memory
 * - Creates markdown documentation with detailed results
 * - Tracks execution history and outcomes
 * - Provides audit trail for configuration changes
 * 
 * #### Automatic Model Testing
 * - After discovery, automatically tests available models
 * - Performs real API calls to verify functionality
 * - Provides success/failure statistics
 * 
 * #### Enhanced Logging System
 * - Structured logging with timestamps
 * - Color-coded log levels (INFO, WARN, ERROR, SUCCESS)
 * - JSON-formatted detailed logs
 * 
 * ## Configuration Files
 * 
 * ### Single Provider Configuration
 * Path: `/Users/fanzhang/.route-claude-code/config/single-provider/config-openai-shuaihong-5508.json`
 * 
 * ### Multi-Provider Configuration  
 * Path: `/Users/fanzhang/.route-claude-code/config/load-balancing/config-multi-openai-full.json`
 * 
 * ## Backup System
 * 
 * ### Backup Directory Structure
 * ```
 * /Users/fanzhang/.route-claude-code/config-backups/
 * ├── YYYY-MM-DD_HH-MM-SS/
 * │   ├── config-openai-shuaihong-5508.json
 * │   └── config-multi-openai-full.json
 * └── ...
 * ```
 * 
 * ### Backup Features
 * - Automatic timestamp-based directory creation
 * - Complete config file duplication
 * - No compression or modification of original files
 * - Easy restore by copying files back
 * 
 * ## Project Memory
 * 
 * ### Memory Storage Location
 * Path: `/Users/fanzhang/.claudecode/Users-fanzhang-Documents-github-claude-code-router/`
 * 
 * ### Memory File Format
 * - Markdown format with structured sections
 * - Timestamp-based filenames
 * - Detailed execution reports and analysis
 * 
 * ### Memory Content Sections
 * - Executive summary
 * - Detailed results
 * - Configuration updates
 * - Issues discovered
 * - Recommendations for follow-up
 * 
 * ## Model Testing
 * 
 * ### Tested Model Categories
 * - OpenAI Compatible Models (GPT, Claude, Gemini, GLM, Qwen, etc.)
 * - Gemini Native Models
 * - Anthropic Models
 * - Common Open Source Models
 * 
 * ### Testing Methodology
 * 1. **Availability Test**: Basic model existence and accessibility
 * 2. **Functionality Test**: Simple API call with math problem
 * 3. **Response Validation**: Verify correct response format
 * 4. **Error Classification**: Categorize different failure types
 * 
 * ### Test Payload
 * ```json
 * {
 *   "model": "model-name",
 *   "messages": [{"role": "user", "content": "What is 2+2? Answer with just the number."}],
 *   "max_tokens": 10,
 *   "temperature": 0.1
 * }
 * ```
 * 
 * ## Common Issues and Solutions
 * 
 * ### Authentication Issues
 * **Symptoms:** 401 Unauthorized errors
 * **Solutions:** Check API keys, ensure proper Authorization header
 * 
 * ### Model Availability Issues
 * **Symptoms:** 404 Not Found or 400 Bad Request errors
 * **Solutions:** Update model lists, check provider model catalog
 * 
 * ### Rate Limiting Issues
 * **Symptoms:** 429 Too Many Requests errors
 * **Solutions:** Reduce concurrent requests, add delays between tests
 * 
 * ### Network Connectivity Issues
 * **Symptoms:** Connection timeout or DNS resolution errors
 * **Solutions:** Check network connectivity, verify endpoint URLs
 * 
 * ### Configuration Syntax Issues
 * **Symptoms:** JSON parsing errors or invalid config structure
 * **Solutions:** Validate JSON syntax, check required fields
 * 
 * ## Best Practices
 * 
 * ### Running Scripts
 * 1. **Backup First**: Always ensure backups exist before running
 * 2. **Test Environment**: Test in staging before production
 * 3. **Monitor Results**: Review logs and reports after execution
 * 4. **Rollback Plan**: Have a rollback plan for configuration changes
 * 
 * ### Maintenance
 * 1. **Regular Updates**: Run discovery script weekly or bi-weekly
 * 2. **Cleanup**: Remove old backups periodically (keep last 10)
 * 3. **Documentation**: Update this README when adding new scripts
 * 
 * ### Security
 * 1. **API Key Protection**: Ensure scripts don't log sensitive keys
 * 2. **Backup Security**: Store backups in secure location
 * 3. **Access Control**: Limit script execution to authorized personnel
 * 
 * ## Troubleshooting
 * 
 * ### Script Fails to Start
 * - Check Node.js version (requires 14+)
 * - Verify script permissions (chmod +x)
 * - Check for missing dependencies
 * 
 * ### Configuration File Not Found
 * - Verify config file paths in script
 * - Check file permissions
 * - Ensure config files exist at expected locations
 * 
 * ### Network Timeouts
 * - Increase TIMEOUT constant in script
 * - Check network connectivity
 * - Verify endpoint URLs are accessible
 * 
 * ### Memory/Project Issues
 * - Verify project memory directory exists
 * - Check write permissions for memory location
 * - Ensure sufficient disk space
 * 
 * ## Future Enhancements
 * 
 * ### Planned Features
 * - [ ] Support for additional provider types
 * - [ ] Parallel execution across multiple config files
 * - [ ] Email/SMS notifications for failures
 * - [ ] Web dashboard for manual model management
 * - [ ] Integration with CI/CD pipelines
 * - [ ] Performance metrics and trending
 * 
 * ### Technical Debt
 * - [ ] Extract hardcoded paths to configuration
 * - [ ] Add unit tests for script functions
 * - [ ] Implement better error handling
 * - [ ] Add script version management
 * 
 * ---
 * 
 * **Last Updated**: 2025-08-05
 * **Version**: 2.0
 * **Maintainer**: Jason Zhang
 */