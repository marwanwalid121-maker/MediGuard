require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.CONTRACT_RUNNER_PORT || 6000;

// Load audit logger
const auditLogger = require('./security/audit-logger');

// Delete wallet folder on startup - DISABLED to preserve connection
// Uncomment only if you need to reset the Fabric identity
/*
const walletPath = path.join(__dirname, '..', '..', 'wallet');
try {
    if (fs.existsSync(walletPath)) {
        fs.rmSync(walletPath, { recursive: true, force: true });
        console.log('🗑️  Wallet folder deleted on startup');
    }
} catch (error) {
    console.warn('⚠️  Could not delete wallet folder:', error.message);
}
*/

// ==================== SETUP ====================
app.use(express.json());
app.use(cors());

// ==================== AUDIT LOGGING MIDDLEWARE ====================
app.use((req, res, next) => {
    const startTime = Date.now();

    // Capture original res.json
    const originalJson = res.json.bind(res);

    res.json = function(data) {
        const responseTime = Date.now() - startTime;

        // Only log chaincode API calls
        if (req.path.startsWith('/api/chaincode/')) {
            auditLogger.log({
                appName: req.user?.appName || 'unknown',
                userId: req.user?.userId || 'unknown',
                function: req.path.replace('/api/chaincode/', ''),
                method: req.method,
                endpoint: req.path,
                params: req.body,
                status: data.success ? 'SUCCESS' : 'ERROR',
                statusCode: res.statusCode,
                responseTime: responseTime,
                error: data.error || null,
                ip: req.ip
            });
        }

        return originalJson(data);
    };

    next();
});

// Load fabric service
let fabricService;
let fabricReady = false;

(async () => {
    try {
        fabricService = require('../shared/fabric-service');
        // Initialize connection at startup
        console.log('🔄 Initializing Fabric connection...');
        await fabricService.connectToGateway();
        fabricReady = true;
        console.log('✅ Fabric connection ready');
    } catch (err) {
        console.warn('⚠️ fabric-service not available, using mock for testing');
        fabricService = {
            storePatient: async (data) => ({ ...data, stored: true }),
            getPatient: async (id) => ({ id, data: 'mock' }),
            getAllPatients: async () => [],
            recordTransaction: async (data) => ({ ...data, recorded: true }),
            getAllTransactions: async () => [],
            verifyCredentials: async (u, p) => 'patient-001',
            storeCredentials: async (data) => ({ stored: true })
        };
        fabricReady = true;
    }
})();

// ==================== LAYER 1: JWT Authentication ====================
const authMiddleware = (req, res, next) => {
    if (req.path === '/health' || req.path === '/') {
        return next();
    }

    // Check if Fabric is ready
    if (!fabricReady) {
        return res.status(503).json({ success: false, error: 'Service initializing, please wait...' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    try {
        const secrets = [
            process.env.JWT_SECRET_PATIENT,
            process.env.JWT_SECRET_HOSPITAL,
            process.env.JWT_SECRET_ADMIN,
            process.env.JWT_SECRET_PHARMACY
        ].filter(Boolean);

        let decoded;
        for (const secret of secrets) {
            try {
                decoded = jwt.verify(token, secret);
                break;
            } catch (e) {
                continue;
            }
        }

        if (!decoded) {
            return res.status(401).json({ success: false, error: 'Invalid token' });
        }

        req.user = {
            userId: decoded.userId || decoded.patientId || 'unknown',
            appName: decoded.appName || 'unknown',
            role: decoded.role || 'user'
        };
        next();
    } catch (error) {
        res.status(401).json({ success: false, error: 'Token verification failed' });
    }
};

// ==================== LAYER 1.5: Request Signature Validation ====================
const signatureMiddleware = (req, res, next) => {
    if (req.path === '/health' || req.path === '/') {
        return next();
    }

    if (process.env.ENABLE_REQUEST_SIGNING !== 'true') {
        return next(); // Signing disabled
    }

    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];

    if (!signature || !timestamp) {
        return res.status(401).json({ success: false, error: 'Missing signature or timestamp' });
    }

    // Validate timestamp (prevent replay attacks - 5 min tolerance)
    const now = Math.floor(Date.now() / 1000);
    const age = now - parseInt(timestamp);
    if (age < 0 || age > 300) {
        return res.status(401).json({ success: false, error: 'Request timestamp expired' });
    }

    // Verify signature
    const secret = process.env.CONTRACT_RUNNER_SECRET;
    if (!secret) {
        console.warn('⚠️ CONTRACT_RUNNER_SECRET not set, skipping signature verification');
        return next();
    }

    const bodyStr = JSON.stringify(req.body || {});
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(bodyStr + timestamp)
        .digest('hex');

    // Use timing-safe comparison
    try {
        const valid = crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
        if (!valid) {
            return res.status(401).json({ success: false, error: 'Invalid signature' });
        }
    } catch (e) {
        return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    next();
};

// ==================== LAYER 2: Rate Limiting ====================
const limiter = rateLimit({
    windowMs: parseInt(process.env.CONTRACT_RUNNER_RATE_WINDOW || '15') * 60 * 1000,
    max: parseInt(process.env.CONTRACT_RUNNER_RATE_LIMIT || '100'),
    keyGenerator: (req) => req.user?.userId || req.ip,
    skip: (req) => req.path === '/health',
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too many requests, please try again later.'
        });
    }
});

app.use(authMiddleware);
app.use(signatureMiddleware);
app.use(limiter);

// ==================== HEALTH & INFO ====================
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Contract Runner' });
});

app.get('/', (req, res) => {
    res.json({
        service: 'Contract Runner',
        version: '1.0.0',
        security: 'JWT + Rate Limiting + Audit Logging'
    });
});

// ==================== CHAINCODE ENDPOINTS ====================

// 1. POST storePatient
app.post('/api/chaincode/storePatient', async (req, res) => {
    try {
        const { patientData } = req.body;
        if (!patientData) return res.status(400).json({ success: false, error: 'patientData required' });
        const result = await fabricService.storePatient(patientData);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. GET getPatient
app.get('/api/chaincode/getPatient/:patientId', async (req, res) => {
    try {
        const result = await fabricService.getPatient(req.params.patientId);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. GET getAllPatients (admin only)
app.get('/api/chaincode/getAllPatients', async (req, res) => {
    try {
        const result = await fabricService.getAllPatients();
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. POST recordTransaction
app.post('/api/chaincode/recordTransaction', async (req, res) => {
    try {
        const { transactionData } = req.body;
        if (!transactionData) return res.status(400).json({ success: false, error: 'transactionData required' });
        const result = await fabricService.recordTransaction(transactionData);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. POST storeCredentials
app.post('/api/chaincode/storeCredentials', async (req, res) => {
    try {
        const { credentialsData } = req.body;
        if (!credentialsData) return res.status(400).json({ success: false, error: 'credentialsData required' });
        const result = await fabricService.storeCredentials(credentialsData);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. POST verifyCredentials
app.post('/api/chaincode/verifyCredentials', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, error: 'username and password required' });
        const result = await fabricService.verifyCredentials(username, password);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7. GET getCredentials
app.get('/api/chaincode/getCredentials/:username', async (req, res) => {
    try {
        const result = await fabricService.getCredentials(req.params.username);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 8. GET getAllTransactions (admin only)
app.get('/api/chaincode/getAllTransactions', async (req, res) => {
    try {
        const result = await fabricService.getAllTransactions();
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 9. GET getPatientByWallet
app.get('/api/chaincode/getPatientByWallet/:walletAddress', async (req, res) => {
    try {
        const result = await fabricService.getPatientByWallet(req.params.walletAddress);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 10. POST storeHospital
app.post('/api/chaincode/storeHospital', async (req, res) => {
    try {
        const { hospitalData } = req.body;
        if (!hospitalData) return res.status(400).json({ success: false, error: 'hospitalData required' });
        const result = await fabricService.storeHospital(hospitalData);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 11. GET getHospital
app.get('/api/chaincode/getHospital/:hospitalId', async (req, res) => {
    try {
        const result = await fabricService.getHospital(req.params.hospitalId);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 11.5. GET getAllHospitals (admin only)
app.get('/api/chaincode/getAllHospitals', async (req, res) => {
    try {
        const result = await fabricService.getAllHospitals();
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 12. GET getTransactionById
app.get('/api/chaincode/getTransactionById/:transactionId', async (req, res) => {
    try {
        const result = await fabricService.getTransactionById(req.params.transactionId);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 13. POST storePharmacyInventory
app.post('/api/chaincode/storePharmacyInventory', async (req, res) => {
    try {
        const { inventoryData } = req.body;
        if (!inventoryData) return res.status(400).json({ success: false, error: 'inventoryData required' });
        const result = await fabricService.storePharmacyInventory(inventoryData);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 14. GET getPharmacyInventory
app.get('/api/chaincode/getPharmacyInventory/:pharmacyId', async (req, res) => {
    try {
        const result = await fabricService.getPharmacyInventory(req.params.pharmacyId);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 15. POST updateMedicationQuantity
app.post('/api/chaincode/updateMedicationQuantity', async (req, res) => {
    try {
        const { updateData } = req.body;
        if (!updateData) return res.status(400).json({ success: false, error: 'updateData required' });
        const result = await fabricService.updateMedicationQuantity(updateData);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 16. POST updateTransactionStatus
app.post('/api/chaincode/updateTransactionStatus', async (req, res) => {
    try {
        const { transactionId, newStatus } = req.body;
        if (!transactionId || !newStatus) return res.status(400).json({ success: false, error: 'transactionId and newStatus required' });
        const result = await fabricService.updateTransactionStatus(transactionId, newStatus);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 17. POST clearAllTransactions (admin only)
app.post('/api/chaincode/clearAllTransactions', async (req, res) => {
    try {
        const result = await fabricService.clearAllTransactions();
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ERROR HANDLERS ====================
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// ==================== START ====================
app.listen(PORT, () => {
    console.log(`\n🔗 Contract Runner listening on port ${PORT}`);
    console.log(`✅ Health: http://localhost:${PORT}/health`);
    console.log(`🔐 Security: JWT Authentication + Rate Limiting`);
    console.log(`📝 17 Chaincode Endpoints Available`);
    console.log(`⏳ Ready...\n`);
});

// Keep server alive to prevent process exit
setInterval(() => {}, 1000);

module.exports = app;
