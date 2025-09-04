/**
 * TypeScript Module Analyzer
 * 
 * 真实的TypeScript模块分析器实现
 * 
 * @author RCC v4.0 Architecture Scanner
 */

import type { 
  ModuleAnalyzerInterface, 
  ModuleInfo, 
  ModuleType, 
  ExportInfo, 
  ImportInfo, 
  InterfaceInfo, 
  ImplementationInfo 
} from '../../core/interfaces/scanner-interface';
import type { ArchScannerConfig } from '../../types/config-types';
import * as fs from 'fs';
import * as path from 'path';

export class TypeScriptModuleAnalyzer implements ModuleAnalyzerInterface {
  private readonly config: ArchScannerConfig;

  constructor(config: ArchScannerConfig) {
    this.config = config;
  }

  async analyzeProject(): Promise<ModuleInfo[]> {
    const modules: ModuleInfo[] = [];
    const tsFiles = await this.findTypeScriptFiles(this.config.projectRoot);
    
    for (const filePath of tsFiles) {
      const moduleInfo = await this.analyzeModule(filePath);
      modules.push(moduleInfo);
    }

    return modules;
  }

  async analyzeModule(modulePath: string): Promise<ModuleInfo> {
    if (!fs.existsSync(modulePath)) {
      throw new TypeError(`Module file not found: ${modulePath}`);
    }

    const content = fs.readFileSync(modulePath, 'utf-8');
    
    return {
      name: this.extractModuleName(modulePath),
      path: modulePath,
      type: this.determineModuleType(modulePath, content),
      exports: this.extractExports(content),
      imports: this.extractImports(content),
      dependencies: this.extractDependencies(content),
      interfaces: this.extractInterfaces(content),
      implementations: this.extractImplementations(content)
    };
  }

  private async findTypeScriptFiles(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const walkDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!this.shouldExclude(fullPath)) {
            walkDir(fullPath);
          }
        } else if (entry.isFile() && this.isTypeScriptFile(entry.name)) {
          if (this.shouldInclude(fullPath)) {
            files.push(fullPath);
          }
        }
      }
    };

    walkDir(rootPath);
    return files;
  }

  private extractModuleName(filePath: string): string {
    const relativePath = path.relative(this.config.projectRoot, filePath);
    return relativePath.replace(/\.(ts|tsx)$/, '').replace(/[/\\]/g, '-');
  }

  private determineModuleType(filePath: string, content: string): ModuleType {
    const pathLower = filePath.toLowerCase();
    
    // 只检测主模块目录的入口文件，不检测内部实现文件
    const relativePath = path.relative(this.config.projectRoot, filePath);
    const pathParts = relativePath.split(path.sep);
    
    // 如果不在src目录下，跳过
    if (pathParts[0] !== 'src') return 'unknown';
    
    // 只检测主模块目录的index.ts或主要入口文件
    if (pathParts.length >= 2) {
      const moduleDir = pathParts[1];
      const fileName = pathParts[pathParts.length - 1];
      
      // 只扫描模块入口文件，忽略内部实现
      const isModuleEntry = fileName === 'index.ts' || 
                           fileName.includes('module.ts') ||
                           fileName.includes('-module.ts') ||
                           fileName.includes('manager.ts');
                           
      if (!isModuleEntry) {
        return 'unknown'; // 跳过内部实现文件
      }
      
      // 基于顶级目录判断模块类型
      if (moduleDir === 'client') return 'client';
      if (moduleDir === 'router') return 'router';
      if (moduleDir === 'pipeline') return 'pipeline';
      if (moduleDir === 'transformer') return 'transformer';
      if (moduleDir === 'protocol') return 'protocol';
      if (moduleDir === 'server-compatibility') return 'server-compatibility';
      if (moduleDir === 'server') return 'server';
      if (moduleDir === 'config') return 'config';
      if (moduleDir === 'auth') return 'auth';
      if (moduleDir === 'debug') return 'debug';
      if (moduleDir === 'middleware') return 'middleware';
      if (moduleDir === 'types' || moduleDir === 'interfaces') return 'types';
    }
    
    return 'unknown';
  }

  private extractExports(content: string): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 默认导出
      if (line.startsWith('export default')) {
        exports.push({
          name: 'default',
          type: this.determineExportType(line),
          isDefault: true,
          line: i + 1
        });
      }
      
      // 命名导出
      const namedExportMatch = line.match(/^export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/);
      if (namedExportMatch) {
        exports.push({
          name: namedExportMatch[1],
          type: this.determineExportType(line),
          isDefault: false,
          line: i + 1
        });
      }
      
      // 重导出
      const reExportMatch = line.match(/^export\s+\{([^}]+)\}/);
      if (reExportMatch) {
        const exportNames = reExportMatch[1].split(',').map(name => name.trim());
        for (const exportName of exportNames) {
          exports.push({
            name: exportName,
            type: 'variable',
            isDefault: false,
            line: i + 1
          });
        }
      }
    }

    return exports;
  }

  private extractImports(content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('import')) {
        const importMatch = line.match(/import\s+(?:type\s+)?(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/);
        
        if (importMatch) {
          const [, namedImports, namespaceImport, defaultImport, source] = importMatch;
          const isTypeOnly = line.includes('import type');
          
          let importNames: string[] = [];
          
          if (namedImports) {
            importNames = namedImports.split(',').map(name => name.trim());
          } else if (namespaceImport) {
            importNames = [namespaceImport];
          } else if (defaultImport) {
            importNames = [defaultImport];
          }
          
          imports.push({
            source,
            imports: importNames,
            isTypeOnly,
            line: i + 1
          });
        }
      }
    }

    return imports;
  }

  private extractDependencies(content: string): string[] {
    const dependencies = new Set<string>();
    const importMatches = content.match(/from\s+['"]([^'"]+)['"]/g);
    
    if (importMatches) {
      for (const match of importMatches) {
        const sourceMatch = match.match(/from\s+['"]([^'"]+)['"]/);
        if (sourceMatch) {
          const source = sourceMatch[1];
          if (!source.startsWith('.')) {
            const packageName = source.split('/')[0];
            dependencies.add(packageName);
          } else {
            dependencies.add(source);
          }
        }
      }
    }

    return Array.from(dependencies);
  }

  private extractInterfaces(content: string): InterfaceInfo[] {
    const interfaces: InterfaceInfo[] = [];
    const interfaceRegex = /interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*\{/g;
    let match;

    while ((match = interfaceRegex.exec(content)) !== null) {
      const interfaceName = match[1];
      const extendsClause = match[2];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      interfaces.push({
        name: interfaceName,
        methods: this.extractMethodsFromBlock(content, match.index),
        properties: this.extractPropertiesFromBlock(content, match.index),
        extends: extendsClause ? extendsClause.split(',').map(e => e.trim()) : undefined,
        line: lineNumber
      });
    }

    return interfaces;
  }

  private extractImplementations(content: string): ImplementationInfo[] {
    const implementations: ImplementationInfo[] = [];
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{/g;
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const extendsClass = match[2];
      const implementsClause = match[3];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      implementations.push({
        name: className,
        extends: extendsClass,
        implements: implementsClause ? implementsClause.split(',').map(i => i.trim()) : undefined,
        methods: this.extractMethodsFromBlock(content, match.index),
        properties: this.extractPropertiesFromBlock(content, match.index),
        line: lineNumber
      });
    }

    return implementations;
  }

  private extractMethodsFromBlock(content: string, startIndex: number): any[] {
    const methods: any[] = [];
    
    // 找到匹配的花括号结束位置
    const blockContent = this.extractBlockContent(content, startIndex);
    if (!blockContent) return methods;
    
    // 提取方法定义
    const methodRegex = /(?:public|private|protected)?\s*(async\s+)?(\w+)\s*\([^)]*\)(?:\s*:\s*[^{;]+)?(?:\s*{[^{}]*}|\s*;)/g;
    let match;
    
    while ((match = methodRegex.exec(blockContent)) !== null) {
      const isAsync = !!match[1];
      const methodName = match[2];
      
      // 跳过构造函数和getter/setter
      if (methodName === 'constructor' || methodName === 'get' || methodName === 'set') {
        continue;
      }
      
      methods.push({
        name: methodName,
        isAsync,
        isPublic: !match[0].includes('private') && !match[0].includes('protected'),
        line: content.substring(0, startIndex + match.index).split('\n').length
      });
    }
    
    return methods;
  }

  private extractPropertiesFromBlock(content: string, startIndex: number): any[] {
    const properties: any[] = [];
    
    // 找到匹配的花括号结束位置
    const blockContent = this.extractBlockContent(content, startIndex);
    if (!blockContent) return properties;
    
    // 提取属性定义
    const propertyRegex = /(?:public|private|protected)?\s*(readonly\s+)?(\w+)(?:\?)?(?:\s*:\s*([^;=\n]+))?(?:\s*=\s*[^;\n]+)?;/g;
    let match;
    
    while ((match = propertyRegex.exec(blockContent)) !== null) {
      const isReadonly = !!match[1];
      const propertyName = match[2];
      const propertyType = match[3]?.trim();
      
      properties.push({
        name: propertyName,
        type: propertyType || 'unknown',
        isReadonly,
        isPublic: !match[0].includes('private') && !match[0].includes('protected'),
        line: content.substring(0, startIndex + match.index).split('\n').length
      });
    }
    
    return properties;
  }

  private extractBlockContent(content: string, startIndex: number): string | null {
    let braceCount = 0;
    let blockStart = -1;
    let blockEnd = -1;
    
    // 找到开始的花括号
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        if (blockStart === -1) blockStart = i;
        braceCount++;
      } else if (content[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          blockEnd = i;
          break;
        }
      }
    }
    
    if (blockStart === -1 || blockEnd === -1) return null;
    
    return content.substring(blockStart + 1, blockEnd);
  }

  private determineExportType(line: string): 'function' | 'class' | 'interface' | 'type' | 'variable' {
    if (line.includes('function')) return 'function';
    if (line.includes('class')) return 'class';
    if (line.includes('interface')) return 'interface';
    if (line.includes('type')) return 'type';
    return 'variable';
  }

  private isTypeScriptFile(fileName: string): boolean {
    return /\.(ts|tsx)$/.test(fileName);
  }

  private shouldExclude(filePath: string): boolean {
    if (!this.config.excludePatterns) return false;
    
    const relativePath = path.relative(this.config.projectRoot, filePath);
    return this.config.excludePatterns.some(pattern => 
      this.matchesGlob(relativePath, pattern)
    );
  }

  private shouldInclude(filePath: string): boolean {
    if (!this.config.includePatterns) return true;
    
    const relativePath = path.relative(this.config.projectRoot, filePath);
    return this.config.includePatterns.some(pattern => 
      this.matchesGlob(relativePath, pattern)
    );
  }

  private matchesGlob(filePath: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }
}