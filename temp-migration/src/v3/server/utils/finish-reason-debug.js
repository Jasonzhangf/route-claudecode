/**
 * Finish Reason Debug Utility - Placeholder Implementation
 */
export class FinishReasonDebug {
    static analyze(finishReason) {
        return {
            reason: finishReason,
            category: 'unknown',
            recommendations: []
        };
    }
    static mapReason(provider, reason) {
        return reason || 'stop';
    }
    static logFinishReasonDebug(reason, context) {
        console.log(`[DEBUG] Finish reason: ${reason}`, context);
    }
}
// Export individual functions for direct import
export function logFinishReasonDebug(reason, context) {
    FinishReasonDebug.logFinishReasonDebug(reason, context);
}
export default FinishReasonDebug;
console.log('🔧 MOCKUP: Finish reason debug utility placeholder loaded');
