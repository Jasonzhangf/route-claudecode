// 测试改进后的硬编码检查和引导功能
// 这个文件在非constants目录，应该触发检查但不会被删除

function testImprovedGuidance() {
    // 故意包含硬编码来测试新的引导机制
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const port = 5506;
    
    return {
        url: apiUrl,
        port: port
    };
}

export { testImprovedGuidance };