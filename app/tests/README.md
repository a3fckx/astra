# Astra Test Suite Documentation

## 🎯 Overview

This test suite provides comprehensive testing for Astra's MongoDB-based infrastructure and environment configuration. It ensures reliability, privacy compliance, and business continuity for our astrology companion application.

## 📋 Table of Contents

- [Business Context](#business-context)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Environment Configuration](#environment-configuration)
- [Business Impact](#business-impact)

## 🏢 Business Context

### Why These Tests Matter

Astra is a **user-data-intensive astrology application** that handles sensitive personal information. Test failures not only cause technical issues but can lead to:

- **Privacy Violations**: Mishandling birth dates and personal data
- **Revenue Loss**: Authentication failures block user access
- **Compliance Risks**: GDPR/CCPA violations result in massive fines
- **User Experience Degradation**: Broken features lead to churn

### Critical Business Functions Tested

| Function | Business Impact | Risk Level | Test Coverage |
|----------|----------------|------------|---------------|
| User Authentication | 100% Revenue Dependency | Critical | Environment parsing |
| Data Privacy (Birth Dates) | GDPR Compliance | Critical | Feature flags |
| Message Processing | Core Service | High | Database operations |
| Session Management | User Retention | Medium | Collections |

## 📁 Test Structure

```
tests/
├── README.md                           # This documentation
├── setup.ts                            # Global test configuration
├── .env.test                           # Test environment variables
├── unit/                               # Unit tests for individual functions
│   ├── env.test.ts                     # Environment variable parsing
│   ├── env-documentation.test.ts       # Fully documented examples
│   └── mongo-connection.test.ts        # Database connection logic
├── integration/                         # End-to-end component testing
│   └── mongo.test.ts                   # MongoDB collection operations
└── utils/                              # Shared testing utilities
    └── mongodb-test-utils.ts           # Database helpers and fixtures
```

## 🚀 Running Tests

### Development Mode
```bash
# Run all tests with watch mode
bun test:watch

# Run specific test file
bun test tests/unit/env.test.ts

# Run with coverage reporting
bun test:coverage
```

### CI/CD Integration
```bash
# Production test run (used in pre-commit)
bun test --timeout=1000 tests/unit/env.test.ts
```

### Test Categories

#### 🔹 Unit Tests
- **Purpose**: Test individual functions in isolation
- **Speed**: Extremely fast (<100ms)
- **Coverage**: Environment parsing, validation logic
- **Business Impact**: Prevents configuration errors

#### 🔹 Integration Tests
- **Purpose**: Test database operations and workflows
- **Speed**: Fast (<1s)
- **Coverage**: CRUD operations, data integrity
- **Business Impact**: Ensures data persistence works

#### 🔹 Documentation Tests
- **Purpose**: Examples with business context
- **Speed**: Fast
- **Coverage**: Real-world scenarios
- **Business Impact**: Team knowledge sharing

## ⚙️ Environment Configuration

### Test Database Setup

The test suite uses a **completely isolated MongoDB database**:

- **Database Name**: `astra_test`
- **Connection**: Never touches production data
- **Isolation**: Each test cleans up after itself
- **Safety**: Zero risk to user data

### Feature Flag Configuration

Environment variables control sensitive features:

| Variable | Purpose | Privacy Impact | Business Value |
|----------|---------|----------------|----------------|
| `GOOGLE_ENABLE_BIRTHDAY_SCOPE` | Birth date access for astrology | Special personal data (GDPR) | Core features |
| `GOOGLE_ENABLE_GMAIL_READ_SCOPE` | Email-based insights | Maximum sensitivity | Advanced analytics |
| `GOOGLE_OAUTH_PROMPT` | User consent flow | User experience | Conversion optimization |

## 💰 Business Impact Analysis

### Test Failure Scenarios

#### 🚨 Critical Failures
1. **Environment Parsing Errors**
   - **Impact**: Complete service outage
   - **Revenue**: $1,000/hour downtime
   - **Recovery**: Manual configuration fixes required

2. **Feature Flag False Positives**
   - **Impact**: Privacy violations, legal action
   - **Risk**: $10M+ GDPR fines
   - **Recovery**: Data deletion, compliance reporting

3. **Database Connection Failures**
   - **Impact**: Data loss, service interruption
   - **Recovery**: Database recovery procedures
   - **Cost**: Emergency engineering time

#### ⚠️ Medium Impact Failures
1. **Permission Scope Errors**
   - **Impact**: Reduced user experience
   - **Conversion**: 40% drop in signups
   - **Support**: Increased user complaints

2. **Collection Operation Failures**
   - **Impact**: Feature degradation
   - **User Trust**: Reduced confidence in service
   - **Recovery**: Manual data fixes

### Success Metrics

When tests pass successfully:

- ✅ **Reliability**: 99.9% uptime target achievable
- ✅ **Privacy**: Compliance with GDPR/CCPA maintained
- ✅ **User Experience**: Features work as expected
- ✅ **Development Velocity**: Fast iteration and deployment

## 🔍 Test Examples and Business Scenarios

### Scenario 1: Feature Flag Privacy Compliance
```typescript
// Test ensures birthday data isn't collected when disabled
GOOGLE_ENABLE_BIRTHDAY_SCOPE=false
// Expected: No birthday scope in OAuth request
// Business Impact: GDPR compliance, user trust
```

### Scenario 2: Startup Configuration Validation
```typescript
// Test prevents startup with missing secrets
BETTER_AUTH_SECRET=undefined
// Expected: Application fails to start
// Business Impact: Prevents security vulnerabilities
```

### Scenario 3: Database Operation Integrity
```typescript
// Test message persisting and retrieval
// Expected: Messages round-trip successfully
// Business Impact: Core functionality works
```

## 📊 Coverage Requirements

### Minimum Coverage Targets

| Test Type | Coverage Target | Business Reason |
|-----------|----------------|-----------------|
| Environment Parsing | 95% | All configuration scenarios |
| Database Operations | 80% | Critical data paths |
| Core Business Logic | 90% | User-facing features |

### Critical Path Testing

These are **must-pass** scenarios:

1. **User Authentication Flow**: Revenue-critical
2. **Privacy Feature Flags**: Legal compliance
3. **Message Processing**: Core service
4. **Database Persistence**: Data integrity
5. **Configuration Validation**: System stability

## 🔄 Continuous Integration

### Pre-commit Hooks
- **Fast Feedback**: Tests run before commits
- **Quality Gates**: Broken code not committed
- **Developer Experience**: Immediate feedback

### CI/CD Pipeline
- **Comprehensive Testing**: Full test suite run
- **Coverage Reports**: Code quality metrics
- **Security Scanning**: Vulnerability detection

## 🎓 Business Testing Guidelines

### When to Add Tests
1. **New Features**: Always test with business scenarios
2. **Configuration Changes**: Test all failure modes
3. **Privacy Features**: Extra scrutiny required
4. **Revenue-Critical paths**: Highest priority

### Test Quality Standards
- **Business Context**: Every test explains business purpose
- **Edge Cases**: Consider real-world failure scenarios
- **Documentation**: Comment with business impact
- **Maintenance**: Tests should evolve with business needs

## 🚀 Future Expansion

### Planned Test Areas
1. **API Integration Tests**: Third-party service reliability
2. **Performance Tests**: Load testing for scalability
3. **Security Tests**: Vulnerability scanning
4. **User Journey Tests**: End-to-end workflows

### Business Metrics Integration
- **Conversion Testing**: Checkout and signup flows
- **Retention Testing**: Long-term user engagement
- **Monetization Testing**: Premium feature access
- **Support Testing**: Customer issue resolution

---

## 📞 Support and Resources

- **Test Failures**: Check business context in execution logs
- **Configuration Issues**: Review .env.test.example
- **Database Problems**: Verify MongoDB Atlas test cluster
- **Production Deployment**: All tests must pass first

**Remember**: Every test failure represents a potential user experience issue and possible business impact. Prioritize fixes based on business criticality and user impact.
