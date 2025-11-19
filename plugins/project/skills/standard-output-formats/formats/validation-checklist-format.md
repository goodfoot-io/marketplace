Use this component when:
- Creating implementation validation checklists
- Documenting verification procedures
- Establishing quality gates
- Guiding review processes
- Ensuring technical standards compliance

**Example user message:**
Create a validation checklist for our API implementation.

## Template

## [Feature/Component] Validation Checklist

### Implementation Completeness
- [ ] **Core Functionality**: All specified features implemented
- [ ] **Error Handling**: Proper error responses and edge case handling
- [ ] **Documentation**: API endpoints and usage documented
- [ ] **Testing**: Unit tests covering main functionality
- [ ] **Integration**: Works with existing system components

### Code Quality Standards
- [ ] **Type Safety**: All TypeScript types properly defined
- [ ] **Code Style**: Follows project style guidelines
- [ ] **Performance**: No obvious performance bottlenecks
- [ ] **Security**: Input validation and security measures implemented
- [ ] **Maintainability**: Code is readable and well-structured

### System Integration
- [ ] **Dependencies**: All required dependencies properly integrated
- [ ] **Configuration**: Environment-specific settings handled
- [ ] **Database**: Schema changes applied and tested
- [ ] **API Contracts**: Request/response formats match specification
- [ ] **Backwards Compatibility**: Changes don't break existing functionality

### Deployment Readiness
- [ ] **Build Process**: Successfully builds in all environments
- [ ] **Environment Variables**: All required configurations documented
- [ ] **Migration Scripts**: Database/system migrations prepared
- [ ] **Monitoring**: Logging and monitoring instrumentation added
- [ ] **Rollback Plan**: Procedure for reverting changes defined

### Validation Results
**Status**: ✅ Ready / ⚠️ Issues Found / ❌ Not Ready
**Critical Issues**: [List any blocking issues]
**Minor Issues**: [List non-blocking issues]
**Recommendations**: [Suggested improvements]

### Sign-off
- [ ] **Developer**: Implementation complete
- [ ] **Code Review**: Peer review passed
- [ ] **Testing**: QA validation complete
- [ ] **Architecture**: Technical design approved
