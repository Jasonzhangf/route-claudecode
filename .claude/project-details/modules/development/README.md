# 开发支持模块 (Development Module)

## 模块概述

开发支持模块是RCC v4.0系统为开发者提供的工具集合，包括开发环境设置、代码生成、调试工具和文档生成等功能。

## 模块职责

1. **开发环境管理**: 管理开发环境的设置和配置
2. **代码生成**: 自动生成代码模板和样板代码
3. **调试工具**: 提供开发调试所需的工具
4. **文档生成**: 自动生成API文档和设计文档
5. **构建工具**: 管理项目的构建和打包过程
6. **开发工作流**: 支持敏捷开发和持续集成工作流

## 模块结构

```
development/
├── README.md                          # 本模块设计文档
├── index.ts                           # 模块入口和导出
├── dev-environment.ts                 # 开发环境管理器
├── code-generator.ts                  # 代码生成器
├── debug-tools.ts                     # 调试工具集
├── doc-generator.ts                    # 文档生成器
├── build-tools.ts                     # 构建工具集
├── workflow-manager.ts                # 工作流管理器
├── scaffolding/                      # 脚手架工具
│   ├── module-scaffolder.ts            # 模块脚手架
│   ├── component-scaffolder.ts        # 组件脚手架
│   └── test-scaffolder.ts             # 测试脚手架
├── templates/                         # 代码模板
│   ├── module-template/               # 模块模板
│   ├── component-template/             # 组件模板
│   └── test-template/                # 测试模板
├── scripts/                           # 开发脚本
│   ├── setup-dev-env.ts               # 设置开发环境脚本
│   ├── generate-module.ts             # 生成模块脚本
│   ├── run-dev-server.ts               # 运行开发服务器脚本
│   └── build-release.ts               # 构建发布版本脚本
├── configs/                           # 开发配置
│   ├── eslint.config.js              # ESLint配置
│   ├── prettier.config.js             # Prettier配置
│   ├── tsconfig.dev.json              # TypeScript开发配置
│   └── webpack.dev.js                 # Webpack开发配置
└── tools/                             # 开发工具
    ├── api-explorer/                  # API浏览器
    ├── perf-monitor/                  # 性能监控器
    └── memory-analyzer/               # 内存分析器
```

## 核心组件

### 开发环境管理器 (DevEnvironmentManager)
负责开发环境的设置、配置和管理。

### 代码生成器 (CodeGenerator)
根据模板自动生成代码和项目结构。

### 调试工具集 (DebugTools)
提供开发调试所需的各种工具。

### 文档生成器 (DocGenerator)
自动生成API文档和设计文档。

### 构建工具集 (BuildTools)
管理项目的构建、打包和发布过程。

### 工作流管理器 (WorkflowManager)
管理开发工作流，支持敏捷开发和持续集成。

### 脚手架工具 (ScaffoldingTools)
提供快速生成项目结构和代码模板的功能。

## 开发环境设置

### 环境要求
```bash
# Node.js版本要求
Node.js >= 18.0.0
npm >= 9.0.0

# 开发工具
TypeScript >= 5.0.0
ESLint >= 8.0.0
Prettier >= 3.0.0
Jest >= 29.0.0
Webpack >= 5.0.0
```

### 环境变量设置
```bash
# 开发环境变量
export NODE_ENV=development
export RCC_DEV_MODE=true
export RCC_DEBUG_PORT=9229
export RCC_LOG_LEVEL=debug
export RCC_CONFIG_PATH=./config/dev.json
```

### 开发环境初始化脚本
```typescript
// setup-dev-env.ts
import { DevEnvironmentManager } from './dev-environment';

async function setupDevelopmentEnvironment() {
  const envManager = new DevEnvironmentManager();
  
  // 1. 检查系统要求
  await envManager.checkSystemRequirements();
  
  // 2. 安装依赖
  await envManager.installDependencies();
  
  // 3. 设置配置文件
  await envManager.setupConfigFiles();
  
  // 4. 初始化开发数据库
  await envManager.initializeDevDatabase();
  
  // 5. 启动开发服务器
  await envManager.startDevServer();
  
  console.log('✅ Development environment setup completed!');
}

setupDevelopmentEnvironment().catch(console.error);
```

## 代码生成工具

### 模块生成器
```typescript
// generate-module.ts
interface ModuleGeneratorOptions {
  name: string;
  type: 'client' | 'router' | 'pipeline' | 'debug' | 'config';
  components: string[];
  withTests: boolean;
  withDocs: boolean;
}

class ModuleGenerator {
  async generateModule(options: ModuleGeneratorOptions): Promise<void> {
    // 1. 创建模块目录结构
    await this.createModuleStructure(options.name, options.type);
    
    // 2. 生成核心文件
    await this.generateCoreFiles(options);
    
    // 3. 生成组件文件
    if (options.components.length > 0) {
      await this.generateComponents(options.name, options.components);
    }
    
    // 4. 生成测试文件
    if (options.withTests) {
      await this.generateTestFiles(options);
    }
    
    // 5. 生成文档文件
    if (options.withDocs) {
      await this.generateDocumentation(options);
    }
    
    console.log(`✅ Module ${options.name} generated successfully!`);
  }
  
  private async createModuleStructure(name: string, type: string): Promise<void> {
    const basePath = `src/${type}/${name}`;
    await fs.promises.mkdir(basePath, { recursive: true });
    
    // 创建子目录
    await Promise.all([
      fs.promises.mkdir(`${basePath}/types`),
      fs.promises.mkdir(`${basePath}/components`),
      fs.promises.mkdir(`${basePath}/__tests__`)
    ]);
  }
  
  private async generateCoreFiles(options: ModuleGeneratorOptions): Promise<void> {
    // 生成index.ts
    const indexPath = `src/${options.type}/${options.name}/index.ts`;
    const indexContent = this.generateIndexFile(options);
    await fs.promises.writeFile(indexPath, indexContent);
    
    // 生成主模块文件
    const modulePath = `src/${options.type}/${options.name}/${options.name}-manager.ts`;
    const moduleContent = this.generateModuleFile(options);
    await fs.promises.writeFile(modulePath, moduleContent);
  }
}
```

### 组件生成器
```typescript
// generate-component.ts
interface ComponentGeneratorOptions {
  moduleName: string;
  componentName: string;
  componentType: 'service' | 'controller' | 'middleware' | 'helper';
  withInterface: boolean;
  withTests: boolean;
}

class ComponentGenerator {
  async generateComponent(options: ComponentGeneratorOptions): Promise<void> {
    const modulePath = `src/modules/${options.moduleName}`;
    
    // 生成组件文件
    const componentPath = `${modulePath}/${options.componentName}.ts`;
    const componentContent = this.generateComponentFile(options);
    await fs.promises.writeFile(componentPath, componentContent);
    
    // 生成接口文件
    if (options.withInterface) {
      const interfacePath = `${modulePath}/${options.componentName}.interface.ts`;
      const interfaceContent = this.generateInterfaceFile(options);
      await fs.promises.writeFile(interfacePath, interfaceContent);
    }
    
    // 生成测试文件
    if (options.withTests) {
      const testPath = `${modulePath}/__tests__/${options.componentName}.test.ts`;
      const testContent = this.generateTestFile(options);
      await fs.promises.writeFile(testPath, testContent);
    }
  }
}
```

## 调试工具集

### 开发服务器
```typescript
// dev-server.ts
class DevServer {
  private server: FastifyInstance;
  private watcher: FSWatcher;
  
  async start(port: number = 3456): Promise<void> {
    this.server = fastify({ logger: true });
    
    // 设置热重载
    this.setupHotReload();
    
    // 设置API路由
    this.setupRoutes();
    
    // 设置静态文件服务
    this.setupStaticFiles();
    
    await this.server.listen({ port, host: 'localhost' });
    console.log(`🚀 Dev server started on http://localhost:${port}`);
  }
  
  private setupHotReload(): void {
    this.watcher = chokidar.watch(['src/**/*.ts'], {
      ignored: /node_modules/,
      persistent: true
    });
    
    this.watcher.on('change', async (path) => {
      console.log(`🔄 File changed: ${path}`);
      // 重新加载模块
      await this.reloadModule(path);
    });
  }
  
  private setupRoutes(): void {
    // API路由
    this.server.post('/api/debug/execute', async (request, reply) => {
      const { code } = request.body as { code: string };
      try {
        const result = await this.executeDebugCode(code);
        return { success: true, result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    // Debug面板路由
    this.server.get('/debug', async (request, reply) => {
      return this.renderDebugPanel();
    });
  }
}
```

### 性能监控器
```typescript
// perf-monitor.ts
class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  
  startMonitoring(label: string): () => PerformanceMetric {
    const startTime = process.hrtime.bigint();
    
    return (): PerformanceMetric => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒
      
      const metric: PerformanceMetric = {
        label,
        duration,
        timestamp: new Date(),
        memoryUsage: process.memoryUsage()
      };
      
      // 存储指标
      if (!this.metrics.has(label)) {
        this.metrics.set(label, []);
      }
      this.metrics.get(label)!.push(metric);
      
      return metric;
    };
  }
  
  getMetrics(label?: string): PerformanceMetric[] | Map<string, PerformanceMetric[]> {
    if (label) {
      return this.metrics.get(label) || [];
    }
    return new Map(this.metrics);
  }
  
  generateReport(): PerformanceReport {
    const report: PerformanceReport = {};
    
    for (const [label, metrics] of this.metrics) {
      const durations = metrics.map(m => m.duration);
      report[label] = {
        count: metrics.length,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        totalDuration: durations.reduce((a, b) => a + b, 0)
      };
    }
    
    return report;
  }
}
```

## 文档生成工具

### API文档生成器
```typescript
// api-doc-generator.ts
class APIDocGenerator {
  async generateAPIDocs(sourceFiles: string[]): Promise<void> {
    // 解析TypeScript文件
    const parsedFiles = await this.parseSourceFiles(sourceFiles);
    
    // 提取API端点信息
    const apiEndpoints = this.extractAPIEndpoints(parsedFiles);
    
    // 生成Markdown文档
    const markdownDoc = this.generateMarkdownDoc(apiEndpoints);
    await fs.promises.writeFile('docs/api.md', markdownDoc);
    
    // 生成HTML文档
    const htmlDoc = this.generateHTMLDoc(apiEndpoints);
    await fs.promises.writeFile('docs/api.html', htmlDoc);
    
    // 生成OpenAPI规范
    const openAPISpec = this.generateOpenAPISpec(apiEndpoints);
    await fs.promises.writeFile('docs/openapi.json', JSON.stringify(openAPISpec, null, 2));
  }
  
  private extractAPIEndpoints(files: ParsedFile[]): APIEndpoint[] {
    const endpoints: APIEndpoint[] = [];
    
    for (const file of files) {
      // 查找带有@route注解的函数
      const routeDecorators = file.ast.find(j.Decorator, {
        expression: {
          callee: {
            name: decorator => decorator === 'route' || decorator === 'get' || decorator === 'post'
          }
        }
      });
      
      routeDecorators.forEach(decorator => {
        const endpoint: APIEndpoint = {
          method: this.extractMethod(decorator),
          path: this.extractPath(decorator),
          description: this.extractDescription(decorator),
          parameters: this.extractParameters(decorator),
          returnType: this.extractReturnType(decorator),
          file: file.path
        };
        
        endpoints.push(endpoint);
      });
    }
    
    return endpoints;
  }
}
```

## 构建工具集

### 构建配置
```javascript
// webpack.dev.js
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: 'rcc.js',
    library: 'RCC',
    libraryTarget: 'umd'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  devtool: 'source-map',
  devServer: {
    contentBase: path.join(__dirname, '../dist'),
    compress: true,
    port: 3456
  }
};
```

### 发布构建脚本
```typescript
// build-release.ts
class ReleaseBuilder {
  async buildRelease(version: string): Promise<void> {
    // 1. 运行测试
    await this.runTests();
    
    // 2. 检查代码质量
    await this.checkCodeQuality();
    
    // 3. 更新版本号
    await this.updateVersion(version);
    
    // 4. 编译TypeScript
    await this.compileTypeScript();
    
    // 5. 打包
    await this.bundle();
    
    // 6. 生成文档
    await this.generateDocs();
    
    // 7. 创建发布包
    await this.createReleasePackage(version);
    
    console.log(`✅ Release ${version} built successfully!`);
  }
  
  private async runTests(): Promise<void> {
    const testProcess = spawn('npm', ['test'], { stdio: 'inherit' });
    await new Promise((resolve, reject) => {
      testProcess.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Tests failed with exit code ${code}`));
        }
      });
    });
  }
  
  private async compileTypeScript(): Promise<void> {
    const tscProcess = spawn('npx', ['tsc', '--project', 'tsconfig.prod.json'], { stdio: 'inherit' });
    await new Promise((resolve, reject) => {
      tscProcess.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`TypeScript compilation failed with exit code ${code}`));
        }
      });
    });
  }
}
```

## 接口定义

```typescript
interface DevelopmentModuleInterface {
  initialize(): Promise<void>;
  setupDevelopmentEnvironment(): Promise<void>;
  generateCode(template: string, options: CodeGenOptions): Promise<string>;
  startDevServer(port?: number): Promise<void>;
  stopDevServer(): Promise<void>;
  runTests(testPattern?: string): Promise<TestResults>;
  generateDocumentation(): Promise<void>;
  buildProject(): Promise<BuildResult>;
}

interface CodeGeneratorInterface {
  generateModule(options: ModuleGenOptions): Promise<void>;
  generateComponent(options: ComponentGenOptions): Promise<void>;
  generateTest(options: TestGenOptions): Promise<void>;
  generateConfig(options: ConfigGenOptions): Promise<void>;
}

interface DevServerInterface {
  start(port: number): Promise<void>;
  stop(): Promise<void>;
  reload(): Promise<void>;
  getServerInfo(): ServerInfo;
}
```

## 依赖关系

- 依赖配置模块获取开发配置
- 依赖测试模块执行自动化测试
- 被开发者工具调用以支持开发工作流

## 设计原则

1. **开发者友好**: 提供简单易用的开发工具和脚本
2. **自动化**: 支持开发、测试、构建的自动化流程
3. **可扩展性**: 易于添加新的开发工具和功能
4. **文档化**: 提供完整的开发文档和示例
5. **标准化**: 遵循业界标准的开发实践
6. **可配置性**: 支持灵活的开发环境配置
7. **集成性**: 与主流开发工具和IDE良好集成
8. **效率性**: 提高开发效率，减少重复工作