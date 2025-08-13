/**
 * V3.0 Error Handling System
 */

export class UnifiedErrorHandler {
  static handle(error: Error, context?: any) {
    console.error('❌ V3 Error:', error.message, context);
    return { error: error.message, context };
  }

  static validateErrorHandling(error: any, reply: any, context: any) {
    console.error('🔍 V3 Error validation:', error.message, context);
  }
}

export function handleProviderError(error: any, reply: any, context: any) {
  console.error(`❌ V3 Provider Error (${context?.providerId}):`, error.message);
  if (reply && !reply.sent) {
    reply.code(500).send({
      error: {
        type: 'provider_error',
        message: error.message
      }
    });
  }
}

export function handleStreamingError(error: any, reply: any, context: any) {
  console.error('❌ V3 Streaming Error:', error.message);
  if (reply && !reply.sent) {
    reply.raw.write(`event: error\ndata: ${JSON.stringify({
      error: {
        type: 'streaming_error',
        message: error.message
      }
    })}\n\n`);
    reply.raw.end();
  }
}

export function handleRoutingError(error: any, reply: any, context: any) {
  console.error('❌ V3 Routing Error:', error.message);
  if (reply && !reply.sent) {
    reply.code(400).send({
      error: {
        type: 'routing_error',
        message: error.message
      }
    });
  }
}

export function handleInputError(error: any, reply: any, context: any) {
  console.error('❌ V3 Input Error:', error.message);
  if (reply && !reply.sent) {
    reply.code(400).send({
      error: {
        type: 'input_error',
        message: error.message
      }
    });
  }
}

export function handleOutputError(error: any, reply: any, context: any) {
  console.error('❌ V3 Output Error:', error.message);
  if (reply && !reply.sent) {
    reply.code(500).send({
      error: {
        type: 'output_error',
        message: error.message
      }
    });
  }
}