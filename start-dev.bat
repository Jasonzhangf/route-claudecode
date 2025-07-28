@echo off
REM Development startup script for Windows
REM Auto build + start service + logging

setlocal EnableDelayedExpansion

REM Default values
set PORT=3456
set DEBUG=false
set LOG_FILE=%USERPROFILE%\.claude-code-router\logs\ccr-dev-%date:~0,4%%date:~5,2%%date:~8,2%-%time:~0,2%%time:~3,2%%time:~6,2%.log

REM Parse command line arguments
:parse_args
if "%~1"=="" goto :args_done
if "%~1"=="-p" (
    set PORT=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="--port" (
    set PORT=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="-d" (
    set DEBUG=true
    shift
    goto :parse_args
)
if "%~1"=="--debug" (
    set DEBUG=true
    shift
    goto :parse_args
)
if "%~1"=="-l" (
    set LOG_FILE=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="--log" (
    set LOG_FILE=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="-h" goto :show_help
if "%~1"=="--help" goto :show_help
echo Unknown option: %~1
exit /b 1

:show_help
echo Usage: %0 [OPTIONS]
echo.
echo Options:
echo   -p, --port PORT    Server port (default: 3456)
echo   -d, --debug        Enable debug mode
echo   -l, --log FILE     Log file path
echo   -h, --help         Show this help message
exit /b 0

:args_done

echo [34m🚀 Route Claude Code - Development Mode (Windows)[0m
echo [34m===============================================[0m

REM Check if port is in use and kill if necessary
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT%') do (
    echo [33m⚠️  Port %PORT% is in use, killing existing process...[0m
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 2 >nul
)

REM Build the project
echo [34m🔨 Building project...[0m
call npm run build
if errorlevel 1 (
    echo [31m❌ Build failed[0m
    exit /b 1
)

REM Start the server
echo [32m🌟 Starting Route Claude Code on port %PORT%[0m
echo [32m📋 Log file: %LOG_FILE%[0m

REM Create log directory if it doesn't exist
for %%F in ("%LOG_FILE%") do (
    if not exist "%%~dpF" mkdir "%%~dpF"
)

REM Prepare start command
set START_CMD=node dist/cli.js start --port %PORT%
if "%DEBUG%"=="true" (
    set START_CMD=%START_CMD% --debug
)

REM Start server with logging
if "%DEBUG%"=="true" (
    echo [33m🔍 Debug mode enabled[0m
    %START_CMD%
) else (
    start /b cmd /c "%START_CMD% > \"%LOG_FILE%\" 2>&1"
    timeout /t 3 >nul
    
    REM Check if server started successfully
    netstat -ano | findstr :%PORT% >nul
    if errorlevel 1 (
        echo [31m❌ Server failed to start[0m
        echo [31m📋 Check logs: %LOG_FILE%[0m
        exit /b 1
    ) else (
        echo [32m✅ Server started successfully[0m
        echo [32m🌐 Available at: http://127.0.0.1:%PORT%[0m
        echo.
        echo [34m📊 Monitoring logs (Ctrl+C to stop):[0m
        type "%LOG_FILE%"
        timeout /t 1 >nul
        powershell -Command "Get-Content '%LOG_FILE%' -Wait"
    )
)

endlocal