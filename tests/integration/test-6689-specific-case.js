#!/usr/bin/env node

/**
 * Test specific 6689 port case where tool call text was not processed
 * Based on real log data from 2025-08-05T18-53-54
 */

const { AnthropicToolCallTextFixPatch } = require('./dist/patches/anthropic/tool-call-text-fix');

// Real problematic response from logs - this is the EXACT data that should have been patched
const realProblematicData = {
  content: [
    {
      type: 'text',
      text: '\n\n现在我将根据我们讨论的记忆系统架构，更新项目的规则和规范。\nTool call: Edit({"file_path":"/Users/fanzhang/Documents/novel/evolve/project_rules.md","new_string":"# 小说项目《进化》创作系统规范\\n\\n## 1. 项目概述\\n\\n本项目采用AI辅助创作系统，基于GraphRAG和本地记忆压缩引擎，构建了一个完整的\\"智能创作大脑\\"体系。该系统通过分层记忆管理和动态上下文构建，实现小说的自动化、连贯化、风格化生成。\\n\\n## 2. 核心目录结构\\n\\n```\\n/evolve/\\n├── 1_settings/                    # 核心设定目录\\n│   ├── world.md                   # 世界观设定\\n│   ├── characters/                # 人物设定文件夹\\n│   │   └── *.json                # 人物结构化档案\\n│   ├── environments.md            # 环境设定\\n│   ├── memory_system.md           # 记忆系统规则\\n│   └── style_guide.md            # 风格指南\\n├── 2_plot_outlines/              # 情节大纲目录\\n│   └── chapter_*.md              # 章节大纲文件\\n├── 3_drafts_for_review/          # 待审章节草稿\\n│   └── draft_*.md                # 生成但未审阅的章节\\n├── 4_final_chapters/             # 最终成文（不可修改）\\n│   └── chapter_*.md              # 经过审阅的最终章节\\n├── _memory_cache/                # 记忆压缩缓存（自动生成）\\n│   ├── summaries/                # 章节摘要缓存\\n│   ├── relationships/            # 人物关系摘要\\n│   └── temporal_contexts/        # 时间上下文缓存\\n├── _system/                      # 系统配置目录\\n│   ├── graphrag_config.json      # GraphRAG配置\\n│   ├── lmce_config.json          # 本地记忆压缩引擎配置\\n│   └── mcp_tools/                # MCP工具脚本\\n└── project_rules.md              # 本项目规则文档\\n```\\n\\n## 3. 创作风格规范\\n\\n### 3.1 整体风格\\n- **核心风格**：采用猫腻的描写风格，细腻且注重细节\\n- **叙事基调**：注重人物内心世界的刻画，情感描写深刻\\n- **语言特点**：文字优美，节奏感强，善用比喻和意象\\n\\n### 3.2 技术写作风格\\n- **科幻设定**：硬科幻风格，技术描写要严谨可信\\n- **世界观展现**：通过细节和对话自然展现，避免大段说明\\n- **人物塑造**：通过行为、语言和内心活动展现性格\\n\\n## 4. 记忆系统架构\\n\\n### 4.1 分层记忆模型\\n- **长期记忆**：存储在GraphRAG知识库中，包含核心设定、人物档案、历史事件\\n- **中期记忆**：通过本地LM Studio模型动态生成的章节摘要和关系演化\\n- **短期记忆**：会话级别的上下文缓存，当前创作场景的直接相关信息\\n- **模糊背景记忆**：从设定中提取的氛围、基调等背景信息\\n\\n### 4.2 记忆管理规则\\n- **记忆初始化**：首次启动时调用 `novel::memory::initialize()` 构建基础知识库\\n- **记忆更新**：章节移入 `4_final_chapters/` 后自动触发记忆压缩和更新\\n- **记忆压缩**：后台闲时自动进行，通过LM Studio接口调用本地模型\\n- **记忆查询**：创作时通过 `novel::build_temporal_context()` 动态构建上下文\\n\\n### 4.3 记忆压缩策略\\n- **时间分层压缩**：根据章节距离当前场景的时间，进行不同粒度的压缩\\n- **情境感知压缩**：根据创作意图和关注实体，动态调整压缩重点\\n- **自动化执行**：后台守护进程监控文件变化，在系统闲时自动执行压缩\\n\\n## 5. 创作流程规范\\n\\n### 5.1 创作准备阶段\\n1. **设定完善**：在 `1_settings/` 目录下完善所有设定文件\\n2. **记忆初始化**：运行记忆初始化，构建GraphRAG知识库\\n3. **大纲规划**：在 `2_plot_outlines/` 中创建章节大纲\\n\\n### 5.2 章节生成阶段\\n1. **大纲制定**：在 `2_plot_outlines/` 中创建新的大纲文件\\n2. **上下文构建**：系统自动调用 `novel::build_temporal_context()` 构建动态上下文\\n3. **内容生成**：基于动态上下文生成章节内容\\n4. **草稿保存**：自动保存到 `3_drafts_for_review/` 目录\\n\\n### 5.3 章节审阅阶段\\n1. **内容审阅**：人工审阅 `3_drafts_for_review/` 中的草稿\\n2. **修改完善**：根据审阅意见修改草稿\\n3. **最终确认**：确认后将章节移入 `4_final_chapters/` 目录\\n4. **记忆更新**：系统自动检测新章节，触发后台记忆压缩和更新\\n\\n## 6. MCP工具规范\\n\\n### 6.1 核心工具接口\\n- `novel::memory::initialize()` - 记忆系统初始化\\n- `novel::memory::update()` - 记忆系统更新（自动/手动）\\n- `novel::memory::extract_on_demand(query)` - 主动记忆抽取\\n- `novel::build_temporal_context(scene_prompt, current_chapter, focus_entities)` - 动态上下文构建\\n- `novel::write_draft(content, chapter_title)` - 草稿写入\\n\\n### 6.2 本地记忆压缩引擎\\n- **部署方式**：通过LM Studio本地部署\\n- **API接口**：`POST /api/v1/compress`\\n- **调用时机**：后台闲时自动调用，或手动触发\\n- **压缩任务类型**：\\n  - 中期记忆摘要压缩\\n  - 长期记忆核心化\\n  - 模糊背景信息提取\\n\\n## 7. 系统技术架构\\n\\n### 7.1 核心组件\\n- **创作引擎**：Claude Code + MCP Tools\\n- **记忆存储**：GraphRAG (Neo4j)\\n- **记忆压缩**：LM Studio + 本地开源模型\\n- **文件存储**：本地文件系统\\n\\n### 7.2 数据流向\\n1. **设定输入** → `1_settings/` → **GraphRAG初始化**\\n2. **大纲创作** → `2_plot_outlines/` → **上下文构建**\\n3. **内容生成** → `3_drafts_for_review/` → **人工审阅**\\n4. **最终确认** → `4_final_chapters/` → **后台记忆压缩** → **GraphRAG更新**\\n\\n## 8. 维护和更新规范\\n\\n### 8.1 设定更新\\n- 世界观更新：修改 `1_settings/world.md` 后需重新初始化记忆系统\\n- 人物更新：修改 `1_settings/characters/*.json` 后自动触发人物关系更新\\n- 环境更新：修改 `1_settings/environments.md` 后自动触发环境设定更新\\n\\n### 8.2 系统维护\\n- 定期检查GraphRAG知识库的一致性\\n- 定期清理过期的记忆缓存文件\\n- 监控LM Studio服务的运行状态\\n- 备份重要的设定和最终章节文件\\n\\n## 9. 版本控制规范\\n\\n- 所有核心设定文件使用Git进行版本控制\\n- 最终章节文件一旦确认不可修改，确保版本稳定性\\n- 定期创建里程碑版本，保存重要的创作节点\\n\\n## 10. 注意事项\\n\\n- 严格遵循\\"草稿→审阅→最终\\"的三阶段流程\\n- 最终章节一旦确认不可随意修改，确保故事连贯性\\n- 定期备份重要的创作数据\\n- 系统配置文件修改后需重启相关服务\\n- 保持GraphRAG知识库和文件系统的一致性","old_string":"/Doc 目录是基本的目录，里面的文件是项目的基本信息，包括项目的名称、描述、版本、作者、许可证等。我们在这个目录里面记录小说的大纲，人物的信息，以及小说的基本信息。\\n/Chapter 目录是小说的章节，我们在这个目录里面记录小说的每一章。\\n/Image 目录是小说的图片，我们在这个目录里面记录小说的图片。\\n/Style 目录是小说的样式，我们在这个目录里面记录小说的样式。 \\n/Progress 目录是小说的进度，我们在这个目录里面记录小说的进度，基本上是在小说比较长的时候我们会在里面进行前文简介"})'
    }
  ],
  id: '2025080518552635fe03a42f5d4344',
  model: 'ZhipuAI/GLM-4.5',
  role: 'assistant',
  stop_reason: 'end_turn',
  stop_sequence: null,
  type: 'message',
  usage: {
    input_tokens: 0,
    output_tokens: 2066
  }
};

async function testSpecificCase() {
  console.log('🔍 Testing specific 6689 case that SHOULD have been patched');
  console.log('===============================================================');
  
  const patch = new AnthropicToolCallTextFixPatch();
  
  // Test context from actual 6689 case
  const context = {
    provider: 'openai', // 6689 uses modelscope-openai provider
    model: 'ZhipuAI/GLM-4.5',
    requestId: '39886d7f-2e93-40a3-a01a-621c42ac5418',
    port: 6689
  };
  
  console.log('📊 Original data analysis:');
  console.log('- Content blocks:', realProblematicData.content.length);
  console.log('- Model:', realProblematicData.model);
  console.log('- Stop reason:', realProblematicData.stop_reason);
  console.log('- Text contains "Tool call:"', realProblematicData.content[0].text.includes('Tool call:'));
  
  // Test condition matching
  console.log('\n🔍 Testing patch condition matching...');
  
  // Test provider condition
  const providerMatches = patch.condition.provider.includes(context.provider);
  console.log('- Provider condition (openai):', providerMatches);
  
  // Test model condition
  const modelMatches = patch.condition.model(context.model);
  console.log('- Model condition (ZhipuAI/GLM-4.5):', modelMatches);
  
  // Test enabled condition
  const enabledCondition = patch.condition.enabled();
  console.log('- Enabled condition:', enabledCondition);
  
  // Test shouldApply
  console.log('\n⚡ Testing shouldApply...');
  const shouldApply = patch.shouldApply(context, realProblematicData);
  console.log('- Should apply patch:', shouldApply);
  
  if (!shouldApply) {
    console.log('\n❌ CRITICAL ISSUE: Patch should apply but returned false!');
    console.log('🔧 Debugging shouldApply logic...');
    
    // Manual debugging
    try {
      const hasTextContent = realProblematicData.content.some(block => {
        if (block.type !== 'text' || !block.text) return false;
        
        const toolCallPatterns = [
          /\{\s*"type"\s*:\s*"tool_use"\s*,/i,
          /\{\s*"id"\s*:\s*"toolu_[^"]+"\s*,/i,
          /"name"\s*:\s*"[^"]+"\s*,\s*"input"\s*:\s*\{/i,
          /Tool\s+call:\s*\w+\s*\(\s*\{[^}]*"[^"]*":[^}]*\}/i,
          /\w+\s*\(\s*\{\s*"[^"]+"\s*:\s*"[^"]*"/i
        ];
        
        const matches = toolCallPatterns.some(pattern => pattern.test(block.text));
        console.log('  - Pattern matching result:', matches);
        if (matches) {
          console.log('  - Matched text preview:', block.text.substring(block.text.indexOf('Tool call:'), block.text.indexOf('Tool call:') + 100));
        }
        return matches;
      });
      
      const hasProperToolUse = realProblematicData.content.some(block => block.type === 'tool_use');
      
      console.log('- Has text content with tool call:', hasTextContent);
      console.log('- Has proper tool use blocks:', hasProperToolUse);
      console.log('- Final shouldApply logic:', hasTextContent && !hasProperToolUse);
      
    } catch (debugError) {
      console.error('Debug error:', debugError);
    }
    
    return;
  }
  
  // Apply patch if it should be applied
  console.log('\n⚡ Applying patch to actual problematic data...');
  try {
    const result = await patch.apply(context, realProblematicData);
    
    console.log('\n📊 Patch application result:');
    console.log('- Success:', result.success);
    console.log('- Applied:', result.applied);
    console.log('- Duration:', result.duration + 'ms');
    
    if (result.success && result.data) {
      console.log('- Content blocks after patch:', result.data.content.length);
      
      const toolUseBlocks = result.data.content.filter(block => block.type === 'tool_use');
      const textBlocks = result.data.content.filter(block => block.type === 'text');
      
      console.log('- Tool use blocks:', toolUseBlocks.length);
      console.log('- Text blocks:', textBlocks.length);
      
      if (toolUseBlocks.length > 0) {
        console.log('\n✅ SUCCESS: Tool calls extracted properly');
        console.log('- First tool call name:', toolUseBlocks[0].name);
        console.log('- First tool call has file_path:', 'file_path' in (toolUseBlocks[0].input || {}));
      }
      
      // Check if tool call text was removed from text blocks
      const remainingTextHasToolCall = textBlocks.some(block => 
        block.text && block.text.includes('Tool call:')
      );
      
      console.log('- Tool call text removed from text:', !remainingTextHasToolCall);
      
      if (remainingTextHasToolCall) {
        console.log('❌ ISSUE: Tool call text still remains in text blocks');
      } else {
        console.log('✅ SUCCESS: Tool call text properly extracted');
      }
      
    } else {
      console.log('❌ Patch failed');
      if (result.metadata && result.metadata.error) {
        console.log('- Error:', result.metadata.error);
      }
    }
    
  } catch (error) {
    console.error('❌ Patch application error:', error.message);
  }
}

// Run test
testSpecificCase().catch(console.error);