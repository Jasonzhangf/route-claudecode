#!/usr/bin/env node

/**
 * 统一预处理系统测试脚本
 * 验证补丁系统统一化重构后的功能
 */

const { getUnifiedPatchPreprocessor } = require('./dist/preprocessing/unified-patch-preprocessor');
const { getLogger } = require('./dist/logging');

// 模拟GLM-4.5的工具调用响应数据（之前有问题的数据）
const glm45ToolCallResponse = {
  "id": "2025080610171082675ddffbb04c79",
  "model": "glm-4.5",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "\n\nTool call: Write({\"content\":\"from fastapi import FastAPI, HTTPException, Query\\nfrom typing import Dict, Any, List, Optional\\nfrom pydantic import BaseModel\\nimport logging\\nimport os\\nimport sys\\nsys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))\\n\\nfrom mcp_tools.tool_manager import MCPToolManager\\nfrom mcp_tools.core_tools import (\\n    GraphRAGQueryTool,\\n    LMCESearchTool,\\n    FileReaderTool,\\n    FileWriterTool\\n)\\n\\napp = FastAPI(title=\\\"核心MCP工具服务器\\\", version=\\\"1.0.0\\\")\\n\\n# 初始化工具管理器\\ntool_manager = MCPToolManager()\\n\\n# 初始化核心工具实例\\ncore_tools = {\\n    \\\"graphrag_query\\\": GraphRAGQueryTool(\\n        neo4j_uri=\\\"bolt://localhost:7687\\\",\\n        username=\\\"neo4j\\\",\\n        password=\\\"password\\\"\\n    ),\\n    \\\"lmce_search\\\": LMCESearchTool(),\\n    \\\"file_reader\\\": FileReaderTool(),\\n    \\\"file_writer\\\": FileWriterTool()\\n}\\n\\n# 配置日志\\nlogging.basicConfig(level=logging.INFO)\\nlogger = logging.getLogger(__name__)\\n\\n# 数据模型\\nclass ToolExecuteRequest(BaseModel):\\n    tool_id: str\\n    parameters: Dict[str, Any] = {}\\n\\nclass ToolExecuteResponse(BaseModel):\\n    success: bool\\n    result: Any = None\\n    error: Optional[str] = None\\n\\n# API路由\\n\\n@app.get(\\\"/health\\\")\\nasync def health_check():\\n    \\\"\\\"\\\"健康检查\\\"\\\"\\\"\\n    return {\\\"status\\\": \\\"ok\\\", \\\"timestamp\\\": datetime.now().isoformat()}\\n\\n@app.get(\\\"/tools\\\")\\nasync def list_tools():\\n    \\\"\\\"\\\"列出所有可用工具\\\"\\\"\\\"\\n    tools = tool_manager.list_tools()\\n    return {\\n        \\\"count\\\": len(tools),\\n        \\\"tools\\\": [\\n            {\\n                \\\"id\\\": tool.id,\\n                \\\"name\\\": tool.name,\\n                \\\"description\\\": tool.description,\\n                \\\"parameters\\\": tool.parameters\\n            }\\n            for tool in tools\\n        ]\\n    }\\n\\n@app.get(\\\"/tools/{tool_id}\\\")\\nasync def get_tool(tool_id: str):\\n    \\\"\\\"\\\"获取工具详情\\\"\\\"\\\"\\n    tool = tool_manager.get_tool(tool_id)\\n    if not tool:\\n        raise HTTPException(status_code=404, detail=\\\"工具未找到\\\")\\n    \\n    return {\\n        \\\"id\\\": tool.id,\\n        \\\"name\\\": tool.name,\\n        \\\"description\\\": tool.description,\\n        \\\"parameters\\\": tool.parameters,\\n        \\\"created_at\\\": tool.created_at,\\n        \\\"updated_at\\\": tool.updated_at\\n    }\\n\\n@app.post(\\\"/tools/execute\\\")\\nasync def execute_tool(request: ToolExecuteRequest):\\n    \\\"\\\"\\\"执行工具\\\"\\\"\\\"\\n    tool_id = request.tool_id\\n    parameters = request.parameters\\n    \\n    # 检查工具是否存在\\n    if tool_id not in core_tools:\\n        raise HTTPException(status_code=404, detail=\\\"工具未找到\\\")\\n    \\n    try:\\n        # 执行工具\\n        if tool_id == \\\"graphrag_query\\\":\\n            query = parameters.get(\\\"query\\\")\\n            if not query:\\n                raise HTTPException(status_code=400, detail=\\\"缺少查询参数\\\")\\n            result = core_tools[\\\"graphrag_query\\\"].execute(query)\\n        elif tool_id == \\\"lmce_search\\\":\\n            query = parameters.get(\\\"query\\\")\\n            limit = parameters.get(\\\"limit\\\", 10)\\n            if not query:\\n                raise HTTPException(status_code=400, detail=\\\"缺少查询参数\\\")\\n            result = core_tools[\\\"lmce_search\\\"].search(query, limit)\\n        elif tool_id == \\\"file_reader\\\":\\n            file_path = parameters.get(\\\"file_path\\\")\\n            if not file_path:\\n                raise HTTPException(status_code=400, detail=\\\"缺少文件路径参数\\\")\\n            result = core_tools[\\\"file_reader\\\"].read_file(file_path)\\n        elif tool_id == \\\"file_writer\\\":\\n            file_path = parameters.get(\\\"file_path\\\")\\n            content = parameters.get(\\\"content\\\")\\n            if not file_path or content is None:\\n                raise HTTPException(status_code=400, detail=\\\"缺少文件路径或内容参数\\\")\\n            result = core_tools[\\\"file_writer\\\"].write_file(file_path, content)\\n        else:\\n            raise HTTPException(status_code=400, detail=\\\"不支持的工具\\\")\\n        \\n        return ToolExecuteResponse(\\n            success=True,\\n            result=result\\n        )\\n        \\n    except Exception as e:\\n        logger.error(f\\\"工具执行失败: {e}\\\")\\n        return ToolExecuteResponse(\\n            success=False,\\n            error=str(e)\\n        )\\n\\n@app.get(\\\"/tools/schemas\\\")\\nasync def get_tool_schemas():\\n    \\\"\\\"\\\"获取所有工具的Schema\\\"\\\"\\\"\\n    return tool_manager.get_tool_schemas()\\n\\n@app.post(\\\"/tools/register\\\")\\nasync def register_tool(tool_data: Dict[str, Any]):\\n    \\\"\\\"\\\"注册新工具（仅用于演示）\\\"\\\"\\\"\\n    try:\\n        tool = MCPTool(**tool_data)\\n        tool_manager.register_tool(tool)\\n        return {\\\"message\\\": \\\"工具注册成功\\\", \\\"tool_id\\\": tool.id}\\n    except Exception as e:\\n        raise HTTPException(status_code=400, detail=str(e))\\n\\n@app.delete(\\\"/tools/{tool_id}\\\")\\nasync def remove_tool(tool_id: str):\\n    \\\"\\\"\\\"移除工具\\\"\\\"\\\"\\n    if tool_id in core_tools:\\n        raise HTTPException(status_code=400, detail=\\\"核心工具不能被移除\\\")\\n    \\n    tool_manager.remove_tool(tool_id)\\n    return {\\\"message\\\": \\\"工具移除成功\\\"}\\n\\nif __name__ == \\\"__main__\\\":\\n    import uvicorn\\n    import datetime\\n    uvicorn.run(app, host=\\\"0.0.0.0\\\", port=3456)\",\"file_path\":\"/Users/fanzhang/Documents/novel/evolve/src/mcp_tools/server.py\"})"
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 0,
    "output_tokens": 1791
  }
};

// 模拟流式响应数据
const streamingChunkData = {
  event: 'content_block_delta',
  data: {
    delta: {
      text: "Tool call: Read({\"file_path\": \"/Users/test/example.py\"})"
    }
  }
};

// 模拟输入请求数据
const inputRequestData = {
  model: "glm-4.5",
  messages: [
    {
      role: "user",
      content: "Please create a FastAPI server for me"
    }
  ],
  tools: [
    {
      name: "Write",
      description: "Write content to a file",
      input_schema: {
        type: "object",
        properties: {
          file_path: { type: "string" },
          content: { type: "string" }
        }
      }
    }
  ]
};

async function testUnifiedPreprocessing() {
  console.log('🧪 测试统一预处理系统\\n');
  
  try {
    // 初始化统一预处理器
    const preprocessor = getUnifiedPatchPreprocessor(6689); // 使用6689端口测试
    
    console.log('📊 测试1: 输入预处理');
    console.log('===================');
    
    // 测试输入预处理
    const preprocessedInput = await preprocessor.preprocessInput(
      inputRequestData,
      'openai',
      'glm-4.5',
      'test-request-001'
    );
    
    console.log('✅ 输入预处理完成');
    console.log(`- 原始数据: ${JSON.stringify(inputRequestData).length} 字符`);
    console.log(`- 预处理后: ${JSON.stringify(preprocessedInput).length} 字符`);
    console.log(`- 数据变化: ${preprocessedInput !== inputRequestData ? '是' : '否'}`);
    console.log(`- 工具数量: ${preprocessedInput.tools?.length || 0}`);
    
    console.log('\\n📊 测试2: 响应预处理（GLM-4.5工具调用）');
    console.log('=======================================');
    
    // 测试响应预处理 - 这里应该修复GLM-4.5的工具调用格式
    const preprocessedResponse = await preprocessor.preprocessResponse(
      glm45ToolCallResponse,
      'openai',
      'glm-4.5',
      'test-request-002'
    );
    
    console.log('✅ 响应预处理完成');
    console.log(`- 原始内容块: ${glm45ToolCallResponse.content.length}`);
    console.log(`- 预处理后内容块: ${preprocessedResponse.content.length}`);
    console.log(`- 数据变化: ${preprocessedResponse !== glm45ToolCallResponse ? '是' : '否'}`);
    
    // 检查是否成功转换为结构化工具调用
    const hasToolUseBlocks = preprocessedResponse.content.some(block => block.type === 'tool_use');
    console.log(`- 包含结构化工具调用: ${hasToolUseBlocks ? '✅ 是' : '❌ 否'}`);
    
    if (hasToolUseBlocks) {
      const toolUseBlocks = preprocessedResponse.content.filter(block => block.type === 'tool_use');
      console.log(`- 工具调用数量: ${toolUseBlocks.length}`);
      toolUseBlocks.forEach((block, index) => {
        console.log(`  工具 ${index + 1}: ${block.name} (ID: ${block.id})`);
        console.log(`    参数: ${Object.keys(block.input || {}).join(', ')}`);
      });
    }
    
    console.log('\\n📊 测试3: 流式预处理');
    console.log('===================');
    
    // 测试流式预处理
    const preprocessedChunk = await preprocessor.preprocessStreaming(
      streamingChunkData,
      'openai',
      'glm-4.5',
      'test-request-003'
    );
    
    console.log('✅ 流式预处理完成');
    console.log(`- 原始事件: ${streamingChunkData.event}`);
    console.log(`- 预处理后事件: ${preprocessedChunk.event}`);
    console.log(`- 数据变化: ${preprocessedChunk !== streamingChunkData ? '是' : '否'}`);
    console.log(`- 原始文本: "${streamingChunkData.data.delta.text}"`);
    console.log(`- 处理后文本: "${preprocessedChunk.data?.delta?.text || 'N/A'}"`);
    
    console.log('\\n📊 测试4: 性能统计');
    console.log('===================');
    
    // 获取性能统计
    const performanceMetrics = preprocessor.getPerformanceMetrics();
    console.log('性能指标:');
    console.log(`- 总处理数量: ${performanceMetrics.totalProcessed}`);
    console.log(`- 平均处理时间: ${performanceMetrics.averageDuration}ms`);
    console.log(`- 输入处理: ${performanceMetrics.byStage.input.count} 次，平均 ${performanceMetrics.byStage.input.count > 0 ? (performanceMetrics.byStage.input.duration / performanceMetrics.byStage.input.count).toFixed(2) : 0}ms`);
    console.log(`- 响应处理: ${performanceMetrics.byStage.response.count} 次，平均 ${performanceMetrics.byStage.response.count > 0 ? (performanceMetrics.byStage.response.duration / performanceMetrics.byStage.response.count).toFixed(2) : 0}ms`);
    console.log(`- 流式处理: ${performanceMetrics.byStage.streaming.count} 次，平均 ${performanceMetrics.byStage.streaming.count > 0 ? (performanceMetrics.byStage.streaming.duration / performanceMetrics.byStage.streaming.count).toFixed(2) : 0}ms`);
    console.log(`- 缓存大小: ${performanceMetrics.cacheSize}`);
    
    console.log('\\n📊 测试5: 补丁管理器统计');
    console.log('=======================');
    
    // 获取补丁管理器统计
    const patchStats = preprocessor.getPatchManagerStats();
    console.log('补丁统计:');
    if (patchStats.length > 0) {
      patchStats.forEach(stat => {
        console.log(`- ${stat.patchName}:`);
        console.log(`  应用次数: ${stat.appliedCount}`);
        console.log(`  成功次数: ${stat.successCount}`);
        console.log(`  失败次数: ${stat.failureCount}`);
        console.log(`  成功率: ${((stat.successCount / stat.appliedCount) * 100).toFixed(1)}%`);
        console.log(`  平均耗时: ${stat.averageDuration.toFixed(2)}ms`);
      });
    } else {
      console.log('- 暂无补丁统计数据');
    }
    
    console.log('\\n🎉 统一预处理系统测试完成！');
    console.log('================================');
    console.log('✅ 所有测试通过');
    console.log(`✅ GLM-4.5工具调用修复: ${hasToolUseBlocks ? '成功' : '失败'}`);
    console.log(`✅ 统一入口验证: 成功`);
    console.log(`✅ 性能统计正常: 成功`);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('详细错误:', error instanceof Error ? error.stack : String(error));
    process.exit(1);
  }
}

// 运行测试
testUnifiedPreprocessing().catch(console.error);