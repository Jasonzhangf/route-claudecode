@echo off
REM Local installation script for Windows
REM Build + Package + Global Install

setlocal EnableDelayedExpansion

REM Colors and formatting for Windows
echo [36m📦 Route Claude Code - Local Installation (Windows)[0m
echo [36m===============================================[0m
echo.

REM Step 1: Clean and build
echo [34m🧹 Step 1: Cleaning and building...[0m
call build.bat
if errorlevel 1 (
    echo [31m❌ Build failed[0m
    exit /b 1
)

REM Step 2: Create package
echo [34m📦 Step 2: Creating package...[0m
for /f "delims=" %%i in ('npm pack') do set PACKAGE_FILE=%%i
echo [32m✅ Package created: %PACKAGE_FILE%[0m

REM Step 3: Uninstall existing global version
echo [34m🗑️  Step 3: Removing existing global installation...[0m
npm uninstall -g route-claudecode >nul 2>&1
npm uninstall -g claude-code-router >nul 2>&1
echo [32m✅ Existing installation removed[0m

REM Step 4: Install globally from local package
echo [34m🌍 Step 4: Installing globally...[0m
npm install -g "%PACKAGE_FILE%"
if errorlevel 1 (
    echo [31m❌ Global installation failed[0m
    exit /b 1
)
echo [32m✅ Global installation completed[0m

REM Step 5: Verify installation
echo [34m🔍 Step 5: Verifying installation...[0m
where rcc >nul 2>&1
if errorlevel 1 (
    echo [31m❌ rcc command not found[0m
    exit /b 1
) else (
    echo [32m✅ rcc command is available[0m
    echo [34m📋 Version info:[0m
    rcc --version
)

REM Step 6: Test basic functionality
echo [34m🧪 Step 6: Testing basic functionality...[0m
rcc --help >nul 2>&1
if errorlevel 1 (
    echo [31m❌ Help command failed[0m
    exit /b 1
) else (
    echo [32m✅ Help command works[0m
)

REM Step 7: Cleanup
echo [34m🧹 Step 7: Cleaning up...[0m
del "%PACKAGE_FILE%" >nul 2>&1
echo [32m✅ Cleanup completed[0m

echo.
echo [36m🎉 Installation completed successfully![0m
echo [36m====================================[0m
echo [32m🚀 You can now use: rcc start[0m
echo [32m📋 For help: rcc --help[0m
echo [32m🔧 Configuration: rcc config --show[0m
echo.
echo [34m💡 Quick start:[0m
echo [33m   rcc start --debug[0m
echo [33m   set ANTHROPIC_BASE_URL=http://127.0.0.1:3456[0m
echo [33m   set ANTHROPIC_API_KEY=any-string-is-ok[0m

endlocal