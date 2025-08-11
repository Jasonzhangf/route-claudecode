/**
 * 自动启动配置工具
 * 处理macOS launchd服务的创建和管理
 * Owner: Jason Zhang
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn } from 'child_process';
import { logger } from './logger';

interface AutoStartConfig {
  configPath: string;
  port: number;
  host: string;
  debug: boolean;
  logLevel: string;
}

interface AutoStartResult {
  success: boolean;
  serviceName?: string;
  message?: string;
  error?: string;
}

/**
 * 设置自动启动服务
 */
export async function setupAutoStart(config: AutoStartConfig): Promise<AutoStartResult> {
  const platform = os.platform();
  
  switch (platform) {
    case 'darwin':
      return setupMacOSLaunchd(config);
    case 'linux':
      return setupLinuxSystemd(config);
    case 'win32':
      return setupWindowsTaskScheduler(config);
    default:
      return { success: false, error: `平台 ${platform} 不支持自动启动功能` };
  }
}

/**
 * macOS launchd 服务配置
 */
async function setupMacOSLaunchd(config: AutoStartConfig): Promise<AutoStartResult> {
  try {
    const serviceName = 'com.rcc.router';
    const launchAgentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    const plistPath = path.join(launchAgentsDir, `${serviceName}.plist`);
    
    // 确保 LaunchAgents 目录存在
    await fs.mkdir(launchAgentsDir, { recursive: true });
    
    // 获取 rcc 命令的完整路径
    let rccPath: string;
    try {
      rccPath = execSync('which rcc', { encoding: 'utf-8' }).trim();
    } catch (error) {
      return { success: false, error: '找不到 rcc 命令，请确保已正确安装' };
    }
    
    // 获取日志目录
    const logsDir = path.join(os.homedir(), '.route-claude-code', 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    
    // 创建 plist 配置文件
    const plistContent = createMacOSPlist({
      serviceName,
      rccPath,
      configPath: config.configPath,
      port: config.port,
      host: config.host,
      debug: config.debug,
      logLevel: config.logLevel,
      logsDir
    });
    
    // 写入 plist 文件
    await fs.writeFile(plistPath, plistContent, 'utf-8');
    
    // 加载服务到 launchd
    try {
      execSync(`launchctl load ${plistPath}`, { stdio: 'pipe' });
      
      // 启动服务
      execSync(`launchctl start ${serviceName}`, { stdio: 'pipe' });
      
      return {
        success: true,
        serviceName,
        message: `macOS launchd 服务已配置，将在系统启动时自动运行`
      };
      
    } catch (launchctlError) {
      // 如果加载失败，删除创建的文件
      try {
        await fs.unlink(plistPath);
      } catch {}
      
      return {
        success: false,
        error: `launchctl 操作失败: ${launchctlError instanceof Error ? launchctlError.message : String(launchctlError)}`
      };
    }
    
  } catch (error) {
    logger.error('Failed to setup macOS autostart', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Windows Task Scheduler 服务配置
 */
async function setupWindowsTaskScheduler(config: AutoStartConfig): Promise<AutoStartResult> {
  try {
    const taskName = 'RCCRouter';
    
    // 获取 rcc 命令的完整路径
    let rccPath: string;
    try {
      rccPath = execSync('where rcc', { encoding: 'utf-8' }).trim();
      // Windows的where命令可能返回多行，取第一行
      rccPath = rccPath.split('\n')[0].trim();
    } catch (error) {
      return { success: false, error: '找不到 rcc 命令，请确保已正确安装' };
    }
    
    // 获取日志目录
    const logsDir = path.join(os.homedir(), '.route-claude-code', 'logs');
    
    // 创建任务计划程序XML配置
    const taskXml = createWindowsTaskXml({
      taskName,
      rccPath,
      configPath: config.configPath,
      port: config.port,
      host: config.host,
      debug: config.debug,
      logLevel: config.logLevel,
      logsDir
    });
    
    // 保存临时XML文件
    const tempXmlPath = path.join(os.tmpdir(), `${taskName}.xml`);
    await fs.writeFile(tempXmlPath, taskXml, 'utf-8');
    
    try {
      // 删除已存在的任务（如果有）
      try {
        execSync(`schtasks /delete /tn "${taskName}" /f`, { stdio: 'pipe' });
      } catch {
        // 忽略删除失败（可能任务不存在）
      }
      
      // 创建新任务
      execSync(`schtasks /create /xml "${tempXmlPath}" /tn "${taskName}"`, { stdio: 'pipe' });
      
      // 启动任务
      execSync(`schtasks /run /tn "${taskName}"`, { stdio: 'pipe' });
      
      // 清理临时文件
      try {
        await fs.unlink(tempXmlPath);
      } catch {}
      
      return {
        success: true,
        serviceName: taskName,
        message: 'Windows 任务计划程序已配置，将在系统启动时自动运行'
      };
      
    } catch (schedTaskError) {
      // 清理临时文件
      try {
        await fs.unlink(tempXmlPath);
      } catch {}
      
      return {
        success: false,
        error: `任务计划程序操作失败: ${schedTaskError instanceof Error ? schedTaskError.message : String(schedTaskError)}`
      };
    }
    
  } catch (error) {
    logger.error('Failed to setup Windows autostart', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Linux systemd 服务配置
 */
async function setupLinuxSystemd(config: AutoStartConfig): Promise<AutoStartResult> {
  try {
    const serviceName = 'rcc-router';
    const systemdDir = path.join(os.homedir(), '.config', 'systemd', 'user');
    const serviceFile = path.join(systemdDir, `${serviceName}.service`);
    
    // 确保 systemd 用户目录存在
    await fs.mkdir(systemdDir, { recursive: true });
    
    // 获取 rcc 命令的完整路径
    let rccPath: string;
    try {
      rccPath = execSync('which rcc', { encoding: 'utf-8' }).trim();
    } catch (error) {
      return { success: false, error: '找不到 rcc 命令，请确保已正确安装' };
    }
    
    // 创建 systemd service 文件
    const serviceContent = createLinuxSystemdService({
      serviceName,
      rccPath,
      configPath: config.configPath,
      port: config.port,
      host: config.host,
      debug: config.debug,
      logLevel: config.logLevel,
      workingDir: os.homedir()
    });
    
    // 写入 service 文件
    await fs.writeFile(serviceFile, serviceContent, 'utf-8');
    
    // 重载 systemd 配置
    try {
      execSync('systemctl --user daemon-reload', { stdio: 'pipe' });
      
      // 启用服务
      execSync(`systemctl --user enable ${serviceName}`, { stdio: 'pipe' });
      
      // 启动服务
      execSync(`systemctl --user start ${serviceName}`, { stdio: 'pipe' });
      
      return {
        success: true,
        serviceName,
        message: `Linux systemd 用户服务已配置，将在用户登录时自动运行`
      };
      
    } catch (systemctlError) {
      // 如果操作失败，删除创建的文件
      try {
        await fs.unlink(serviceFile);
      } catch {}
      
      return {
        success: false,
        error: `systemctl 操作失败: ${systemctlError instanceof Error ? systemctlError.message : String(systemctlError)}`
      };
    }
    
  } catch (error) {
    logger.error('Failed to setup Linux autostart', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 创建 macOS plist 配置文件内容
 */
function createMacOSPlist(options: {
  serviceName: string;
  rccPath: string;
  configPath: string;
  port: number;
  host: string;
  debug: boolean;
  logLevel: string;
  logsDir: string;
}): string {
  // 默认使用dual-config + daemon模式，确保开机自启动也是双服务器
  const args = [
    'start',
    '--daemon',
    '--log-level', options.logLevel
  ];
  
  if (options.debug) {
    args.push('--debug');
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${options.serviceName}</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>${options.rccPath}</string>
${args.map(arg => `        <string>${arg}</string>`).join('\n')}
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>${path.join(options.logsDir, 'autostart.log')}</string>
    
    <key>StandardErrorPath</key>
    <string>${path.join(options.logsDir, 'autostart-error.log')}</string>
    
    <key>WorkingDirectory</key>
    <string>${os.homedir()}</string>
    
    <key>ProcessType</key>
    <string>Background</string>
    
    <key>ThrottleInterval</key>
    <integer>10</integer>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}</string>
        <key>NODE_PATH</key>
        <string>${process.env.NODE_PATH || ''}</string>
    </dict>
</dict>
</plist>`;
}

/**
 * 创建 Linux systemd service 文件内容
 */
function createLinuxSystemdService(options: {
  serviceName: string;
  rccPath: string;
  configPath: string;
  port: number;
  host: string;
  debug: boolean;
  logLevel: string;
  workingDir: string;
}): string {
  // 默认使用dual-config + daemon模式，确保开机自启动也是双服务器
  const args = [
    'start',
    '--daemon',
    '--log-level', options.logLevel
  ];
  
  if (options.debug) {
    args.push('--debug');
  }
  
  return `[Unit]
Description=RCC Router - Claude Code Router Service
After=network.target
Wants=network.target

[Service]
Type=simple
ExecStart=${options.rccPath} ${args.join(' ')}
Restart=always
RestartSec=10
WorkingDirectory=${options.workingDir}
Environment="PATH=${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}"
Environment="NODE_PATH=${process.env.NODE_PATH || ''}"

[Install]
WantedBy=default.target`;
}

/**
 * 创建 Windows 任务计划程序 XML 配置文件内容
 */
function createWindowsTaskXml(options: {
  taskName: string;
  rccPath: string;
  configPath: string;
  port: number;
  host: string;
  debug: boolean;
  logLevel: string;
  logsDir: string;
}): string {
  // 默认使用daemon模式，确保开机自启动也使用智能配置检测
  const args = [
    'start',
    '--daemon',
    '--log-level', options.logLevel
  ];
  
  if (options.debug) {
    args.push('--debug');
  }
  
  const argsString = args.join(' ');
  
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Date>2024-01-01T00:00:00</Date>
    <Author>RCC Router</Author>
    <Description>Claude Code Router - Auto-start service with intelligent config detection</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <Delay>PT30S</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <DisallowStartOnRemoteAppSession>false</DisallowStartOnRemoteAppSession>
    <UseUnifiedSchedulingEngine>true</UseUnifiedSchedulingEngine>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT5M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${options.rccPath}</Command>
      <Arguments>${argsString}</Arguments>
      <WorkingDirectory>${os.homedir()}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>`;
}

/**
 * 移除自动启动配置
 */
export async function removeAutoStart(): Promise<AutoStartResult> {
  const platform = os.platform();
  
  switch (platform) {
    case 'darwin':
      return removeMacOSLaunchd();
    case 'linux':
      return removeLinuxSystemd();
    case 'win32':
      return removeWindowsTaskScheduler();
    default:
      return { success: false, error: `平台 ${platform} 不支持移除自动启动` };
  }
}

/**
 * 移除 macOS launchd 服务
 */
async function removeMacOSLaunchd(): Promise<AutoStartResult> {
  try {
    const serviceName = 'com.rcc.router';
    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${serviceName}.plist`);
    
    // 停止并卸载服务
    try {
      execSync(`launchctl stop ${serviceName}`, { stdio: 'pipe' });
    } catch {}
    
    try {
      execSync(`launchctl unload ${plistPath}`, { stdio: 'pipe' });
    } catch {}
    
    // 删除 plist 文件
    try {
      await fs.unlink(plistPath);
    } catch {}
    
    return {
      success: true,
      serviceName,
      message: 'macOS 自动启动服务已移除'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 移除 Windows 任务计划程序
 */
async function removeWindowsTaskScheduler(): Promise<AutoStartResult> {
  try {
    const taskName = 'RCCRouter';
    
    // 停止并删除任务
    try {
      execSync(`schtasks /end /tn "${taskName}"`, { stdio: 'pipe' });
    } catch {
      // 忽略停止失败（可能任务未运行）
    }
    
    try {
      execSync(`schtasks /delete /tn "${taskName}" /f`, { stdio: 'pipe' });
    } catch {
      // 忽略删除失败（可能任务不存在）
    }
    
    return {
      success: true,
      serviceName: taskName,
      message: 'Windows 自动启动任务已移除'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 移除 Linux systemd 服务
 */
async function removeLinuxSystemd(): Promise<AutoStartResult> {
  try {
    const serviceName = 'rcc-router';
    const serviceFile = path.join(os.homedir(), '.config', 'systemd', 'user', `${serviceName}.service`);
    
    // 停止并禁用服务
    try {
      execSync(`systemctl --user stop ${serviceName}`, { stdio: 'pipe' });
    } catch {}
    
    try {
      execSync(`systemctl --user disable ${serviceName}`, { stdio: 'pipe' });
    } catch {}
    
    // 删除 service 文件
    try {
      await fs.unlink(serviceFile);
    } catch {}
    
    // 重载配置
    try {
      execSync('systemctl --user daemon-reload', { stdio: 'pipe' });
    } catch {}
    
    return {
      success: true,
      serviceName,
      message: 'Linux 自动启动服务已移除'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}