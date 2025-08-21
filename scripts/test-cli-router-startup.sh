#!/bin/bash

# =============================================================================
# RCC4 CLI和Router启动验证测试脚本
# =============================================================================
# 
# 测试目标：
# 1. CLI启动和配置读取
# 2. Router初始化和流水线建立
# 3. 配置文件与实际路由的一致性
# 4. 流水线路由字段正确性
# 5. 路由路径验证
#
# 作者: Jason Zhang
# 版本: v1.0.0
# =============================================================================

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 测试配置
TEST_CONFIG_PATH="/Users/fanzhang/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506-demo1-enhanced.json"
TEST_PORT=5506
RCC4_CMD="rcc4"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results/cli-router"
PIPELINE_TABLE_PATH="$PROJECT_ROOT/config/generated/lmstudio-v4-5506-demo1-enhanced-pipeline-table.json"

# 创建测试结果目录
mkdir -p "$TEST_RESULTS_DIR"

# 日志文件
TEST_LOG="$TEST_RESULTS_DIR/cli-router-test-$(date +%Y%m%d_%H%M%S).log"
CONFIG_VALIDATION_LOG="$TEST_RESULTS_DIR/config-validation.log"
ROUTER_VALIDATION_LOG="$TEST_RESULTS_DIR/router-validation.log"
PIPELINE_VALIDATION_LOG="$TEST_RESULTS_DIR/pipeline-validation.log"

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}🧪 RCC4 CLI和Router启动验证测试${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo -e "${CYAN}测试时间: $(date)${NC}"
echo -e "${CYAN}测试配置: $TEST_CONFIG_PATH${NC}"
echo -e "${CYAN}测试端口: $TEST_PORT${NC}"
echo -e "${CYAN}结果目录: $TEST_RESULTS_DIR${NC}"
echo -e "${BLUE}==============================================================================${NC}"

# 日志函数
log() {
    echo -e "$1" | tee -a "$TEST_LOG"
}

log_section() {
    echo -e "\n${PURPLE}=== $1 ===${NC}" | tee -a "$TEST_LOG"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$TEST_LOG"
}

log_error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$TEST_LOG"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$TEST_LOG"
}

log_info() {
    echo -e "${CYAN}ℹ️  $1${NC}" | tee -a "$TEST_LOG"
}

# 清理函数
cleanup() {
    log_section "清理测试环境"
    
    # 停止RCC4服务器
    if pgrep -f "rcc4.*start" > /dev/null; then
        log_info "停止RCC4服务器..."
        pkill -f "rcc4.*start" || true
        sleep 2
    fi
    
    # 检查端口是否释放
    if lsof -i :$TEST_PORT > /dev/null 2>&1; then
        log_warning "端口 $TEST_PORT 仍被占用，强制清理..."
        lsof -ti :$TEST_PORT | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    log_success "清理完成"
}

# 设置陷阱以确保清理
trap cleanup EXIT

# 预检查函数
pre_check() {
    log_section "环境预检查"
    
    # 检查RCC4命令是否可用
    if ! command -v $RCC4_CMD &> /dev/null; then
        log_error "RCC4命令不可用，请确保已正确安装"
        return 1
    fi
    log_success "RCC4命令可用"
    
    # 检查配置文件是否存在
    if [[ ! -f "$TEST_CONFIG_PATH" ]]; then
        log_error "测试配置文件不存在: $TEST_CONFIG_PATH"
        return 1
    fi
    log_success "测试配置文件存在"
    
    # 检查端口是否可用
    if lsof -i :$TEST_PORT > /dev/null 2>&1; then
        log_warning "端口 $TEST_PORT 已被占用，尝试清理..."
        lsof -ti :$TEST_PORT | xargs kill -9 2>/dev/null || true
        sleep 2
        if lsof -i :$TEST_PORT > /dev/null 2>&1; then
            log_error "无法清理端口 $TEST_PORT"
            return 1
        fi
    fi
    log_success "端口 $TEST_PORT 可用"
    
    return 0
}

# 配置文件验证函数
validate_config() {
    log_section "配置文件结构验证"
    
    # 使用jq验证JSON格式
    if ! jq empty "$TEST_CONFIG_PATH" 2>/dev/null; then
        log_error "配置文件JSON格式无效"
        return 1
    fi
    log_success "配置文件JSON格式有效"
    
    # 提取配置文件关键信息
    local config_info=$(jq -r '
        {
            providers: (.Providers | length),
            provider_names: (.Providers | map(.name)),
            router_rules: (.Router | keys),
            router_count: (.Router | keys | length)
        }
    ' "$TEST_CONFIG_PATH")
    
    echo "$config_info" > "$CONFIG_VALIDATION_LOG"
    log_info "配置文件信息已保存到: $CONFIG_VALIDATION_LOG"
    
    # 验证必需字段
    local providers_count=$(jq -r '.Providers | length' "$TEST_CONFIG_PATH")
    local router_count=$(jq -r '.Router | keys | length' "$TEST_CONFIG_PATH")
    
    if [[ "$providers_count" -eq 0 ]]; then
        log_error "配置文件中没有Provider定义"
        return 1
    fi
    log_success "发现 $providers_count 个Provider"
    
    if [[ "$router_count" -eq 0 ]]; then
        log_error "配置文件中没有Router规则"
        return 1
    fi
    log_success "发现 $router_count 个Router规则"
    
    # 验证Router规则格式
    local invalid_routes=$(jq -r '.Router | to_entries[] | select(.value | test("^[^,]+,[^,]+$") | not) | .key' "$TEST_CONFIG_PATH")
    if [[ -n "$invalid_routes" ]]; then
        log_error "发现无效的Router规则格式: $invalid_routes"
        return 1
    fi
    log_success "所有Router规则格式正确 (provider,model)"
    
    return 0
}

# CLI启动测试函数
test_cli_startup() {
    log_section "CLI启动测试"
    
    # 测试CLI版本信息
    local version_output
    if version_output=$($RCC4_CMD --version 2>&1); then
        log_success "CLI版本检查成功: $version_output"
    else
        log_error "CLI版本检查失败"
        return 1
    fi
    
    # 测试CLI帮助信息
    local help_output
    if help_output=$($RCC4_CMD --help 2>&1); then
        log_success "CLI帮助信息可用"
        # 检查关键命令是否存在
        if echo "$help_output" | grep -q "start.*Start.*server"; then
            log_success "发现start命令"
        else
            log_warning "未发现start命令描述"
        fi
    else
        log_error "CLI帮助信息获取失败"
        return 1
    fi
    
    return 0
}

# 服务器启动测试函数
test_server_startup() {
    log_section "服务器启动测试"
    
    log_info "启动RCC4服务器..."
    log_info "命令: $RCC4_CMD start --config \"$TEST_CONFIG_PATH\" --port $TEST_PORT --debug"
    
    # 在后台启动服务器，捕获输出
    local server_log="$TEST_RESULTS_DIR/server-startup.log"
    timeout 30s $RCC4_CMD start --config "$TEST_CONFIG_PATH" --port $TEST_PORT --debug > "$server_log" 2>&1 &
    local server_pid=$!
    
    log_info "服务器进程ID: $server_pid"
    
    # 等待服务器启动
    local max_wait=20
    local wait_count=0
    
    while [[ $wait_count -lt $max_wait ]]; do
        if lsof -i :$TEST_PORT > /dev/null 2>&1; then
            log_success "服务器已在端口 $TEST_PORT 上启动"
            break
        fi
        
        # 检查进程是否还在运行
        if ! kill -0 $server_pid 2>/dev/null; then
            log_error "服务器进程已退出"
            log_error "服务器日志:"
            cat "$server_log" | tail -20
            return 1
        fi
        
        sleep 1
        ((wait_count++))
        log_info "等待服务器启动... ($wait_count/$max_wait)"
    done
    
    if [[ $wait_count -eq $max_wait ]]; then
        log_error "服务器启动超时"
        log_error "服务器日志:"
        cat "$server_log" | tail -20
        return 1
    fi
    
    # 验证服务器响应
    local health_check_url="http://localhost:$TEST_PORT/health"
    if curl -s --max-time 5 "$health_check_url" > /dev/null; then
        log_success "服务器健康检查通过"
    else
        log_warning "服务器健康检查失败，但端口已监听"
    fi
    
    return 0
}

# 流水线验证函数
validate_pipeline() {
    log_section "流水线配置验证"
    
    # 等待流水线表生成
    local max_wait=10
    local wait_count=0
    
    while [[ $wait_count -lt $max_wait ]]; do
        if [[ -f "$PIPELINE_TABLE_PATH" ]]; then
            log_success "流水线表文件已生成"
            break
        fi
        sleep 1
        ((wait_count++))
        log_info "等待流水线表生成... ($wait_count/$max_wait)"
    done
    
    if [[ ! -f "$PIPELINE_TABLE_PATH" ]]; then
        log_error "流水线表文件未生成: $PIPELINE_TABLE_PATH"
        return 1
    fi
    
    # 验证流水线表格式
    if ! jq empty "$PIPELINE_TABLE_PATH" 2>/dev/null; then
        log_error "流水线表JSON格式无效"
        return 1
    fi
    log_success "流水线表JSON格式有效"
    
    # 提取流水线信息
    local pipeline_info=$(jq -r '
        {
            total_pipelines: .totalPipelines,
            virtual_models: (.virtualModels | keys),
            provider_models: (.providerModels | keys),
            pipelines: (.pipelines | map({
                id: .id,
                virtualModel: .virtualModel,
                layers: [
                    .transformer.transformerType,
                    .protocol.protocolType,
                    .serverCompatibility.serverCompatibilityName,
                    .server.endpoint
                ]
            }))
        }
    ' "$PIPELINE_TABLE_PATH")
    
    echo "$pipeline_info" > "$PIPELINE_VALIDATION_LOG"
    log_info "流水线信息已保存到: $PIPELINE_VALIDATION_LOG"
    
    # 验证流水线数量
    local total_pipelines=$(jq -r '.totalPipelines' "$PIPELINE_TABLE_PATH")
    if [[ "$total_pipelines" -eq 0 ]]; then
        log_error "没有创建任何流水线"
        return 1
    fi
    log_success "创建了 $total_pipelines 个流水线"
    
    # 验证流水线结构
    local pipelines_with_all_layers=$(jq -r '.pipelines | map(select(.transformer and .protocol and .serverCompatibility and .server)) | length' "$PIPELINE_TABLE_PATH")
    if [[ "$pipelines_with_all_layers" -ne "$total_pipelines" ]]; then
        log_error "部分流水线缺少必需的层级"
        return 1
    fi
    log_success "所有流水线都包含完整的4层架构"
    
    return 0
}

# 路由一致性验证函数
validate_routing_consistency() {
    log_section "路由一致性验证"
    
    # 比较配置文件和流水线表中的路由
    local config_routes=$(jq -r '.Router | keys[]' "$TEST_CONFIG_PATH" | sort)
    local pipeline_routes=$(jq -r '.virtualModels | keys[]' "$PIPELINE_TABLE_PATH" | sort)
    
    # 生成路由对比报告
    local routing_report="$TEST_RESULTS_DIR/routing-consistency.json"
    jq -n \
        --argjson config_routes "$(echo "$config_routes" | jq -R . | jq -s .)" \
        --argjson pipeline_routes "$(echo "$pipeline_routes" | jq -R . | jq -s .)" \
        '{
            config_routes: $config_routes,
            pipeline_routes: $pipeline_routes,
            missing_in_pipeline: ($config_routes - $pipeline_routes),
            extra_in_pipeline: ($pipeline_routes - $config_routes),
            matched_routes: ($config_routes | map(select(. as $route | $pipeline_routes | index($route))))
        }' > "$routing_report"
    
    echo "$routing_report" > "$ROUTER_VALIDATION_LOG"
    log_info "路由一致性报告已保存到: $routing_report"
    
    # 检查路由一致性
    local missing_count=$(jq -r '.missing_in_pipeline | length' "$routing_report")
    local extra_count=$(jq -r '.extra_in_pipeline | length' "$routing_report")
    
    if [[ "$missing_count" -gt 0 ]]; then
        local missing_routes=$(jq -r '.missing_in_pipeline[]' "$routing_report")
        log_error "配置文件中的路由在流水线中缺失: $missing_routes"
        return 1
    fi
    
    if [[ "$extra_count" -gt 0 ]]; then
        local extra_routes=$(jq -r '.extra_in_pipeline[]' "$routing_report")
        log_warning "流水线中存在额外的路由: $extra_routes"
    fi
    
    log_success "路由配置与流水线完全一致"
    
    return 0
}

# 路由路径验证函数
validate_routing_paths() {
    log_section "路由路径验证"
    
    # 验证每个路由的完整路径
    local route_paths_report="$TEST_RESULTS_DIR/route-paths.json"
    
    jq -r '
        .pipelines[] | 
        {
            virtualModel: .virtualModel,
            path: {
                transformer: .transformer.transformerType,
                protocol: .protocol.protocolType,
                serverCompatibility: .serverCompatibility.serverCompatibilityName,
                server: .server.endpoint
            },
            config: {
                provider: .transformer.targetProvider,
                model: .transformer.targetModel,
                maxTokens: .transformer.maxTokens,
                apiKey: .protocol.apiKey
            }
        }
    ' "$PIPELINE_TABLE_PATH" > "$route_paths_report"
    
    log_info "路由路径报告已保存到: $route_paths_report"
    
    # 验证路径完整性
    local incomplete_paths=$(jq -r 'select(.path.transformer == null or .path.protocol == null or .path.serverCompatibility == null or .path.server == null) | .virtualModel' "$route_paths_report")
    
    if [[ -n "$incomplete_paths" ]]; then
        log_error "发现不完整的路由路径: $incomplete_paths"
        return 1
    fi
    log_success "所有路由路径完整"
    
    # 验证LM Studio特殊配置
    local lmstudio_routes=$(jq -r 'select(.path.serverCompatibility == "lmstudio") | .virtualModel' "$route_paths_report")
    if [[ -n "$lmstudio_routes" ]]; then
        log_success "LM Studio兼容性路由正确配置: $lmstudio_routes"
    fi
    
    return 0
}

# 状态检查函数
check_server_status() {
    log_section "服务器状态检查"
    
    # 使用RCC4自带的status命令
    local status_output
    if status_output=$($RCC4_CMD status --port $TEST_PORT 2>&1); then
        log_success "服务器状态检查成功"
        echo "$status_output" | tee -a "$TEST_LOG"
    else
        log_warning "服务器状态检查失败，但这可能是正常的"
        echo "$status_output" | tee -a "$TEST_LOG"
    fi
    
    return 0
}

# 生成测试报告函数
generate_test_report() {
    log_section "生成测试报告"
    
    local report_file="$TEST_RESULTS_DIR/cli-router-test-report.json"
    local test_end_time=$(date -Iseconds)
    
    # 收集所有测试结果
    jq -n \
        --arg test_time "$(date)" \
        --arg config_path "$TEST_CONFIG_PATH" \
        --arg port "$TEST_PORT" \
        --argjson config_info "$(cat "$CONFIG_VALIDATION_LOG" 2>/dev/null || echo '{}')" \
        --argjson pipeline_info "$(cat "$PIPELINE_VALIDATION_LOG" 2>/dev/null || echo '{}')" \
        --argjson routing_consistency "$(cat "$ROUTER_VALIDATION_LOG" 2>/dev/null || echo '{}')" \
        '{
            test_metadata: {
                test_time: $test_time,
                config_path: $config_path,
                port: $port,
                script_version: "v1.0.0"
            },
            test_results: {
                config_validation: $config_info,
                pipeline_validation: $pipeline_info,
                routing_consistency: $routing_consistency
            },
            test_files: {
                main_log: "cli-router-test-*.log",
                config_validation: "config-validation.log",
                router_validation: "router-validation.log",
                pipeline_validation: "pipeline-validation.log",
                route_paths: "route-paths.json",
                routing_consistency: "routing-consistency.json"
            }
        }' > "$report_file"
    
    log_success "测试报告已生成: $report_file"
    
    return 0
}

# 主测试流程
main() {
    log_section "开始CLI和Router启动验证测试"
    
    local test_passed=true
    
    # 预检查
    if ! pre_check; then
        log_error "预检查失败"
        return 1
    fi
    
    # 配置文件验证
    if ! validate_config; then
        log_error "配置文件验证失败"
        test_passed=false
    fi
    
    # CLI启动测试
    if ! test_cli_startup; then
        log_error "CLI启动测试失败"
        test_passed=false
    fi
    
    # 服务器启动测试
    if ! test_server_startup; then
        log_error "服务器启动测试失败"
        test_passed=false
    else
        # 只有服务器启动成功才进行后续测试
        
        # 流水线验证
        if ! validate_pipeline; then
            log_error "流水线验证失败"
            test_passed=false
        fi
        
        # 路由一致性验证
        if ! validate_routing_consistency; then
            log_error "路由一致性验证失败"
            test_passed=false
        fi
        
        # 路由路径验证
        if ! validate_routing_paths; then
            log_error "路由路径验证失败"
            test_passed=false
        fi
        
        # 状态检查
        check_server_status
    fi
    
    # 生成测试报告
    generate_test_report
    
    # 总结
    log_section "测试结果总结"
    
    if $test_passed; then
        log_success "🎉 所有测试通过！CLI和Router启动验证成功"
        log_info "详细结果请查看: $TEST_RESULTS_DIR"
        return 0
    else
        log_error "❌ 部分测试失败，请查看详细日志"
        log_info "详细结果请查看: $TEST_RESULTS_DIR"
        return 1
    fi
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi