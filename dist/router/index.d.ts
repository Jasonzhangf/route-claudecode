/**
 * DEPRECATED: This router module has been replaced by src/modules/routing/
 *
 * ❌ DO NOT USE: This router module is deprecated
 * ✅ USE INSTEAD: src/modules/routing/core-router.ts - CoreRouter
 *
 * @deprecated Use CoreRouter from src/modules/routing/ instead
 * @see src/modules/routing/core-router.ts
 */
export { CoreRouter } from '../modules/routing';
export declare const ROUTER_MODULE_VERSION = "4.0.0-alpha.2";
export interface RouterModuleInterface {
    version: string;
    initialize(): Promise<void>;
    routeRequest(request: any): Promise<any>;
}
//# sourceMappingURL=index.d.ts.map