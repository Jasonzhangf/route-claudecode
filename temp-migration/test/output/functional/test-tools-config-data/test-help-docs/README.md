# Claude Code Router v3.0 - Tools Ecosystem Help

## Overview
Comprehensive tools ecosystem for Claude Code Router v3.0 with 5 integrated tools providing data processing, visualization, monitoring, and configuration management capabilities.

## Available Tools by Category


### Data-processing
- **log-parser**: Provider-protocol-classified data extraction from logs


### Visualization
- **timeline-visualizer**: Interactive API timeline visualization with multi-provider support


### Monitoring
- **finish-reason-tracker**: Comprehensive finish reason logging and pattern analysis
- **configuration-dashboard**: Web-based real-time configuration monitoring dashboard


### Configuration
- **dynamic-config-manager**: Real-time configuration management with validation and rollback


## Global Configuration
Configuration file location: `/Users/fanzhang/Documents/github/route-claudecode/test/output/functional/test-tools-config-data/test-tools-config.json`

## Quick Start
```bash
# Show help for any tool
node <tool-path> help

# List all available tools
node tools-config-manager.js list

# Get tool-specific configuration
node tools-config-manager.js config --tool <tool-name>

# Generate fresh help documentation
node tools-config-manager.js generate-docs
```

## Tool Categories

### Data Processing
Tools for log parsing, data extraction, and classification
- Supports multiple provider protocols (Anthropic, OpenAI, Gemini, CodeWhisperer)
- JSON standardization and metadata generation
- Comprehensive data organization and storage

### Visualization  
Interactive visualization tools for API timelines and data analysis
- Multi-colored timeline displays with provider-specific color schemes
- Configurable quantity limits and time range filtering
- Export capabilities (HTML, JSON, CSV)

### Monitoring
Real-time monitoring and alerting systems
- Finish reason tracking and pattern analysis
- Configurable alert thresholds and notification systems
- Historical trend analysis and distribution reporting

### Configuration
Dynamic configuration management and dashboard interfaces
- Real-time configuration updates without service restart
- Web-based monitoring dashboards with system metrics
- Configuration validation, backup, and rollback capabilities

## Configuration Management

All tools share a unified configuration system:
- Central configuration file: `tools-config.json`  
- Environment-specific overrides supported
- Configuration validation and default value management
- Automatic backup and rollback capabilities

## Help System

Each tool provides comprehensive help documentation:
- Command-line `--help` flag support
- Detailed usage examples and configuration options
- Generated markdown documentation files
- Interactive help system with tool discovery

## Support

For tool-specific help:
```bash
node <tool-path> help
```

For configuration management:
```bash  
node tools-config-manager.js help
```

---
*Claude Code Router v3.0 Tools Ecosystem*  
*Generated: 2025-08-11T07:06:31.581Z*  
*Tools: 5 | Categories: 4*
