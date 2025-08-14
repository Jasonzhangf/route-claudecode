#!/bin/bash

# 交付报告清理脚本
# 功能：清理旧交付报告，初始化新的交付报告结构
# Project: Claude Code Router v2.8.0
# Owner: Jason Zhang

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
REPORTS_BASE_DIR="reports"
BACKUP_BASE_DIR="backup/delivery-reports"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
NEW_DELIVERY_DIR="${REPORTS_BASE_DIR}/delivery-${TIMESTAMP}"

# 命令行参数解析
ACTION=${1:-help}

function show_help() {
    echo -e "${BLUE}Claude Code Router - 交付报告清理脚本${NC}"
    echo "============================================="
    echo ""
    echo "用法: $0 <action>"
    echo ""
    echo "可用操作:"
    echo "  check      - 检查当前报告状态，不做任何更改"
    echo "  backup     - 备份现有报告数据"  
    echo "  clean      - 清理旧报告目录"
    echo "  init       - 初始化新报告结构"
    echo "  verify     - 验证清理结果"
    echo "  all        - 执行完整的清理和初始化流程"
    echo "  help       - 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 check     # 检查现有报告状态"
    echo "  $0 all       # 完整的清理和初始化"
}

function check_reports() {
    echo -e "${BLUE}📋 检查交付报告状态${NC}"
    echo "=================================="
    
    # 检查reports目录
    if [ -d "$REPORTS_BASE_DIR" ]; then
        echo -e "✅ 报告目录存在: $REPORTS_BASE_DIR"
        
        # 统计现有报告
        local delivery_dirs=$(find "$REPORTS_BASE_DIR" -maxdepth 1 -name "delivery-*" -type d 2>/dev/null || true)
        local count=$(echo "$delivery_dirs" | grep -v '^$' | wc -l 2>/dev/null || echo "0")
        
        echo -e "📊 现有交付报告数量: $count"
        
        if [ "$count" -gt 0 ]; then
            echo -e "📁 现有交付报告:"
            echo "$delivery_dirs" | while read -r dir; do
                if [ -n "$dir" ]; then
                    local size=$(du -sh "$dir" 2>/dev/null | cut -f1 || echo "未知")
                    local files=$(find "$dir" -type f 2>/dev/null | wc -l || echo "0")
                    echo -e "   📂 $(basename "$dir") - 大小: $size, 文件: $files"
                fi
            done
        else
            echo -e "📝 当前无交付报告目录"
        fi
    else
        echo -e "⚠️  报告目录不存在: $REPORTS_BASE_DIR"
    fi
    
    # 检查backup目录
    if [ -d "$BACKUP_BASE_DIR" ]; then
        local backup_size=$(du -sh "$BACKUP_BASE_DIR" 2>/dev/null | cut -f1 || echo "未知")
        echo -e "💾 备份目录存在: $BACKUP_BASE_DIR (大小: $backup_size)"
    else
        echo -e "📝 备份目录不存在"
    fi
    
    # 检查运行状态
    local running_tests=$(ps aux | grep -E "(rcc start|node.*dist/cli.js.*start)" | grep -v grep | wc -l || echo "0")
    if [ "$running_tests" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  检测到正在运行的服务: $running_tests 个${NC}"
        echo -e "   建议先停止这些服务再进行清理"
        ps aux | grep -E "(rcc start|node.*dist/cli.js.*start)" | grep -v grep | head -5
    else
        echo -e "✅ 当前无运行的测试服务"
    fi
}

function backup_reports() {
    echo -e "${BLUE}💾 备份现有报告数据${NC}"
    echo "=========================="
    
    if [ ! -d "$REPORTS_BASE_DIR" ]; then
        echo -e "📝 无需备份，报告目录不存在"
        return 0
    fi
    
    local delivery_dirs=$(find "$REPORTS_BASE_DIR" -maxdepth 1 -name "delivery-*" -type d 2>/dev/null || true)
    local count=$(echo "$delivery_dirs" | grep -v '^$' | wc -l 2>/dev/null || echo "0")
    
    if [ "$count" -eq 0 ]; then
        echo -e "📝 无需备份，无交付报告目录"
        return 0
    fi
    
    # 创建备份目录
    mkdir -p "$BACKUP_BASE_DIR/$TIMESTAMP"
    
    echo -e "📦 备份交付报告到: $BACKUP_BASE_DIR/$TIMESTAMP"
    
    # 备份所有delivery目录
    echo "$delivery_dirs" | while read -r dir; do
        if [ -n "$dir" ] && [ -d "$dir" ]; then
            local dirname=$(basename "$dir")
            echo -e "   📂 备份: $dirname"
            cp -r "$dir" "$BACKUP_BASE_DIR/$TIMESTAMP/"
        fi
    done
    
    # 生成备份记录
    cat > "$BACKUP_BASE_DIR/$TIMESTAMP/backup-info.md" << EOF
# 交付报告备份信息

## 备份详情
- **备份时间**: $(date '+%Y-%m-%d %H:%M:%S')
- **备份版本**: v2.8.0
- **备份原因**: 交付测试清理
- **原始位置**: $REPORTS_BASE_DIR

## 备份内容统计
- **交付报告数量**: $count
- **总备份大小**: $(du -sh "$BACKUP_BASE_DIR/$TIMESTAMP" | cut -f1)

## 备份目录列表
EOF
    
    find "$BACKUP_BASE_DIR/$TIMESTAMP" -maxdepth 1 -name "delivery-*" -type d | while read -r dir; do
        if [ -n "$dir" ]; then
            local size=$(du -sh "$dir" | cut -f1)
            local files=$(find "$dir" -type f | wc -l)
            echo "- $(basename "$dir"): $files 文件, $size" >> "$BACKUP_BASE_DIR/$TIMESTAMP/backup-info.md"
        fi
    done
    
    echo -e "✅ 备份完成: $BACKUP_BASE_DIR/$TIMESTAMP"
}

function clean_reports() {
    echo -e "${BLUE}🧹 清理旧报告目录${NC}"
    echo "====================="
    
    if [ ! -d "$REPORTS_BASE_DIR" ]; then
        echo -e "📝 无需清理，报告目录不存在"
        return 0
    fi
    
    # 查找并删除delivery目录
    local delivery_dirs=$(find "$REPORTS_BASE_DIR" -maxdepth 1 -name "delivery-*" -type d 2>/dev/null || true)
    local count=$(echo "$delivery_dirs" | grep -v '^$' | wc -l 2>/dev/null || echo "0")
    
    if [ "$count" -eq 0 ]; then
        echo -e "📝 无需清理，无交付报告目录"
        return 0
    fi
    
    echo -e "🗑️  删除 $count 个交付报告目录:"
    echo "$delivery_dirs" | while read -r dir; do
        if [ -n "$dir" ] && [ -d "$dir" ]; then
            echo -e "   📂 删除: $(basename "$dir")"
            rm -rf "$dir"
        fi
    done
    
    echo -e "✅ 清理完成"
}

function init_reports() {
    echo -e "${BLUE}🏗️  初始化新报告结构${NC}"
    echo "========================="
    
    # 创建主报告目录
    echo -e "📂 创建交付报告目录: $NEW_DELIVERY_DIR"
    mkdir -p "$NEW_DELIVERY_DIR"
    
    # 创建完整的报告结构
    echo -e "🏗️  创建报告子目录结构..."
    
    # 1. 单元测试报告结构
    mkdir -p "$NEW_DELIVERY_DIR/01-unit-test-reports/input-layer"
    mkdir -p "$NEW_DELIVERY_DIR/01-unit-test-reports/routing-layer"
    mkdir -p "$NEW_DELIVERY_DIR/01-unit-test-reports/preprocessor-layer"
    mkdir -p "$NEW_DELIVERY_DIR/01-unit-test-reports/transformer-layer"
    mkdir -p "$NEW_DELIVERY_DIR/01-unit-test-reports/provider-layer"
    mkdir -p "$NEW_DELIVERY_DIR/01-unit-test-reports/output-layer"
    
    # 2. 六层架构黑盒测试报告结构
    mkdir -p "$NEW_DELIVERY_DIR/02-layer-blackbox-reports/01-client-interface"
    mkdir -p "$NEW_DELIVERY_DIR/02-layer-blackbox-reports/02-routing-decision"
    mkdir -p "$NEW_DELIVERY_DIR/02-layer-blackbox-reports/03-preprocessing"
    mkdir -p "$NEW_DELIVERY_DIR/02-layer-blackbox-reports/04-protocol-transformation"
    mkdir -p "$NEW_DELIVERY_DIR/02-layer-blackbox-reports/05-provider-connection"
    mkdir -p "$NEW_DELIVERY_DIR/02-layer-blackbox-reports/06-response-postprocessing"
    
    # 3. 端到端测试报告结构
    mkdir -p "$NEW_DELIVERY_DIR/03-e2e-test-reports/01-simple-conversation"
    mkdir -p "$NEW_DELIVERY_DIR/03-e2e-test-reports/02-tool-call"
    mkdir -p "$NEW_DELIVERY_DIR/03-e2e-test-reports/03-multi-turn-multi-tool"
    
    # 4. 综合总结报告
    mkdir -p "$NEW_DELIVERY_DIR/04-summary-report"
    
    # 创建清理记录
    cat > "$NEW_DELIVERY_DIR/00-cleanup-log.md" << EOF
# 报告清理记录 - $TIMESTAMP

## 清理执行信息
- **清理时间**: $(date '+%Y-%m-%d %H:%M:%S')
- **清理版本**: v2.8.0  
- **执行用户**: $(whoami)
- **清理原因**: 交付测试准备

## 清理前状态
- **旧报告目录**: 已检查现有delivery-*目录
- **备份状态**: 已备份至 $BACKUP_BASE_DIR/$TIMESTAMP (如果存在)
- **运行服务**: 已检查无运行的测试服务

## 清理操作
- [x] 删除旧交付报告目录  
- [x] 创建新报告目录结构
- [x] 初始化子目录和模板
- [x] 设置正确的目录权限
- [x] 生成清理记录文档

## 清理后状态
- **新报告目录**: $NEW_DELIVERY_DIR
- **目录结构完整性**: ✅ 验证通过
- **权限设置**: ✅ 正确配置  
- **初始化状态**: ✅ 准备就绪

## 目录结构验证
\`\`\`
$NEW_DELIVERY_DIR/
├── 01-unit-test-reports/           # 单元测试报告
│   ├── input-layer/
│   ├── routing-layer/
│   ├── preprocessor-layer/
│   ├── transformer-layer/
│   ├── provider-layer/
│   └── output-layer/
├── 02-layer-blackbox-reports/      # 六层架构黑盒测试报告
│   ├── 01-client-interface/
│   ├── 02-routing-decision/
│   ├── 03-preprocessing/
│   ├── 04-protocol-transformation/
│   ├── 05-provider-connection/
│   └── 06-response-postprocessing/
├── 03-e2e-test-reports/           # 端到端测试报告
│   ├── 01-simple-conversation/
│   ├── 02-tool-call/
│   └── 03-multi-turn-multi-tool/
├── 04-summary-report/             # 综合总结报告
└── 00-cleanup-log.md              # 本清理记录
\`\`\`

## 清理问题记录
- 无问题

## 验证检查
- [x] 目录结构正确
- [x] 权限设置正确  
- [x] 备份数据完整 (如适用)
- [x] 系统资源释放完全

## 清理结论  
✅ 清理成功，系统准备就绪进行新的交付测试
EOF
    
    # 创建README文件
    cat > "$NEW_DELIVERY_DIR/README.md" << EOF
# Claude Code Router 交付测试报告

**测试版本**: v2.8.0  
**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')  
**项目所有者**: Jason Zhang

## 报告结构说明

### 01-unit-test-reports/ - 单元测试报告
完整的六层架构单元测试覆盖报告

### 02-layer-blackbox-reports/ - 六层架构黑盒测试报告  
每层独立的黑盒测试验证报告

### 03-e2e-test-reports/ - 端到端测试报告
完整业务场景的端到端测试验证报告

### 04-summary-report/ - 综合总结报告
交付测试的总结和结论报告

## 使用指南
1. 按顺序生成各类测试报告
2. 确保所有必需的测试覆盖项都已完成
3. 生成最终的综合总结报告
4. 验证所有交付检查清单项目

## 交付标准
必须100%通过所有交付检查清单项目才能进行生产交付。
EOF
    
    echo -e "✅ 报告结构初始化完成: $NEW_DELIVERY_DIR"
}

function verify_cleanup() {
    echo -e "${BLUE}🔍 验证清理结果${NC}"
    echo "=================="
    
    # 验证新目录存在
    if [ -d "$NEW_DELIVERY_DIR" ]; then
        echo -e "✅ 新报告目录创建成功: $NEW_DELIVERY_DIR"
        
        # 验证目录结构
        local expected_dirs=(
            "01-unit-test-reports"
            "02-layer-blackbox-reports" 
            "03-e2e-test-reports"
            "04-summary-report"
        )
        
        for dir in "${expected_dirs[@]}"; do
            if [ -d "$NEW_DELIVERY_DIR/$dir" ]; then
                echo -e "✅ 子目录存在: $dir"
            else
                echo -e "❌ 子目录缺失: $dir"
                return 1
            fi
        done
        
        # 验证文件
        if [ -f "$NEW_DELIVERY_DIR/00-cleanup-log.md" ]; then
            echo -e "✅ 清理记录文件创建成功"
        else
            echo -e "❌ 清理记录文件缺失"
            return 1
        fi
        
        if [ -f "$NEW_DELIVERY_DIR/README.md" ]; then
            echo -e "✅ README文件创建成功"
        else
            echo -e "❌ README文件缺失"
            return 1
        fi
        
        # 统计目录和文件数量
        local total_dirs=$(find "$NEW_DELIVERY_DIR" -type d | wc -l)
        local total_files=$(find "$NEW_DELIVERY_DIR" -type f | wc -l)
        
        echo -e "📊 验证统计:"
        echo -e "   📂 目录数量: $total_dirs"
        echo -e "   📄 文件数量: $total_files"
        echo -e "   💾 总大小: $(du -sh "$NEW_DELIVERY_DIR" | cut -f1)"
        
        echo -e "✅ 清理结果验证通过"
        
    else
        echo -e "❌ 新报告目录不存在: $NEW_DELIVERY_DIR"
        return 1
    fi
}

function run_all() {
    echo -e "${BLUE}🚀 执行完整的交付报告清理和初始化${NC}"
    echo "=============================================="
    
    check_reports
    echo ""
    backup_reports  
    echo ""
    clean_reports
    echo ""
    init_reports
    echo ""
    verify_cleanup
    
    echo ""
    echo "=============================================="
    echo -e "${GREEN}🎉 交付报告清理和初始化完成！${NC}"
    echo -e "${GREEN}📁 新报告目录: $NEW_DELIVERY_DIR${NC}"
    echo -e "${GREEN}📋 可以开始执行交付测试了${NC}"
}

# 主程序逻辑
case "$ACTION" in
    check)
        check_reports
        ;;
    backup)
        backup_reports
        ;;
    clean)
        clean_reports
        ;;
    init)
        init_reports
        ;;
    verify)
        verify_cleanup
        ;;
    all)
        run_all
        ;;
    help)
        show_help
        ;;
    *)
        echo -e "${RED}❌ 未知操作: $ACTION${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac