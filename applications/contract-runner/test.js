/**
 * Contract Runner Comprehensive Test Suite
 * Tests all 5 security layers + 17 endpoints
 */

const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const BASE_URL = process.env.CONTRACT_RUNNER_URL || 'http://localhost:6000';
let testsPassed = 0;
let testsFailed = 0;

// Test configuration
const config = {
    jwtSecrets: {
        patient: process.env.JWT_SECRET_PATIENT || 'test-patient-secret',
        hospital: process.env.JWT_SECRET_HOSPITAL || 'test-hospital-secret',
        admin: process.env.JWT_SECRET_ADMIN || 'test-admin-secret',
        pharmacy: process.env.JWT_SECRET_PHARMACY || 'test-pharmacy-secret'
    },
    contractRunnerSecret: process.env.CONTRACT_RUNNER_SECRET || 'test-contract-runner-secret',
    port: parseInt(process.env.CONTRACT_RUNNER_PORT || '6000')
};

/**
 * Make HTTP request
 */
function makeRequest(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: parsed
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

/**
 * Generate JWT token
 */
function generateToken(secret, userId = 'test-user', appName = 'test-app', role = 'user') {
    return jwt.sign({ userId, appName, role }, secret, { expiresIn: '1h' });
}

/**
 * Sign request (HMAC-SHA256)
 */
function signRequest(body, secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify(body) + timestamp;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    return { signature, timestamp };
}

/**
 * Test helper
 */
async function test(name, fn) {
    try {
        await fn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (err) {
        console.log(`❌ ${name}: ${err.message}`);
        testsFailed++;
    }
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('\n================== CONTRACT RUNNER TEST SUITE ==================\n');

    // Test 1: Health endpoint (no auth required)
    await test('TEST 1: Health endpoint', async () => {
        const res = await makeRequest('GET', '/health');
        if (res.status !== 200 || !res.body.status) throw new Error(`Expected 200, got ${res.status}`);
    });

    // Test 2: JWT required (should fail without token)
    await test('TEST 2: Missing JWT token returns 401', async () => {
        const res = await makeRequest('GET', '/api/chaincode/getAllPatients');
        if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // Test 3: JWT validation (valid token should pass)
    await test('TEST 3: Valid JWT token accepted', async () => {
        const token = generateToken(config.jwtSecrets.admin, 'admin-001', 'admin-dashboard', 'admin');
        const res = await makeRequest('GET', '/api/chaincode/getAllPatients', null, {
            'Authorization': `Bearer ${token}`
        });
        // Should either succeed or fail on signature/input validation, not auth
        if (res.status === 401 && res.body.error?.includes('No token')) throw new Error('JWT should have been valid');
    });

    // Test 4: Invalid JWT token (should fail)
    await test('TEST 4: Invalid JWT token returns 401', async () => {
        const res = await makeRequest('GET', '/api/chaincode/getAllPatients', null, {
            'Authorization': 'Bearer invalid.jwt.token'
        });
        if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // Test 5: Request signature validation (if enabled)
    if (process.env.ENABLE_REQUEST_SIGNING === 'true') {
        await test('TEST 5: Invalid signature returns 401', async () => {
            const token = generateToken(config.jwtSecrets.pharmacy, 'pharmacy-001', 'pharmacy-portal', 'pharmacy');
            const body = { inventoryData: { pharmacyId: 'pharmacy-001', inventory: [] } };
            const res = await makeRequest('POST', '/api/chaincode/storePharmacyInventory', body, {
                'Authorization': `Bearer ${token}`,
                'X-Signature': 'invalid-signature-here',
                'X-Timestamp': Math.floor(Date.now() / 1000).toString()
            });
            if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
        });

        await test('TEST 6: Valid signature accepted', async () => {
            const token = generateToken(config.jwtSecrets.pharmacy, 'pharmacy-001', 'pharmacy-portal', 'pharmacy');
            const body = { inventoryData: { pharmacyId: 'pharmacy-001', inventory: [] } };
            const { signature, timestamp } = signRequest(body, config.contractRunnerSecret);
            const res = await makeRequest('POST', '/api/chaincode/storePharmacyInventory', body, {
                'Authorization': `Bearer ${token}`,
                'X-Signature': signature,
                'X-Timestamp': timestamp
            });
            // Success or fail on input validation, not signature
            if (res.status === 401 && res.body.error?.includes('signature')) throw new Error('Valid signature rejected');
        });
    }

    // Test 7: Input validation
    await test('TEST 7: Missing required field returns 400', async () => {
        const token = generateToken(config.jwtSecrets.patient, 'patient-001', 'patient-portal', 'patient');
        const body = {}; // Missing required patientData
        const res = await makeRequest('POST', '/api/chaincode/storePatient', body, {
            'Authorization': `Bearer ${token}`
        });
        if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    // Test 8: GET endpoint works
    await test('TEST 8: GET endpoint accessible', async () => {
        const token = generateToken(config.jwtSecrets.patient, 'patient-001', 'patient-portal', 'patient');
        const res = await makeRequest('GET', '/api/chaincode/getPatient/patient-001', null, {
            'Authorization': `Bearer ${token}`
        });
        // May fail due to data not existing, but should pass auth
        if (res.status === 401 && res.body.error?.includes('token')) throw new Error('Auth layer failed');
    });

    // Test 9: POST endpoint works
    await test('TEST 9: POST endpoint accessible', async () => {
        const token = generateToken(config.jwtSecrets.patient, 'patient-001', 'patient-portal', 'patient');
        const body = { patientData: { id: 'test-patient' } };
        const res = await makeRequest('POST', '/api/chaincode/storePatient', body, {
            'Authorization': `Bearer ${token}`
        });
        // May fail on blockchain, but should pass auth
        if (res.status === 401 && res.body.error?.includes('token')) throw new Error('Auth layer failed');
    });

    // Test 10: 404 for unknown endpoint
    await test('TEST 10: Unknown endpoint returns 404', async () => {
        const token = generateToken(config.jwtSecrets.admin, 'admin-001', 'admin-dashboard', 'admin');
        const res = await makeRequest('GET', '/api/unknown-endpoint', null, {
            'Authorization': `Bearer ${token}`
        });
        if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    });

    // Test 11: All 17 endpoints exist
    const endpoints = [
        { method: 'POST', path: '/api/chaincode/storePatient' },
        { method: 'POST', path: '/api/chaincode/storeHospital' },
        { method: 'POST', path: '/api/chaincode/recordTransaction' },
        { method: 'POST', path: '/api/chaincode/storeCredentials' },
        { method: 'POST', path: '/api/chaincode/storePharmacyInventory' },
        { method: 'POST', path: '/api/chaincode/updateMedicationQuantity' },
        { method: 'POST', path: '/api/chaincode/updateTransactionStatus' },
        { method: 'POST', path: '/api/chaincode/clearAllTransactions' },
        { method: 'POST', path: '/api/chaincode/verifyCredentials' },
        { method: 'GET', path: '/api/chaincode/getPatient/test' },
        { method: 'GET', path: '/api/chaincode/getAllPatients' },
        { method: 'GET', path: '/api/chaincode/getPatientByWallet/0xtest' },
        { method: 'GET', path: '/api/chaincode/getHospital/hospital-001' },
        { method: 'GET', path: '/api/chaincode/getTransactionById/tx-001' },
        { method: 'GET', path: '/api/chaincode/getCredentials/testuser' },
        { method: 'GET', path: '/api/chaincode/getAllTransactions' },
        { method: 'GET', path: '/api/chaincode/getPharmacyInventory/pharmacy-001' }
    ];

    for (const endpoint of endpoints) {
        await test(`TEST: ${endpoint.method} ${endpoint.path} exists`, async () => {
            const token = generateToken(config.jwtSecrets.admin, 'admin-001', 'admin-dashboard', 'admin');
            let body = null;
            if (endpoint.method === 'POST') {
                body = { testData: 'test' };
            }
            const res = await makeRequest(endpoint.method, endpoint.path, body, {
                'Authorization': `Bearer ${token}`
            });
            // Should NOT be 404 - either succeed or fail on validation/backend
            if (res.status === 404) throw new Error(`Endpoint not found (404)`);
        });
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log(`TESTS PASSED: ${testsPassed}`);
    console.log(`TESTS FAILED: ${testsFailed}`);
    console.log('='.repeat(60) + '\n');

    process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
});
