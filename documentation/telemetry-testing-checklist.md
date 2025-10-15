# Telemetry Testing Checklist

## Automated Testing (Unit Tests)

### Privacy & Sanitization Tests
- [ ] Test branch name sanitization
  - [ ] Common branches (main, master, develop) remain unchanged
  - [ ] Custom branch names are hashed
  - [ ] Hash length is 16 characters
- [ ] Test path sanitization
  - [ ] User paths are replaced with `<user>`
  - [ ] Workspace paths are replaced with `<workspace>/`
  - [ ] File paths in error messages are sanitized
- [ ] Test URL sanitization
  - [ ] Git URLs are replaced with `<url>`
  - [ ] HTTP/HTTPS URLs are replaced with `<url>`
- [ ] Test stack trace sanitization
  - [ ] User-specific paths removed
  - [ ] Stack trace length limited to 2000 chars

### Telemetry Service Tests
- [ ] Test telemetry disabled in development mode
- [ ] Test telemetry respects VS Code settings (`isTelemetryEnabled`)
- [ ] Test error rate limiting (max 100 errors per session)
- [ ] Test sampling logic (`shouldSample` returns correct rate)
- [ ] Test event naming convention (Category.EventName)
- [ ] Test null-safe operations (no errors when reporter is undefined)

### Error Context Tests
- [ ] Test error context includes all required fields
  - [ ] `operationName`
  - [ ] `errorCategory` (git, user, extension, vscode)
  - [ ] `extensionVersion`
  - [ ] `vscodeVersion`
  - [ ] `platform`

## Manual Testing

### Installation & Activation
- [ ] Install extension in VS Code
- [ ] Open a git repository
- [ ] Verify activation completes without errors
- [ ] Check Output panel for telemetry initialization messages

### Privacy Verification (Application Insights Portal)
- [ ] Open Application Insights portal
- [ ] Search for recent telemetry events
- [ ] Verify NO user-specific paths are present
- [ ] Verify NO actual branch names (except common ones)
- [ ] Verify NO git remote URLs
- [ ] Verify stack traces have sanitized paths

### Error Tracking
- [ ] Trigger git initialization failure
  - [ ] Delete .git folder
  - [ ] Verify error telemetry sent with proper context
- [ ] Trigger branch detection failure
  - [ ] Use invalid branch name
  - [ ] Verify error telemetry sent
- [ ] Trigger command failure
  - [ ] Use discard changes on locked file
  - [ ] Verify error telemetry sent with stack trace

### Usage Tracking
- [ ] Execute commands multiple times
  - [ ] Refresh command (verify 10% sampling)
  - [ ] Branch selection (verify 10% sampling)
  - [ ] Open file (verify 10% sampling)
  - [ ] Open diff (verify 10% sampling)
- [ ] Toggle view modes
  - [ ] Switch to "All Files"
  - [ ] Switch to "Changed Files"
  - [ ] Verify events sent (no sampling)
- [ ] Use multi-select operations
  - [ ] Select multiple files
  - [ ] Open files
  - [ ] Verify multi-select event sent

### Performance Tracking
- [ ] Execute operations and verify performance events
  - [ ] Extension activation
  - [ ] Git repository discovery
  - [ ] GitService creation
  - [ ] Command executions

### File Watcher Aggregation
- [ ] Make batch file changes
  - [ ] Modify multiple files
  - [ ] Verify aggregated metrics sent (not individual events)
  - [ ] Check batch size is reported correctly

### Telemetry Opt-Out
- [ ] Disable telemetry in VS Code settings
  - [ ] `telemetry.telemetryLevel = off`
- [ ] Verify no telemetry events sent
- [ ] Verify extension still functions normally

### Disposal & Cleanup
- [ ] Reload VS Code window
- [ ] Verify telemetry reporter disposal
- [ ] Check for any pending events

## Expected Events in Application Insights

### Extension Lifecycle
- `Extension.ActivationStarted`
- `Extension.GitRepositoryDiscovered` or `Extension.GitRepositoryNotFound`
- `Extension.GitServiceCreated`
- `Extension.ActivationCompleted`

### Error Events
- `Error.Occurred` (with errorCategory, operationName, stack trace)

### Usage Events
- `Usage.CommandExecuted` (sampled 10%)
- `Usage.ViewModeChanged` (no sampling)
- `Usage.BranchSelectionMethod` (no sampling)
- `Usage.MultiSelectOperation` (no sampling)

### Performance Events
- `Performance.RefreshCompleted`
- `Performance.GitOperationCompleted`
- `Performance.CommandCompleted`

### File Watcher Events
- `FileWatcher.BatchProcessed` (aggregated, 10% sampling)

## Known Issues & Limitations
- Telemetry is disabled in development mode (ExtensionMode.Development)
- Error rate limiting prevents more than 100 errors per session
- High-frequency commands use 10% sampling to reduce data volume
- File watcher events are aggregated (individual file changes not tracked)

## Testing Tools

### Application Insights Queries
```kusto
// Find all extension events
customEvents
| where timestamp > ago(1h)
| where name startswith "Extension." or name startswith "Usage." or name startswith "Error." or name startswith "Performance."
| order by timestamp desc

// Check for PII leakage
customEvents
| where timestamp > ago(1h)
| where customDimensions contains "/Users/" or customDimensions contains "C:\\Users\\"
| project timestamp, name, customDimensions

// Error analysis
customEvents
| where timestamp > ago(1h)
| where name == "Error.Occurred"
| extend errorType = tostring(customDimensions.errorType)
| extend errorCategory = tostring(customDimensions.errorCategory)
| summarize count() by errorType, errorCategory
```

### VS Code Settings for Testing
```json
{
  "telemetry.telemetryLevel": "all",  // Enable telemetry
  "compareBranch.autoDetectSourceBranch": true
}
```

## Post-Deployment Monitoring

### Week 1 Checks
- [ ] Monitor error rates (should be < 1% per operation)
- [ ] Verify no PII in collected data
- [ ] Check telemetry volume (should not exceed quota)
- [ ] Review top errors and prioritize fixes

### Ongoing Monitoring
- [ ] Set up alerts for error rate > 5%
- [ ] Review weekly aggregated metrics
- [ ] Track feature adoption rates
- [ ] Monitor performance regressions
