# Design Document

## Overview

This design outlines the migration of the comprehensive rule system from the `.claude` directory to Kiro's steering system. The migration will transform Claude-specific rules into Kiro-compatible steering documents while preserving the essential governance and quality assurance mechanisms.

The design follows Kiro's steering system architecture, which supports:
- Always included steering files (default behavior)
- Conditionally included files based on file matching patterns
- Manual inclusion via context keys
- File references using `#[[file:<relative_file_name>]]` syntax

## Architecture

### Steering Document Structure

The steering system will be organized into the following hierarchy:

```
.kiro/steering/
├── core-programming-rules.md          # Always included - Core programming standards
├── architecture-design-rules.md       # Always included - System architecture rules
├── testing-framework-rules.md         # Always included - Testing methodology
├── memory-management-rules.md          # Always included - Memory system rules
├── project-architecture-overview.md   # Always included - High-level system overview
├── provider-implementation-guide.md   # Conditional - When working with providers
├── routing-system-guide.md            # Conditional - When working with routing
├── logging-system-guide.md            # Conditional - When working with logging
├── patch-system-guide.md              # Conditional - When working with patches
└── compliance-verification.md         # Always included - Quality assurance
```

### Document Categories

#### 1. Always Included Documents
These documents contain fundamental rules that apply to all development work:
- Core programming rules (zero hardcoding, bacterial programming)
- Architecture design principles
- Testing framework requirements
- Memory management protocols
- Compliance verification checklists

#### 2. Conditionally Included Documents
These documents are included when working with specific system components:
- Provider implementation guide (when files match `src/providers/**`)
- Routing system guide (when files match `src/routing/**`)
- Logging system guide (when files match `src/logging/**`)
- Patch system guide (when files match `src/patches/**`)

#### 3. Referenced Architecture Documents
Key architecture documents will be referenced using the `#[[file:...]]` syntax to include detailed technical specifications without duplicating content.

## Components and Interfaces

### Core Programming Rules Component

**Purpose**: Enforce fundamental programming standards
**Content**: 
- Zero hardcoding principles
- Zero fallback mechanisms
- Bacterial programming methodology
- Code quality checklists

**Interface**: Always included, provides mandatory compliance rules

### Architecture Design Rules Component

**Purpose**: Maintain system architecture integrity
**Content**:
- Six-layer architecture design
- Cross-node coupling constraints
- Provider interface standards
- Routing mechanism principles

**Interface**: Always included, enforces architectural decisions

### Memory Management Component

**Purpose**: Ensure knowledge preservation and retrieval
**Content**:
- Project memory directory paths
- Memory consultation workflows
- Experience recording requirements
- ADR (Architecture Decision Record) standards

**Interface**: Always included, mandates memory operations

### Conditional Guidance Components

**Purpose**: Provide specific guidance for system components
**Content**: Detailed implementation guides for specific subsystems
**Interface**: Included based on file matching patterns

## Data Models

### Steering Document Model

```typescript
interface SteeringDocument {
  frontMatter: {
    inclusion: 'always' | 'fileMatch' | 'manual';
    fileMatchPattern?: string;
    contextKey?: string;
    priority: number;
  };
  content: {
    rules: Rule[];
    guidelines: Guideline[];
    references: FileReference[];
    checklists: ComplianceChecklist[];
  };
}
```

### Rule Model

```typescript
interface Rule {
  id: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2';  // P0 = immediate rejection
  description: string;
  enforcement: 'mandatory' | 'recommended';
  violationConsequence: string;
  examples: {
    correct: string[];
    incorrect: string[];
  };
}
```

### File Reference Model

```typescript
interface FileReference {
  path: string;
  description: string;
  relevantSections?: string[];
}
```

## Error Handling

### Rule Violation Handling

1. **P0 Violations (Immediate Rejection)**
   - Hardcoding detection
   - Fallback mechanism usage
   - Silent failure patterns
   - Cross-node coupling

2. **P1 Violations (Mandatory Consultation)**
   - Architecture violations
   - Missing memory consultation
   - Test skipping
   - Documentation gaps

3. **P2 Violations (Warning and Correction)**
   - Naming convention issues
   - Missing comments
   - Performance concerns

### Error Response Format

```typescript
interface RuleViolationError {
  violationType: 'P0' | 'P1' | 'P2';
  ruleId: string;
  description: string;
  requiredAction: string;
  relevantDocument: string;
  section: string;
}
```

## Testing Strategy

### Document Validation Testing

1. **Content Consistency Tests**
   - Verify all rules from `.claude` are properly migrated
   - Check for conflicting rules across documents
   - Validate file reference integrity

2. **Inclusion Logic Tests**
   - Test always-included documents are loaded
   - Verify conditional inclusion patterns work correctly
   - Test file matching patterns

3. **Reference Resolution Tests**
   - Verify `#[[file:...]]` references resolve correctly
   - Test circular reference detection
   - Validate reference path accuracy

### Integration Testing

1. **AI Assistant Compliance Tests**
   - Test rule enforcement during code generation
   - Verify memory consultation requirements
   - Test architectural constraint enforcement

2. **Workflow Integration Tests**
   - Test steering integration with Kiro's spec workflow
   - Verify compliance verification checkpoints
   - Test error handling and rejection mechanisms

### Performance Testing

1. **Document Loading Performance**
   - Measure steering document loading time
   - Test memory usage with large rule sets
   - Verify conditional loading efficiency

2. **Rule Processing Performance**
   - Measure rule evaluation time
   - Test compliance checking performance
   - Verify scalability with multiple documents

## Implementation Phases

### Phase 1: Core Document Migration
- Migrate core programming rules
- Migrate architecture design rules
- Migrate memory management rules
- Set up basic compliance verification

### Phase 2: Conditional Document Setup
- Create provider implementation guide
- Create routing system guide
- Create logging system guide
- Create patch system guide
- Configure file matching patterns

### Phase 3: Reference Integration
- Set up file references to detailed architecture documents
- Integrate with existing project documentation
- Create cross-reference navigation

### Phase 4: Validation and Testing
- Implement comprehensive testing suite
- Validate rule enforcement mechanisms
- Test integration with Kiro workflows
- Performance optimization

## Migration Strategy

### Content Transformation Rules

1. **Rule Priority Mapping**
   - Claude "绝对禁令" → Kiro P0 violations
   - Claude "强制查阅" → Kiro P1 violations
   - Claude "警告纠正" → Kiro P2 violations

2. **Language Adaptation**
   - Convert Chinese content to English where appropriate
   - Maintain technical precision
   - Adapt Claude-specific references to Kiro context

3. **Structure Standardization**
   - Convert to consistent Markdown format
   - Standardize section headers
   - Normalize code examples

### Validation Criteria

1. **Completeness**: All essential rules from `.claude` are preserved
2. **Consistency**: No conflicting rules across documents
3. **Accessibility**: Clear navigation and findable content
4. **Enforceability**: Rules are specific and actionable
5. **Performance**: Efficient loading and processing