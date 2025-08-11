# Test Request Body Construction

## Test Case
Verify that the CodeWhisperer request body is constructed correctly by comparing with the demo2 implementation.

## Test Objective
- Generate a sample CodeWhisperer request using the current TypeScript implementation
- Output the complete request body as JSON for comparison
- Identify any structural differences from the demo2 Go implementation

## Execution
```bash
node test/functional/test-request-body-construction.js
```

## Expected Output
A JSON representation of the CodeWhisperer request body that can be compared with the demo2 implementation.

## Recent Execution Records
| Date | Status | Duration | Log File |
|------|--------|----------|----------|
| 2025-07-28 | Created | N/A | N/A |

## Related Files
- `test/functional/test-request-body-construction.js` - Test script
- `src/providers/codewhisperer/converter.ts` - Request construction logic
- `./examples/demo2/main.go` - Reference Go implementation
- `~/.claude-code-router/config.json` - Configuration file

## Notes
This test helps diagnose the 400 API errors by allowing direct comparison of request body structure between implementations.