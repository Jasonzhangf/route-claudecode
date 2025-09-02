const { spawn } = require('child_process');
const http = require('http');

// 启动RCC4服务
console.log('Starting RCC4 service...');
const service = spawn('node', ['dist/cli.js', 'start', '--config', 'config/config-qwen.json'], {
  cwd: process.cwd(),
  stdio: 'pipe'
});

service.stdout.on('data', (data) => {
  console.log(`[SERVICE] ${data}`);
});

service.stderr.on('data', (data) => {
  console.error(`[SERVICE ERROR] ${data}`);
});

service.on('error', (error) => {
  console.error(`Failed to start service: ${error.message}`);
});

// 等待服务启动后发送测试请求
setTimeout(() => {
  console.log('Sending test request...');
  
  // 测试请求数据 - 使用Claude Code工具调用格式
  const testData = {
    model: "qwen3-coder-flash",
    messages: [
      {
        role: "user",
        content: "请列出当前目录的文件。你需要使用list_files工具来完成这个任务。"
      }
    ],
    tools: [
      {
        name: "list_files",
        description: "列出指定目录中的文件",
        input_schema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "要列出文件的目录路径"
            }
          },
          required: ["path"]
        }
      }
    ],
    tool_choice: {
      type: "auto"
    },
    max_tokens: 1000,
    temperature: 0.7
  };

  const postData = JSON.stringify(testData);
  
  const options = {
    hostname: 'localhost',
    port: 5512,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer rcc4-proxy-key',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:');
      console.log(data);
      
      try {
        const response = JSON.parse(data);
        console.log('\nParsed Response:');
        console.log(JSON.stringify(response, null, 2));
      } catch (e) {
        console.error('Failed to parse response as JSON');
      }
      
      // 关闭服务
      service.kill();
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    service.kill();
  });

  // 写入数据到请求体
  req.write(postData);
  req.end();
}, 15000); // 等待15秒让服务完全启动