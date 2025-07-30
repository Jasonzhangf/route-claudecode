# RCC Daemon PowerShell Script for Windows
# Handles daemon mode operations on Windows

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "status", "restart", "logs")]
    [string]$Command,
    
    [string]$ConfigMode = "auto"
)

$RCC_PID_FILE = "$env:TEMP\rcc-daemon.pid"
$RCC_LOG_FILE = "$env:TEMP\rcc-daemon.log"

function Start-Daemon {
    param([string]$ConfigMode)
    
    Write-Host "🚀 Starting RCC daemon..." -ForegroundColor Blue
    
    # Check if already running
    if (Test-Path $RCC_PID_FILE) {
        $ExistingPid = Get-Content $RCC_PID_FILE -ErrorAction SilentlyContinue
        if ($ExistingPid -and (Get-Process -Id $ExistingPid -ErrorAction SilentlyContinue)) {
            Write-Host "⚠️  RCC daemon is already running (PID: $ExistingPid)" -ForegroundColor Yellow
            return
        } else {
            Write-Host "🧹 Cleaning up stale PID file" -ForegroundColor Gray
            Remove-Item $RCC_PID_FILE -Force -ErrorAction SilentlyContinue
        }
    }
    
    # Kill existing processes
    Write-Host "🧹 Cleaning up existing processes..." -ForegroundColor Gray
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*rcc*start*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    # Kill processes using ports
    $PortProcesses = @(3456, 8888)
    foreach ($Port in $PortProcesses) {
        $Process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
        if ($Process) {
            Stop-Process -Id $Process -Force -ErrorAction SilentlyContinue
        }
    }
    
    Start-Sleep -Seconds 2
    
    # Start daemon with intelligent config detection
    if ($ConfigMode -eq "--dual-config") {
        Write-Host "🎯 Starting dual config servers..." -ForegroundColor Green
        $ProcessArgs = @("start", "--dual-config")
    } elseif ($ConfigMode -eq "--single-config") {
        Write-Host "🎯 Starting single config server..." -ForegroundColor Green
        $ProcessArgs = @("start", "--single-config")
    } else {
        Write-Host "🎯 Starting with intelligent config detection..." -ForegroundColor Green
        $ProcessArgs = @("start")
    }
    
    # Start process in background
    $ProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
    $ProcessInfo.FileName = "rcc"
    $ProcessInfo.Arguments = $ProcessArgs -join " "
    $ProcessInfo.UseShellExecute = $false
    $ProcessInfo.RedirectStandardOutput = $true
    $ProcessInfo.RedirectStandardError = $true
    $ProcessInfo.CreateNoWindow = $true
    
    $Process = New-Object System.Diagnostics.Process
    $Process.StartInfo = $ProcessInfo
    $Process.Start() | Out-Null
    
    $DaemonPid = $Process.Id
    
    # Save PID
    $DaemonPid | Out-File -FilePath $RCC_PID_FILE -Encoding ASCII
    
    # Wait for startup
    Start-Sleep -Seconds 5
    
    # Verify startup
    if (Get-Process -Id $DaemonPid -ErrorAction SilentlyContinue) {
        Write-Host "✅ RCC daemon started successfully (PID: $DaemonPid)" -ForegroundColor Green
        Write-Host "📊 Development server: http://localhost:3456/dual-stats" -ForegroundColor Cyan
        Write-Host "📊 Release server: http://localhost:8888/dual-stats" -ForegroundColor Cyan
        Write-Host "📋 Logs: Get-Content $RCC_LOG_FILE -Wait" -ForegroundColor Gray
    } else {
        Write-Host "❌ Failed to start RCC daemon" -ForegroundColor Red
        Remove-Item $RCC_PID_FILE -Force -ErrorAction SilentlyContinue
        return 1
    }
}

function Stop-Daemon {
    Write-Host "🛑 Stopping RCC daemon..." -ForegroundColor Blue
    
    if (Test-Path $RCC_PID_FILE) {
        $DaemonPid = Get-Content $RCC_PID_FILE -ErrorAction SilentlyContinue
        if ($DaemonPid -and (Get-Process -Id $DaemonPid -ErrorAction SilentlyContinue)) {
            Write-Host "📤 Sending stop signal to PID $DaemonPid..." -ForegroundColor Gray
            Stop-Process -Id $DaemonPid -Force -ErrorAction SilentlyContinue
            
            # Wait for graceful shutdown
            $Count = 0
            while ((Get-Process -Id $DaemonPid -ErrorAction SilentlyContinue) -and ($Count -lt 10)) {
                Start-Sleep -Seconds 1
                $Count++
            }
            
            Write-Host "✅ RCC daemon stopped" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Daemon was not running" -ForegroundColor Yellow
        }
        Remove-Item $RCC_PID_FILE -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "⚠️  No PID file found" -ForegroundColor Yellow
    }
    
    # Clean up ports
    Write-Host "🧹 Cleaning up ports..." -ForegroundColor Gray
    $PortProcesses = @(3456, 8888)
    foreach ($Port in $PortProcesses) {
        $Process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
        if ($Process) {
            Stop-Process -Id $Process -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-DaemonStatus {
    if (Test-Path $RCC_PID_FILE) {
        $DaemonPid = Get-Content $RCC_PID_FILE -ErrorAction SilentlyContinue
        if ($DaemonPid -and (Get-Process -Id $DaemonPid -ErrorAction SilentlyContinue)) {
            Write-Host "✅ RCC daemon is running (PID: $DaemonPid)" -ForegroundColor Green
            
            # Check port status
            $DevStatus = "❌"
            $RelStatus = "❌"
            
            try {
                $Response = Invoke-WebRequest -Uri "http://localhost:3456/status" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
                if ($Response.StatusCode -eq 200) { $DevStatus = "✅" }
            } catch {}
            
            try {
                $Response = Invoke-WebRequest -Uri "http://localhost:8888/status" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
                if ($Response.StatusCode -eq 200) { $RelStatus = "✅" }
            } catch {}
            
            Write-Host "   Development (3456): $DevStatus" -ForegroundColor Gray
            Write-Host "   Release (8888): $RelStatus" -ForegroundColor Gray
            
            return 0
        } else {
            Write-Host "❌ RCC daemon is not running (stale PID file)" -ForegroundColor Red
            Remove-Item $RCC_PID_FILE -Force -ErrorAction SilentlyContinue
            return 1
        }
    } else {
        Write-Host "❌ RCC daemon is not running" -ForegroundColor Red
        return 1
    }
}

function Restart-Daemon {
    param([string]$ConfigMode)
    
    Write-Host "🔄 Restarting RCC daemon..." -ForegroundColor Blue
    Stop-Daemon
    Start-Sleep -Seconds 2
    Start-Daemon -ConfigMode $ConfigMode
}

function Show-DaemonLogs {
    if (Test-Path $RCC_LOG_FILE) {
        Write-Host "📋 RCC daemon logs:" -ForegroundColor Blue
        Get-Content $RCC_LOG_FILE -Wait
    } else {
        Write-Host "❌ No log file found" -ForegroundColor Red
        return 1
    }
}

# Main script execution
switch ($Command) {
    "start" {
        Start-Daemon -ConfigMode $ConfigMode
    }
    "stop" {
        Stop-Daemon
    }
    "status" {
        $ExitCode = Get-DaemonStatus
        exit $ExitCode
    }
    "restart" {
        Restart-Daemon -ConfigMode $ConfigMode
    }
    "logs" {
        Show-DaemonLogs
    }
    default {
        Write-Host "Usage: .\rcc-daemon.ps1 {start|stop|status|restart|logs} [options]" -ForegroundColor White
        Write-Host ""
        Write-Host "Commands:" -ForegroundColor White
        Write-Host "  start [--dual-config|--single-config]  - Start RCC daemon" -ForegroundColor Gray
        Write-Host "  stop                                    - Stop RCC daemon" -ForegroundColor Gray
        Write-Host "  status                                  - Show daemon status" -ForegroundColor Gray
        Write-Host "  restart [--dual-config|--single-config] - Restart daemon" -ForegroundColor Gray
        Write-Host "  logs                                    - Show daemon logs" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Options:" -ForegroundColor White
        Write-Host "  --dual-config   - Force dual-config mode" -ForegroundColor Gray
        Write-Host "  --single-config - Force single-config mode" -ForegroundColor Gray
        Write-Host "  (no option)     - Intelligent config detection" -ForegroundColor Gray
        exit 1
    }
}