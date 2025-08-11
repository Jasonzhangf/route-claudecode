# Provider-Protocol Naming Migration Plan

## 📋 Migration Overview
**Created**: 2025-08-11  
**Status**: Planning Phase  
**Priority**: Medium (Non-Breaking)  

## 🎯 Objective
Clarify the naming convention between "Provider" (third-party services) and "Provider-Protocol" (our protocol implementations) throughout the codebase while maintaining backward compatibility.

## 📝 Current State Analysis

### ✅ Documentation Updates Completed
- [x] CLAUDE.md updated with new terminology
- [x] .kiro requirements and design documents updated  
- [x] .kiro tasks updated with new terminology
- [x] Project-details documentation updated
- [x] Added naming convention clarification section

### 🔍 Current Code Structure
```
src/provider/                    # Current directory (Provider-Protocol implementations)
├── anthropic/                  # Anthropic Provider-Protocol
├── openai/                     # OpenAI Provider-Protocol  
├── gemini/                     # Gemini Provider-Protocol
├── codewhisperer/              # CodeWhisperer Provider-Protocol
└── base-provider.ts            # Base Provider-Protocol class
```

### 📋 Configuration Structure (Correct)
```json
{
  "providers": {
    "shuaihong-openai": {        // Third-party Provider name
      "type": "openai"           // Provider-Protocol type
    }
  }
}
```

## 🚦 Migration Strategy Options

### Option 1: Gradual Documentation-First Migration (Recommended) ✅
- **Phase 1**: Documentation updates (COMPLETED)
- **Phase 2**: Update comments and variable names in code
- **Phase 3**: Consider directory rename in v3.0 refactor
- **Benefits**: Non-breaking, maintains compatibility
- **Timeline**: Implement with regular development cycles

### Option 2: Immediate Code Structure Update
- **Action**: Rename `src/provider/` → `src/provider-protocol/`
- **Impact**: Breaking changes, requires import updates
- **Risk**: High - affects all module imports
- **Not Recommended**: Too disruptive for current v2.7.0

## 🎯 Recommended Implementation Plan

### Phase 1: Comment and Variable Updates ⏳
```typescript
// Before
export class BaseProvider implements ProviderClient

// After  
export class BaseProviderProtocol implements ProviderProtocolClient
// OR maintain class name but update comments
export class BaseProvider implements ProviderClient {
  // Provider-Protocol base class for different AI service protocols
}
```

### Phase 2: Type Definitions and Interfaces
```typescript
// Update interface names in v3.0
interface ProviderProtocolClient {
  // Provider-Protocol specific methods
}

interface ThirdPartyProvider {
  // Third-party service provider configuration
}
```

### Phase 3: v3.0 Architecture Integration
- Implement proper directory structure in v3.0:
  ```
  src/v3/provider-protocols/     # New v3.0 structure
  ├── anthropic/
  ├── openai/
  └── gemini/
  ```

## ⚠️ Important Considerations

### Backward Compatibility
- Keep existing directory names in v2.7.0
- Update only documentation and comments initially
- Plan structural changes for v3.0 refactor

### Configuration Stability  
- Configuration format remains unchanged
- `"type": "openai"` continues to work
- Provider names in config represent third-party services

### Team Communication
- Ensure team understands new terminology
- Update onboarding documentation
- Clarify in code reviews and discussions

## ✅ Current Status

### Completed ✅
1. **Documentation Updates**: All project documentation updated with correct terminology
2. **Kiro Integration**: Requirements, design, and tasks updated
3. **Naming Clarification**: Added detailed explanation in CLAUDE.md
4. **Configuration Examples**: Updated all examples to show correct usage

### Next Steps 📋
1. **Code Comments**: Update inline comments to reflect Provider-Protocol terminology
2. **Variable Names**: Gradually update variable names in new code
3. **v3.0 Planning**: Include proper directory structure in v3.0 refactor
4. **Team Training**: Ensure consistent usage of new terminology

## 🎯 Success Criteria
- [x] Clear documentation distinguishes Provider vs Provider-Protocol
- [x] Configuration examples show correct relationship
- [x] Project architecture diagrams updated
- [ ] Code comments reflect new terminology (Future)
- [ ] v3.0 structure uses correct directory names (Future)

---
**Owner**: Jason Zhang  
**Last Updated**: 2025-08-11  
**Next Review**: During v3.0 refactor planning