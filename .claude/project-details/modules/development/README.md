# 开发调试系统

## 模块概述

开发调试系统提供完整的开发环境支持，包括日志管理、调试命令、开发工具脚本等，确保开发过程的高效性和便利性。

## 目录结构

```
scripts/
├── README.md                        # 开发脚本文档
├── dev/                            # 开发相关脚本
│   ├── setup-dev-env.sh            # 开发环境设置
│   ├── start-dev.sh                # 开发模式启动
│   ├── debug-mode.sh               # 调试模式启动
│   ├── hot-reload.sh               # 热重载启动
│   └── clean-dev.sh                # 清理开发环境
├── build/                          # 编译相关脚本
│   ├── build.sh                    # 构建脚本
│   ├── build-watch.sh              # 监听构建
│   ├── clean-build.sh              # 清理构建
│   └── type-check.sh               # 类型检查
├── test/                           # 测试相关脚本
│   ├── run-tests.sh                # 运行测试
│   ├── test-watch.sh               # 监听测试
│   ├── coverage.sh                 # 覆盖率测试
│   └── generate-replay-tests.sh    # 生成回放测试
├── debug/                          # 调试工具脚本
│   ├── curl-commands.sh            # cURL命令集合
│   ├── log-viewer.sh               # 日志查看器
│   ├── debug-session.sh            # 调试会话管理
│   └── health-check.sh             # 健康检查
├── utils/                          # 工具脚本
│   ├── generate-types.sh           # 生成类型定义
│   ├── update-deps.sh              # 更新依赖
│   ├── format-code.sh              # 代码格式化
│   └── lint-fix.sh                 # 代码检查修复
└── templates/                      # 模板文件
    ├── module-template/            # 模块模板
    ├── test-template/              # 测试模板
    └── config-template/            # 配置模板
```

## 文件命名规则

### 1. 日志文件命名规则
```bash
# 运行时日志路径: ~/.route-claudecode/logs/
# 按端口组织，使用当前时区时间命名
# 命名格式: port-[port]/[module]-[YYYY-MM-DD_HH-MM-SS].log

~/.route-claudecode/logs/
├── port-3456/                      # 端口3456的日志
│   ├── client-2024-08-15_14-30-22.log      # 客户端日志
│   ├── router-2024-08-15_14-30-22.log      # 路由器日志
│   ├── pipeline-2024-08-15_14-30-22.log    # 流水线日志
│   ├── debug-2024-08-15_14-30-22.log       # Debug系统日志
│   ├── error-2024-08-15_14-30-22.log       # 错误日志
│   ├── access-2024-08-15_14-30-22.log      # 访问日志
│   └── performance-2024-08-15_14-30-22.log # 性能日志
├── port-8080/                      # 端口8080的日志
│   ├── client-2024-08-15_15-45-10.log
│   └── router-2024-08-15_15-45-10.log
└── current/                        # 当前活跃日志的软链接
    ├── port-3456 -> ../port-3456/
    └── port-8080 -> ../port-8080/

# 开发日志路径: ./logs/dev/
# 开发环境按会话组织
./logs/dev/
├── session-2024-08-15_14-30-22/    # 开发会话日志
│   ├── dev-server.log              # 开发服务器日志
│   ├── hot-reload.log              # 热重载日志
│   ├── build.log                   # 构建日志
│   └── test.log                    # 测试日志
└── current -> session-2024-08-15_14-30-22/  # 当前会话软链接
```

### 2. 配置文件命名规则
```bash
# 开发配置文件
config/dev/
├── providers.dev.json              # 开发环境Provider配置
├── routing.dev.json                # 开发环境路由配置
├── global.dev.json                 # 开发环境全局配置
└── debug.dev.json                  # 开发环境Debug配置

# 测试配置文件
config/test/
├── providers.test.json             # 测试环境Provider配置
├── routing.test.json               # 测试环境路由配置
└── mock-providers.test.json        # 测试Mock配置

# 生产配置文件
config/prod/
├── providers.prod.json             # 生产环境Provider配置
├── routing.prod.json               # 生产环境路由配置
└── global.prod.json                # 生产环境全局配置
```

### 3. 临时文件命名规则
```bash
# 临时文件路径: ./tmp/
# 使用当前时区时间戳，格式: YYYY-MM-DD_HH-MM-SS
./tmp/
├── build/                          # 构建临时文件
│   ├── tsc-output/                 # TypeScript编译输出
│   └── webpack-cache/              # Webpack缓存
├── debug/                          # 调试临时文件
│   ├── port-3456/                  # 按端口分组调试文件
│   │   ├── session-2024-08-15_14-30-22/  # 调试会话文件
│   │   └── curl-responses-2024-08-15_14-30-22/  # cURL响应文件
│   └── port-8080/
├── test/                           # 测试临时文件
│   ├── coverage-2024-08-15_14-30-22/     # 覆盖率报告
│   └── test-results-2024-08-15_14-30-22/ # 测试结果
└── logs/                           # 临时日志
    ├── dev-2024-08-15_14-30-22.log       # 开发临时日志
    └── debug-2024-08-15_14-30-22.log     # 调试临时日志
```

## 开发调试命令

### 1. cURL命令脚本
```bash
#!/bin/bash
# scripts/debug/curl-commands.sh

# RCC v4.0 调试cURL命令集合
# 使用方法: ./curl-commands.sh [command] [options]

set -e

# 配置
RCC_HOST="http://localhost:3456"
RCC_PORT="${RCC_PORT:-3456}"
LOG_DIR="./tmp/debug/port-${RCC_PORT}/curl-responses-$(date +'%Y-%m-%d_%H-%M-%S')"
TIMESTAMP=$(date +'%Y-%m-%d_%H-%M-%S')
READABLE_TIME=$(date +'%Y-%m-%d %H:%M:%S %Z')

# 创建日志目录
mkdir -p "$LOG_DIR"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
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

# 健康检查
health_check() {
    log_info "Checking RCC server health at $READABLE_TIME..."
    
    local response_file="$LOG_DIR/health_check_$TIMESTAMP.json"
    
    curl -s -w "\n%{http_code}\n" \
         -H "Content-Type: application/json" \
         "$RCC_HOST/health" \
         > "$response_file"
    
    local http_code=$(tail -n1 "$response_file")
    local response_body=$(head -n -1 "$response_file")
    
    if [ "$http_code" = "200" ]; then
        log_success "Server is healthy"
        echo "Response: $response_body"
    else
        log_error "Server health check failed (HTTP $http_code)"
        echo "Response: $response_body"
    fi
}

# 测试简单对话
test_simple_chat() {
    log_info "Testing simple chat..."
    
    local response_file="$LOG_DIR/simple_chat_$TIMESTAMP.json"
    
    curl -s -w "\n%{http_code}\n" \
         -X POST \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer rcc-proxy-key" \
         -d '{
           "model": "claude-3-5-sonnet-20241022",
           "max_tokens": 100,
           "messages": [
             {
               "role": "user",
               "content": "Hello, this is a test message."
             }
           ]
         }' \
         "$RCC_HOST/v1/messages" \
         > "$response_file"
    
    local http_code=$(tail -n1 "$response_file")
    local response_body=$(head -n -1 "$response_file")
    
    if [ "$http_code" = "200" ]; then
        log_success "Simple chat test passed"
        echo "Response saved to: $response_file"
    else
        log_error "Simple chat test failed (HTTP $http_code)"
        echo "Response: $response_body"
    fi
}

# 测试流式对话
test_streaming_chat() {
    log_info "Testing streaming chat..."
    
    local response_file="$LOG_DIR/streaming_chat_$TIMESTAMP.txt"
    
    curl -s -w "\n%{http_code}\n" \
         -X POST \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer rcc-proxy-key" \
         -d '{
           "model": "claude-3-5-sonnet-20241022",
           "max_tokens": 100,
           "stream": true,
           "messages": [
             {
               "role": "user",
               "content": "Count from 1 to 5."
             }
           ]
         }' \
         "$RCC_HOST/v1/messages" \
         > "$response_file"
    
    local http_code=$(tail -n1 "$response_file")
    
    if [ "$http_code" = "200" ]; then
        log_success "Streaming chat test passed"
        echo "Response saved to: $response_file"
    else
        log_error "Streaming chat test failed (HTTP $http_code)"
        cat "$response_file"
    fi
}

# 测试工具调用
test_tool_calling() {
    log_info "Testing tool calling..."
    
    local response_file="$LOG_DIR/tool_calling_$TIMESTAMP.json"
    
    curl -s -w "\n%{http_code}\n" \
         -X POST \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer rcc-proxy-key" \
         -d '{
           "model": "claude-3-5-sonnet-20241022",
           "max_tokens": 200,
           "messages": [
             {
               "role": "user",
               "content": "What is the weather like in San Francisco?"
             }
           ],
           "tools": [
             {
               "name": "get_weather",
               "description": "Get weather information for a location",
               "input_schema": {
                 "type": "object",
                 "properties": {
                   "location": {
                     "type": "string",
                     "description": "The city and state, e.g. San Francisco, CA"
                   }
                 },
                 "required": ["location"]
               }
             }
           ]
         }' \
         "$RCC_HOST/v1/messages" \
         > "$response_file"
    
    local http_code=$(tail -n1 "$response_file")
    local response_body=$(head -n -1 "$response_file")
    
    if [ "$http_code" = "200" ]; then
        log_success "Tool calling test passed"
        echo "Response saved to: $response_file"
    else
        log_error "Tool calling test failed (HTTP $http_code)"
        echo "Response: $response_body"
    fi
}

# 测试错误处理
test_error_handling() {
    log_info "Testing error handling..."
    
    local response_file="$LOG_DIR/error_handling_$TIMESTAMP.json"
    
    # 发送无效请求
    curl -s -w "\n%{http_code}\n" \
         -X POST \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer invalid-key" \
         -d '{
           "model": "invalid-model",
           "messages": []
         }' \
         "$RCC_HOST/v1/messages" \
         > "$response_file"
    
    local http_code=$(tail -n1 "$response_file")
    local response_body=$(head -n -1 "$response_file")
    
    if [ "$http_code" != "200" ]; then
        log_success "Error handling test passed (HTTP $http_code)"
        echo "Error response: $response_body"
    else
        log_warning "Error handling test unexpected success"
        echo "Response: $response_body"
    fi
}

# 性能测试
test_performance() {
    log_info "Running performance test..."
    
    local response_file="$LOG_DIR/performance_$TIMESTAMP.txt"
    local concurrent_requests=5
    local total_requests=20
    
    echo "Running $total_requests requests with $concurrent_requests concurrent connections..." > "$response_file"
    
    # 使用ab (Apache Bench) 进行性能测试
    if command -v ab &> /dev/null; then
        ab -n $total_requests -c $concurrent_requests \
           -H "Content-Type: application/json" \
           -H "Authorization: Bearer rcc-proxy-key" \
           -p <(echo '{
             "model": "claude-3-5-sonnet-20241022",
             "max_tokens": 50,
             "messages": [{"role": "user", "content": "Hello"}]
           }') \
           "$RCC_HOST/v1/messages" >> "$response_file"
        
        log_success "Performance test completed"
        echo "Results saved to: $response_file"
    else
        log_warning "Apache Bench (ab) not found, skipping performance test"
    fi
}

# 主函数
main() {
    case "${1:-help}" in
        "health")
            health_check
            ;;
        "chat")
            test_simple_chat
            ;;
        "stream")
            test_streaming_chat
            ;;
        "tools")
            test_tool_calling
            ;;
        "error")
            test_error_handling
            ;;
        "perf")
            test_performance
            ;;
        "all")
            health_check
            test_simple_chat
            test_streaming_chat
            test_tool_calling
            test_error_handling
            test_performance
            ;;
        "help"|*)
            echo "RCC v4.0 调试cURL命令"
            echo ""
            echo "使用方法: $0 [command]"
            echo ""
            echo "可用命令:"
            echo "  health    - 健康检查"
            echo "  chat      - 测试简单对话"
            echo "  stream    - 测试流式对话"
            echo "  tools     - 测试工具调用"
            echo "  error     - 测试错误处理"
            echo "  perf      - 性能测试"
            echo "  all       - 运行所有测试"
            echo "  help      - 显示帮助信息"
            echo ""
            echo "响应文件保存在: $LOG_DIR"
            echo ""
            echo "环境变量:"
            echo "  RCC_PORT=3456           - 指定测试的RCC端口 (默认3456)"
            echo "  RCC_HOST=localhost      - 指定RCC主机地址"
            ;;
    esac
}

# 执行主函数
main "$@"
```

### 2. 日志查看器脚本
```bash
#!/bin/bash
# scripts/debug/log-viewer.sh

# RCC v4.0 日志查看器
# 使用方法: ./log-viewer.sh [module] [options]

set -e

# 配置
RCC_PORT="${RCC_PORT:-3456}"
LOG_DIR="$HOME/.route-claudecode/logs/port-${RCC_PORT}"
DEV_LOG_DIR="./logs/dev/current"
TEMP_LOG_DIR="./tmp/logs"
CURRENT_TIME=$(date +'%Y-%m-%d %H:%M:%S %Z')

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志级别颜色映射
colorize_log() {
    sed -E \
        -e "s/\[ERROR\]/${RED}[ERROR]${NC}/g" \
        -e "s/\[WARN\]/${YELLOW}[WARN]${NC}/g" \
        -e "s/\[INFO\]/${BLUE}[INFO]${NC}/g" \
        -e "s/\[DEBUG\]/${CYAN}[DEBUG]${NC}/g" \
        -e "s/\[SUCCESS\]/${GREEN}[SUCCESS]${NC}/g"
}

# 查看实时日志
tail_logs() {
    local module="$1"
    local log_file
    
    if [ "$module" = "dev" ]; then
        # 查找最新的开发日志文件
        log_file=$(find "$DEV_LOG_DIR" -name "dev-server.log" -type f 2>/dev/null | head -1)
        if [ -z "$log_file" ]; then
            log_file="$DEV_LOG_DIR/dev-server.log"
        fi
    else
        # 查找最新的模块日志文件
        log_file=$(find "$LOG_DIR" -name "${module}-*.log" -type f 2>/dev/null | sort -r | head -1)
        if [ -z "$log_file" ]; then
            log_file="$LOG_DIR/${module}-$(date +'%Y-%m-%d_%H-%M-%S').log"
        fi
    fi
    
    if [ -f "$log_file" ]; then
        echo -e "${BLUE}[INFO]${NC} [$CURRENT_TIME] Tailing log file: $log_file"
        echo -e "${BLUE}[INFO]${NC} Port: $RCC_PORT, Module: $module"
        echo -e "${BLUE}[INFO]${NC} Press Ctrl+C to stop"
        echo ""
        tail -f "$log_file" | colorize_log
    else
        echo -e "${RED}[ERROR]${NC} [$CURRENT_TIME] Log file not found: $log_file"
        echo -e "${YELLOW}[INFO]${NC} Searching for logs in port-$RCC_PORT directory..."
        list_available_logs
    fi
}

# 查看历史日志
view_logs() {
    local module="$1"
    local lines="${2:-100}"
    local log_file
    
    if [ "$module" = "dev" ]; then
        # 查找最新的开发日志文件
        log_file=$(find "$DEV_LOG_DIR" -name "dev-server.log" -type f 2>/dev/null | head -1)
    else
        # 查找最新的模块日志文件
        log_file=$(find "$LOG_DIR" -name "${module}-*.log" -type f 2>/dev/null | sort -r | head -1)
    fi
    
    if [ -f "$log_file" ]; then
        echo -e "${BLUE}[INFO]${NC} [$CURRENT_TIME] Viewing last $lines lines of: $log_file"
        echo -e "${BLUE}[INFO]${NC} Port: $RCC_PORT, Module: $module"
        echo ""
        tail -n "$lines" "$log_file" | colorize_log
    else
        echo -e "${RED}[ERROR]${NC} [$CURRENT_TIME] Log file not found for module: $module"
        echo -e "${YELLOW}[INFO]${NC} Searching in port-$RCC_PORT directory..."
        list_available_logs
    fi
}

# 搜索日志
search_logs() {
    local module="$1"
    local pattern="$2"
    local log_file
    
    if [ "$module" = "dev" ]; then
        log_file="$DEV_LOG_DIR/dev-server-$(date +%Y-%m-%d).log"
    else
        log_file="$LOG_DIR/${module}-$(date +%Y-%m-%d).log"
    fi
    
    if [ -f "$log_file" ]; then
        echo -e "${BLUE}[INFO]${NC} Searching for '$pattern' in: $log_file"
        echo ""
        grep -n --color=always "$pattern" "$log_file" | colorize_log
    else
        echo -e "${RED}[ERROR]${NC} Log file not found: $log_file"
        list_available_logs
    fi
}

# 列出可用日志
list_available_logs() {
    echo -e "${BLUE}[INFO]${NC} [$CURRENT_TIME] Available log files:"
    echo -e "${BLUE}[INFO]${NC} Current port: $RCC_PORT"
    echo ""
    
    echo -e "${PURPLE}Production logs (Port $RCC_PORT):${NC}"
    if [ -d "$LOG_DIR" ]; then
        ls -la "$LOG_DIR"/*.log 2>/dev/null | while read -r line; do
            echo "  $line"
        done || echo "  No production logs found for port $RCC_PORT"
    else
        echo "  Log directory not found: $LOG_DIR"
        echo "  Creating directory..."
        mkdir -p "$LOG_DIR"
    fi
    
    echo ""
    echo -e "${PURPLE}All ports production logs:${NC}"
    local base_log_dir="$HOME/.route-claudecode/logs"
    if [ -d "$base_log_dir" ]; then
        for port_dir in "$base_log_dir"/port-*; do
            if [ -d "$port_dir" ]; then
                local port=$(basename "$port_dir" | cut -d'-' -f2)
                echo "  Port $port:"
                ls -la "$port_dir"/*.log 2>/dev/null | sed 's/^/    /' || echo "    No logs found"
            fi
        done
    fi
    
    echo ""
    echo -e "${PURPLE}Development logs:${NC}"
    if [ -d "$DEV_LOG_DIR" ]; then
        ls -la "$DEV_LOG_DIR"/*.log 2>/dev/null | while read -r line; do
            echo "  $line"
        done || echo "  No development logs found"
    else
        echo "  Development log directory not found: $DEV_LOG_DIR"
    fi
}

# 清理旧日志
clean_old_logs() {
    local days="${1:-7}"
    
    echo -e "${YELLOW}[WARNING]${NC} [$CURRENT_TIME] Cleaning logs older than $days days..."
    
    # 清理所有端口的生产日志
    local base_log_dir="$HOME/.route-claudecode/logs"
    if [ -d "$base_log_dir" ]; then
        local cleaned_count=0
        for port_dir in "$base_log_dir"/port-*; do
            if [ -d "$port_dir" ]; then
                local port=$(basename "$port_dir" | cut -d'-' -f2)
                local files_before=$(find "$port_dir" -name "*.log" | wc -l)
                find "$port_dir" -name "*.log" -mtime +$days -delete
                local files_after=$(find "$port_dir" -name "*.log" | wc -l)
                local cleaned=$((files_before - files_after))
                if [ $cleaned -gt 0 ]; then
                    echo -e "${GREEN}[SUCCESS]${NC} Cleaned $cleaned log files from port $port"
                    cleaned_count=$((cleaned_count + cleaned))
                fi
            fi
        done
        echo -e "${GREEN}[SUCCESS]${NC} Total production logs cleaned: $cleaned_count"
    fi
    
    # 清理开发日志
    local dev_base_dir="./logs/dev"
    if [ -d "$dev_base_dir" ]; then
        local dev_cleaned=$(find "$dev_base_dir" -name "*.log" -mtime +$days | wc -l)
        find "$dev_base_dir" -name "*.log" -mtime +$days -delete
        find "$dev_base_dir" -type d -empty -mtime +$days -delete 2>/dev/null || true
        echo -e "${GREEN}[SUCCESS]${NC} Cleaned $dev_cleaned development log files"
    fi
    
    # 清理临时日志
    if [ -d "$TEMP_LOG_DIR" ]; then
        local temp_cleaned=$(find "$TEMP_LOG_DIR" -name "*.log" -mtime +$days | wc -l)
        find "$TEMP_LOG_DIR" -name "*.log" -mtime +$days -delete
        echo -e "${GREEN}[SUCCESS]${NC} Cleaned $temp_cleaned temporary log files"
    fi
}

# 分析错误日志
analyze_errors() {
    local module="$1"
    local log_file
    
    if [ "$module" = "dev" ]; then
        log_file="$DEV_LOG_DIR/dev-server-$(date +%Y-%m-%d).log"
    else
        log_file="$LOG_DIR/${module}-$(date +%Y-%m-%d).log"
    fi
    
    if [ -f "$log_file" ]; then
        echo -e "${BLUE}[INFO]${NC} Analyzing errors in: $log_file"
        echo ""
        
        echo -e "${RED}Error summary:${NC}"
        grep -c "\[ERROR\]" "$log_file" 2>/dev/null || echo "0 errors found"
        
        echo ""
        echo -e "${RED}Recent errors:${NC}"
        grep "\[ERROR\]" "$log_file" | tail -10 | colorize_log
        
        echo ""
        echo -e "${YELLOW}Warning summary:${NC}"
        grep -c "\[WARN\]" "$log_file" 2>/dev/null || echo "0 warnings found"
        
    else
        echo -e "${RED}[ERROR]${NC} Log file not found: $log_file"
    fi
}

# 主函数
main() {
    local command="${1:-help}"
    local module="$2"
    local param3="$3"
    
    case "$command" in
        "tail")
            if [ -z "$module" ]; then
                echo -e "${RED}[ERROR]${NC} Module name required"
                echo "Usage: $0 tail [module]"
                exit 1
            fi
            tail_logs "$module"
            ;;
        "view")
            if [ -z "$module" ]; then
                echo -e "${RED}[ERROR]${NC} Module name required"
                echo "Usage: $0 view [module] [lines]"
                exit 1
            fi
            view_logs "$module" "$param3"
            ;;
        "search")
            if [ -z "$module" ] || [ -z "$param3" ]; then
                echo -e "${RED}[ERROR]${NC} Module name and search pattern required"
                echo "Usage: $0 search [module] [pattern]"
                exit 1
            fi
            search_logs "$module" "$param3"
            ;;
        "list")
            list_available_logs
            ;;
        "clean")
            clean_old_logs "$module"
            ;;
        "errors")
            if [ -z "$module" ]; then
                echo -e "${RED}[ERROR]${NC} Module name required"
                echo "Usage: $0 errors [module]"
                exit 1
            fi
            analyze_errors "$module"
            ;;
        "help"|*)
            echo "RCC v4.0 日志查看器"
            echo ""
            echo "使用方法: $0 [command] [options]"
            echo ""
            echo "可用命令:"
            echo "  tail [module]           - 实时查看日志"
            echo "  view [module] [lines]   - 查看历史日志 (默认100行)"
            echo "  search [module] [pattern] - 搜索日志内容"
            echo "  list                    - 列出可用日志文件"
            echo "  clean [days]            - 清理旧日志 (默认7天)"
            echo "  errors [module]         - 分析错误日志"
            echo "  help                    - 显示帮助信息"
            echo ""
            echo "可用模块:"
            echo "  client, router, pipeline, debug, error, dev"
            echo ""
            echo "环境变量:"
            echo "  RCC_PORT=3456           - 指定要查看的端口日志 (默认3456)"
            echo ""
            echo "示例:"
            echo "  $0 tail client          - 实时查看客户端日志"
            echo "  $0 view router 50       - 查看路由器日志最后50行"
            echo "  $0 search pipeline ERROR - 搜索流水线错误日志"
            echo "  RCC_PORT=8080 $0 tail client - 查看端口8080的客户端日志"
            ;;
    esac
}

# 执行主函数
main "$@"
```

### 3. 调试会话管理脚本
```bash
#!/bin/bash
# scripts/debug/debug-session.sh

# RCC v4.0 调试会话管理器
# 使用方法: ./debug-session.sh [command] [options]

set -e

# 配置
RCC_PORT="${RCC_PORT:-3456}"
DEBUG_DIR="$HOME/.route-claudecode/debug/port-${RCC_PORT}"
SESSION_DIR="./tmp/debug/port-${RCC_PORT}/sessions"
TIMESTAMP=$(date +'%Y-%m-%d_%H-%M-%S')
READABLE_TIME=$(date +'%Y-%m-%d %H:%M:%S %Z')

# 创建会话目录
mkdir -p "$SESSION_DIR"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# 启动调试会话
start_debug_session() {
    local session_name="${1:-debug_$TIMESTAMP}"
    local session_dir="$SESSION_DIR/$session_name"
    
    mkdir -p "$session_dir"
    
    log_info "Starting debug session: $session_name at $READABLE_TIME"
    
    # 创建会话配置
    cat > "$session_dir/session.json" << EOF
{
  "sessionName": "$session_name",
  "port": $RCC_PORT,
  "startTime": "$(date +'%Y-%m-%d %H:%M:%S %Z')",
  "startTimeISO": "$(date -Iseconds)",
  "pid": $$,
  "debugLevel": "debug",
  "modules": ["client", "router", "pipeline", "debug"],
  "logFiles": {
    "session": "$session_dir/session.log",
    "requests": "$session_dir/requests.log",
    "errors": "$session_dir/errors.log"
  }
}
EOF
    
    # 启动日志记录
    echo "$(date +'%Y-%m-%d %H:%M:%S %Z') [INFO] Debug session started: $session_name (Port: $RCC_PORT)" > "$session_dir/session.log"
    
    log_success "Debug session started: $session_name"
    log_info "Port: $RCC_PORT"
    log_info "Session directory: $session_dir"
    log_info "Started at: $READABLE_TIME"
    log_info "Use 'stop $session_name' to end the session"
    
    # 设置环境变量
    export RCC_DEBUG_SESSION="$session_name"
    export RCC_DEBUG_DIR="$session_dir"
    export RCC_DEBUG_PORT="$RCC_PORT"
    export RCC_LOG_LEVEL="debug"
    
    echo "# Export these environment variables:"
    echo "export RCC_DEBUG_SESSION=\"$session_name\""
    echo "export RCC_DEBUG_DIR=\"$session_dir\""
    echo "export RCC_DEBUG_PORT=\"$RCC_PORT\""
    echo "export RCC_LOG_LEVEL=\"debug\""
}

# 停止调试会话
stop_debug_session() {
    local session_name="$1"
    local session_dir="$SESSION_DIR/$session_name"
    
    if [ ! -d "$session_dir" ]; then
        log_error "Debug session not found: $session_name"
        return 1
    fi
    
    log_info "Stopping debug session: $session_name at $READABLE_TIME"
    
    # 更新会话配置
    local session_file="$session_dir/session.json"
    if [ -f "$session_file" ]; then
        # 使用jq更新结束时间（如果可用）
        if command -v jq &> /dev/null; then
            jq --arg endTime "$(date +'%Y-%m-%d %H:%M:%S %Z')" --arg endTimeISO "$(date -Iseconds)" '.endTime = $endTime | .endTimeISO = $endTimeISO' "$session_file" > "$session_file.tmp" && mv "$session_file.tmp" "$session_file"
        fi
    fi
    
    # 记录会话结束
    echo "$(date +'%Y-%m-%d %H:%M:%S %Z') [INFO] Debug session ended: $session_name (Port: $RCC_PORT)" >> "$session_dir/session.log"
    
    # 生成会话报告
    generate_session_report "$session_name"
    
    log_success "Debug session stopped: $session_name"
    log_info "Session report: $session_dir/report.txt"
}

# 列出调试会话
list_debug_sessions() {
    log_info "Debug sessions for port $RCC_PORT at $READABLE_TIME:"
    
    if [ ! -d "$SESSION_DIR" ]; then
        log_warning "No debug sessions found for port $RCC_PORT"
        log_info "Session directory: $SESSION_DIR"
        return
    fi
    
    local session_count=0
    for session_dir in "$SESSION_DIR"/*; do
        if [ -d "$session_dir" ]; then
            local session_name=$(basename "$session_dir")
            local session_file="$session_dir/session.json"
            
            if [ -f "$session_file" ]; then
                local start_time=$(grep -o '"startTime": "[^"]*"' "$session_file" | cut -d'"' -f4)
                local end_time=$(grep -o '"endTime": "[^"]*"' "$session_file" | cut -d'"' -f4)
                local port=$(grep -o '"port": [0-9]*' "$session_file" | cut -d':' -f2 | tr -d ' ')
                
                if [ -z "$end_time" ]; then
                    echo -e "  ${GREEN}●${NC} $session_name (Port: $port, Started: $start_time)"
                else
                    echo -e "  ${RED}●${NC} $session_name (Port: $port, Ended: $end_time)"
                fi
                session_count=$((session_count + 1))
            else
                echo -e "  ${YELLOW}●${NC} $session_name (invalid session)"
            fi
        fi
    done
    
    if [ $session_count -eq 0 ]; then
        log_warning "No valid debug sessions found for port $RCC_PORT"
    else
        log_info "Found $session_count debug sessions for port $RCC_PORT"
    fi
    
    # 显示其他端口的会话
    local base_session_dir="./tmp/debug"
    if [ -d "$base_session_dir" ]; then
        echo ""
        log_info "Sessions from other ports:"
        for port_dir in "$base_session_dir"/port-*; do
            if [ -d "$port_dir" ]; then
                local other_port=$(basename "$port_dir" | cut -d'-' -f2)
                if [ "$other_port" != "$RCC_PORT" ]; then
                    local other_sessions=$(find "$port_dir/sessions" -maxdepth 1 -type d 2>/dev/null | wc -l)
                    if [ $other_sessions -gt 1 ]; then  # 减1因为包含sessions目录本身
                        echo -e "  Port $other_port: $((other_sessions - 1)) sessions"
                    fi
                fi
            fi
        done
    fi
}

# 生成会话报告
generate_session_report() {
    local session_name="$1"
    local session_dir="$SESSION_DIR/$session_name"
    local report_file="$session_dir/report.txt"
    
    log_info "Generating session report..."
    
    cat > "$report_file" << EOF
RCC v4.0 Debug Session Report
=============================

Session Name: $session_name
Generated: $(date -Iseconds)

EOF
    
    # 会话信息
    if [ -f "$session_dir/session.json" ]; then
        echo "Session Information:" >> "$report_file"
        cat "$session_dir/session.json" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    # 请求统计
    if [ -f "$session_dir/requests.log" ]; then
        echo "Request Statistics:" >> "$report_file"
        echo "Total requests: $(wc -l < "$session_dir/requests.log")" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    # 错误统计
    if [ -f "$session_dir/errors.log" ]; then
        echo "Error Statistics:" >> "$report_file"
        echo "Total errors: $(wc -l < "$session_dir/errors.log")" >> "$report_file"
        echo "" >> "$report_file"
        
        if [ -s "$session_dir/errors.log" ]; then
            echo "Recent Errors:" >> "$report_file"
            tail -10 "$session_dir/errors.log" >> "$report_file"
            echo "" >> "$report_file"
        fi
    fi
    
    # 性能统计
    echo "Performance Metrics:" >> "$report_file"
    echo "Session duration: $(calculate_session_duration "$session_dir")" >> "$report_file"
    echo "" >> "$report_file"
    
    log_success "Session report generated: $report_file"
}

# 计算会话持续时间
calculate_session_duration() {
    local session_dir="$1"
    local session_file="$session_dir/session.json"
    
    if [ -f "$session_file" ]; then
        local start_time=$(grep -o '"startTime": "[^"]*"' "$session_file" | cut -d'"' -f4)
        local end_time=$(grep -o '"endTime": "[^"]*"' "$session_file" | cut -d'"' -f4)
        
        if [ -n "$start_time" ] && [ -n "$end_time" ]; then
            # 计算时间差（需要date命令支持）
            local start_epoch=$(date -d "$start_time" +%s 2>/dev/null || echo "0")
            local end_epoch=$(date -d "$end_time" +%s 2>/dev/null || echo "0")
            local duration=$((end_epoch - start_epoch))
            
            if [ $duration -gt 0 ]; then
                echo "${duration}s"
            else
                echo "Unknown"
            fi
        else
            echo "Ongoing"
        fi
    else
        echo "Unknown"
    fi
}

# 清理调试会话
clean_debug_sessions() {
    local days="${1:-7}"
    
    log_warning "Cleaning debug sessions older than $days days..."
    
    if [ -d "$SESSION_DIR" ]; then
        find "$SESSION_DIR" -type d -mtime +$days -exec rm -rf {} + 2>/dev/null || true
        log_success "Cleaned old debug sessions"
    fi
}

# 主函数
main() {
    local command="${1:-help}"
    local param2="$2"
    
    case "$command" in
        "start")
            start_debug_session "$param2"
            ;;
        "stop")
            if [ -z "$param2" ]; then
                log_error "Session name required"
                echo "Usage: $0 stop [session_name]"
                exit 1
            fi
            stop_debug_session "$param2"
            ;;
        "list")
            list_debug_sessions
            ;;
        "report")
            if [ -z "$param2" ]; then
                log_error "Session name required"
                echo "Usage: $0 report [session_name]"
                exit 1
            fi
            generate_session_report "$param2"
            ;;
        "clean")
            clean_debug_sessions "$param2"
            ;;
        "help"|*)
            echo "RCC v4.0 调试会话管理器"
            echo ""
            echo "使用方法: $0 [command] [options]"
            echo ""
            echo "可用命令:"
            echo "  start [name]    - 启动调试会话"
            echo "  stop [name]     - 停止调试会话"
            echo "  list            - 列出所有调试会话"
            echo "  report [name]   - 生成会话报告"
            echo "  clean [days]    - 清理旧会话 (默认7天)"
            echo "  help            - 显示帮助信息"
            echo ""
            echo "环境变量:"
            echo "  RCC_PORT=3456           - 指定调试会话的端口 (默认3456)"
            echo ""
            echo "示例:"
            echo "  $0 start my-debug       - 启动名为my-debug的会话"
            echo "  $0 stop my-debug        - 停止my-debug会话"
            echo "  $0 list                 - 列出当前端口的所有会话"
            echo "  RCC_PORT=8080 $0 start test - 在端口8080启动test会话"
            ;;
    esac
}

# 执行主函数
main "$@"
```

## 开发环境配置

### 1. 开发环境变量
```bash
# .env.development
NODE_ENV=development
RCC_PORT=3456
RCC_HOST=127.0.0.1
RCC_LOG_LEVEL=debug
RCC_DEBUG_ENABLED=true

# 测试API密钥（开发用）
OPENAI_API_KEY_DEV=sk-dev-test-key
ANTHROPIC_API_KEY_DEV=sk-ant-dev-test-key
GEMINI_API_KEY_DEV=dev-test-key

# 开发配置路径
RCC_CONFIG_PATH=./config/dev
RCC_LOG_PATH=./logs/dev
RCC_DEBUG_PATH=./tmp/debug

# 热重载配置
RCC_HOT_RELOAD=true
RCC_WATCH_CONFIG=true
RCC_AUTO_RESTART=true
```

### 2. 开发启动脚本
```bash
#!/bin/bash
# scripts/dev/start-dev.sh

set -e

# 加载开发环境变量
if [ -f ".env.development" ]; then
    export $(cat .env.development | grep -v '^#' | xargs)
fi

# 创建必要目录
mkdir -p logs/dev
mkdir -p tmp/debug
mkdir -p config/dev

# 启动开发服务器
echo "🚀 Starting RCC v4.0 Development Server..."
echo "Port: $RCC_PORT"
echo "Log Level: $RCC_LOG_LEVEL"
echo "Config Path: $RCC_CONFIG_PATH"

# 使用nodemon进行热重载
if command -v nodemon &> /dev/null; then
    nodemon \
        --watch src \
        --watch config \
        --ext ts,json \
        --exec "npm run build && node dist/cli.js start --port $RCC_PORT --config $RCC_CONFIG_PATH --debug"
else
    echo "⚠️  nodemon not found, using regular node"
    npm run build && node dist/cli.js start --port $RCC_PORT --config $RCC_CONFIG_PATH --debug
fi
```

## 质量要求

### 开发工具标准
- ✅ 完整的调试命令集合
- ✅ 实时日志查看和分析
- ✅ 调试会话管理
- ✅ 自动化测试脚本
- ✅ 性能监控工具
- ✅ 错误追踪机制

### 文件管理规范
- ✅ 统一的文件命名规则
- ✅ 自动日志轮转和清理
- ✅ 临时文件管理
- ✅ 配置文件版本管理
- ✅ 敏感信息保护

这个开发调试系统为RCC v4.0提供了完整的开发支持，确保开发过程的高效性和便利性。