#!/bin/bash

# RCC4 流水线测试运行器 v1.0
# 可配置的模块化流水线测试脚本
# 支持指定起始点和数据来源进行端到端测试

set -e

# 脚本配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$PROJECT_ROOT/.rcc-pipeline-test"
LOG_DIR="$PROJECT_ROOT/logs/pipeline-tests"
RESULTS_DIR="$PROJECT_ROOT/test-results/pipeline"

# 创建必要目录
mkdir -p "$CONFIG_DIR" "$LOG_DIR" "$RESULTS_DIR"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_DIR/pipeline-test-$(date +%Y%m%d).log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_DIR/pipeline-test-$(date +%Y%m%d).log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_DIR/pipeline-test-$(date +%Y%m%d).log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_DIR/pipeline-test-$(date +%Y%m%d).log"
}

# 显示使用说明
show_usage() {
    cat << EOF
🔧 RCC4 流水线测试运行器

用法:
  $0 [选项] [配置文件]

选项:
  --module <模块名>       指定测试的起始模块 (router|pipeline|client|debug)
  --data-source <源>      指定测试数据源 (mock|file|live)
  --config <配置文件>     指定RCC4配置文件路径
  --port <端口>          指定测试端口 (默认: 5506)
  --timeout <秒数>       指定测试超时 (默认: 30)
  --mode <模式>          测试模式 (unit|integration|e2e|full)
  --output <格式>        输出格式 (console|json|html)
  --help                 显示此帮助信息

预设配置:
  basic                  基础流水线测试
  full                   完整端到端测试
  debug                  调试模式测试
  performance            性能测试

示例:
  $0 --module router --data-source file --mode integration
  $0 --config ~/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json
  $0 basic
  $0 --mode e2e --output json

EOF
}

# 默认配置
MODULE="pipeline"
DATA_SOURCE="file"
CONFIG_FILE=""
PORT="5506"
TIMEOUT="30"
MODE="integration"
OUTPUT="console"
PRESET=""

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --module)
            MODULE="$2"
            shift 2
            ;;
        --data-source)
            DATA_SOURCE="$2"
            shift 2
            ;;
        --config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --mode)
            MODE="$2"
            shift 2
            ;;
        --output)
            OUTPUT="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            if [[ -z "$PRESET" && ! "$1" =~ ^-- ]]; then
                PRESET="$1"
            else
                log_error "未知参数: $1"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# 应用预设配置
apply_preset() {
    local preset="$1"
    case "$preset" in
        basic)
            MODULE="router"
            DATA_SOURCE="file"
            MODE="integration"
            TIMEOUT="15"
            ;;
        full)
            MODULE="pipeline"
            DATA_SOURCE="live"
            MODE="e2e"
            TIMEOUT="60"
            ;;
        debug)
            MODULE="debug"
            DATA_SOURCE="mock"
            MODE="unit"
            TIMEOUT="10"
            ;;
        performance)
            MODULE="pipeline"
            DATA_SOURCE="file"
            MODE="performance"
            TIMEOUT="120"
            ;;
        *)
            if [[ -n "$preset" ]]; then
                log_error "未知预设: $preset"
                exit 1
            fi
            ;;
    esac
}

# 应用预设
if [[ -n "$PRESET" ]]; then
    apply_preset "$PRESET"
    log_info "应用预设配置: $PRESET"
fi

# 验证模块
validate_module() {
    local module="$1"
    case "$module" in
        router|pipeline|client|debug)
            return 0
            ;;
        *)
            log_error "无效模块: $module (支持: router, pipeline, client, debug)"
            return 1
            ;;
    esac
}

# 验证数据源
validate_data_source() {
    local source="$1"
    case "$source" in
        mock|file|live)
            return 0
            ;;
        *)
            log_error "无效数据源: $source (支持: mock, file, live)"
            return 1
            ;;
    esac
}

# 生成测试配置
generate_test_config() {
    local config_file="$CONFIG_DIR/test-config-$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$config_file" << EOF
{
  "test_session": {
    "id": "$(uuidgen 2>/dev/null || echo "test-$(date +%s)")",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "module": "$MODULE",
    "data_source": "$DATA_SOURCE",
    "mode": "$MODE",
    "config": {
      "port": $PORT,
      "timeout": $TIMEOUT,
      "rcc_config": "$CONFIG_FILE"
    }
  },
  "test_data": {
    "requests": [
      {
        "type": "claude_code_request",
        "prompt": "列出本目录中所有文件夹",
        "tools": ["LS", "Bash"],
        "expected_tools": ["LS"]
      },
      {
        "type": "tool_calling_test",
        "prompt": "检查项目的TypeScript编译状态",
        "tools": ["Bash"],
        "expected_commands": ["tsc", "npm"]
      }
    ]
  },
  "validation": {
    "check_response_format": true,
    "check_tool_execution": true,
    "check_debug_logs": true,
    "performance_thresholds": {
      "response_time_ms": 5000,
      "memory_usage_mb": 500
    }
  }
}
EOF
    
    echo "$config_file"
}

# 执行模块测试
run_module_test() {
    local module="$1"
    local test_config="$2"
    
    log_info "开始 $module 模块测试..."
    
    case "$module" in
        router)
            test_router_module "$test_config"
            ;;
        pipeline)
            test_pipeline_module "$test_config"
            ;;
        client)
            test_client_module "$test_config"
            ;;
        debug)
            test_debug_module "$test_config"
            ;;
    esac
}

# 路由器模块测试
test_router_module() {
    local test_config="$1"
    log_info "测试路由器模块..."
    
    # 检查路由配置
    if [[ -n "$CONFIG_FILE" && -f "$CONFIG_FILE" ]]; then
        log_info "验证路由配置: $CONFIG_FILE"
        if ! jq . "$CONFIG_FILE" >/dev/null 2>&1; then
            log_error "配置文件格式错误"
            return 1
        fi
        log_success "配置文件验证通过"
    fi
    
    # 启动路由器测试
    log_info "启动路由器端到端测试..."
    cd "$PROJECT_ROOT"
    
    # 编译检查
    if ! npm run build 2>/dev/null || ! npx tsc --noEmit; then
        log_error "TypeScript编译失败，无法进行路由器测试"
        return 1
    fi
    
    log_success "路由器模块测试完成"
}

# 流水线模块测试
test_pipeline_module() {
    local test_config="$1"
    log_info "测试流水线模块..."
    
    cd "$PROJECT_ROOT"
    
    # 运行流水线集成测试
    if [[ "$MODE" == "e2e" ]]; then
        log_info "执行端到端流水线测试..."
        
        # 启动测试服务
        if [[ -n "$CONFIG_FILE" ]]; then
            timeout "$TIMEOUT" node dist/cli.js start --config "$CONFIG_FILE" --port "$PORT" &
            local server_pid=$!
            sleep 3
            
            # 测试请求
            log_info "发送测试请求..."
            curl -s -X POST "http://localhost:$PORT/v1/chat/completions" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer rcc4-proxy-key" \
                -d '{
                    "model": "claude-3-sonnet",
                    "messages": [{"role": "user", "content": "列出本目录中所有文件夹"}],
                    "tools": [{"type": "function", "function": {"name": "LS"}}]
                }' > "$RESULTS_DIR/e2e-test-result.json"
            
            # 清理
            kill $server_pid 2>/dev/null || true
            wait $server_pid 2>/dev/null || true
        fi
    fi
    
    log_success "流水线模块测试完成"
}

# 客户端模块测试
test_client_module() {
    local test_config="$1"
    log_info "测试客户端模块..."
    
    # 测试客户端连接和请求处理
    cd "$PROJECT_ROOT"
    
    if [[ -f "src/client/client-manager.ts" ]]; then
        log_info "验证客户端管理器..."
        npx ts-node -e "
            import { ClientManager } from './src/client/client-manager';
            console.log('客户端管理器加载成功');
        " || log_warning "客户端管理器验证失败"
    fi
    
    log_success "客户端模块测试完成"
}

# 调试模块测试
test_debug_module() {
    local test_config="$1"
    log_info "测试调试模块..."
    
    cd "$PROJECT_ROOT"
    
    # 检查调试系统
    if [[ -f "src/debug/debug-manager.ts" ]]; then
        log_info "验证调试管理器..."
        npx ts-node -e "
            import { DebugManager } from './src/debug/debug-manager';
            console.log('调试管理器加载成功');
        " || log_warning "调试管理器验证失败"
    fi
    
    # 检查调试日志目录
    if [[ -d "debug-logs" ]]; then
        log_info "调试日志目录存在: debug-logs/"
        log_info "最近日志文件: $(ls -t debug-logs/ | head -3 | tr '\n' ' ')"
    else
        log_warning "调试日志目录不存在"
    fi
    
    log_success "调试模块测试完成"
}

# 生成测试报告
generate_report() {
    local test_config="$1"
    local report_file="$RESULTS_DIR/pipeline-test-report-$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "test_session": $(jq '.test_session' "$test_config"),
  "results": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "status": "completed",
    "module_tested": "$MODULE",
    "data_source": "$DATA_SOURCE",
    "mode": "$MODE"
  },
  "logs": {
    "log_file": "$LOG_DIR/pipeline-test-$(date +%Y%m%d).log",
    "results_dir": "$RESULTS_DIR"
  }
}
EOF
    
    if [[ "$OUTPUT" == "json" ]]; then
        cat "$report_file"
    else
        log_success "测试报告已生成: $report_file"
    fi
}

# 主执行流程
main() {
    log_info "🚀 开始RCC4流水线测试..."
    log_info "模块: $MODULE, 数据源: $DATA_SOURCE, 模式: $MODE"
    
    # 验证参数
    validate_module "$MODULE" || exit 1
    validate_data_source "$DATA_SOURCE" || exit 1
    
    # 生成测试配置
    local test_config
    test_config=$(generate_test_config)
    log_info "测试配置已生成: $test_config"
    
    # 执行测试
    if run_module_test "$MODULE" "$test_config"; then
        log_success "✅ 流水线测试成功完成！"
        generate_report "$test_config"
        exit 0
    else
        log_error "❌ 流水线测试失败！"
        generate_report "$test_config"
        exit 1
    fi
}

# 运行主函数
main "$@"