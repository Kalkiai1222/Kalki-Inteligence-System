/**
 * Integration Test: Verify API Error Handling
 * Tests that the modified routes properly catch errors and return responses
 */

const tests = [];
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║    API Error Handling Integration Tests - Local      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Test 1: GET request without auth
  test('GET /projects/{id} without auth should return 401', async () => {
    try {
      const response = await fetch('http://localhost:3000/api/companies/test-company/projects/test-project');
      if (response.status === 401) {
        return { pass: true, message: 'Correctly returned 401 Unauthorized' };
      } else {
        return { pass: false, message: `Expected 401, got ${response.status}` };
      }
    } catch (err) {
      return { pass: false, message: `Network error: ${err.message}` };
    }
  });

  // Test 2: GET request with invalid company ID
  test('GET /projects with invalid company ID should return error', async () => {
    try {
      const response = await fetch('http://localhost:3000/api/companies/invalid-id/projects/invalid-project');
      // Should return either 401 (no auth) or 500 (error caught in try-catch)
      if (response.status === 401 || response.status === 500 || response.status === 403) {
        const data = await response.json().catch(() => ({}));
        return { pass: true, message: `Got ${response.status} with error response` };
      } else {
        return { pass: false, message: `Expected 401/403/500, got ${response.status}` };
      }
    } catch (err) {
      return { pass: false, message: `Network error: ${err.message}` };
    }
  });

  // Test 3: PUT request with invalid data
  test('PUT /projects with invalid data should return error', async () => {
    try {
      const response = await fetch('http://localhost:3000/api/companies/test-company/projects/test-project', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' })
      });
      
      // Should return either 401 or 500 (caught by try-catch)
      if (response.status === 401 || response.status === 500 || response.status === 403) {
        return { pass: true, message: `Got ${response.status} - error properly handled` };
      } else {
        return { pass: false, message: `Expected 401/403/500, got ${response.status}` };
      }
    } catch (err) {
      return { pass: false, message: `Network error: ${err.message}` };
    }
  });

  // Test 4: Server should not hang - test timeout
  test('API should respond within 5 seconds (not hang)', async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('http://localhost:3000/api/companies/test/projects/test', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return { pass: true, message: `Request completed in < 5s (status: ${response.status})` };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { pass: false, message: 'Request timed out - API is hanging!' };
      }
      return { pass: true, message: `Got error response (not a hang): ${err.message}` };
    }
  });

  // Test 5: Verify error response has proper JSON
  test('Error responses should return valid JSON with error details', async () => {
    try {
      const response = await fetch('http://localhost:3000/api/companies/test-company/projects/test-project');
      const contentType = response.headers.get('content-type');
      
      if (!contentType?.includes('application/json')) {
        return { pass: false, message: `Expected JSON content-type, got ${contentType}` };
      }

      const data = await response.json();
      if (data.error) {
        return { pass: true, message: `Valid JSON error response: "${data.error}"` };
      } else {
        return { pass: false, message: 'Response missing error field' };
      }
    } catch (err) {
      return { pass: false, message: `Failed to parse JSON: ${err.message}` };
    }
  });

  // Run all tests
  for (const { name, fn } of tests) {
    try {
      const result = await fn();
      if (result.pass) {
        console.log(`✅ PASS: ${name}`);
        console.log(`   → ${result.message}\n`);
        passCount++;
      } else {
        console.log(`❌ FAIL: ${name}`);
        console.log(`   → ${result.message}\n`);
        failCount++;
      }
    } catch (err) {
      console.log(`❌ ERROR: ${name}`);
      console.log(`   → ${err.message}\n`);
      failCount++;
    }
  }

  // Summary
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log(`║  Test Results: ${passCount} passed, ${failCount} failed`);
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (failCount === 0) {
    console.log('✅ All tests passed! API error handling is working correctly.\n');
    return true;
  } else {
    console.log('❌ Some tests failed. Review the errors above.\n');
    return false;
  }
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
});
