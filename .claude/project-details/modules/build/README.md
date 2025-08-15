# 编译构建系统

## 模块概述

编译构建系统提供完整的构建流程，包括TypeScript编译、打包、优化、一键构建和部署脚本，确保项目的高效构建和部署。

## 目录结构

```
scripts/build/
├── README.md                        # 构建系统文档
├── build.sh                         # 主构建脚本
├── build-watch.sh                   # 监听构建脚本
├── clean-build.sh                   # 清理构建脚本
├── type-check.sh                    # 类型检查脚本
├── one-click-build.sh               # 一键构建脚本
├── one-click-start.sh               # 一键启动脚本
├── webpack.config.js                # Webpack配置
├── tsconfig.build.json              # 构建TypeScript配置
└── build-utils/                     # 构建工具
    ├── version-manager.js           # 版本管理
    ├── asset-optimizer.js           # 资源优化
    ├── bundle-analyzer.js           # 包分析
    └── build-reporter.js            # 构建报告

dist/                                # 构建输出目录
├── cli.js                          # CLI入口文件
├── index.js                        # 库入口文件
├── client/                         # 客户端模块
├── router/                         # 路由器模块
├── pipeline/                       # 流水线模块
├── config/                         # 配置模块
├── debug/                          # Debug模块
├── error-handler/                  # 错误处理模块
├── types/                          # 类型定义
└── package.json                    # 构建后的package.json

build/                              # 构建临时文件
├── tsc-output/                     # TypeScript编译输出
├── webpack-cache/                  # Webpack缓存
├── type-check/                     # 类型检查结果
└── reports/                        # 构建报告
    ├── bundle-analysis.html        # 包分析报告
    ├── build-stats.json           # 构建统计
    └── performance-report.json     # 性能报告
```

## 构建配置

### 1. TypeScript构建配置
```json
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "importHelpers": true,
    "downlevelIteration": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/__tests__/**/*",
    "node_modules",
    "dist",
    "build"
  ]
}
```

### 2. Webpack配置
```javascript
// scripts/build/webpack.config.js
const path = require('path');
const webpack = require('webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isDevelopment = !isProduction;

  return {
    target: 'node',
    mode: isProduction ? 'production' : 'development',
    
    entry: {
      cli: './src/cli.ts',
      index: './src/index.ts'
    },
    
    output: {
      path: path.resolve(__dirname, '../../dist'),
      filename: '[name].js',
      libraryTarget: 'commonjs2',
      clean: true
    },
    
    resolve: {
      extensions: ['.ts', '.js', '.json'],
      alias: {
        '@': path.resolve(__dirname, '../../src'),
        '@types': path.resolve(__dirname, '../../src/types'),
        '@client': path.resolve(__dirname, '../../src/client'),
        '@router': path.resolve(__dirname, '../../src/router'),
        '@pipeline': path.resolve(__dirname, '../../src/pipeline'),
        '@config': path.resolve(__dirname, '../../src/config'),
        '@debug': path.resolve(__dirname, '../../src/debug'),
        '@error-handler': path.resolve(__dirname, '../../src/error-handler')
      }
    },
    
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: 'tsconfig.build.json',
                transpileOnly: false,
                compilerOptions: {
                  sourceMap: isDevelopment
                }
              }
            }
          ],
          exclude: /node_modules/
        },
        {
          test: /\.json$/,
          type: 'json'
        }
      ]
    },
    
    plugins: [
      new CleanWebpackPlugin(),
      
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        'process.env.RCC_VERSION': JSON.stringify(require('../../package.json').version),
        'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString())
      }),
      
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'package.json',
            to: 'package.json',
            transform(content) {
              const pkg = JSON.parse(content.toString());
              // 移除开发依赖
              delete pkg.devDependencies;
              delete pkg.scripts.dev;
              delete pkg.scripts.test;
              // 更新入口点
              pkg.main = 'index.js';
              pkg.bin = {
                rcc: 'cli.js'
              };
              return JSON.stringify(pkg, null, 2);
            }
          },
          {
            from: 'README.md',
            to: 'README.md'
          },
          {
            from: 'LICENSE',
            to: 'LICENSE',
            noErrorOnMissing: true
          }
        ]
      }),
      
      // 生产环境插件
      ...(isProduction ? [
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: '../build/reports/bundle-analysis.html'
        })
      ] : []),
      
      // 开发环境插件
      ...(isDevelopment ? [
        new webpack.SourceMapDevToolPlugin({
          filename: '[file].map'
        })
      ] : [])
    ],
    
    externals: {
      // 排除Node.js内置模块
      ...require('webpack-node-externals')(),
      // 保留特定的依赖包
      'openai': 'commonjs openai',
      '@anthropic-ai/sdk': 'commonjs @anthropic-ai/sdk',
      '@google/generative-ai': 'commonjs @google/generative-ai',
      'fastify': 'commonjs fastify',
      'winston': 'commonjs winston'
    },
    
    optimization: {
      minimize: isProduction,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      }
    },
    
    devtool: isDevelopment ? 'source-map' : false,
    
    stats: {
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false
    }
  };
};
```

## 构建脚本

### 1. 主构建脚本
```bash
#!/bin/bash
# scripts/build/build.sh

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
BUILD_MODE="${1:-production}"
BUILD_DIR="./build"
DIST_DIR="./dist"
REPORTS_DIR="$BUILD_DIR/reports"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 创建必要目录
create_directories() {
    log_info "Creating build directories..."
    mkdir -p "$BUILD_DIR"
    mkdir -p "$REPORTS_DIR"
    mkdir -p "$DIST_DIR"
}

# 清理旧构建
clean_build() {
    log_info "Cleaning previous build..."
    rm -rf "$DIST_DIR"/*
    rm -rf "$BUILD_DIR/tsc-output"
    rm -rf "$BUILD_DIR/webpack-cache"
}

# 类型检查
type_check() {
    log_info "Running TypeScript type check..."
    
    if npx tsc --noEmit --project tsconfig.build.json; then
        log_success "Type check passed"
    else
        log_error "Type check failed"
        exit 1
    fi
}

# 代码检查
lint_check() {
    log_info "Running ESLint check..."
    
    if npx eslint src --ext .ts --max-warnings 0; then
        log_success "Lint check passed"
    else
        log_error "Lint check failed"
        exit 1
    fi
}

# 运行测试
run_tests() {
    if [ "$BUILD_MODE" = "production" ]; then
        log_info "Running tests..."
        
        if npm run test:unit; then
            log_success "Tests passed"
        else
            log_error "Tests failed"
            exit 1
        fi
    else
        log_warning "Skipping tests in development mode"
    fi
}

# Webpack构建
webpack_build() {
    log_info "Running Webpack build..."
    
    local webpack_mode="$BUILD_MODE"
    if [ "$BUILD_MODE" = "dev" ]; then
        webpack_mode="development"
    fi
    
    if npx webpack --mode "$webpack_mode" --config scripts/build/webpack.config.js; then
        log_success "Webpack build completed"
    else
        log_error "Webpack build failed"
        exit 1
    fi
}

# 生成构建报告
generate_build_report() {
    log_info "Generating build report..."
    
    local report_file="$REPORTS_DIR/build-stats.json"
    local performance_file="$REPORTS_DIR/performance-report.json"
    
    # 构建统计
    cat > "$report_file" << EOF
{
  "buildTime": "$(date -Iseconds)",
  "buildMode": "$BUILD_MODE",
  "version": "$(node -p "require('./package.json').version")",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)",
  "distSize": "$(du -sh $DIST_DIR | cut -f1)",
  "files": $(find "$DIST_DIR" -type f | wc -l)
}
EOF
    
    # 性能报告
    if [ -f "$DIST_DIR/cli.js" ]; then
        local cli_size=$(stat -f%z "$DIST_DIR/cli.js" 2>/dev/null || stat -c%s "$DIST_DIR/cli.js" 2>/dev/null || echo "0")
        local index_size=$(stat -f%z "$DIST_DIR/index.js" 2>/dev/null || stat -c%s "$DIST_DIR/index.js" 2>/dev/null || echo "0")
        
        cat > "$performance_file" << EOF
{
  "bundleSizes": {
    "cli.js": $cli_size,
    "index.js": $index_size
  },
  "totalSize": $((cli_size + index_size)),
  "compressionRatio": "$(echo "scale=2; $((cli_size + index_size)) / 1024 / 1024" | bc)MB"
}
EOF
    fi
    
    log_success "Build report generated"
}

# 验证构建结果
verify_build() {
    log_info "Verifying build output..."
    
    # 检查必要文件
    local required_files=("cli.js" "index.js" "package.json")
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$DIST_DIR/$file" ]; then
            log_error "Required file missing: $file"
            exit 1
        fi
    done
    
    # 检查CLI可执行性
    if node "$DIST_DIR/cli.js" --version > /dev/null 2>&1; then
        log_success "CLI executable verification passed"
    else
        log_error "CLI executable verification failed"
        exit 1
    fi
    
    log_success "Build verification completed"
}

# 主构建流程
main() {
    local start_time=$(date +%s)
    
    log_info "🏗️  Starting RCC v4.0 build process..."
    log_info "Build mode: $BUILD_MODE"
    
    create_directories
    clean_build
    type_check
    lint_check
    run_tests
    webpack_build
    generate_build_report
    verify_build
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "✅ Build completed successfully in ${duration}s"
    log_info "📦 Output directory: $DIST_DIR"
    log_info "📊 Reports directory: $REPORTS_DIR"
    
    # 显示构建统计
    if [ -f "$REPORTS_DIR/build-stats.json" ]; then
        echo ""
        log_info "📈 Build Statistics:"
        cat "$REPORTS_DIR/build-stats.json" | jq '.' 2>/dev/null || cat "$REPORTS_DIR/build-stats.json"
    fi
}

# 执行主函数
main "$@"
```

### 2. 一键构建脚本
```bash
#!/bin/bash
# scripts/build/one-click-build.sh

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# 检查环境
check_environment() {
    log_step "1/8 Checking environment..."
    
    # 检查Node.js版本
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found"
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="18.0.0"
    
    if ! npx semver -r ">=$required_version" "$node_version" &> /dev/null; then
        log_error "Node.js version $node_version is not supported. Required: >=$required_version"
        exit 1
    fi
    
    # 检查npm
    if ! command -v npm &> /dev/null; then
        log_error "npm not found"
        exit 1
    fi
    
    log_success "Environment check passed"
}

# 安装依赖
install_dependencies() {
    log_step "2/8 Installing dependencies..."
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    log_success "Dependencies installed"
}

# 清理环境
clean_environment() {
    log_step "3/8 Cleaning environment..."
    
    # 清理构建目录
    rm -rf dist/
    rm -rf build/
    rm -rf coverage/
    rm -rf tmp/
    
    # 清理日志
    rm -rf logs/dev/
    
    # 清理node_modules/.cache
    rm -rf node_modules/.cache/
    
    log_success "Environment cleaned"
}

# 代码质量检查
quality_check() {
    log_step "4/8 Running quality checks..."
    
    # TypeScript类型检查
    log_info "Running TypeScript type check..."
    npm run type-check
    
    # ESLint检查
    log_info "Running ESLint..."
    npm run lint
    
    # Prettier格式检查
    log_info "Running Prettier check..."
    npm run format:check
    
    log_success "Quality checks passed"
}

# 运行测试
run_tests() {
    log_step "5/8 Running tests..."
    
    # 单元测试
    log_info "Running unit tests..."
    npm run test:unit
    
    # 集成测试
    log_info "Running integration tests..."
    npm run test:integration
    
    # 生成覆盖率报告
    log_info "Generating coverage report..."
    npm run test:coverage
    
    log_success "All tests passed"
}

# 构建项目
build_project() {
    log_step "6/8 Building project..."
    
    # 运行主构建脚本
    ./scripts/build/build.sh production
    
    log_success "Project built successfully"
}

# 验证构建
verify_build() {
    log_step "7/8 Verifying build..."
    
    # 检查构建输出
    if [ ! -d "dist" ]; then
        log_error "Build output directory not found"
        exit 1
    fi
    
    # 检查CLI功能
    log_info "Testing CLI functionality..."
    if ! node dist/cli.js --version; then
        log_error "CLI test failed"
        exit 1
    fi
    
    # 检查库导入
    log_info "Testing library import..."
    if ! node -e "require('./dist/index.js')"; then
        log_error "Library import test failed"
        exit 1
    fi
    
    log_success "Build verification passed"
}

# 生成发布包
generate_package() {
    log_step "8/8 Generating release package..."
    
    local version=$(node -p "require('./package.json').version")
    local package_name="rcc-v4-${version}.tar.gz"
    
    # 创建发布包
    cd dist
    tar -czf "../${package_name}" .
    cd ..
    
    log_success "Release package generated: $package_name"
    
    # 显示包信息
    local package_size=$(du -sh "$package_name" | cut -f1)
    log_info "Package size: $package_size"
    log_info "Package location: $(pwd)/$package_name"
}

# 显示构建摘要
show_summary() {
    echo ""
    echo "🎉 One-Click Build Completed Successfully!"
    echo "========================================"
    echo ""
    echo "📦 Build Output:"
    echo "  - Distribution: ./dist/"
    echo "  - Reports: ./build/reports/"
    echo "  - Coverage: ./coverage/"
    echo ""
    echo "🚀 Next Steps:"
    echo "  - Test locally: ./scripts/build/one-click-start.sh"
    echo "  - Install globally: npm install -g ./dist/"
    echo "  - Deploy package: Upload the generated .tar.gz file"
    echo ""
    echo "📊 Build Statistics:"
    if [ -f "build/reports/build-stats.json" ]; then
        cat build/reports/build-stats.json | jq '.' 2>/dev/null || cat build/reports/build-stats.json
    fi
}

# 错误处理
handle_error() {
    log_error "Build failed at step: $1"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "  - Check the error messages above"
    echo "  - Ensure all dependencies are installed"
    echo "  - Verify Node.js version compatibility"
    echo "  - Check for any uncommitted changes"
    echo ""
    echo "📝 Logs:"
    echo "  - Build logs: ./build/reports/"
    echo "  - Test logs: ./coverage/"
    exit 1
}

# 主函数
main() {
    local start_time=$(date +%s)
    
    echo "🚀 RCC v4.0 One-Click Build System"
    echo "=================================="
    echo ""
    
    # 设置错误处理
    trap 'handle_error "Unknown"' ERR
    
    check_environment
    install_dependencies
    clean_environment
    quality_check
    run_tests
    build_project
    verify_build
    generate_package
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    show_summary
    
    echo ""
    log_success "✅ Total build time: ${duration}s"
}

# 执行主函数
main "$@"
```

### 3. 一键启动脚本
```bash
#!/bin/bash
# scripts/build/one-click-start.sh

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# 配置
RCC_PORT="${RCC_PORT:-3456}"
RCC_CONFIG_PATH="${RCC_CONFIG_PATH:-$HOME/.route-claudecode/config}"
RCC_LOG_LEVEL="${RCC_LOG_LEVEL:-info}"

# 检查构建
check_build() {
    log_step "1/5 Checking build..."
    
    if [ ! -d "dist" ]; then
        log_error "Build not found. Please run one-click-build.sh first"
        exit 1
    fi
    
    if [ ! -f "dist/cli.js" ]; then
        log_error "CLI not found in build output"
        exit 1
    fi
    
    log_success "Build check passed"
}

# 检查配置
check_config() {
    log_step "2/5 Checking configuration..."
    
    # 创建配置目录
    mkdir -p "$RCC_CONFIG_PATH"
    
    # 检查Provider配置
    local providers_config="$RCC_CONFIG_PATH/providers.json"
    if [ ! -f "$providers_config" ]; then
        log_warning "Provider config not found, creating default..."
        
        cat > "$providers_config" << 'EOF'
{
  "providers": [
    {
      "name": "openai",
      "protocol": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "serverType": "openai",
      "models": ["gpt-4", "gpt-3.5-turbo"],
      "apiKey": "${OPENAI_API_KEY}",
      "availability": true
    }
  ]
}
EOF
    fi
    
    # 检查路由配置
    local routing_config="$RCC_CONFIG_PATH/routing.json"
    if [ ! -f "$routing_config" ]; then
        log_warning "Routing config not found, creating default..."
        
        cat > "$routing_config" << 'EOF'
{
  "routes": [
    {
      "category": "default",
      "rules": [
        {
          "provider": "openai",
          "model": "gpt-4",
          "weight": 1.0
        }
      ]
    }
  ]
}
EOF
    fi
    
    log_success "Configuration check completed"
}

# 检查环境变量
check_environment() {
    log_step "3/5 Checking environment variables..."
    
    local missing_vars=()
    
    # 检查必需的环境变量
    if [ -z "$OPENAI_API_KEY" ]; then
        missing_vars+=("OPENAI_API_KEY")
    fi
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_warning "Missing environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        echo ""
        log_warning "Some features may not work without proper API keys"
    else
        log_success "Environment variables check passed"
    fi
}

# 检查端口
check_port() {
    log_step "4/5 Checking port availability..."
    
    if lsof -Pi :$RCC_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_error "Port $RCC_PORT is already in use"
        echo ""
        echo "🔍 Port usage:"
        lsof -Pi :$RCC_PORT -sTCP:LISTEN
        echo ""
        echo "💡 Solutions:"
        echo "  - Kill the process using the port"
        echo "  - Use a different port: RCC_PORT=3457 $0"
        exit 1
    fi
    
    log_success "Port $RCC_PORT is available"
}

# 启动服务
start_service() {
    log_step "5/5 Starting RCC service..."
    
    echo ""
    echo "🚀 Starting RCC v4.0 Server"
    echo "============================"
    echo "Port: $RCC_PORT"
    echo "Config: $RCC_CONFIG_PATH"
    echo "Log Level: $RCC_LOG_LEVEL"
    echo ""
    echo "🌐 Service URLs:"
    echo "  - API Endpoint: http://localhost:$RCC_PORT/v1/messages"
    echo "  - Health Check: http://localhost:$RCC_PORT/health"
    echo "  - Management UI: http://localhost:$RCC_PORT/ui/"
    echo ""
    echo "📝 Claude Code Setup:"
    echo "  export ANTHROPIC_BASE_URL=http://localhost:$RCC_PORT"
    echo "  export ANTHROPIC_API_KEY=rcc-proxy-key"
    echo ""
    echo "⏹️  Press Ctrl+C to stop the server"
    echo ""
    
    # 启动服务
    node dist/cli.js start \
        --port "$RCC_PORT" \
        --config "$RCC_CONFIG_PATH" \
        --log-level "$RCC_LOG_LEVEL"
}

# 错误处理
handle_error() {
    log_error "Startup failed: $1"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "  - Check if the build is complete"
    echo "  - Verify configuration files"
    echo "  - Ensure required environment variables are set"
    echo "  - Check if the port is available"
    echo ""
    echo "📚 Documentation:"
    echo "  - Configuration: .claude/project-details/modules/config/"
    echo "  - Troubleshooting: .claude/project-details/modules/client/"
    exit 1
}

# 显示启动信息
show_startup_info() {
    echo "🎯 RCC v4.0 One-Click Start"
    echo "==========================="
    echo ""
    echo "📋 Startup Checklist:"
    echo "  ✓ Build verification"
    echo "  ✓ Configuration setup"
    echo "  ✓ Environment check"
    echo "  ✓ Port availability"
    echo "  ✓ Service startup"
    echo ""
}

# 主函数
main() {
    show_startup_info
    
    # 设置错误处理
    trap 'handle_error "Unknown error"' ERR
    
    check_build
    check_config
    check_environment
    check_port
    start_service
}

# 执行主函数
main "$@"
```

### 4. 监听构建脚本
```bash
#!/bin/bash
# scripts/build/build-watch.sh

set -e

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 配置
WATCH_DIRS="src config"
BUILD_SCRIPT="./scripts/build/build.sh"
BUILD_MODE="${1:-development}"

log_info "🔍 Starting RCC v4.0 Watch Build"
log_info "Build mode: $BUILD_MODE"
log_info "Watching directories: $WATCH_DIRS"

# 初始构建
log_info "Running initial build..."
$BUILD_SCRIPT "$BUILD_MODE"
log_success "Initial build completed"

# 监听文件变化
if command -v fswatch &> /dev/null; then
    log_info "Using fswatch for file monitoring..."
    fswatch -o $WATCH_DIRS | while read f; do
        log_info "Files changed, rebuilding..."
        $BUILD_SCRIPT "$BUILD_MODE"
        log_success "Rebuild completed"
    done
elif command -v inotifywait &> /dev/null; then
    log_info "Using inotifywait for file monitoring..."
    while inotifywait -r -e modify,create,delete $WATCH_DIRS; do
        log_info "Files changed, rebuilding..."
        $BUILD_SCRIPT "$BUILD_MODE"
        log_success "Rebuild completed"
    done
else
    log_warning "No file watcher found (fswatch or inotifywait)"
    log_warning "Falling back to polling mode..."
    
    while true; do
        sleep 2
        if find $WATCH_DIRS -newer dist/cli.js 2>/dev/null | grep -q .; then
            log_info "Files changed, rebuilding..."
            $BUILD_SCRIPT "$BUILD_MODE"
            log_success "Rebuild completed"
        fi
    done
fi
```

## package.json构建脚本

```json
{
  "scripts": {
    "build": "./scripts/build/build.sh production",
    "build:dev": "./scripts/build/build.sh development",
    "build:watch": "./scripts/build/build-watch.sh development",
    "build:clean": "./scripts/build/clean-build.sh",
    "build:one-click": "./scripts/build/one-click-build.sh",
    "start:one-click": "./scripts/build/one-click-start.sh",
    "type-check": "./scripts/build/type-check.sh",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write src/**/*.ts",
    "format:check": "prettier --check src/**/*.ts",
    "prebuild": "npm run type-check && npm run lint",
    "postbuild": "npm run verify-build",
    "verify-build": "node -e \"require('./dist/cli.js')\" && echo 'Build verification passed'"
  }
}
```

## 质量要求

### 构建系统标准
- ✅ 完整的TypeScript编译
- ✅ 代码质量检查 (ESLint, Prettier)
- ✅ 自动化测试集成
- ✅ 构建结果验证
- ✅ 性能优化和分析
- ✅ 一键构建和部署

### 构建输出要求
- ✅ 可执行的CLI工具
- ✅ 可导入的库文件
- ✅ 完整的类型定义
- ✅ 源码映射文件
- ✅ 构建报告和统计

这个编译构建系统为RCC v4.0提供了完整的构建流程，确保项目的高质量构建和便捷部署。