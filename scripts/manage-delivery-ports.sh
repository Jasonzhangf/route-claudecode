#!/bin/bash

# 交付测试端口管理脚本
# Project: Claude Code Router v2.8.0
# Owner: Jason Zhang

set -e

ACTION=${1:-"status"}
PORT_RANGE="3458-3467"

function show_port_status() {
    echo "🔍 交付测试端口状态 ($PORT_RANGE):"
    echo "=================================="
    
    for port in {3458..3467}; do
        if lsof -i :$port > /dev/null 2>&1; then
            PID=$(lsof -ti :$port)
            CMD=$(ps -p $PID -o command= 2>/dev/null || echo "unknown")
            echo "  端口 $port: 🔴 占用 (PID: $PID, CMD: $CMD)"
        else
            echo "  端口 $port: 🟢 空闲"
        fi
    done
}

function cleanup_delivery_ports() {
    echo "🧹 清理交付测试端口..."
    
    for port in {3458..3467}; do
        if lsof -i :$port > /dev/null 2>&1; then
            PIDS=$(lsof -ti :$port)
            for PID in $PIDS; do
                CMD=$(ps -p $PID -o command= 2>/dev/null || echo "unknown")
                if [[ "$CMD" == *"rcc start"* ]] || [[ "$CMD" == *"dist/cli.js start"* ]]; then
                    echo "  停止端口 $port 上的服务 (PID: $PID)"
                    kill -TERM $PID 2>/dev/null || true
                fi
            done
        fi
    done
    
    sleep 2
    
    # 强制清理残留进程
    for port in {3458..3467}; do
        if lsof -i :$port > /dev/null 2>&1; then
            echo "  强制清理端口 $port"
            lsof -ti :$port | xargs kill -9 2>/dev/null || true
        fi
    done
    
    echo "✅ 端口清理完成"
}

function reserve_ports() {
    echo "🔒 预留交付测试端口..."
    echo "这将清理现有占用并确保端口可用"
    cleanup_delivery_ports
    show_port_status
}

case "$ACTION" in
    status)
        show_port_status
        ;;
    cleanup)
        cleanup_delivery_ports
        ;;
    reserve)
        reserve_ports
        ;;
    *)
        echo "用法: $0 {status|cleanup|reserve}"
        exit 1
        ;;
esac
