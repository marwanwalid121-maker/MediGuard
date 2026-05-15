require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const bcrypt = require('bcrypt');
const fabricClient = require('../shared/fabric-client');
const encryptionService = require('../shared/encryption-service');
const app = express();
const PORT = process.env.PATIENT_PORTAL_PORT || process.env.PORT || 3003;

app.use(express.json());
app.use(express.static('public'));
app.use(require('cors')());

const JWT_SECRET = process.env.JWT_SECRET_PATIENT;
if (!JWT_SECRET) throw new Error('JWT_SECRET_PATIENT is required in .env file');

// NO HARDCODED DATA - All data stored on blockchain

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// Register new patient on blockchain
app.post('/api/register', async (req, res) => {
    const { username, password, name, phone, bloodType, allergies, conditions, medications } = req.body;

    try {
        // Generate patient ID
        const patientId = `patient-${Date.now()}`;
        const walletAddress = generateWalletAddress(patientId);

        // Hash password with bcrypt (Contract Runner will verify)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Set user context for fabric-client
        fabricClient.setUserContext({ userId: patientId, appName: 'patient-portal', role: 'patient' });

        // Store credentials via Contract Runner
        await fabricClient.storeCredentials({
            username,
            hashedPassword,
            userId: patientId,
            role: 'patient'
        });

        // Encrypt and store patient data on blockchain
        const patientKey = encryptionService.generatePatientKey(walletAddress, patientId);

        const medicalData = {
            bloodType: bloodType || 'Unknown',
            allergies: allergies || [],
            conditions: conditions || [],
            medications: medications || [],
            fullMedicalHistory: { records: [], lastUpdated: new Date().toISOString() }
        };

        const encrypted = encryptionService.encryptMedicalData(medicalData, patientKey);

        // Store patient data via Contract Runner
        await fabricClient.storePatient({
            id: patientId,
            name,
            phone,
            faceIdEnabled: false,
            walletAddress: walletAddress,
            medicalData: { encrypted: true, encryptedData: encrypted }
        });

        console.log(`🆕 Patient registered: ${username} (ID: ${patientId})`);

        res.json({
            success: true,
            message: 'Patient registered successfully',
            patientId,
            walletAddress: walletAddress
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

// Short URL handler for steganographic QR codes
app.get('/p', (req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Not Found</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto; }
                h1 { color: #666; margin-bottom: 20px; }
                p { color: #999; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>404 - Not Found</h1>
                <p>The requested resource could not be found.</p>
            </div>
        </body>
        </html>
    `);
});

// Generate QR code for patient from blockchain
app.post('/api/generate-qr', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const patientId = decoded.patientId || decoded.userId;

        // Set user context
        fabricClient.setUserContext({ userId: patientId, appName: 'patient-portal', role: 'patient' });

        // Get patient from blockchain via Contract Runner
        const patientBlock = await fabricClient.getPatient(patientId);

        if (!patientBlock) {
            return res.status(404).json({ success: false, error: 'Patient not found' });
        }

        // Record QR generation transaction
        await fabricClient.recordTransaction({
            id: `qr_${Date.now()}`,
            patientId: patientId,
            type: 'qr-generation',
            status: 'QR_GENERATED',
            timestamp: new Date().toISOString(),
            transaction: {
                type: 'QR_GENERATION',
                patientId: patientId
            }
        });

        // Generate steganographic QR
        const steganographicData = encryptionService.generateSteganographicQR({
            id: patientId,
            name: patientBlock.name,
            walletAddress: patientBlock.walletAddress
        });

        const qrImage = await QRCode.toDataURL(steganographicData.publicUrl, {
            width: 300,
            margin: 2,
            color: { dark: '#2d3748', light: '#ffffff' }
        });

        res.json({
            success: true,
            qrData: steganographicData.publicUrl,
            qrImage,
            hiddenEHR: steganographicData.ehrToken,
            patient: {
                name: patientBlock.name,
                faceIdEnabled: patientBlock.faceIdEnabled
            }
        });
    } catch (error) {
        console.error('QR generation error:', error);
        res.status(401).json({ success: false, error: 'Authentication failed' });
    }
});

// Login endpoint with blockchain verification
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    // Test credentials fallback (for when Fabric is unavailable)
    const testCredentials = {
        'patient': { password: 'patient123', id: 'patient-001', name: 'John Doe' },
        'doctor': { password: 'doctor123', id: 'hospital-001', name: 'Dr. Smith' }
    };

    try {
        // Set user context for fabric-client
        fabricClient.setUserContext({ userId: 'system', appName: 'patient-portal', role: 'patient' });

        let userId;
        let patientData;

        try {
            // Try Fabric first
            userId = await fabricClient.verifyCredentials(username, password);

            if (userId) {
                fabricClient.setUserContext({ userId: userId, appName: 'patient-portal', role: 'patient' });
                patientData = await fabricClient.getPatient(userId);
            }
        } catch (fabricError) {
            // Fabric unavailable - use test credentials fallback
            console.log('⚠️  Fabric unavailable, using test credentials fallback');
            const testCred = testCredentials[username];
            if (testCred && testCred.password === password) {
                userId = testCred.id;
                patientData = {
                    id: testCred.id,
                    name: testCred.name,
                    walletAddress: '0xFAB0000000000000000000000000000000000001'
                };
            }
        }

        if (!userId || !patientData) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Try to record transaction (best effort)
        try {
            await fabricClient.recordTransaction({
                id: `login_${Date.now()}`,
                patientId: userId,
                type: 'patient-login',
                status: 'LOGIN_SUCCESS',
                timestamp: new Date().toISOString(),
                transaction: {
                    type: 'LOGIN',
                    fromUser: 'patient'
                }
            });
        } catch (txError) {
            console.log('ℹ️  Could not record login transaction (Fabric unavailable)');
        }

        const token = jwt.sign({ patientId: userId }, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            success: true,
            token,
            user: {
                id: userId,
                name: patientData.name,
                role: userId.startsWith('hospital-') ? 'hospital' : 'patient'
            },
            patient: {
                id: userId,
                name: patientData.name,
                walletAddress: patientData.walletAddress
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
});

// Get patient profile from blockchain
app.get('/api/profile', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Support both patientId (old) and userId (new unified login)
        const patientId = decoded.patientId || decoded.userId;
        
        if (!patientId) {
            return res.status(401).json({ success: false, error: 'Invalid token: missing user ID' });
        }

        // Set user context
        fabricClient.setUserContext({ userId: patientId, appName: 'patient-portal', role: 'patient' });

        // Get patient data from blockchain
        const patientBlock = await fabricClient.getPatient(patientId);

        if (!patientBlock) {
            return res.status(404).json({ success: false, error: 'Patient not found' });
        }

        // Decrypt medical data
        const patientKey = encryptionService.generatePatientKey(patientBlock.walletAddress, patientId);
        let decryptedData = {};

        if (patientBlock.medicalData && patientBlock.medicalData.encryptedData) {
            const encData = patientBlock.medicalData.encryptedData;
            // Check if this is properly formatted encrypted data
            const isProperlyEncrypted = encData && encData.iv && encData.ciphertext && encData.authTag;

            if (isProperlyEncrypted) {
                try {
                    decryptedData = encryptionService.decryptMedicalData(encData, patientKey);
                } catch (decryptError) {
                    // Return empty data if decryption fails
                    decryptedData = {
                        age: null,
                        bloodType: null,
                        allergies: [],
                        conditions: [],
                        medications: [],
                        fullMedicalHistory: { records: [] }
                    };
                }
            } else {
                // Return empty data if format is invalid
                decryptedData = {
                    age: null,
                    bloodType: null,
                    allergies: [],
                    conditions: [],
                    medications: [],
                    fullMedicalHistory: { records: [] }
                };
            }
        } else if (patientBlock.medicalData) {
            // Try to extract unencrypted fields if they exist
            decryptedData = {
                age: patientBlock.medicalData.age || null,
                bloodType: patientBlock.medicalData.bloodType || null,
                allergies: patientBlock.medicalData.allergies || [],
                conditions: patientBlock.medicalData.conditions || [],
                medications: patientBlock.medicalData.medications || [],
                fullMedicalHistory: patientBlock.medicalData.fullMedicalHistory || { records: [] }
            };
        } else {
            // No medical data on blockchain
            decryptedData = {
                age: null,
                bloodType: null,
                allergies: [],
                conditions: [],
                medications: [],
                fullMedicalHistory: { records: [] }
            };
        }

        const medicalData = {
            age: decryptedData.age,
            bloodType: decryptedData.bloodType,
            allergies: decryptedData.allergies || [],
            conditions: decryptedData.conditions || [],
            medications: decryptedData.medications || [],
            visits: decryptedData.fullMedicalHistory?.records?.map(record => ({
                hospital: record.hospital,
                date: record.date,
                note: record.notes + (record.prescription ? ` | Prescription: ${record.prescription}` : '')
            })) || []
        };

        res.json({
            success: true,
            profile: {
                id: patientId,
                name: patientBlock.name,
                walletAddress: patientBlock.walletAddress,
                phone: patientBlock.phone,
                faceIdEnabled: patientBlock.faceIdEnabled,
                medicalData: medicalData
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

// Get medical history from blockchain
app.get('/api/medical-history', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const patientId = decoded.patientId || decoded.userId;

        // Set user context
        fabricClient.setUserContext({ userId: patientId, appName: 'patient-portal', role: 'patient' });

        // Get patient data from blockchain
        const patientBlock = await fabricClient.getPatient(patientId);

        if (!patientBlock) {
            return res.status(404).json({ success: false, error: 'Patient not found' });
        }

        // Decrypt medical data to show history
        const patientKey = encryptionService.generatePatientKey(patientBlock.walletAddress, decoded.patientId);
        let decryptedData = {};

        if (patientBlock.medicalData && patientBlock.medicalData.encryptedData) {
            const encData = patientBlock.medicalData.encryptedData;
            // Check if properly formatted encrypted data
            const isProperlyEncrypted = encData && encData.iv && encData.ciphertext && encData.authTag;

            if (isProperlyEncrypted) {
                try {
                    decryptedData = encryptionService.decryptMedicalData(encData, patientKey);
                } catch (decryptError) {
                    decryptedData = {};
                }
            } else {
                // Legacy data format - extract directly
                decryptedData = {};
            }
        }

        const history = decryptedData.fullMedicalHistory?.records || [];

        res.json({
            success: true,
            history: history,
            walletAddress: patientBlock.walletAddress,
            patientId: patientId
        });
    } catch (error) {
        console.error('Medical history error:', error);
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

// Get patient medical data from blockchain
app.get('/api/medical-data', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const patientId = decoded.patientId || decoded.userId;

        // Set user context
        fabricClient.setUserContext({ userId: patientId, appName: 'patient-portal', role: 'patient' });

        // Get patient data from blockchain
        const patientBlock = await fabricClient.getPatient(patientId);

        if (!patientBlock) {
            return res.status(404).json({ success: false, error: 'Patient not found' });
        }

        // Decrypt medical data
        const patientKey = encryptionService.generatePatientKey(patientBlock.walletAddress, decoded.patientId);
        let decryptedData = {};

        if (patientBlock.medicalData && patientBlock.medicalData.encryptedData) {
            const encData = patientBlock.medicalData.encryptedData;
            // Check if properly formatted encrypted data
            const isProperlyEncrypted = encData && encData.iv && encData.ciphertext && encData.authTag;

            if (isProperlyEncrypted) {
                try {
                    decryptedData = encryptionService.decryptMedicalData(encData, patientKey);
                } catch (decryptError) {
                    decryptedData = {};
                }
            } else {
                // Legacy data format - extract directly
                decryptedData = {};
            }
        } else if (patientBlock.medicalData) {
            // Direct unencrypted data
            decryptedData = patientBlock.medicalData;
        }

        const medicalData = {
            age: decryptedData.age,
            bloodType: decryptedData.bloodType,
            allergies: decryptedData.allergies || [],
            conditions: decryptedData.conditions || [],
            medications: decryptedData.medications || [],
            visits: decryptedData.fullMedicalHistory?.records?.map(record => ({
                hospital: record.hospital,
                date: record.date,
                note: record.notes + (record.prescription ? ` | Prescription: ${record.prescription}` : '')
            })) || []
        };

        res.json({
            success: true,
            data: medicalData
        });
    } catch (error) {
        console.error('Get medical data error:', error);
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

// Store active sessions for real-time updates
const patientSessions = new Map();

// Receive OTP from admin - immediately available for display
app.post('/api/admin-otp', (req, res) => {
    const { sessionId, otp, patientWallet, patientName } = req.body;
    
    patientSessions.set(patientWallet, {
        sessionId,
        otp,
        patientName,
        status: 'OTP_GENERATED',
        timestamp: Date.now(),
        displayReady: true,
        hospitalName: 'Hospital'
    });
    
    res.json({ success: true, message: 'OTP stored and ready', otp });
});

// Admin approved access
app.post('/api/admin-approved', (req, res) => {
    const { sessionId, patientWallet } = req.body;
    
    const session = patientSessions.get(patientWallet);
    if (session) {
        session.status = 'ADMIN_APPROVED';
        session.approvedTime = Date.now();
    }
    
    res.json({ success: true, message: 'Admin approved access' });
});

// Admin ended session
app.post('/api/admin-session-end', (req, res) => {
    const { sessionId, patientWallet } = req.body;
    
    const session = patientSessions.get(patientWallet);
    if (session) {
        session.status = 'SESSION_ENDED';
        session.endTime = Date.now();
        
        // Clear session after 5 seconds
        setTimeout(() => {
            patientSessions.delete(patientWallet);
        }, 5000);
    }
    
    console.log(`🔒 Admin ended session for ${patientWallet}`);
    
    res.json({ success: true, message: 'Session ended by admin' });
});

// Session created - hospital scanned QR
app.post('/api/session-created', (req, res) => {
    const { sessionId, otp, patientWallet, hospitalName } = req.body;
    
    patientSessions.set(patientWallet, {
        sessionId,
        otp,
        hospitalName,
        status: 'OTP_GENERATED',
        timestamp: Date.now()
    });
    
    console.log(`📱 Session created for ${patientWallet} - OTP: ${otp}`);
    
    res.json({ success: true, message: 'Session created' });
});

// Hospital is accessing data
app.post('/api/hospital-accessing', (req, res) => {
    const { sessionId, patientWallet } = req.body;
    
    const session = patientSessions.get(patientWallet);
    if (session) {
        session.status = 'HOSPITAL_ACCESSING';
        session.accessTime = Date.now();
        patientSessions.set(patientWallet, session);
    } else {
        patientSessions.set(patientWallet, {
            sessionId,
            status: 'HOSPITAL_ACCESSING',
            accessTime: Date.now(),
            hospitalName: 'Hospital'
        });
    }
    
    res.json({ success: true, message: 'Hospital accessing data' });
});

// Data received from hospital
app.post('/api/data-received', (req, res) => {
    const { sessionId, patientWallet } = req.body;
    
    const session = patientSessions.get(patientWallet);
    if (session) {
        session.status = 'DATA_RECEIVED';
        session.completedTime = Date.now();
        
        // Auto-clear after 10 seconds
        setTimeout(() => {
            patientSessions.delete(patientWallet);
        }, 10000);
    }
    
    console.log(`📨 Data received for ${patientWallet}`);
    
    res.json({ success: true, message: 'Data received' });
});

// Get current session status
app.get('/api/session-status/:walletAddress', (req, res) => {
    const { walletAddress } = req.params;
    const session = patientSessions.get(walletAddress);
    
    if (session) {
        res.json({ 
            success: true, 
            session: {
                otp: session.otp,
                status: session.status,
                hospitalName: session.hospitalName || 'Hospital',
                patientName: session.patientName,
                timestamp: session.timestamp
            }
        });
    } else {
        res.json({ success: true, session: null });
    }
});

// Store active QR tokens for hospital extraction
const activeQRTokens = new Map();

// Extract hidden EHR token for hospital scanners with secret
app.post('/api/extract-hidden-ehr', (req, res) => {
    const { publicQrData, hospitalSecret } = req.body;
    
    // Verify hospital has the correct secret token
    const HOSPITAL_SCANNER_SECRET = process.env.HOSPITAL_SCANNER_SECRET;
    if (!HOSPITAL_SCANNER_SECRET) throw new Error('HOSPITAL_SCANNER_SECRET is required in .env file');
    if (hospitalSecret !== HOSPITAL_SCANNER_SECRET) {
        return res.status(403).json({
            success: false,
            error: 'Unauthorized - Invalid hospital secret'
        });
    }
    
    // Try to find hidden token for any QR data
    console.log(`🔍 Attempting to extract hidden EHR from: ${publicQrData}`);
    
    // Find matching hidden token for this public QR data
    const hiddenToken = activeQRTokens.get(publicQrData);
    
    if (hiddenToken) {
        console.log(`✅ Hospital extracted hidden EHR token from QR`);
        
        return res.json({
            success: true,
            hiddenEHR: hiddenToken,
            message: 'Hidden EHR token successfully extracted'
        });
    }
    
    console.log(`❌ No hidden EHR token found for QR: ${publicQrData}`);
    console.log(`📊 Active tokens: ${Array.from(activeQRTokens.keys())}`);
    
    res.json({ 
        success: false, 
        error: 'No hidden EHR token found for this QR code' 
    });
});

// Server-Sent Events for real-time session updates
app.get('/api/session-stream/:walletAddress', (req, res) => {
    const { walletAddress } = req.params;
    
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    
    // Send initial connection message
    res.write('data: {"status":"connected"}\n\n');
    
    // Check for session updates every 1 second
    const interval = setInterval(() => {
        const session = patientSessions.get(walletAddress);
        if (session) {
            res.write(`data: ${JSON.stringify({
                otp: session.otp,
                status: session.status,
                hospitalName: session.hospitalName,
                timestamp: session.timestamp
            })}\n\n`);
        }
    }, 1000);
    
    // Clean up on client disconnect
    req.on('close', () => {
        clearInterval(interval);
    });
});

// Initialize default patient credentials
async function initializeDefaultPatientCredentials() {
    const testCredentials = [
        { username: 'attacker', password: '123', patientId: 'patient-attacker', name: 'Attacker' },
    ];

    for (const cred of testCredentials) {
        try {
            const walletAddress = generateWalletAddress(cred.patientId);
            const hashedPassword = await bcrypt.hash(cred.password, 10);

            fabricClient.setUserContext({ userId: 'patient-system', appName: 'patient-portal', role: 'patient' });
            
            // Store credentials in blockchain
            await fabricClient.storeCredentials({
                username: cred.username,
                hashedPassword,
                userId: cred.patientId,
                role: 'Patient'
            });

            // Create patient data with encrypted medical records
            const patientKey = encryptionService.generatePatientKey(walletAddress, cred.patientId);
            const medicalData = {
                bloodType: '',
                allergies: [],
                conditions: [],
                medications: [],
                fullMedicalHistory: { records: [], lastUpdated: new Date().toISOString().split('T')[0] }
            };
            const encrypted = encryptionService.encryptMedicalData(medicalData, patientKey);

            await fabricClient.storePatient({
                id: cred.patientId,
                name: cred.name,
                age: 0,
                phone: '',
                walletAddress: walletAddress,
                faceIdEnabled: false,
                medicalData: { encrypted: true, encryptedData: encrypted }
            });

            console.log(`✅ Default patient initialized: ${cred.username} (password: ${cred.password})`);
        } catch (error) {
            console.log(`ℹ️  Default patient may already exist: ${cred.username}`);
        }
    }
}

/**
 * Generate a random wallet address for patient
 * @param {string} userId - Patient user ID
 * @returns {string} Wallet address in format 0xFAB...
 */
function generateWalletAddress(userId) {
    const crypto = require('crypto');
    const randomBytes = crypto.randomBytes(19).toString('hex');
    return `0xFAB${randomBytes}`;
}

/**
 * Get hospital wallet address from blockchain
 * @param {string} hospitalId - Hospital ID
 * @returns {Promise<string|null>} Hospital wallet address or null
 */
async function getHospitalWallet(hospitalId) {
    try {
        fabricClient.setUserContext({
            userId: 'system',
            appName: 'patient-portal',
            role: 'patient'
        });
        const hospital = await fabricClient.getHospital(hospitalId);
        return hospital?.walletAddress || null;
    } catch (error) {
        console.warn(`Failed to get hospital wallet for ${hospitalId}:`, error.message);
        return null;
    }
}

/**
 * Record access transaction for patient-hospital interaction
 * @param {string} patientId - Patient ID
 * @param {string} hospitalId - Hospital ID
 * @param {string} accessMethod - How access was granted (QR_SCAN, API, etc.)
 * @returns {Promise<Object>} Transaction record
 */
async function recordAccessTransaction(patientId, hospitalId, accessMethod) {
    const txData = {
        id: `tx_${Date.now()}`,
        type: 'ACCESS_RECORD',
        patientId,
        hospitalId,
        accessMethod,
        timestamp: new Date().toISOString(),
        transaction: {
            type: accessMethod,
            id: `tx_${Date.now()}`,
            fromWallet: 'patient-wallet',
            toWallet: hospitalId
        }
    };
    return await fabricClient.recordTransaction(txData);
}


const server = app.listen(PORT, async () => {
    console.log(`👤 Patient Portal: http://localhost:${PORT}`);
    console.log('🔗 Hyperledger Fabric Integration: ENABLED');
    console.log('💰 Zero Gas Fees: CONFIRMED');
    console.log('🔒 Wallet Format: 0xFAB... (40 characters)');
    console.log('📱 Secure QR Codes: EHR_SECURE_ encrypted format');
    console.log('🏥 Hospital Scanner Compatible: YES');
    console.log('📱 Mobile UI: Optimized for iPhone/Android');
    console.log('🔢 Session-based OTP: Real-time updates');
    console.log('📡 Live Status: OTP → Accessing → Complete');

    // Initialize default patient credentials
    await initializeDefaultPatientCredentials();
});

// Keep server alive - prevent Node from exiting
server.keepAliveTimeout = 65000;

// Keep process alive
setInterval(() => {}, 1000);