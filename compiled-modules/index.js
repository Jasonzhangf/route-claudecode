/**
 * RCC v4.0 模块API网关
 * 
 * ⚠️ 此文件为编译生成，请勿手动修改
 * 
 * 提供统一的模块访问接口，隐藏具体实现细节
 */

// 导出所有编译后的模块
module.exports = {
  // 配置管理模块
  config: require('./config'),
  
  // 路由器模块  
  router: require('./router'),
  
  // 未来扩展：
  // pipeline: require('./pipeline'),    // 待重构
  // scheduler: require('./scheduler'),  // 待重构
};

// 模块信息
module.exports.__moduleInfo = {
  version: '4.1.0',
  buildTime: new Date().toISOString(),
  isolationLevel: 'complete',
  availableModules: Object.keys(module.exports).filter(k => k !== '__moduleInfo')
};
