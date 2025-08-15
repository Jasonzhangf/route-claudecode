# Claude Code Router v4.0 - 强制项目执行规范

## 🚨 强制执行指令 - 不可违反 (MANDATORY COMPLIANCE)

⚠️ **AI开发者必须严格遵循**: 本项目采用严格的任务驱动开发模式，所有开发工作必须按照`tasks.md`中的任务计划执行。违反者将被拒绝继续工作。

### 📋 强制执行的开发流程 (MANDATORY DEVELOPMENT WORKFLOW)

#### 1. **任务执行前检查 (PRE-TASK VALIDATION)**
在开始任何开发工作前，必须：
- [ ] 检查`tasks.md`中的任务状态和依赖关系
- [ ] 确认前置任务已100%完成且测试通过
- [ ] 验证当前任务的验收标准和测试要求
- [ ] 更新任务状态为"🚧 进行中"

#### 2. **开发过程约束 (DEVELOPMENT CONSTRAINTS)**
开发过程中必须：
- [ ] **零代码重复**: 检查examples目录下的参考实现，复用可用组件
- [ ] **接口优先**: 根据`.claude/project-details/`中的设计文档定义接口
- [ ] **测试驱动**: 先写测试，再写实现代码
- [ ] **实时文档**: 同步更新代码注释和设计文档

#### 3. **完成前验证 (PRE-COMPLETION VALIDATION)**
任务完成前必须：
- [ ] **单元测试**: 达到80%+代码覆盖率
- [ ] **真实API测试**: 与LM Studio进行真实API调用测试
- [ ] **性能基准**: 满足延迟(<100ms)和内存(<200MB)要求
- [ ] **集成测试**: 通过端到端流水线测试
- [ ] **更新文档**: 同步更新相关设计文档和API文档

#### 4. **任务完成确认 (TASK COMPLETION CONFIRMATION)**
完成任务时必须：
- [ ] 在`tasks.md`中更新任务状态为"✅ 已完成"
- [ ] 记录测试报告和API响应数据
- [ ] 提交代码审查请求
- [ ] 更新下一个任务的前置条件

### 🎯 项目总体目标 (PROJECT OBJECTIVES)

#### **核心目标**: 构建Claude Code Router v4.0
一个高性能、可扩展的多AI提供商路由转换系统，支持：
- **主要协议**: OpenAI兼容接口（优先LM Studio）
- **核心功能**: 请求路由、格式转换、负载均衡、错误处理
- **质量标准**: 零fallback、零静默失败、<100ms延迟
- **可扩展性**: 插件化架构，支持动态添加新的AI Provider

#### **开发优先级**: 渐进式实现策略
1. **Phase 1-2**: 核心架构和CLI系统 (Week 1-2)
2. **Phase 3-4**: LM Studio路由和流水线 (Week 3-4)  
3. **Phase 5-6**: Debug系统和性能优化 (Week 5-6)
4. **Phase 7+**: 扩展其他Provider (Anthropic/OpenAI/Gemini)

### 🔧 技术实现要求 (TECHNICAL REQUIREMENTS)

#### **架构约束 (ARCHITECTURE CONSTRAINTS)**
- **模块化设计**: 11模块标准流水线架构
- **接口标准**: 严格按照`.claude/project-details/rcc-v4-specification.md`
- **零硬编码**: 所有配置通过配置文件管理
- **类型安全**: 使用TypeScript，严格类型检查

#### **质量标准 (QUALITY STANDARDS)**
- **代码覆盖率**: 单元测试80%+，集成测试90%+，端到端100%
- **性能基准**: 响应延迟<100ms，内存使用<200MB
- **错误处理**: 零静默失败，完整错误链追踪
- **日志记录**: 结构化日志，支持调试和监控

#### **测试要求 (TESTING REQUIREMENTS)**
```typescript
// 每个任务必须包含以下测试类型：

// 1. 单元测试示例
describe('RouterModule', () => {
  it('should route request to correct provider', async () => {
    // 测试代码
  });
});

// 2. 真实API测试示例  
describe('LMStudio Integration', () => {
  it('should complete real API call within 100ms', async () => {
    const response = await router.route({
      provider: 'lmstudio',
      model: 'llama-3.1-8b',
      messages: [/* 测试消息 */]
    });
    expect(response.latency).toBeLessThan(100);
  });
});

// 3. 端到端测试示例
describe('End-to-End Pipeline', () => {
  it('should process complete request pipeline', async () => {
    // 完整流水线测试
  });
});
```

### 📊 进度跟踪和报告 (PROGRESS TRACKING)

#### **每日进度报告模板**
```markdown
## 日期: YYYY-MM-DD
### 当前任务: [任务ID] 任务名称
- **状态**: 🚧 进行中 / ✅ 已完成 / ❌ 阻塞
- **完成度**: X%
- **今日工作**: 具体完成的工作内容
- **测试结果**: 单元测试X个通过，API测试X个通过
- **遇到问题**: 具体问题描述和解决方案
- **明日计划**: 下一步工作计划
```

#### **任务状态更新要求**
在`tasks.md`中实时更新任务状态：
- **⏳ 待开始**: 任务尚未开始
- **🚧 进行中**: 任务正在进行
- **✅ 已完成**: 任务已完成并通过所有测试
- **❌ 阻塞**: 任务遇到阻塞，需要解决
- **🔄 重做**: 任务需要重新执行

### 🔍 参考实现指南 (REFERENCE IMPLEMENTATION GUIDE)

#### **Examples目录结构和用途**
```
examples/
├── demo1/          # TypeScript实现参考 - 中间件和路由逻辑
├── demo2/          # Go语言实现参考 - SSE解析和并发处理  
├── demo3/          # JavaScript实现参考 - Provider策略模式
└── lmstudio-reference-pipeline.ts  # LM Studio专用流水线参考
```

#### **参考实现复用策略**
1. **demo1**: 借鉴中间件架构和路由策略实现
2. **demo2**: 参考SSE流解析和错误处理逻辑
3. **demo3**: 学习Provider策略模式和适配器设计
4. **lmstudio-pipeline**: 直接复用LM Studio集成逻辑

### ⚠️ 违规处理机制 (VIOLATION HANDLING)

#### **自动拒绝条件**
以下行为将导致开发工作被自动拒绝：
- 未检查`tasks.md`任务状态就开始编码
- 跳过测试要求或使用mock代替真实API测试
- 未更新任务进度和文档
- 违反架构设计约束
- 提交未通过质量检查的代码

#### **质量控制检查清单**
在每次提交前，必须通过以下检查：
- [ ] 代码符合TypeScript严格模式要求
- [ ] 单元测试覆盖率达到80%+
- [ ] 真实API测试全部通过
- [ ] 性能基准测试达标
- [ ] 代码注释和文档完整
- [ ] 任务状态和进度已更新

### 🎯 成功标准 (SUCCESS CRITERIA)

#### **阶段性里程碑**
- **Week 1**: 核心架构和CLI基础完成
- **Week 2**: 配置系统和模块管理实现
- **Week 3**: LM Studio路由器核心功能
- **Week 4**: 完整的LM Studio流水线集成
- **Week 5**: Debug系统和监控实现
- **Week 6**: 性能优化和最终测试

#### **最终交付标准**
- **功能完整性**: 支持LM Studio的完整请求-响应流水线
- **性能达标**: 平均响应时间<100ms，并发支持100+请求
- **质量保证**: 零已知bug，100%端到端测试覆盖
- **文档完整**: 完整的API文档、部署指南和用户手册
- **可扩展性**: 支持快速添加新的AI Provider

---

## 📋 当前任务执行状态

**查看详细任务计划**: [tasks.md](./tasks.md)

**当前阶段**: Phase 1 - 核心架构设计与实现

**下一个任务**: 请查阅`tasks.md`确定当前需要执行的任务

---

**⚠️ 重要提醒**: 本项目采用严格的质量控制标准。任何偷工减料或跳过测试的行为都将导致工作被拒绝。请严格按照任务计划和质量要求执行开发工作。