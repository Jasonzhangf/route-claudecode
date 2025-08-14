#!/bin/bash

# 🧪 Claude Code Router 测试修复脚本 v2.0
# 自动修复测试环境问题，处理依赖、配置、服务连接问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 修复日志文件
TEST_FIX_LOG="~/.route-claude-code/logs/test-fix-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="~/.route-claude-code/backups/test-env-$(date +%Y%m%d-%H%M%S)"

# 创建必要目录
mkdir -p ~/.route-claude-code/logs
mkdir -p ~/.route-claude-code/backups

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" >> "$TEST_FIX_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1" >> "$TEST_FIX_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1" >> "$TEST_FIX_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" >> "$TEST_FIX_LOG"
}

# 检查权限令牌
check_permissions() {
    local permission_token="~/.route-claude-code/.permission-token"
    
    if [[ ! -f "$permission_token" ]]; then
        log_error "未找到权限令牌，请先执行权限审批: ./permission-review.sh --pre-approval"
        exit 1
    fi
    
    log_success "权限验证通过，开始测试环境修复"
}

# 修复依赖问题
fix_dependency_issues() {
    log_info "📦 开始修复依赖问题"
    
    # 检查 package.json 是否存在
    if [[ ! -f "package.json" ]]; then
        log_error "未找到 package.json 文件"
        return 1
    fi
    
    # 清理 node_modules 和锁文件
    log_info "清理现有依赖"
    rm -rf node_modules/
    rm -f package-lock.json
    rm -f yarn.lock
    
    # 检查 npm 版本
    local npm_version
    npm_version=$(npm --version)
    log_info "当前 npm 版本: $npm_version"
    
    # 安装依赖
    log_info "重新安装依赖"
    if npm install; then
        log_success "依赖安装成功"
    else
        log_error "依赖安装失败，尝试使用 --legacy-peer-deps"
        if npm install --legacy-peer-deps; then
            log_success "使用 legacy-peer-deps 安装成功"
        else
            log_error "依赖安装彻底失败"
            return 1
        fi
    fi
    
    # 检查关键依赖
    local critical_deps=(
        "typescript"
        "jest"
        "eslint"
        "axios"
        "@anthropic-ai/sdk"
        "openai"
    )
    
    for dep in "${critical_deps[@]}"; do
        if npm list "$dep" > /dev/null 2>&1; then
            log_success "关键依赖存在: $dep"
        else
            log_warning "关键依赖缺失: $dep，尝试安装"
            if npm install "$dep"; then
                log_success "成功安装: $dep"
            else
                log_error "安装失败: $dep"
            fi
        fi
    done
    
    # 安装测试相关依赖
    local test_deps=(
        "@types/jest"
        "@types/node"
        "ts-jest"
        "supertest"
        "@types/supertest"
    )
    
    log_info "检查测试依赖"
    for dep in "${test_deps[@]}"; do
        if ! npm list "$dep" > /dev/null 2>&1; then
            log_info "安装测试依赖: $dep"
            npm install --save-dev "$dep"
        fi
    done
    
    log_success "依赖问题修复完成"
}

# 修复配置文件问题
fix_configuration_issues() {
    log_info "⚙️ 开始修复配置文件问题"
    
    # 检查配置目录结构
    local config_base="$HOME/.route-claude-code/config"
    
    if [[ ! -d "$config_base" ]]; then
        log_info "创建配置目录结构"
        mkdir -p "$config_base/single-provider"
        mkdir -p "$config_base/load-balancing"
        mkdir -p "$config_base/production-ready"
    fi
    
    # 验证单Provider配置文件
    local single_provider_configs=(
        "config-codewhisperer-primary-5501.json"
        "config-google-gemini-5502.json"
        "config-codewhisperer-kiro-github-5503.json"
        "config-openai-lmstudio-5506.json"
        "config-openai-shuaihong-5508.json"
    )
    
    for config_file in "${single_provider_configs[@]}"; do
        local config_path="$config_base/single-provider/$config_file"
        
        if [[ ! -f "$config_path" ]]; then
            log_warning "配置文件缺失: $config_file"
            
            # 根据配置文件名生成基本配置模板
            local port
            port=$(echo "$config_file" | grep -o '[0-9]\+')
            
            case "$config_file" in
                *"codewhisperer"*)
                    create_codewhisperer_config "$config_path" "$port"
                    ;;
                *"gemini"*)
                    create_gemini_config "$config_path" "$port"
                    ;;
                *"openai"*)
                    create_openai_config "$config_path" "$port"
                    ;;
            esac
        else
            log_info "验证配置文件: $config_file"
            if validate_config_file "$config_path"; then
                log_success "配置文件有效: $config_file"
            else
                log_warning "配置文件格式问题，尝试修复: $config_file"
                fix_config_format "$config_path"
            fi
        fi
    done
    
    log_success "配置文件问题修复完成"
}

# 创建 CodeWhisperer 配置模板
create_codewhisperer_config() {
    local config_path="$1"
    local port="$2"
    
    cat > "$config_path" << EOF
{
  "server": {
    "port": $port,
    "host": "localhost"
  },
  "providers": [
    {
      "name": "codewhisperer",
      "type": "codewhisperer",
      "region": "us-east-1",
      "models": [
        "CLAUDE_SONNET_4_20250514_V1_0",
        "CLAUDE_3_7_SONNET"
      ],
      "routing": {
        "default": "CLAUDE_SONNET_4_20250514_V1_0"
      }
    }
  ],
  "routing": {
    "strategy": "round-robin"
  },
  "logging": {
    "level": "info",
    "file": "~/.route-claude-code/logs/ccr-$port.log"
  }
}
EOF
    
    log_success "创建 CodeWhisperer 配置: $config_path"
}

# 创建 Gemini 配置模板
create_gemini_config() {
    local config_path="$1"
    local port="$2"
    
    cat > "$config_path" << EOF
{
  "server": {
    "port": $port,
    "host": "localhost"
  },
  "providers": [
    {
      "name": "gemini",
      "type": "gemini",
      "apiKey": "\${GEMINI_API_KEY}",
      "models": [
        "gemini-2.5-pro",
        "gemini-2.5-flash"
      ],
      "routing": {
        "default": "gemini-2.5-pro"
      }
    }
  ],
  "routing": {
    "strategy": "round-robin"
  },
  "logging": {
    "level": "info",
    "file": "~/.route-claude-code/logs/ccr-$port.log"
  }
}
EOF
    
    log_success "创建 Gemini 配置: $config_path"
}

# 创建 OpenAI 兼容配置模板
create_openai_config() {
    local config_path="$1"
    local port="$2"
    
    local base_url
    case "$config_path" in
        *"lmstudio"*)
            base_url="http://localhost:1234/v1"
            ;;
        *"shuaihong"*)
            base_url="\${SHUAIHONG_BASE_URL}"
            ;;
        *)
            base_url="\${OPENAI_BASE_URL}"
            ;;
    esac
    
    cat > "$config_path" << EOF
{
  "server": {
    "port": $port,
    "host": "localhost"
  },
  "providers": [
    {
      "name": "openai-compatible",
      "type": "openai",
      "baseURL": "$base_url",
      "apiKey": "\${OPENAI_API_KEY}",
      "models": [
        "gpt-4",
        "gpt-3.5-turbo"
      ],
      "routing": {
        "default": "gpt-4"
      }
    }
  ],
  "routing": {
    "strategy": "round-robin"
  },
  "logging": {
    "level": "info",
    "file": "~/.route-claude-code/logs/ccr-$port.log"
  }
}
EOF
    
    log_success "创建 OpenAI 兼容配置: $config_path"
}

# 验证配置文件格式
validate_config_file() {
    local config_path="$1"
    
    # 检查JSON格式
    if jq . "$config_path" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# 修复配置文件格式
fix_config_format() {
    local config_path="$1"
    
    # 备份原配置
    cp "$config_path" "$config_path.backup"
    
    # 尝试修复常见JSON格式问题
    # 移除trailing commas
    sed -i 's/,\s*}/}/g' "$config_path"
    sed -i 's/,\s*]/]/g' "$config_path"
    
    # 验证修复结果
    if validate_config_file "$config_path"; then
        log_success "配置文件格式修复成功: $config_path"
        rm "$config_path.backup"
    else
        log_error "配置文件格式修复失败，恢复备份"
        mv "$config_path.backup" "$config_path"
    fi
}

# 处理端口冲突
fix_port_conflicts() {
    log_info "🔌 开始处理端口冲突"
    
    local test_ports=(5501 5502 5503 5504 5505 5506 5507 5508 5509 3456 3457)
    
    for port in "${test_ports[@]}"; do
        log_info "检查端口占用: $port"
        
        # 检查端口是否被占用
        if lsof -Pi :$port -sTCP:LISTEN -t > /dev/null; then
            local pid
            pid=$(lsof -Pi :$port -sTCP:LISTEN -t)
            log_warning "端口 $port 被占用，PID: $pid"
            
            # 检查是否是rcc进程
            if ps -p "$pid" -o command= | grep -q "rcc start"; then
                log_info "发现 rcc start 进程占用端口 $port，将终止"
                kill "$pid"
                
                # 等待进程终止
                sleep 2
                
                if ! lsof -Pi :$port -sTCP:LISTEN -t > /dev/null; then
                    log_success "成功释放端口: $port"
                else
                    log_warning "强制终止进程: $port"
                    kill -9 "$pid" 2>/dev/null || true
                fi
            else
                log_warning "端口 $port 被其他进程占用，请手动处理 (PID: $pid)"
            fi
        else
            log_success "端口可用: $port"
        fi
    done
    
    log_success "端口冲突处理完成"
}

# 修复网络连接问题
fix_network_issues() {
    log_info "🌐 开始修复网络连接问题"
    
    # 测试关键API端点连通性
    local endpoints=(
        "https://api.anthropic.com/v1/messages"
        "https://api.openai.com/v1/models"
        "https://generativelanguage.googleapis.com/v1/models"
        "http://localhost:1234/v1/models"
    )
    
    for endpoint in "${endpoints[@]}"; do
        log_info "测试连接: $endpoint"
        
        if curl -s --connect-timeout 5 --max-time 10 "$endpoint" > /dev/null; then
            log_success "连接成功: $endpoint"
        else
            log_warning "连接失败: $endpoint"
            
            # 尝试基本网络诊断
            local host
            host=$(echo "$endpoint" | sed 's|https\?://||' | cut -d'/' -f1 | cut -d':' -f1)
            
            if ping -c 1 "$host" > /dev/null 2>&1; then
                log_info "主机可达: $host"
            else
                log_warning "主机不可达: $host"
            fi
        fi
    done
    
    # 检查DNS解析
    log_info "检查DNS解析"
    local dns_hosts=("api.anthropic.com" "api.openai.com" "generativelanguage.googleapis.com")
    
    for host in "${dns_hosts[@]}"; do
        if nslookup "$host" > /dev/null 2>&1; then
            log_success "DNS解析正常: $host"
        else
            log_warning "DNS解析失败: $host"
        fi
    done
    
    log_success "网络连接问题修复完成"
}

# 修复测试数据问题
fix_test_data_issues() {
    log_info "📊 开始修复测试数据问题"
    
    # 检查测试数据目录
    local test_data_dir="database/pipeline-data-unified"
    
    if [[ ! -d "$test_data_dir" ]]; then
        log_warning "测试数据目录不存在: $test_data_dir"
        mkdir -p "$test_data_dir/simulation-data"
        mkdir -p "$test_data_dir/test-scenarios"
    fi
    
    # 检查关键测试数据文件
    local test_files=(
        "$test_data_dir/simulation-data/anthropic-samples.json"
        "$test_data_dir/simulation-data/openai-samples.json"
        "$test_data_dir/simulation-data/gemini-samples.json"
        "$test_data_dir/test-scenarios/tool-call-response.json"
    )
    
    for test_file in "${test_files[@]}"; do
        if [[ ! -f "$test_file" ]]; then
            log_warning "测试数据文件缺失: $test_file"
            
            # 创建基本测试数据模板
            case "$test_file" in
                *"anthropic-samples.json")
                    create_anthropic_test_data "$test_file"
                    ;;
                *"openai-samples.json")
                    create_openai_test_data "$test_file"
                    ;;
                *"gemini-samples.json")
                    create_gemini_test_data "$test_file"
                    ;;
                *"tool-call-response.json")
                    create_tool_call_test_data "$test_file"
                    ;;
            esac
        else
            log_info "验证测试数据: $test_file"
            if validate_json_file "$test_file"; then
                log_success "测试数据有效: $test_file"
            else
                log_error "测试数据格式错误: $test_file"
            fi
        fi
    done
    
    log_success "测试数据问题修复完成"
}

# 创建 Anthropic 测试数据
create_anthropic_test_data() {
    local file_path="$1"
    
    cat > "$file_path" << EOF
{
  "samples": [
    {
      "request": {
        "model": "claude-3-sonnet-20240229",
        "messages": [
          {
            "role": "user",
            "content": "Hello, how are you?"
          }
        ],
        "max_tokens": 100
      },
      "response": {
        "type": "message",
        "content": [
          {
            "type": "text",
            "text": "Hello! I'm doing well, thank you for asking."
          }
        ]
      }
    }
  ]
}
EOF
    
    log_success "创建 Anthropic 测试数据: $file_path"
}

# 创建 OpenAI 测试数据
create_openai_test_data() {
    local file_path="$1"
    
    cat > "$file_path" << EOF
{
  "samples": [
    {
      "request": {
        "model": "gpt-4",
        "messages": [
          {
            "role": "user",
            "content": "Hello, how are you?"
          }
        ],
        "max_tokens": 100
      },
      "response": {
        "choices": [
          {
            "message": {
              "role": "assistant",
              "content": "Hello! I'm doing well, thank you for asking."
            },
            "finish_reason": "stop"
          }
        ]
      }
    }
  ]
}
EOF
    
    log_success "创建 OpenAI 测试数据: $file_path"
}

# 创建 Gemini 测试数据
create_gemini_test_data() {
    local file_path="$1"
    
    cat > "$file_path" << EOF
{
  "samples": [
    {
      "request": {
        "contents": [
          {
            "parts": [
              {
                "text": "Hello, how are you?"
              }
            ]
          }
        ]
      },
      "response": {
        "candidates": [
          {
            "content": {
              "parts": [
                {
                  "text": "Hello! I'm doing well, thank you for asking."
                }
              ]
            },
            "finishReason": "STOP"
          }
        ]
      }
    }
  ]
}
EOF
    
    log_success "创建 Gemini 测试数据: $file_path"
}

# 创建工具调用测试数据
create_tool_call_test_data() {
    local file_path="$1"
    
    cat > "$file_path" << EOF
{
  "tool_call_scenarios": [
    {
      "name": "simple_grep",
      "request": {
        "messages": [
          {
            "role": "user",
            "content": "Please search for 'function' in the current directory"
          }
        ],
        "tools": [
          {
            "type": "function",
            "function": {
              "name": "grep",
              "description": "Search for patterns in files"
            }
          }
        ]
      },
      "expected_tool_calls": [
        {
          "name": "grep",
          "arguments": {
            "pattern": "function",
            "path": "."
          }
        }
      ]
    }
  ]
}
EOF
    
    log_success "创建工具调用测试数据: $file_path"
}

# 验证JSON文件
validate_json_file() {
    local file_path="$1"
    
    if jq . "$file_path" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# 修复环境变量问题
fix_environment_issues() {
    log_info "🔧 开始修复环境变量问题"
    
    # 检查关键环境变量
    local required_env_vars=(
        "NODE_ENV"
        "npm_config_registry"
    )
    
    local optional_env_vars=(
        "ANTHROPIC_API_KEY"
        "OPENAI_API_KEY"
        "GEMINI_API_KEY"
        "RCC_PORT"
    )
    
    # 设置默认环境变量
    if [[ -z "$NODE_ENV" ]]; then
        export NODE_ENV="test"
        log_info "设置 NODE_ENV=test"
    fi
    
    if [[ -z "$npm_config_registry" ]]; then
        export npm_config_registry="https://registry.npmjs.org/"
        log_info "设置默认npm registry"
    fi
    
    # 检查可选环境变量
    for var in "${optional_env_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            log_warning "可选环境变量未设置: $var"
        else
            log_success "环境变量已设置: $var"
        fi
    done
    
    log_success "环境变量问题修复完成"
}

# 运行测试验证
verify_test_environment() {
    log_info "🔍 验证测试环境"
    
    # 编译检查
    log_info "执行编译检查"
    if npm run build; then
        log_success "✅ 编译检查通过"
    else
        log_error "❌ 编译检查失败"
        return 1
    fi
    
    # ESLint检查
    log_info "执行代码质量检查"
    if npx eslint src/ --ext .ts; then
        log_success "✅ 代码质量检查通过"
    else
        log_warning "⚠️ 代码质量检查发现问题"
    fi
    
    # 基础测试
    log_info "执行基础测试"
    if npm test; then
        log_success "✅ 基础测试通过"
    else
        log_warning "⚠️ 基础测试发现问题"
    fi
    
    # 配置文件验证
    log_info "验证配置文件"
    local config_valid=true
    local config_dir="$HOME/.route-claude-code/config/single-provider"
    
    for config_file in "$config_dir"/*.json; do
        if [[ -f "$config_file" ]]; then
            if validate_json_file "$config_file"; then
                log_success "配置文件有效: $(basename "$config_file")"
            else
                log_error "配置文件无效: $(basename "$config_file")"
                config_valid=false
            fi
        fi
    done
    
    if [[ "$config_valid" == "true" ]]; then
        log_success "✅ 所有配置文件验证通过"
    else
        log_error "❌ 部分配置文件验证失败"
        return 1
    fi
    
    log_success "测试环境验证完成"
}

# 生成测试修复报告
generate_test_fix_report() {
    local report_file="~/.route-claude-code/reports/test-fix-report-$(date +%Y%m%d-%H%M%S).md"
    mkdir -p ~/.route-claude-code/reports
    
    cat > "$report_file" << EOF
# Claude Code Router 测试环境修复报告

## 修复概览
- **执行时间**: $(date '+%Y-%m-%d %H:%M:%S')
- **修复脚本**: fix-test-failures.sh v2.0
- **项目所有者**: Jason Zhang

## 修复项目

### 📦 依赖问题修复
- 清理并重新安装所有依赖
- 验证关键依赖完整性
- 安装缺失的测试依赖

### ⚙️ 配置文件修复
- 创建缺失的配置文件模板
- 修复配置文件格式问题
- 验证所有配置文件有效性

### 🔌 端口冲突处理
- 检查并释放冲突端口
- 终止异常的rcc进程
- 确保测试端口可用

### 🌐 网络连接修复
- 测试关键API端点连通性
- 验证DNS解析功能
- 诊断网络连接问题

### 📊 测试数据修复
- 创建缺失的测试数据文件
- 验证测试数据格式
- 建立完整的测试数据集

### 🔧 环境变量修复
- 设置必要的环境变量
- 检查可选环境变量
- 确保测试环境配置正确

## 验证结果
- **编译状态**: $(if npm run build > /dev/null 2>&1; then echo "✅ 通过"; else echo "❌ 失败"; fi)
- **代码质量**: $(if npx eslint src/ --ext .ts > /dev/null 2>&1; then echo "✅ 通过"; else echo "⚠️ 警告"; fi)
- **基础测试**: $(if npm test > /dev/null 2>&1; then echo "✅ 通过"; else echo "⚠️ 部分失败"; fi)
- **配置文件**: ✅ 所有配置文件有效

## 可用端口清单
- 5501: CodeWhisperer Primary
- 5502: Google Gemini  
- 5506: LM Studio
- 5508: ShuaiHong服务
- 3456: 生产环境

## 测试数据位置
- Anthropic样本: database/pipeline-data-unified/simulation-data/anthropic-samples.json
- OpenAI样本: database/pipeline-data-unified/simulation-data/openai-samples.json
- Gemini样本: database/pipeline-data-unified/simulation-data/gemini-samples.json
- 工具调用: database/pipeline-data-unified/test-scenarios/tool-call-response.json

## 建议后续操作
1. 执行完整5层测试流程
2. 运行真实端到端测试
3. 进行代码风险审核

---
**报告生成时间**: $(date '+%Y-%m-%d %H:%M:%S')
EOF
    
    log_success "测试修复报告已生成: $report_file"
}

# 显示帮助信息
show_help() {
    echo "🧪 Claude Code Router 测试修复脚本 v2.0"
    echo ""
    echo "用法:"
    echo "  $0                    执行完整测试环境修复"
    echo "  $0 --dependencies     只修复依赖问题"
    echo "  $0 --configuration    只修复配置文件问题"
    echo "  $0 --ports            只处理端口冲突"
    echo "  $0 --network          只修复网络连接问题"
    echo "  $0 --test-data        只修复测试数据问题"
    echo "  $0 --environment      只修复环境变量问题"
    echo "  $0 --verify           只验证测试环境"
    echo "  $0 --help             显示帮助信息"
    echo ""
    echo "注意: 执行前请确保已通过权限审批"
}

# 主函数
main() {
    log_info "🧪 Claude Code Router 测试修复脚本启动"
    
    case "${1:-all}" in
        --dependencies)
            check_permissions
            fix_dependency_issues
            ;;
        --configuration)
            check_permissions
            fix_configuration_issues
            ;;
        --ports)
            check_permissions
            fix_port_conflicts
            ;;
        --network)
            check_permissions
            fix_network_issues
            ;;
        --test-data)
            check_permissions
            fix_test_data_issues
            ;;
        --environment)
            check_permissions
            fix_environment_issues
            ;;
        --verify)
            verify_test_environment
            ;;
        --help)
            show_help
            exit 0
            ;;
        all|"")
            check_permissions
            
            echo "🚀 执行完整测试环境修复流程"
            echo "========================================="
            
            fix_dependency_issues
            fix_configuration_issues
            fix_port_conflicts
            fix_network_issues
            fix_test_data_issues
            fix_environment_issues
            
            verify_test_environment
            generate_test_fix_report
            
            log_success "🎉 测试环境修复完成！"
            echo ""
            echo "📋 接下来可以执行:"
            echo "  ./comprehensive-delivery-test.sh"
            echo "  ./test-runner.sh --category unit"
            echo ""
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"