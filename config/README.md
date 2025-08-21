# Configuration Directory Structure

## Current Active Configuration Format: Demo1

This directory contains configuration files for RCC v4.0. The project has been migrated to use the Demo1 format exclusively.

### Active Configuration Files

- `system-config.json` - System-level configuration
- `demo1-enhanced-config.json` - Template for Demo1 format
- `examples/config.example.json` - Example configuration

### User Configuration Location

Active user configurations are stored in:
`~/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506-demo1-enhanced.json`

### Deprecated/Legacy Files (To Be Removed)

- `test-v3-config.json` - V3 format (deprecated)
- `hybrid-multi-provider-v3-5509.json` - V3 format (deprecated) 
- `hybrid-multi-provider.template.json` - Legacy template
- `unified-config-templates.json` - Multiple format templates (deprecated)
- `user-config-template.json` - Legacy template
- `user-config-with-rules.json` - Legacy format
- `user-config.example.json` - Legacy example
- `simplified-user-config-template.json` - Legacy simplified template
- `test-demo1-enhanced.json` - Test file (should be in tests/)
- `default.json` - Legacy default config

### Migration Notes

RCC v4.0 uses the "zero conversion" principle - configurations are read directly in Demo1 format without any transformations.
