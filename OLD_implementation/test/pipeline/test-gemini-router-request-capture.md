# Gemini Router Request Capture Test

## 测试用例
**一句话描述**: 通过请求拦截技术捕获路由器向Gemini API发送的实际请求，分析MALFORMED_FUNCTION_CALL错误的根本原因

## 测试目标
1. **请求拦截**: 使用Axios拦截技术捕获所有发往Gemini API的HTTP请求
2. **数据分析**: 详细分析请求结构、工具配置和模式转换结果
3. **错误定位**: 精确识别导致MALFORMED_FUNCTION_CALL和UNEXPECTED_TOOL_CALL的具体字段
4. **对比验证**: 对比实际请求与Gemini API规范的差异

## 最近执行记录

### 2025-08-07 07:00:00 - 初始实现 - 状态：待执行
- **执行时长**: N/A
- **状态**: 测试脚本完成，待运行
- **日志文件**: `test/debug/output/gemini-request-capture/`
- **预期输出**: 拦截到的完整请求和响应数据

## 测试架构详情

### 🔍 请求拦截机制
```javascript
// Axios请求拦截器
axios.post = async function(url, data, config) {
  if (url.includes('generativelanguage.googleapis.com')) {
    // 捕获请求数据
    self.capturedRequests.push({
      timestamp: new Date().toISOString(),
      url: url,
      data: data,
      headers: config?.headers
    });
    
    // 执行实际请求并捕获响应
    const response = await originalPost.call(this, url, data, config);
    self.capturedResponses.push({
      timestamp: new Date().toISOString(),
      status: response.status,
      data: response.data
    });
    
    return response;
  }
};
```

### 📊 测试用例设计

#### 测试用例1: simple-weather-tool
```javascript
{
  name: 'simple-weather-tool',
  description: '简单天气工具调用测试',
  payload: {
    model: 'gemini-2.5-flash',
    messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
    tools: [
      {
        name: 'get_weather',
        description: '获取指定城市的天气信息',
        input_schema: {
          type: 'object',
          properties: { city: { type: 'string', description: '城市名称' } },
          required: ['city']
        }
      }
    ]
  }
}
```

#### 测试用例2: complex-multi-tool
```javascript
{
  name: 'complex-multi-tool',
  description: '复杂多工具模式测试',
  tools: [
    { name: 'LS', /* 文件列表工具 */ },
    { name: 'get_weather', /* 天气工具 */ }
  ]
}
```

### 🔬 分析维度

#### 1. 请求结构验证
- **contents字段**: 检查是否存在且格式正确
- **tools字段**: 验证数组结构和functionDeclarations
- **toolConfig字段**: 确认functionCallingConfig设置

#### 2. 工具模式转换分析
```javascript
// 检查functionDeclarations结构
tool.functionDeclarations.forEach((func, funcIndex) => {
  if (!func.name) issues.push('Missing name');
  if (!func.parameters) issues.push('Missing parameters');
  
  // 检查不支持的字段
  checkForUnsupported(func.parameters);
});
```

#### 3. 响应错误模式识别
- **MALFORMED_FUNCTION_CALL**: 工具模式格式错误
- **UNEXPECTED_TOOL_CALL**: 工具配置不匹配
- **HTTP错误**: API调用失败

### 📋 关键检查点

#### Schema字段合规性检查
```javascript
const unsupportedFields = ['$schema', 'additionalProperties', 'minItems', 'maxItems'];
// 递归检查所有嵌套对象是否包含不支持的字段
```

#### ToolConfig配置验证
```javascript
if (data.toolConfig.functionCallingConfig?.mode !== 'AUTO') {
  analysis.issues.push('toolConfig mode is not AUTO');
}
```

### 📊 输出数据结构

#### 完整分析报告
```json
{
  "timestamp": "2025-08-07T07:00:00.000Z",
  "testResults": [...],
  "capturedData": {
    "requests": [...],
    "responses": [...]
  },
  "analysis": {
    "requestCount": 2,
    "responseCount": 2,
    "issues": [...],
    "observations": [...]
  },
  "summary": {
    "totalTests": 2,
    "requestsCaptured": 2,
    "issuesFound": 0
  }
}
```

## 历史执行记录

### 待执行测试列表
1. **Router端口检查** - 确认5502端口Gemini服务正常运行
2. **基础拦截测试** - 验证请求拦截机制工作正常
3. **Schema转换验证** - 确认input_schema → parameters转换正确
4. **错误重现测试** - 重现MALFORMED_FUNCTION_CALL场景

## 相关文件
- **测试脚本**: `test/pipeline/test-gemini-router-request-capture.js`
- **输出目录**: `test/debug/output/gemini-request-capture/`
- **Gemini客户端**: `src/providers/gemini/client.ts`

## 执行前置条件

### 1. Gemini服务运行
```bash
# 启动Gemini服务器 (端口5502)
rcc start ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug
```

### 2. 环境变量 (可选)
```bash
# 如果需要直接测试Gemini API
export GEMINI_API_KEY=your_api_key_here
```

### 3. 执行测试
```bash
# 运行请求捕获测试
node test/pipeline/test-gemini-router-request-capture.js
```

## 预期成果

### 🎯 问题定位精度
- **请求级别**: 捕获完整的Gemini API请求数据
- **字段级别**: 识别导致错误的具体JSON字段
- **转换级别**: 验证Anthropic → Gemini格式转换正确性

### 🔧 具体发现目标
1. **Schema问题**: 确认是否存在不支持的JSON Schema字段
2. **配置问题**: 验证toolConfig设置是否符合API要求
3. **格式问题**: 检查functionDeclarations结构是否正确
4. **编码问题**: 确认中文描述是否导致解析错误

### 📈 修复指导方案
根据捕获的数据提供具体的修复建议：
- 如果发现不支持字段 → 优化cleanJsonSchemaForGemini方法
- 如果配置错误 → 调整toolConfig设置
- 如果格式问题 → 修复convertTools方法
- 如果编码问题 → 处理特殊字符转义

## 执行建议

### 优先级执行
1. **P0** - 立即运行基础拦截测试，验证机制有效性
2. **P1** - 执行simple-weather-tool测试，获取基线请求数据
3. **P2** - 运行complex-multi-tool测试，验证多工具场景
4. **P3** - 分析捕获数据，制定具体修复方案

### 成功标准
- **拦截成功**: 成功捕获到发往Gemini API的HTTP请求
- **数据完整**: 请求和响应数据完整且可分析
- **问题定位**: 准确识别MALFORMED_FUNCTION_CALL的根本原因
- **修复指导**: 提供可执行的具体修复建议