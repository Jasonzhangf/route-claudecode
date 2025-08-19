/**
 * Provider工厂
 *
 * 统一创建和管理各种Protocol处理器实例
 *
 * @author Jason Zhang
 */
import { OpenAIProtocolConfig } from './openai-protocol-handler';
import { AnthropicProtocolConfig } from './anthropic-protocol-handler';
import { IModuleInterface } from '../../interfaces/core/module-implementation-interface';
/**
 * 支持的Provider Protocol类型
 */
export type ProviderProtocolType = 'openai' | 'anthropic' | 'gemini';
/**
 * Provider配置接口
 */
export interface ProviderConfig {
    /** Provider Protocol类型 */
    type: ProviderProtocolType;
    /** Provider ID */
    id: string;
    /** Provider名称 */
    name: string;
    /** 是否启用 */
    enabled: boolean;
    /** 特定协议的配置 */
    config: OpenAIProtocolConfig | AnthropicProtocolConfig | any;
}
/**
 * Provider创建选项
 */
export interface ProviderCreateOptions {
    /** Provider ID */
    id: string;
    /** Provider Protocol类型 */
    type: ProviderProtocolType;
    /** 特定协议的配置 */
    config: any;
    /** 调试模式 */
    debug?: boolean;
}
/**
 * Provider工厂类
 */
export declare class ProviderFactory {
    private static instance;
    private createdProviders;
    private constructor();
    /**
     * 获取工厂单例
     */
    static getInstance(): ProviderFactory;
    /**
     * 创建Provider实例
     */
    createProvider(options: ProviderCreateOptions): IModuleInterface;
    /**
     * 批量创建Provider实例
     */
    createProviders(configs: ProviderConfig[], debug?: boolean): IModuleInterface[];
    /**
     * 获取已创建的Provider
     */
    getProvider(id: string): IModuleInterface | undefined;
    /**
     * 获取所有已创建的Provider
     */
    getAllProviders(): IModuleInterface[];
    /**
     * 检查Provider是否存在
     */
    hasProvider(id: string): boolean;
    /**
     * 销毁Provider实例
     */
    destroyProvider(id: string): Promise<boolean>;
    /**
     * 销毁所有Provider实例
     */
    destroyAllProviders(): Promise<void>;
    /**
     * 获取支持的Provider Protocol类型
     */
    getSupportedTypes(): ProviderProtocolType[];
    /**
     * 验证Provider配置
     */
    validateProviderConfig(config: ProviderConfig): {
        valid: boolean;
        errors: string[];
    };
    /**
     * 获取工厂状态信息
     */
    getFactoryStatus(): {
        totalProviders: number;
        providerIds: string[];
        supportedTypes: ProviderProtocolType[];
        createdAt: string;
    };
}
//# sourceMappingURL=provider-factory.d.ts.map