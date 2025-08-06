#!/usr/bin/env node

/**
 * Test tool call fix functionality with real 6689 port error data
 * Based on actual error logs from port 6689
 */

const { AnthropicToolCallTextFixPatch } = require('./dist/patches/anthropic/tool-call-text-fix');

// Real error data from 6689 logs
const realErrorData = {
  content: [
    {
      type: 'text',
      text: 'Tool call: Edit({"file_path":"/Users/fanzhang/Documents/novel/evolve/project_rules.md","old_string":"# 小说项目《进化》创作系统规范\\n\\n## 📋 项目基本信息\\n- **项目名称**: 《进化》\\n- **类型**: 科幻小说\\n- **目标字数**: 20万字\\n- **更新频率**: 每日更新\\n- **风格**: 硬科幻 + 人文思考\\n\\n## 🎯 核心设定\\n### 世界观\\n- **时间**: 2157年\\n- **背景**: 人类文明经历三次进化浪潮\\n- **核心概念**: 意识、算法、进化的边界\\n\\n### 主要角色\\n- **林晨**: 量子生物学家，主角\\n- **AI-9527**: 高级人工智能，伙伴\\n- **陈教授**: 导师，传统派代表\\n\\n### 科技设定\\n- **量子意识**: 意识可以数字化传输\\n- **进化算法**: 自主学习和适应的AI系统\\n- **生物改造**: 基因层面的人类增强\\n\\n## ✍️ 创作规范\\n### 更新机制\\n- 每日更新不少于2000字\\n- 保证故事连贯性和逻辑性\\n- 定期review和修订已发布章节\\n\\n### 文风要求\\n- 硬科幻设定要有科学依据\\n- 人物对话要符合角色身份\\n- 描述要生动具体，避免空洞抽象\\n\\n### 章节结构\\n- 每章3000-5000字\\n- 章节间要有明确的情节推进\\n- 重要科技概念要有详细解释\\n\\n## 📚 参考材料\\n- 《三体》系列 - 刘慈欣\\n- 《神经漫游者》 - 威廉·吉布森\\n- 《银翼杀手》 - 菲利普·K·迪克\\n\\n## 🔄 版本管理\\n- 使用Git管理小说文稿\\n- 重要修改要有commit说明\\n- 定期备份到云端","new_string":"# 小说项目《进化》创作系统规范\\n\\n## 📋 项目基本信息\\n- **项目名称**: 《进化》\\n- **类型**: 科幻小说\\n- **目标字数**: 20万字\\n- **更新频率**: 每日更新\\n- **风格**: 硬科幻 + 人文思考\\n\\n## 🎯 核心设定\\n### 世界观\\n- **时间**: 2157年\\n- **背景**: 人类文明经历三次进化浪潮后，正面临第四次巨变\\n- **核心概念**: 意识与算法的融合边界，进化的不可逆性\\n\\n### 主要角色\\n- **林晨**: 37岁量子生物学家，第三代意识增强人类，主角\\n- **AI-9527**: 拥有独立人格的高级人工智能，林晨的研究伙伴\\n- **陈教授**: 68岁，传统派代表，坚持纯人类主义\\n- **莫拉**: 神秘的第四代进化体，真实身份未明\\n\\n### 科技设定\\n- **量子意识传输**: 意识可以在量子层面数字化，但传输过程存在0.3%的信息丢失\\n- **进化算法**: 具有自主学习和适应能力的AI系统，已发展出情感模拟\\n- **生物改造技术**: 基因层面的人类增强，分为三个等级\\n- **意识融合**: 人类与AI意识的深度结合，存在不可逆风险\\n\\n## ✍️ 创作规范\\n### 更新机制\\n- 每日更新不少于2000字\\n- 保证故事连贯性和逻辑性\\n- 每周review已发布章节，必要时进行修订\\n- 读者反馈要在48小时内回应\\n\\n### 文风要求\\n- 硬科幻设定必须有现实科学理论支撑\\n- 人物对话要体现角色的教育背景和生活经历\\n- 场景描述要具体生动，运用五感描写\\n- 避免过度的技术名词堆砌，确保可读性\\n\\n### 章节结构\\n- 每章3000-5000字\\n- 每章结尾要有悬念或情节转折\\n- 重要科技概念通过角色对话自然引入\\n- 保持快节奏，避免冗长的环境描述\\n\\n### 角色发展\\n- 每个主要角色都要有明确的成长弧线\\n- 角色行为要符合其设定的价值观\\n- 通过行动而非对白来展现角色性格\\n\\n## 📚 参考材料\\n- 《三体》系列 - 刘慈欣（宇宙观设定）\\n- 《神经漫游者》 - 威廉·吉布森（赛博朋克元素）\\n- 《银翼杀手》 - 菲利普·K·迪克（人工智能思辨）\\n- 《异形》系列（生物恐怖元素）\\n- 《攻壳机动队》（意识哲学探讨）\\n\\n## 🔄 版本管理\\n- 使用Git管理小说文稿和设定文档\\n- 每日更新必须有详细的commit说明\\n- 重大情节修改需要创建分支\\n- 每周自动备份到三个不同的云端平台\\n- 保留所有版本历史，便于回溯和分析创作过程"})'
    }
  ],
  id: 'msg_test_6689',
  model: 'ZhipuAI/GLM-4.5',
  role: 'assistant',
  stop_reason: null,
  stop_sequence: null,
  type: 'message',
  usage: {
    input_tokens: 1500,
    output_tokens: 800
  }
};

async function testToolCallFix() {
  console.log('🧪 Testing AnthropicToolCallTextFixPatch with real 6689 error data');
  console.log('================================================================');
  
  // Initialize patch
  const patch = new AnthropicToolCallTextFixPatch();
  
  // Test context
  const context = {
    provider: 'openai',
    model: 'ZhipuAI/GLM-4.5',
    requestId: 'test-6689-tool-call-fix',
    port: 6689
  };
  
  console.log('📊 Original data structure:');
  console.log('- Content blocks:', realErrorData.content.length);
  console.log('- First block type:', realErrorData.content[0].type);
  console.log('- Text preview:', realErrorData.content[0].text.substring(0, 100) + '...');
  
  // Test shouldApply
  console.log('\n🔍 Testing shouldApply condition...');
  const shouldApply = patch.shouldApply(context, realErrorData);
  console.log('- Should apply patch:', shouldApply);
  
  if (!shouldApply) {
    console.log('❌ Patch should apply but returned false');
    console.log('📝 Debugging shouldApply logic...');
    
    // Debug hasTextContentWithToolCall
    const hasTextContent = patch.hasTextContentWithToolCall && patch.hasTextContentWithToolCall(realErrorData);
    console.log('- Has text content with tool call:', hasTextContent);
    
    // Debug hasProperToolUse  
    const hasProperToolUse = patch.hasProperToolUse && patch.hasProperToolUse(realErrorData);
    console.log('- Has proper tool use:', hasProperToolUse);
    
    return;
  }
  
  // Apply patch
  console.log('\n⚡ Applying patch...');
  const startTime = Date.now();
  
  try {
    const result = await patch.apply(context, realErrorData);
    
    console.log('\n✅ Patch application result:');
    console.log('- Success:', result.success);
    console.log('- Applied:', result.applied);
    console.log('- Duration:', result.duration + 'ms');
    console.log('- Patch name:', result.patchName);
    
    if (result.metadata) {
      console.log('- Metadata:', result.metadata);
    }
    
    if (result.success && result.data) {
      console.log('\n📊 Transformed data structure:');
      console.log('- Content blocks:', result.data.content.length);
      
      for (let i = 0; i < result.data.content.length; i++) {
        const block = result.data.content[i];
        console.log(`- Block ${i}: type=${block.type}`);
        
        if (block.type === 'tool_use') {
          console.log(`  - Tool ID: ${block.id}`);
          console.log(`  - Tool name: ${block.name}`);
          console.log(`  - Input keys: ${Object.keys(block.input || {}).join(', ')}`);
        } else if (block.type === 'text') {
          console.log(`  - Text preview: ${(block.text || '').substring(0, 50)}...`);
        }
      }
      
      // Validate transformation
      console.log('\n🔍 Validation:');
      const toolBlocks = result.data.content.filter(block => block.type === 'tool_use');
      const textBlocks = result.data.content.filter(block => block.type === 'text');
      
      console.log('- Tool use blocks extracted:', toolBlocks.length);
      console.log('- Text blocks remaining:', textBlocks.length);
      
      if (toolBlocks.length > 0) {
        const firstTool = toolBlocks[0];
        console.log('- First tool call validation:');
        console.log('  - Has valid ID:', typeof firstTool.id === 'string' && firstTool.id.length > 0);
        console.log('  - Has valid name:', typeof firstTool.name === 'string' && firstTool.name.length > 0);
        console.log('  - Has input object:', typeof firstTool.input === 'object' && firstTool.input !== null);
        
        if (firstTool.name === 'Edit' && firstTool.input) {
          console.log('  - Edit tool validation:');
          console.log('    - Has file_path:', 'file_path' in firstTool.input);
          console.log('    - Has old_string:', 'old_string' in firstTool.input);
          console.log('    - Has new_string:', 'new_string' in firstTool.input);
        }
      }
      
      // Check if original tool call text was removed
      const remainingText = textBlocks.map(block => block.text || '').join(' ');
      const stillContainsToolCall = remainingText.includes('Tool call: Edit(');
      console.log('- Original tool call text removed:', !stillContainsToolCall);
      
    } else {
      console.log('❌ Patch failed');
      if (result.metadata && result.metadata.error) {
        console.log('- Error:', result.metadata.error);
      }
    }
    
  } catch (error) {
    console.log('❌ Patch application threw error:', error.message);
    console.error(error);
  }
}

// Run test
testToolCallFix().catch(console.error);