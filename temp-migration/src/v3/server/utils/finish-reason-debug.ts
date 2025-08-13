/**
 * Finish Reason Debug Utility - Placeholder Implementation
 */

export class FinishReasonDebug {
  static analyze(finishReason: string): any {
    return {
      reason: finishReason,
      category: 'unknown',
      recommendations: []
    };
  }

  static mapReason(provider: string, reason: string): string {
    return reason || 'stop';
  }

  static logFinishReasonDebug(reason: string, context: any): void {
    console.log(`[DEBUG] Finish reason: ${reason}`, context);
  }
}

// Export individual functions for direct import
export function logFinishReasonDebug(reason: string, context: any): void {
  FinishReasonDebug.logFinishReasonDebug(reason, context);
}

export default FinishReasonDebug;

console.log('🔧 MOCKUP: Finish reason debug utility placeholder loaded');