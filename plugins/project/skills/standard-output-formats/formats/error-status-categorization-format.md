Use this component when:
- Documenting API error responses
- Creating troubleshooting matrices
- Mapping status codes to actions
- Building error recovery strategies
- Standardizing error handling across systems

**Example user message:**
Document all the error codes our API can return with explanations and fixes.

## Template

## [System Name] Error Reference

### Error Code Quick Reference
```text
Code Range    Category            Retry?    User Action Required
──────────────────────────────────────────────────────────────────
[100-199]     [Informational]     N/A       None
[200-299]     [Success]           No        None
[400-499]     [Client Error]      No        Fix request
[500-599]     [Server Error]      Yes       Wait and retry
[XXX-XXX]     [Custom Category]   Varies    See specific code
```

### Detailed Error Catalog
```text
┌──────────┬────────────────────┬──────────────┬─────────────────┐
│   Code   │     Message        │    Cause     │    Solution     │
├──────────┼────────────────────┼──────────────┼─────────────────┤
│ [CODE_1] │ [User message]     │ [Root cause] │ [How to fix]    │
│ [CODE_2] │ [User message]     │ [Root cause] │ [How to fix]    │
│ [CODE_3] │ [User message]     │ [Root cause] │ [How to fix]    │
└──────────┴────────────────────┴──────────────┴─────────────────┘
```

### Error Response Structure
```json
{
  "error": {
    "code": "[ERROR_CODE]",
    "message": "[Human-readable message]",
    "details": {
      "[field]": "[specific issue]",
      "[context]": "[additional info]"
    },
    "timestamp": "[ISO-8601]",
    "request_id": "[trace-id]",
    "help_url": "[documentation link]"
  }
}
```

### Recovery Strategy Matrix
```text
Error Type          First Attempt       Second Attempt      Final Action
────────────────────────────────────────────────────────────────────────
Network Timeout     Retry immediately   Retry +5s delay     Circuit break
Rate Limited        Wait per header     Exponential backoff Queue request
Invalid Data        Log and reject      N/A                 Return error
Server Error        Retry +1s           Retry +5s           Failover
Auth Failed         Refresh token       Re-authenticate     Logout user
```

### Status-to-Action Mapping
```text
Status              Cache?    Retry?    Log Level    Alert?
──────────────────────────────────────────────────────────
2XX Success         Yes       No        INFO         No
3XX Redirect        No        Follow    INFO         No
400 Bad Request     No        No        WARN         No
401 Unauthorized    No        After auth ERROR       No
429 Rate Limited    No        Yes       WARN         Yes (if frequent)
500 Server Error    No        Yes       ERROR        Yes
503 Unavailable     No        Yes       ERROR        Yes (if >5 min)
```
