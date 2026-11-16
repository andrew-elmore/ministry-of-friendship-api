# Ministry of Friendship API - Test Suite

## Directory Structure

```
tests/
├── unit/              Unit tests for cloud functions
├── integration/       Integration tests for API endpoints
├── e2e/              End-to-end workflow tests
├── helpers/          Test utilities
└── fixtures/         Test data
```

## Test File Naming

Files are named by the MODULE being tested:

- Unit: `<module>.unit.test.js`
- Integration: `<module>.integration.test.js`
- E2E: `<workflow>.e2e.test.js`

Examples:
- `squad-functions.unit.test.js` - Tests for squad cloud functions
- `auth-api.integration.test.js` - Tests for authentication endpoints
- `squad-workflow.e2e.test.js` - E2E test for squad creation flow

Card numbers go in file comments, NOT in filenames.

## Running Tests

```bash
npm test                  Run all tests
npm run test:unit         Run unit tests only
npm run test:integration  Run integration tests only
npm run test:e2e         Run e2e tests
npm run test:coverage    Generate coverage report
npm run test:watch       Watch mode for development
```

## Writing Tests

### Unit Tests
Test individual cloud functions in isolation.

```javascript
const { myCloudFunction } = require('../../cloud/main');

describe('myCloudFunction', () => {
  it('should process data correctly', () => {
    const result = myCloudFunction(input);
    expect(result).toBe(expectedOutput);
  });
});
```

### Integration Tests
Test API endpoints with database.

```javascript
const request = require('supertest');
const app = require('../../index');

describe('POST /api/squads', () => {
  it('should create a new squad', async () => {
    const response = await request(app)
      .post('/api/squads')
      .send({ name: 'Test Squad' })
      .expect(201);

    expect(response.body.name).toBe('Test Squad');
  });
});
```

### E2E Tests
Test complete workflows from start to finish.

```javascript
describe('Squad Management Workflow', () => {
  it('should create, update, and delete squad', async () => {
  });
});
```

## Coverage Requirements

Minimum 80% coverage for:
- Branches
- Functions
- Lines
- Statements
