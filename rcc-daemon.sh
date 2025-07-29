#!/bin/bash

# RCC Daemon Script - 正确的启动方式
# 避免使用&导致的信号处理问题

set -e

RCC_PID_FILE="/tmp/rcc-daemon.pid"
RCC_LOG_FILE="/tmp/rcc-daemon.log"

function start_daemon() {
    echo "🚀 Starting RCC daemon..."
    
    # 检查是否已经运行
    if [ -f "$RCC_PID_FILE" ]; then
        local existing_pid=$(cat "$RCC_PID_FILE")
        if kill -0 "$existing_pid" 2>/dev/null; then
            echo "⚠️  RCC daemon is already running (PID: $existing_pid)"
            return 0
        else
            echo "🧹 Cleaning up stale PID file"
            rm -f "$RCC_PID_FILE"
        fi
    fi
    
    # 杀掉占用端口的进程
    echo "🧹 Cleaning up existing processes..."
    pkill -f "rcc.*start" || true
    lsof -ti:3456 | xargs kill -9 2>/dev/null || true
    lsof -ti:8888 | xargs kill -9 2>/dev/null || true
    
    sleep 2
    
    # 启动daemon
    echo "🎯 Starting dual config servers..."
    nohup rcc start --dual-config > "$RCC_LOG_FILE" 2>&1 &
    local daemon_pid=$!
    
    # 保存PID
    echo "$daemon_pid" > "$RCC_PID_FILE"
    
    # 等待启动完成
    sleep 5
    
    # 验证启动状态
    if kill -0 "$daemon_pid" 2>/dev/null; then
        echo "✅ RCC daemon started successfully (PID: $daemon_pid)"
        echo "📊 Development server: http://localhost:3456/dual-stats"
        echo "📊 Release server: http://localhost:8888/dual-stats"
        echo "📋 Logs: tail -f $RCC_LOG_FILE"
    else
        echo "❌ Failed to start RCC daemon"
        rm -f "$RCC_PID_FILE"
        return 1
    fi
}

function stop_daemon() {
    echo "🛑 Stopping RCC daemon..."
    
    if [ -f "$RCC_PID_FILE" ]; then
        local daemon_pid=$(cat "$RCC_PID_FILE")
        if kill -0 "$daemon_pid" 2>/dev/null; then
            echo "📤 Sending SIGTERM to PID $daemon_pid..."
            kill -TERM "$daemon_pid"
            
            # 等待优雅关闭
            local count=0
            while kill -0 "$daemon_pid" 2>/dev/null && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            # 如果还在运行，强制关闭
            if kill -0 "$daemon_pid" 2>/dev/null; then
                echo "⚠️  Graceful shutdown failed, forcing..."
                kill -KILL "$daemon_pid"
            fi
            
            echo "✅ RCC daemon stopped"
        else
            echo "⚠️  Daemon was not running"
        fi
        rm -f "$RCC_PID_FILE"
    else
        echo "⚠️  No PID file found"
    fi
    
    # 清理端口
    echo "🧹 Cleaning up ports..."
    lsof -ti:3456 | xargs kill -9 2>/dev/null || true
    lsof -ti:8888 | xargs kill -9 2>/dev/null || true
}

function status_daemon() {
    if [ -f "$RCC_PID_FILE" ]; then
        local daemon_pid=$(cat "$RCC_PID_FILE")
        if kill -0 "$daemon_pid" 2>/dev/null; then
            echo "✅ RCC daemon is running (PID: $daemon_pid)"
            
            # 检查端口状态
            local dev_status="❌"
            local rel_status="❌"
            
            if curl -s http://localhost:3456/status >/dev/null 2>&1; then
                dev_status="✅"
            fi
            
            if curl -s http://localhost:8888/status >/dev/null 2>&1; then
                rel_status="✅"
            fi
            
            echo "   Development (3456): $dev_status"
            echo "   Release (8888): $rel_status"
            
            return 0
        else
            echo "❌ RCC daemon is not running (stale PID file)"
            rm -f "$RCC_PID_FILE"
            return 1
        fi
    else
        echo "❌ RCC daemon is not running"
        return 1
    fi
}

function restart_daemon() {
    echo "🔄 Restarting RCC daemon..."
    stop_daemon
    sleep 2
    start_daemon
}

function logs_daemon() {
    if [ -f "$RCC_LOG_FILE" ]; then
        echo "📋 RCC daemon logs:"
        tail -f "$RCC_LOG_FILE"
    else
        echo "❌ No log file found"
        return 1
    fi
}

case "${1:-}" in
    start)
        start_daemon
        ;;
    stop)
        stop_daemon
        ;;
    status)
        status_daemon
        ;;
    restart)
        restart_daemon
        ;;
    logs)
        logs_daemon
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start RCC daemon with dual config"
        echo "  stop    - Stop RCC daemon"
        echo "  status  - Show daemon status"
        echo "  restart - Restart daemon" 
        echo "  logs    - Show daemon logs"
        exit 1
        ;;
esac