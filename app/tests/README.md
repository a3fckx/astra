# Astra Test Suite Documentation

> **Complete testing guide**: Business context, structure, patterns, and best practices

---

## 🎯 Overview

This test suite provides comprehensive testing for Astra's MongoDB-based infrastructure, voice session functionality, and environment configuration. It ensures reliability, privacy compliance, and business continuity for our astrology companion application.

## 📋 Table of Contents

- [Business Context](#business-context)
- [Directory Structure](#directory-structure)
- [Organizational Principles](#organizational-principles)
- [Running Tests](#running-tests)
- [Test Categories](#test-categories)
- [Mock Guidelines](#mock-guidelines)
- [Helper Guidelines](#helper-guidelines)
- [Import Patterns](#import-patterns)
- [Best Practices](#best-practices)
- [Business Impact](#business-impact)
- [Maintenance](#maintenance)

---

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
| Voice Sessions | Core Product Feature | Critical | Full lifecycle |
| Data Privacy (Birth Dates) | GDPR Compliance | Critical | Feature flags |
| Database Operations | Core Service | High | CRUD operations |
| Session Management | User Retention | Medium | Collections |

---

## 📁 Directory Structure

```
tests/
├── __mocks__/                      # Centralized mock implementations
│   ├── index.ts                    # Export all mocks
│   └── elevenlabs.mock.ts          # ElevenLabs SDK mocks
│
├── __fixtures__/                   # Static test data
│   └── [Future: sample user data, API responses, etc.]
│
├── helpers/                        # Reusable test utilities
│   ├── index.ts                    # Export all helpers
│   └── mongodb.ts                  # MongoDB test helpers
│
├── unit/                           # Unit tests (isolated components)
│   ├── env/                        # Environment configuration tests
│   │   ├── env.test.ts
│   │   └── env-documentation.test.ts
│   ├── database/                   # Database utilities tests
│   │   └── mongo-connection.test.ts
│   ├── responder/                  # Responder-specific logic
│   │   └── handshake.test.ts
│   └── voice-session/              # Voice session components
│       └── useVoiceConnection.test.ts
│
├── integration/                    # Integration tests (multiple components)
│   ├── database/                   # Database integration tests
│   │   └── mongo.test.ts
│   └── voice-session/              # Voice session APIs
│       └── handshake.test.ts
│
├── README.md                       # This file (complete documentation)
└── setup.ts                        # Global test configuration
```

---

## 🎯 Organizational Principles

### 1. **Domain-First Structure**
Tests are organized by **feature/domain** rather than just test type:
- ✅ `unit/voice-session/` (clear domain)
- ❌ `unit/hooks/` (too generic)

### 2. **Consistent Naming**
- **Test files**: `*.test.ts`
- **Mock files**: `*.mock.ts`
- **Helper files**: plain `.ts` (e.g., `mongodb.ts`)

### 3. **Centralized Mocks**
All mocks live in `__mocks__/` with a single export point:
```typescript
import { createMockSessionHandshake } from '@/tests/__mocks__';
```

### 4. **Centralized Helpers**
All test utilities live in `helpers/` with a single export point:
```typescript
import { getTestDb, cleanupTestData } from '@/tests/helpers';
```

---

## 🚀 Running Tests

### Development Mode
```bash
# Run all tests with watch mode
bun test:watch

# Run specific test file
bun test tests/unit/env/env.test.ts

# Run with coverage reporting
bun test:coverage
```

### CI/CD Integration
```bash
# Production test run (used in pre-commit)
bun test --timeout=1000 tests/unit/env/env.test.ts
```

### Test Patterns
```bash
# All tests
bun test

# Specific feature
bun test tests/unit/voice-session

# Specific pattern
find tests -path "*voice-session*.test.ts"

# By domain
bun test tests/unit/env
bun test tests/integration/database
```

---

## 🧪 Test Categories

### Unit Tests (`unit/`)
**Purpose**: Test individual functions/components in isolation

**Characteristics**:
- Fast execution (<100ms per test)
- No external dependencies (mocked)
- High coverage of edge cases
- Single responsibility focus

**Example**:
```typescript
describe('useVoiceConnection', () => {
  it('should handle missing agent ID', () => {
    // Business Impact: Prevents misconfigured sessions
    expect(error).toContain('agent');
  });
});
```

### Integration Tests (`integration/`)
**Purpose**: Test multiple components working together

**Characteristics**:
- Slower execution (may hit real databases/APIs)
- Tests actual integrations
- End-to-end workflows
- Business scenario focus

**Example**:
```typescript
describe('Voice Session Handshake API', () => {
  it('should return complete session data', async () => {
    // Business Impact: Frontend depends on this structure
    const response = await fetchWithAuth('/api/responder/session');
    expect(response.session).toHaveProperty('user');
  });
});
```

---

## 📦 Import Patterns

### ✅ Recommended
```typescript
// Import mocks from centralized location
import { createMockSessionHandshake } from '@/tests/__mocks__';

// Import helpers from centralized location
import { getTestDb } from '@/tests/helpers';

// Import types from source
import type { SessionHandshake } from '@/components/voice-session/types';
```

### ❌ Avoid
```typescript
// Don't import directly from mock files
import { createMockSessionHandshake } from '@/tests/__mocks__/elevenlabs.mock';

// Don't import from relative paths
import { getTestDb } from '../helpers/mongodb';
```

---

## 🎨 Mock Guidelines

### Creating New Mocks

1. **Create the mock file** in `__mocks__/`:
   ```typescript
   // __mocks__/julep.mock.ts
   export function createMockJulepClient() {
     return {
       users: {
         create: mock(() => Promise.resolve({ id: 'user_123' })),
       },
     };
   }
   ```

2. **Export from index**:
   ```typescript
   // __mocks__/index.ts
   export * from './julep.mock';
   ```

3. **Use in tests**:
   ```typescript
   import { createMockJulepClient } from '@/tests/__mocks__';
   ```

### Mock Naming Conventions
- **Factory functions**: `createMock[Thing]()`
- **Mock data**: `mock[Thing]Data`
- **Mock utilities**: `mock[Action]`

**Examples**:
- `createMockSessionHandshake()`
- `mockUserData`
- `mockFetchResponse()`

---

## 🛠️ Helper Guidelines

### Creating New Helpers

1. **Create the helper file** in `helpers/`:
   ```typescript
   // helpers/auth.ts
   export async function createTestUser() {
     // Helper logic
   }
   ```

2. **Export from index**:
   ```typescript
   // helpers/index.ts
   export * from './auth';
   ```

3. **Use in tests**:
   ```typescript
   import { createTestUser } from '@/tests/helpers';
   ```

### Helper Categories
- **Setup**: `setupTestDb()`, `createTestUser()`
- **Cleanup**: `cleanupTestData()`, `resetDatabase()`
- **Assertions**: `expectValidSession()`, `assertNoErrors()`
- **Utilities**: `waitForCondition()`, `generateTestId()`

---

## 📋 Fixtures vs Mocks

### Fixtures (`__fixtures__/`)
**Static test data** that doesn't change:
```typescript
// __fixtures__/users.json
{
  "testUser": {
    "email": "test@example.com",
    "name": "Test User"
  }
}
```

### Mocks (`__mocks__/`)
**Dynamic mock implementations** of functions/modules:
```typescript
// __mocks__/elevenlabs.mock.ts
export function createMockUseConversation() {
  return {
    startSession: mock(() => Promise.resolve('conv_123')),
  };
}
```

**When to use each**:
- **Fixtures**: Sample user profiles, API responses, test configurations
- **Mocks**: SDK functions, API clients, browser APIs

---

## ✅ Best Practices

### DO
✅ Group tests by domain/feature  
✅ Use descriptive test names explaining business impact  
✅ Import from centralized index files  
✅ Clean up resources in `afterEach`/`afterAll`  
✅ Document why a test exists (business context)  
✅ Keep tests focused and isolated  
✅ Use type-safe mocks  

### DON'T
❌ Mix unit and integration tests in the same file  
❌ Create deep nested test directories (max 2 levels)  
❌ Import directly from mock files (use index)  
❌ Share mutable state between tests  
❌ Test implementation details  
❌ Leave commented-out tests  

---

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

---

## 💰 Business Impact Analysis

### Test Failure Scenarios

#### 🚨 Critical Failures
1. **Environment Parsing Errors**
   - **Impact**: Complete service outage
   - **Revenue**: $1,000/hour downtime
   - **Recovery**: Manual configuration fixes required

2. **Voice Session Errors**
   - **Impact**: Core product broken (100% feature failure)
   - **Revenue**: All voice users affected
   - **Recovery**: Immediate hotfix required

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

---

## 📊 Coverage Goals

| Category | Target | Priority | Status |
|----------|--------|----------|--------|
| Unit Tests | 90% | High | 🟢 Active |
| Integration Tests | 70% | Medium | 🟢 Active |
| E2E Tests | 50% | Low | 🟡 Planned |

**Critical Paths** (must be 100%):
- ✅ Authentication flow
- ✅ Voice session lifecycle
- ✅ Environment configuration
- ✅ Database operations

---

## 🔄 Maintenance

### Adding a New Feature
1. Create domain folder in `unit/` and/or `integration/`
2. Add mock file in `__mocks__/` if needed
3. Export from `__mocks__/index.ts`
4. Write tests with business context
5. Update this documentation

### Refactoring Tests
1. Check `git log` for test history
2. Understand business context (see test comments)
3. Run tests before and after changes
4. Update documentation if structure changes

### Deprecated Tests
1. Mark with `it.skip()` or `describe.skip()`
2. Add comment explaining why deprecated
3. Remove after confirming no regressions
4. Update coverage reports

---

## 🎓 Examples

### Adding a New Test Suite

```typescript
// tests/unit/notifications/email.test.ts
import { describe, it, expect } from 'bun:test';
import { createMockEmailClient } from '@/tests/__mocks__';

describe('Email Notifications', () => {
  it('should send welcome email to new users', async () => {
    // Business Impact: User onboarding experience
    const mockClient = createMockEmailClient();
    await mockClient.send({
      to: 'user@example.com',
      subject: 'Welcome to Astra',
    });
    expect(mockClient.send).toHaveBeenCalled();
  });
});
```

### Adding a New Mock

```typescript
// tests/__mocks__/email.mock.ts
import { mock } from 'bun:test';

export function createMockEmailClient() {
  return {
    send: mock(() => Promise.resolve({ messageId: 'msg_123' })),
  };
}

// tests/__mocks__/index.ts
export * from './email.mock';
```

### Adding a New Helper

```typescript
// tests/helpers/email.ts
export async function createTestEmailTemplate() {
  return {
    subject: 'Test Email',
    body: 'Test content',
  };
}

// tests/helpers/index.ts
export * from './email';
```

---

## 🔍 Finding Tests

### By Feature
```bash
# All voice session tests
find tests -path "*voice-session*.test.ts"

# All database tests
find tests -path "*database*.test.ts"
```

### By Type
```bash
# All unit tests
ls tests/unit/**/*.test.ts

# All integration tests
ls tests/integration/**/*.test.ts
```

### By Pattern
```bash
# All tests matching "handshake"
grep -r "describe.*handshake" tests/
```

---

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

---

## 📞 Support and Resources

- **Test Failures**: Check business context in execution logs
- **Configuration Issues**: Review .env.test.example
- **Database Problems**: Verify MongoDB Atlas test cluster
- **Production Deployment**: All tests must pass first
- **Mock Patterns**: See `__mocks__/elevenlabs.mock.ts`
- **Helper Patterns**: See `helpers/mongodb.ts`

---

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

## 📈 Continuous Integration

### Pre-commit Hooks
- **Fast Feedback**: Tests run before commits
- **Quality Gates**: Broken code not committed
- **Developer Experience**: Immediate feedback

### CI/CD Pipeline
- **Comprehensive Testing**: Full test suite run
- **Coverage Reports**: Code quality metrics
- **Security Scanning**: Vulnerability detection

---

## ✅ Business Testing Checklist

Before deploying changes:

- ✅ Happy path test passes (start → connected → stop)
- ✅ Error handling covers all failure modes
- ✅ No regressions (regression tests pass)
- ✅ Business context documented in tests
- ✅ Mock/helper patterns followed
- ✅ Coverage meets targets
- ✅ Cleanup happens properly
- ✅ No flaky tests

**Critical Business Metrics**:
- Session start success rate: >99%
- Session start latency: <2s
- WebSocket disconnect rate: <1%
- Test suite execution time: <2 minutes

**Monitoring Alerts**:
- Test failure rate spike
- Coverage drop below thresholds
- Flaky test detection
- Performance degradation

---

**Remember**: Every test failure represents a potential user experience issue and possible business impact. Prioritize fixes based on business criticality and user impact.

**Last Updated**: 2025-01-16  
**Maintainer**: Engineering Team  
**Version**: 2.0.0