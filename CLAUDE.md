# CLAUDE.md - RCC v4.0 项目开发指引

This file provides essential guidance for Claude Code when working with this RCC v4.0 repository. **Critical rules are embedded directly - detailed specifications and project context are in `.claude/` directory.**

## 🎯 Project Overview

**RCC v4.0** is a modular AI provider router with six-layer pipeline architecture. It converts Anthropic requests to OpenAI format and routes to multiple AI providers (LM Studio, Qwen, etc.).

**Key Architecture**: Client ↔ Router ↔ Pipeline ↔ Transformer ↔ Protocol ↔ Server  
**Core Principle**: Zero hardcoding, zero silent failures, TypeScript-only, zero cross-provider fallback

**🚨 P0级规则 (违反立即拒绝)**: 见下方Critical Rules部分  
**📋 详细规则**: `.claude/rules/README.md`          | **快速参考**: `.claude/rules/quick-reference.md`  
**📖 项目规格**: `.claude/project-details/rcc-v4-specification.md` | **模块文档**: `.claude/project-details/modules/README.md`

## 🚨 Critical Rules (P0 - Immediate Rejection)

### **Absolute Prohibitions (违反立即拒绝)**
- **❌ Zero Hardcoding**: No hardcoded URLs, ports, API keys, model names, credentials
- **❌ Zero Silent Failures**: All errors must be handled by ErrorHandler and re-thrown
- **❌ Zero Mockup Responses**: No fake data, placeholder responses, or mock outputs
- **❌ Zero Mock Testing**: All tests must use real pipelines and actual data
- **❌ Zero Cross-Module Processing**: Strict module boundaries - no direct cross-module logic
- **❌ Zero Cross-Provider Fallback**: No fallback between different AI providers

### **Mandatory Requirements (强制要求)**
- **✅ Configuration-Driven**: All parameters from config files only
- **✅ TypeScript-Only**: 100% TypeScript, no JavaScript files allowed
- **✅ Zero TypeScript Errors**: No compilation errors, type coverage ≥95%
- **✅ Real Pipeline Testing**: All tests use actual compiled modules and real data
- **✅ Standard Interfaces**: Module communication through defined interfaces only
- **✅ Comprehensive Error Handling**: All errors properly propagated and logged
- **✅ Fail-Fast Behavior**: Immediate error propagation, no silent degradation

## 📋 Development Pre-Check (Mandatory)

**Before any development:**
```bash
# 1. Check current module documentation
ls .claude/project-details/modules/[target-module]/README.md

# 2. Review architecture specification  
cat .claude/project-details/rcc-v4-specification.md

# 3. Understand your module's role
cat .claude/rules/quick-reference.md  # See "六层架构速览" section

# 4. Review critical policies
cat .claude/rules/typescript-only-policy.md
cat .claude/rules/zero-fallback-policy.md
```

**You MUST be able to answer:**
- [ ] What is my module's single responsibility in the six-layer architecture?
- [ ] What are my exact input/output interfaces?
- [ ] Which modules do I depend on and how do I communicate with them?
- [ ] How should errors be handled in my module?
- [ ] How do I ensure TypeScript-only compliance?
- [ ] How do I avoid fallback mechanisms?

**Mandatory Compliance Checks:**
```bash
# TypeScript-only check
bash .claude/rules/scripts/typescript-only-check.sh

# Zero-fallback compliance check
bash .claude/rules/scripts/automated-compliance-check.sh

# Hardcoding violation check
./scripts/check-hardcoding.sh
```

## 🏗 Project Architecture Overview

### Six-Layer Pipeline Architecture
```
Client ↔ Router ↔ Pipeline ↔ Debug/Config/Types
         │         │
         │         ├── Transformer      # Anthropic ↔ Protocol conversion
         │         ├── Protocol          # Protocol control and streaming
         │         ├── Server-Compatibility  # Third-party server adaptation
         │         └── Server           # AI provider communication
```

### Core Module Responsibilities
- **Config**: Configuration preprocessing and validation (one-time `preprocess()` method only)
- **Router**: Request routing and pipeline configuration generation
- **Pipeline**: Dynamic assembly and management of processing pipelines
- **Bootstrap**: System startup coordination and pipeline assembly reporting
- **Self-Check**: Health monitoring including OAuth error detection and API key validation
- **HTTP Server**: Request handling with support for both Anthropic and OpenAI endpoints

### Pipeline Architecture
- **Six-Layer Design**: Each request flows through 6 distinct processing layers
- **Dynamic Assembly**: Pipelines are assembled at startup based on configuration
- **Provider Agnostic**: Same architecture works for all AI providers
- **Module Registry**: Static registration of all available modules

## Development Commands

### Build and Compilation
```bash
# Compile TypeScript to JavaScript
npm run build

# Check for TypeScript errors without compiling
npm run build -- --noEmit
```

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:pipeline-startup
npm run test:individual-pipeline
npm run test:basic
npm run test:tools
npm run test:streaming

# Run individual test file
npx jest src/__tests__/core-transformer.test.ts --verbose

# Generate comparison reports
npm run test:compare
```

### Development Workflow
```bash
# Start development server
npm start:test

# Run with specific configuration
npx ts-node src/index.ts --config ~/.route-claudecode/config.json --port 5506
```

## Key Design Principles

### **Zero-Fallback Policy (零Fallback策略)**
- **Policy**: No cross-provider fallback mechanisms
- **Allowed**: Same-provider load balancing and pipeline scheduling only
- **Behavior**: Fail-fast for all provider failures and misconfigurations
- **Details**: `.claude/rules/zero-fallback-policy.md`

### **TypeScript-Only Enforcement (TypeScript-Only强制政策)**
- **Policy**: 100% TypeScript development required
- **Prohibited**: No JavaScript files or modification
- **Standards**: Zero TypeScript errors, ≥95% type coverage
- **Details**: `.claude/rules/typescript-only-policy.md`

### **Modular Development (模块化开发)**
- **Architecture**: Six-layer pipeline with strict module boundaries
- **Communication**: Well-defined interfaces between modules
- **Independence**: Each module has independent implementation
- **Registry**: Static module registration for performance

### **Security First (安全第一)**
- **Credentials**: Zero hardcoded credentials or configurations
- **Error Handling**: Secure error handling without internal exposure
- **Configuration**: All parameters from encrypted config files only

## Configuration Structure

The system uses a v4 configuration format:
```json
{
  "version": "4.1",
  "Providers": [...],
  "router": {...},
  "server": {...}
}
```

## Testing Architecture

### Test Layers
1. **Preprocessor Tests**: Config and Router preprocessing validation
2. **Pipeline Tests**: Individual pipeline and startup testing
3. **Conversion Tests**: Protocol format conversion verification
4. **Integration Tests**: End-to-end system validation

### Test Output Structure
- `src/__tests__/test-outputs/` contains detailed test results
- JSON reports for pipeline configurations and validation
- Performance metrics and error analysis

## Debug and Monitoring

### Debug System
- Module-specific debug integration
- Session-based logging and recording
- Performance metrics collection

### Health Checks
- Pipeline assembly validation
- Module health status monitoring
- System integrity verification

## 📚 Rule Navigation Guide (规则查找指引)

### **Critical Policies (关键政策)**
- **TypeScript-Only强制政策**: `.claude/rules/typescript-only-policy.md`
- **Zero Fallback策略**: `.claude/rules/zero-fallback-policy.md`
- **项目规格书**: `.claude/project-details/rcc-v4-specification.md`

### **Development Rules (开发规则)**
- **编码规则总览**: `.claude/rules/README.md`
- **快速参考卡**: `.claude/rules/quick-reference.md` (P0级红线速查)
- **编程规则**: `.claude/rules/programming-rules.md`
- **架构规则**: `.claude/rules/architecture-rules.md`
- **测试规则**: `.claude/rules/testing-rules.md`

### **Module Documentation (模块文档)**
- **模块总览**: `.claude/project-details/modules/README.md`
- **特定模块文档**: `.claude/project-details/modules/[module-name]/README.md`
- **接口定义**: 参见各模块README中的接口定义部分

### **Automated Compliance (自动化合规检查)**
```bash
# 强制合规检查脚本
.claude/rules/scripts/typescript-only-check.sh     # TypeScript-only检查
.claude/rules/scripts/automated-compliance-check.sh # 自动化合规检查
.claude/rules/scripts/dist-protection.sh           # 编译文件保护
.claude/rules/validate-rules.sh                    # 规则验证
```

### **Quick Reference (快速参考)**
- **Architecture**: Six-layer pipeline - Client → Router → Pipeline → Transformer → Protocol → Server
- **Build Command**: `npm run build` (TypeScript compilation)
- **Test Command**: `npm run test:pipeline-startup` (real pipeline testing)
- **Policy Check**: `bash .claude/rules/scripts/typescript-only-check.sh`
- **Compliance**: All P0 rules must pass before any commit

### Definition of Done
- All TypeScript compilation passes (0 errors)
- Unit tests achieve 80%+ coverage with real pipelines
- Integration tests pass with actual data
- Zero P0 rule violations (hardcoding, silent failures, etc.)
- TypeScript-only compliance verified
- Performance benchmarks met (<100ms latency)
- Comprehensive error handling implemented

### Code Standards
- Zero-interface-exposure design pattern
- Strict separation of concerns and module boundaries
- Comprehensive error handling with re-throwing
- Detailed logging and monitoring
- Configuration-driven parameter management