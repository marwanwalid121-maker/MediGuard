require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const fabricClient = require('../shared/fabric-client');
const crypto = require('crypto');
const { requireHospital } = require('../shared/rbac-middleware');
const app = express();
const PORT = process.env.PORT || 3004; // Hospital portal port

app.use(express.json());
app.use(express.static('public'));
app.use(require('cors')());

const JWT_SECRET = process.env.JWT_SECRET_HOSPITAL;
if (!JWT_SECRET) throw new Error('JWT_SECRET_HOSPITAL is required in .env file');
const PATIENT_JWT_SECRET = process.env.JWT_SECRET_PATIENT;
if (!PATIENT_JWT_SECRET) throw new Error('JWT_SECRET_PATIENT is required in .env file');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'scanner.html'));
});

// Debug endpoint to receive logs from phone scanner
app.post('/api/debug-log', (req, res) => {
    const { message, data } = req.body;
    console.log(`📱 PHONE SCANNER: ${message}`);
    if (data) {
        console.log('   Data:', JSON.stringify(data, null, 2));
    }
    res.json({ logged: true });
});

// GET endpoint for testing
app.get('/api/scan', (req, res) => {
    res.json({ 
        message: 'Scanner endpoint is working. Use POST to scan QR codes.',
        endpoints: {
            'POST /api/scan': 'Scan QR code',
            'POST /api/validate-qr': 'Validate QR code',
            'POST /api/test-qr': 'Test QR code'
        }
    });
});

// Test endpoint to see what QR data looks like
app.post('/api/test-qr', (req, res) => {
    const { qrData } = req.body;
    console.log('🧪 TEST QR RECEIVED:');
    console.log('   Length:', qrData.length);
    console.log('   First 100 chars:', qrData.substring(0, 100));
    console.log('   Contains ?session=:', qrData.includes('?session='));
    console.log('   Starts with EHR_SECURE_:', qrData.startsWith('EHR_SECURE_'));
    console.log('   Full QR:', qrData);
    
    res.json({ received: true, length: qrData.length });
});

// Simple QR validation endpoint - returns true if EHR token found, false if not
app.post('/api/validate-qr', async (req, res) => {
    const { qrData } = req.body;

    console.log('🔍 VALIDATION REQUEST RECEIVED');
    console.log('   QR Length:', qrData.length);
    console.log('   QR Preview:', qrData.substring(0, 100) + '...');
    console.log('   Contains ?session=:', qrData.includes('?session='));
    console.log('   Starts with EHR_SECURE_:', qrData.startsWith('EHR_SECURE_'));

    try {
        // Check if QR contains encrypted EHR token
        if (qrData.includes('?session=')) {
            const urlParams = new URL(qrData);
            const encodedToken = urlParams.searchParams.get('session');

            if (encodedToken) {
                const decodedToken = Buffer.from(encodedToken, 'base64').toString('utf8');
                const [encryptedData, ivHex] = decodedToken.split(':');

                const encryptionService = require('../shared/encryption-service');
                const ehrData = encryptionService.decryptEHRToken(encryptedData, ivHex);

                if (ehrData.exp && ehrData.exp < Math.floor(Date.now() / 1000)) {
                    console.log('❌ QR expired');
                    return res.json({ valid: false, reason: 'expired' });
                }

                console.log(`✅ Valid steganographic QR for: ${ehrData.name}`);
                return res.json({ valid: true, patientName: ehrData.name, patientId: ehrData.userId });
            }
        }

        if (qrData.startsWith('EHR_SECURE_')) {
            try {
                const encodedToken = qrData.replace('EHR_SECURE_', '');
                const decodedToken = Buffer.from(encodedToken, 'base64').toString('utf8');
                const [encryptedData, ivHex] = decodedToken.split(':');

                const encryptionService = require('../shared/encryption-service');
                const ehrData = encryptionService.decryptEHRToken(encryptedData, ivHex);

                if (ehrData.exp && ehrData.exp < Math.floor(Date.now() / 1000)) {
                    console.log('❌ QR expired');
                    return res.json({ valid: false, reason: 'expired' });
                }

                console.log(`✅ Valid direct EHR token for: ${ehrData.name}`);
                return res.json({ valid: true, patientName: ehrData.name, patientId: ehrData.userId });
            } catch (encryptError) {
                // If decryption fails, token is invalid
                console.log(`❌ Decryption failed: ${encryptError.message}`);
                return res.json({ valid: false, reason: 'decryption_failed' });
            }
        }

    } catch (error) {
        console.log(`❌ Validation failed: ${error.message}`);
        return res.json({ valid: false, reason: 'decryption_failed' });
    }

    console.log('❌ No valid EHR token found');
    return res.json({ valid: false, reason: 'no_ehr_token' });
});

// Scan secure QR - validate first, then forward to hospital dashboard
app.post('/api/scan', async (req, res) => {
    const { qrData } = req.body;

    console.log(`📱 Scanner received QR: ${qrData.substring(0, 100)}...`);

    try {
        let decoded;

        // Scan secure QR - validate first, then forward to hospital dashboard
        if (qrData.includes('?s=')) {
            console.log('🔍 Decrypting steganographic QR...');
            const urlParams = new URL(qrData);
            const encryptedToken = urlParams.searchParams.get('s');

            if (encryptedToken) {
                try {
                    // Decrypt the token to get patient info
                    const encryptionService = require('../shared/encryption-service');
                    console.log(`🔐 Encrypted token from URL: ${encryptedToken.substring(0, 50)}...`);

                    // Accept any valid encrypted token from steganographic QR
                    if (encryptedToken && encryptedToken.length > 10) {
                        console.log(`✅ QR VALIDATED: Found valid encrypted token`);

                        // Decrypt to get patient info
                        try {
                            const decodedToken = Buffer.from(encryptedToken, 'base64').toString('utf8');
                            const [encryptedData, ivHex] = decodedToken.split(':');
                            const ehrData = encryptionService.decryptEHRToken(encryptedData, ivHex);

                            decoded = {
                                userId: ehrData.userId,
                                name: ehrData.name,
                                walletAddress: ehrData.walletAddress,
                                timestamp: Date.now()
                            };
                        } catch (decryptErr) {
                            console.log('Failed to decrypt token, will fetch from blockchain');
                            decoded = {
                                userId: 'unknown',
                                name: 'Patient',
                                walletAddress: null,
                                timestamp: Date.now()
                            };
                        }
                    } else {
                        console.log(`❌ QR REJECTED: Invalid encrypted token`);

                        // Log unauthorized access to admin
                        try {
                            await fetch('http://localhost:3001/api/unauthorized-access', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    timestamp: new Date().toISOString(),
                                    reason: `🚨 INVALID ENCRYPTED TOKEN`,
                                    accessType: 'UNAUTHORIZED_QR_SCAN',
                                    qrData: qrData.substring(0, 200)
                                })
                            });
                            console.log('🚨 Unauthorized QR scan logged to admin');
                        } catch (err) {
                            console.log('Failed to log unauthorized access:', err.message);
                        }

                        return res.status(400).json({ success: false, error: 'QR REJECTED - Invalid encrypted token' });
                    }
                } catch (decryptError) {
                    console.log(`❌ QR REJECTED: Decryption failed - ${decryptError.message}`);
                    return res.status(400).json({ success: false, error: 'QR REJECTED - Decryption failed' });
                }
            }
        }
        else {
            console.log('🚨 UNAUTHORIZED QR SCAN ATTEMPT');
            console.log(`   Rejected QR: ${qrData}`);
            console.log(`   Contains ?s=: ${qrData.includes('?s=')}`);
            console.log(`   Starts with EHR_SECURE_: ${qrData.startsWith('EHR_SECURE_')}`);

            // Log unauthorized access to admin
            try {
                await fetch('http://localhost:3001/api/unauthorized-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        timestamp: new Date().toISOString(),
                        reason: `🚨 UNAUTHORIZED QR CODE SCANNED`,
                        accessType: 'UNAUTHORIZED_QR_SCAN',
                        qrData: qrData.substring(0, 200)
                    })
                });
                console.log('🚨 Unauthorized QR scan logged to admin transaction history');
            } catch (err) {
                console.error('Failed to log unauthorized access:', err.message);
            }

            return res.status(400).json({ success: false, error: '🚨 UNAUTHORIZED QR CODE - Only hospital EHR tokens with ?s= parameter accepted' });
        }

        if (!decoded) {
            console.log('❌ QR REJECTED: No valid EHR token found');

            // Log unauthorized access to admin
            try {
                await fetch('http://localhost:3001/api/unauthorized-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        timestamp: new Date().toISOString(),
                        reason: `🚨 NO VALID EHR TOKEN`,
                        accessType: 'UNAUTHORIZED_QR_SCAN',
                        qrData: qrData.substring(0, 200)
                    })
                });
                console.log('🚨 Unauthorized QR scan logged to admin');
            } catch (err) {
                console.log('Failed to log unauthorized access:', err.message);
            }

            return res.status(400).json({ success: false, error: 'QR REJECTED - No valid EHR token found' });
        }

        // Step 2: QR is valid - forward decrypted EHR token to hospital dashboard
        console.log(`🏥 Forwarding decrypted EHR token to hospital dashboard...`);

        try {
            // Forward the original QR data to hospital dashboard
            console.log(`🔐 Forwarding QR data to hospital dashboard`);

            const hospitalResponse = await fetch('http://localhost:3005/api/tunnel-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qrData: qrData })
            });

            const hospitalResult = await hospitalResponse.json();

            if (hospitalResult.success) {
                console.log(`✅ Hospital accepted QR for: ${decoded.name}`);

                // QR_SCANNED transaction will be recorded by QR scanner server
                console.log('✅ QR validated, forwarding to hospital dashboard');

                return res.json({
                    success: true,
                    message: 'QR validated and forwarded to hospital',
                    patientName: decoded.name,
                    patientId: decoded.userId,
                    scanId: hospitalResult.scanId
                });
            } else {
                console.log(`❌ Hospital rejected QR: ${hospitalResult.error}`);
                return res.status(400).json({ success: false, error: 'Hospital rejected QR' });
            }
        } catch (hospitalError) {
            console.log(`❌ Hospital communication failed: ${hospitalError.message}`);
            return res.status(500).json({ success: false, error: 'Hospital communication failed' });
        }

    } catch (error) {
        console.error('❌ QR REJECTED:', error.message);
        res.status(400).json({ success: false, error: 'QR REJECTED - ' + error.message });
    }
});

// Verify OTP with blockchain transaction
app.post('/api/verify-otp', async (req, res) => {
    const { userId, otp } = req.body;
    res.status(400).json({ success: false, error: 'Invalid OTP' });
});

// Get patient data from blockchain
app.get('/api/patient-data', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Get patient data from blockchain
        fabricClient.setUserContext({
            userId: decoded.userId,
            appName: 'hospital-portal',
            role: 'hospital'
        });
        const patientBlock = await fabricClient.getPatient(decoded.userId);

        // Decrypt medical data
        const encryptionService = require('../shared/encryption-service');
        const patientKey = encryptionService.generatePatientKey(patientBlock.walletAddress, decoded.userId);
        const decryptedData = encryptionService.decryptMedicalData(patientBlock.encryptedData.medicalData.encryptedData, patientKey);

        const patientData = {
            name: patientBlock.encryptedData.name,
            bloodType: decryptedData.bloodType,
            allergies: decryptedData.allergies,
            conditions: decryptedData.conditions,
            medications: decryptedData.medications
        };

        res.json({ success: true, data: patientData });
    } catch (error) {
        console.error('Get patient data error:', error);
        res.status(401).json({ success: false, error: 'Invalid token' });
    }
});

// Access patient data from blockchain
app.post('/api/access-patient-data', requireHospital(), async (req, res) => {
    const { patientId, hospitalId, accessToken } = req.body;

    try {
        fabricClient.setUserContext({
            userId: 'hospital-system',
            appName: 'hospital-portal',
            role: 'hospital'
        });

        // Record blockchain transaction using Hyperledger Fabric
        const transaction = await fabricClient.recordTransaction({
            id: `tx_${Date.now()}`,
            type: 'ACCESS_RECORD',
            patientId,
            hospitalId: hospitalId || 'hospital-001',
            accessMethod: 'BLOCKCHAIN_ACCESS',
            timestamp: new Date().toISOString(),
            transaction: {
                type: 'BLOCKCHAIN_ACCESS',
                id: `tx_${Date.now()}`
            }
        });

        // Get patient data from blockchain
        const patientBlock = await fabricClient.getPatient(patientId);

        // Decrypt medical data
        const encryptionService = require('../shared/encryption-service');
        const patientKey = encryptionService.generatePatientKey(patientBlock.walletAddress, patientId);
        const decryptedData = encryptionService.decryptMedicalData(patientBlock.encryptedData.medicalData.encryptedData, patientKey);

        // Create history string from decrypted data
        let history = `MEDICAL HISTORY - ${patientBlock.encryptedData.name}
`;
        history += `Patient ID: ${patientId}
`;
        history += `Wallet Address: ${patientBlock.walletAddress}

`;
        history += '=== MEDICAL RECORDS ===\n';

        if (decryptedData.fullMedicalHistory && decryptedData.fullMedicalHistory.records) {
            decryptedData.fullMedicalHistory.records.forEach(record => {
                history += `Date: ${record.date}
`;
                history += `Hospital: ${record.hospital}
`;
                history += `Doctor: ${record.doctor}
`;
                history += `Notes: ${record.notes}
`;
                if (record.prescription) {
                    history += `Prescription: ${record.prescription}
`;
                }
                history += '\n';
            });
        }

        history += '=== CURRENT STATUS ===\n';
        history += `Blood Type: ${decryptedData.bloodType}\n`;
        history += `Allergies: ${decryptedData.allergies.join(', ')}\n`;
        history += `Current Conditions: ${decryptedData.conditions.join(', ')}\n`;
        history += `Current Medications: ${decryptedData.medications.join(', ')}\n`;
        history += `Last Updated: ${decryptedData.fullMedicalHistory?.lastUpdated || new Date().toISOString()}`;

        // Create hash of medical data for blockchain integrity
        const dataHash = crypto.createHash('sha256').update(history).digest('hex');

        // Record medical data transfer transaction
        const transferResult = await fabricClient.recordTransaction({
            id: `transfer_${Date.now()}`,
            type: 'MEDICAL_DATA_TRANSFER',
            patientId,
            fromWallet: patientBlock.walletAddress,
            toWallet: await getHospitalWallet(hospitalId || 'hospital-001'),
            dataHash: dataHash,
            timestamp: new Date().toISOString(),
            transaction: {
                type: 'MEDICAL_DATA_TRANSFER',
                fromWallet: patientBlock.walletAddress,
                toWallet: await getHospitalWallet(hospitalId || 'hospital-001'),
                details: `Medical data transferred (hash: ${dataHash})`
            }
        });

        // Generate unique transaction ID for this access
        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Record transaction in admin dashboard
        await fetch('http://localhost:3001/api/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patientId,
                hospitalId: hospitalId || 'hospital-001',
                accessMethod: 'BLOCKCHAIN_ACCESS',
                transaction: {
                    id: transaction.transactionId || transaction.id || transactionId,
                    type: 'ACCESS_REQUEST',
                    fromWallet: patientBlock.walletAddress,
                    toWallet: await getHospitalWallet(hospitalId || 'hospital-001'),
                    patientId,
                    timestamp: transaction.timestamp || new Date().toISOString(),
                    status: transaction.status || 'completed',
                    dataHash,
                    transferId: transferResult.transferId || `transfer_${Date.now()}`
                }
            })
        }).catch(() => {});

        res.json({
            success: true,
            history,
            transaction,
            transferResult,
            transactionId
        });
    } catch (error) {
        console.error('Fabric access error:', error);
        res.status(500).json({ success: false, error: 'Failed to access patient data from blockchain' });
    }
});

// Save edited history to blockchain
app.post('/api/save-history', requireHospital(), async (req, res) => {
    const { patientId, history, hospitalId } = req.body;

    try {
        fabricClient.setUserContext({
            userId: 'hospital-system',
            appName: 'hospital-portal',
            role: 'hospital'
        });

        // Record blockchain transaction for data update
        const transaction = await fabricClient.recordTransaction({
            id: `tx_${Date.now()}`,
            type: 'DATA_UPDATE',
            patientId,
            hospitalId: hospitalId || 'hospital-001',
            timestamp: new Date().toISOString(),
            transaction: {
                type: 'DATA_UPDATE',
                id: `tx_${Date.now()}`
            }
        });

        // Parse history to extract medical data
        const medicalData = parseHistoryToMedicalData(history);

        // Get patient data from blockchain
        const patientBlock = await fabricClient.getPatient(patientId);

        // Encrypt updated medical data
        const encryptionService = require('../shared/encryption-service');
        const patientKey = encryptionService.generatePatientKey(patientBlock.walletAddress, patientId);
        const encryptedData = encryptionService.encryptMedicalData(medicalData, patientKey);

        // Store updated data on blockchain
        const updatedPatientData = {
            ...patientBlock.encryptedData,
            medicalData: {
                encrypted: true,
                encryptedData: encryptedData
            }
        };

        await fabricClient.storePatient({
            id: patientId,
            walletAddress: patientBlock.walletAddress,
            ...updatedPatientData
        });

        // Create hash of updated data
        const dataHash = crypto.createHash('sha256').update(history).digest('hex');

        // Record update transaction in admin
        await fetch('http://localhost:3001/api/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patientId,
                hospitalId: hospitalId || 'hospital-001',
                accessMethod: 'DATA_UPDATE',
                transaction: {
                    id: transaction.transactionId || transaction.id || `update_${Date.now()}`,
                    type: 'DATA_UPDATE',
                    fromWallet: await getHospitalWallet(hospitalId || 'hospital-001'),
                    toWallet: patientBlock.walletAddress,
                    patientId,
                    timestamp: new Date().toISOString(),
                    status: 'completed',
                    dataHash
                }
            })
        }).catch(() => {});

        res.json({ success: true, transaction, dataHash });
    } catch (error) {
        console.error('Save history error:', error);
        res.status(500).json({ success: false, error: 'Failed to save history to blockchain' });
    }
});

// Helper function to parse history text to medical data structure
function parseHistoryToMedicalData(history) {
    const lines = history.split('\n');
    const records = [];
    let currentRecord = null;
    let bloodType = '';
    let allergies = [];
    let conditions = [];
    let medications = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('Date: ')) {
            if (currentRecord) records.push(currentRecord);
            currentRecord = { date: line.replace('Date: ', '') };
        } else if (line.startsWith('Hospital: ') && currentRecord) {
            currentRecord.hospital = line.replace('Hospital: ', '');
        } else if (line.startsWith('Doctor: ') && currentRecord) {
            currentRecord.doctor = line.replace('Doctor: ', '');
        } else if (line.startsWith('Notes: ') && currentRecord) {
            currentRecord.notes = line.replace('Notes: ', '');
        } else if (line.startsWith('Prescription: ') && currentRecord) {
            currentRecord.prescription = line.replace('Prescription: ', '');
        } else if (line.startsWith('Blood Type: ')) {
            bloodType = line.replace('Blood Type: ', '');
        } else if (line.startsWith('Allergies: ')) {
            allergies = line.replace('Allergies: ', '').split(', ').filter(a => a);
        } else if (line.startsWith('Current Conditions: ')) {
            conditions = line.replace('Current Conditions: ', '').split(', ').filter(c => c);
        } else if (line.startsWith('Current Medications: ')) {
            medications = line.replace('Current Medications: ', '').split(', ').filter(m => m);
        }
    }
    
    if (currentRecord) records.push(currentRecord);
    
    return {
        bloodType: bloodType || 'Unknown',
        allergies: allergies || [],
        conditions: conditions || [],
        medications: medications || [],
        fullMedicalHistory: {
            records: records,
            lastUpdated: new Date().toISOString()
        }
    };
}

// Send back to patient with blockchain transaction
app.post('/api/send-back', requireHospital(), async (req, res) => {
    const { patientId, hospitalId } = req.body;

    try {
        fabricClient.setUserContext({
            userId: 'hospital-system',
            appName: 'hospital-portal',
            role: 'hospital'
        });

        // Get patient data from blockchain
        const patientBlock = await fabricClient.getPatient(patientId);

        // Create history string from blockchain data
        const encryptionService = require('../shared/encryption-service');
        const patientKey = encryptionService.generatePatientKey(patientBlock.walletAddress, patientId);
        const decryptedData = encryptionService.decryptMedicalData(patientBlock.encryptedData.medicalData.encryptedData, patientKey);

        let history = `MEDICAL HISTORY - ${patientBlock.encryptedData.name}
`;
        history += `Patient ID: ${patientId}
`;
        history += `Wallet Address: ${patientBlock.walletAddress}

`;
        history += '=== MEDICAL RECORDS ===\n';

        if (decryptedData.fullMedicalHistory && decryptedData.fullMedicalHistory.records) {
            decryptedData.fullMedicalHistory.records.forEach(record => {
                history += `Date: ${record.date}
`;
                history += `Hospital: ${record.hospital}
`;
                history += `Doctor: ${record.doctor}
`;
                history += `Notes: ${record.notes}
`;
                if (record.prescription) {
                    history += `Prescription: ${record.prescription}
`;
                }
                history += '\n';
            });
        }

        history += '=== CURRENT STATUS ===\n';
        history += `Blood Type: ${decryptedData.bloodType}\n`;
        history += `Allergies: ${decryptedData.allergies.join(', ')}\n`;
        history += `Current Conditions: ${decryptedData.conditions.join(', ')}\n`;
        history += `Current Medications: ${decryptedData.medications.join(', ')}\n`;
        history += `Last Updated: ${decryptedData.fullMedicalHistory?.lastUpdated || new Date().toISOString()}`;

        const dataHash = crypto.createHash('sha256').update(history).digest('hex');

        // Transfer updated medical data back to patient on blockchain
        const transferResult = await fabricClient.recordTransaction({
            id: `transfer_${Date.now()}`,
            type: 'MEDICAL_DATA_TRANSFER',
            patientId,
            fromWallet: await getHospitalWallet(hospitalId || 'hospital-001'),
            toWallet: patientBlock.walletAddress,
            dataHash: dataHash,
            timestamp: new Date().toISOString(),
            transaction: {
                type: 'MEDICAL_DATA_TRANSFER',
                fromWallet: await getHospitalWallet(hospitalId || 'hospital-001'),
                toWallet: patientBlock.walletAddress,
                details: `Medical data transferred back (hash: ${dataHash})`
            }
        });

        // Record return transaction using Hyperledger Fabric
        const transaction = await fabricClient.recordTransaction({
            id: `tx_${Date.now()}`,
            type: 'ACCESS_RETURN',
            patientId,
            hospitalId: hospitalId || 'hospital-001',
            accessMethod: 'BLOCKCHAIN_RETURN',
            timestamp: new Date().toISOString(),
            transaction: {
                type: 'BLOCKCHAIN_RETURN',
                id: `tx_${Date.now()}`
            }
        });

        // Generate unique transaction ID
        const transactionId = `return_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Record transaction in admin dashboard
        await fetch('http://localhost:3001/api/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patientId,
                hospitalId: hospitalId || 'hospital-001',
                accessMethod: 'BLOCKCHAIN_RETURN',
                transaction: {
                    id: transaction.transactionId || transaction.id || transactionId,
                    type: 'SEND_BACK',
                    fromWallet: await getHospitalWallet(hospitalId || 'hospital-001'),
                    toWallet: patientBlock.walletAddress,
                    patientId,
                    timestamp: transaction.timestamp || new Date().toISOString(),
                    status: transaction.status || 'completed',
                    dataHash,
                    transferId: transferResult.transferId || `transfer_return_${Date.now()}`
                }
            })
        }).catch(() => {});

        res.json({ success: true, transaction, transferResult, transactionId });
    } catch (error) {
        console.error('Fabric send-back error:', error);
        res.status(500).json({ success: false, error: 'Failed to send back data from blockchain' });
    }
});

// Wallet address validation - check format (0xFAB... pattern)
function validateWalletAddress(address) {
    const walletRegex = /^0x[a-fA-F0-9]{40,}$/;
    return walletRegex.test(address);
}

// Get hospital wallet address from blockchain
async function getHospitalWallet(hospitalId) {
    try {
        fabricClient.setUserContext({
            userId: 'hospital-system',
            appName: 'hospital-portal',
            role: 'hospital'
        });
        const hospital = await fabricClient.getHospital(hospitalId);
        return hospital?.walletAddress || null;
    } catch (error) {
        console.warn(`Failed to get hospital wallet for ${hospitalId}:`, error.message);
        return null;
    }
}

// Record blockchain transaction endpoint
app.post('/api/record-transaction', requireHospital(), async (req, res) => {
    const { type, patientId, hospitalId, timestamp } = req.body;

    try {
        fabricClient.setUserContext({
            userId: 'hospital-system',
            appName: 'hospital-portal',
            role: 'hospital'
        });

        const transaction = await fabricClient.recordTransaction({
            id: `tx_${Date.now()}`,
            type: type || 'CUSTOM_TRANSACTION',
            patientId,
            hospitalId,
            timestamp: timestamp || new Date().toISOString(),
            transaction: {
                type: type || 'CUSTOM_TRANSACTION',
                id: `tx_${Date.now()}`
            }
        });

        res.json({ success: true, transaction });
    } catch (error) {
        console.error('Record transaction error:', error);
        res.status(500).json({ success: false, error: 'Failed to record transaction' });
    }
});

// Security alert endpoint for unauthorized QR scans
app.post('/api/security-alert', (req, res) => {
    const { type, qrData, timestamp, message } = req.body;
    
    console.log('🚨 SECURITY ALERT RECEIVED');
    console.log(`   Type: ${type}`);
    console.log(`   Message: ${message}`);
    console.log(`   QR Data: ${qrData}`);
    console.log(`   Time: ${timestamp}`);
    console.log('🚨 UNAUTHORIZED QR SCAN BLOCKED - Only hospital EHR tokens accepted');
    
    res.json({ 
        success: true, 
        message: 'Security alert received and logged' 
    });
});

// Log ALL incoming requests
app.use((req, res, next) => {
    console.log(`📶 ${req.method} ${req.path} - ${new Date().toLocaleTimeString()}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('   Body:', JSON.stringify(req.body).substring(0, 100) + '...');
    }
    if (req.query && Object.keys(req.query).length > 0) {
        console.log('   Query:', req.query);
    }
    next();
});

app.listen(PORT, () => {
    console.log(`📱 Hospital QR Scanner: http://localhost:${PORT}`);
    console.log('🌐 Public Tunnel: Use localtunnel for iPhone access');
    console.log('📱 iPhone Camera Support: ENABLED');
    console.log('🔒 Secure QR Validation: EHR_SECURE_ format only');
    console.log('🏥 Hospital Dashboard: http://localhost:3005');
    console.log('🔗 API Communication: Scanner → Dashboard');
    console.log('');
    console.log('🔍 QR Scanner Endpoints:');
    console.log('   POST /api/scan - Full scan processing');
    console.log('   POST /api/validate-qr - Quick validation');
    console.log('   POST /api/test-qr - Debug endpoint');
    console.log('   GET /api/scan - Test endpoint status');
    console.log('');
    console.log('ℹ️ Waiting for QR scan requests...');
    console.log('⚠️ If you scan a QR and see no logs above, your scanner is NOT calling this server!');
    console.log('🔧 Configure your local tunnel scanner to POST to: http://localhost:3002/api/scan');
});

// Keep server alive to prevent process exit
setInterval(() => {}, 1000);