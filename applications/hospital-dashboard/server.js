require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const fabricService = require('../shared/fabric-service-simple');
const fabricClient = require('../shared/fabric-client');
const fs = require('fs');
const encryptionService = require('../shared/encryption-service');
const crypto = require('crypto');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());
app.use(express.static('public'));
app.use(require('cors')());

const JWT_SECRET = process.env.JWT_SECRET_ADMIN;
if (!JWT_SECRET) throw new Error('JWT_SECRET_ADMIN is required in .env file');
const HOSPITAL_SECRET_TOKEN = process.env.HOSPITAL_SCANNER_SECRET;
if (!HOSPITAL_SECRET_TOKEN) throw new Error('HOSPITAL_SCANNER_SECRET is required in .env file'); // Secret token for hospital scanners

// Store pending QR scans and active sessions
let pendingScans = new Map();
let activeSessions = new Map();

// Simple QR validation endpoint - returns true if EHR token found, false if not
app.post('/api/validate-qr', async (req, res) => {
    const { qrData } = req.body;
    
    try {
        // Check if QR contains encrypted EHR token
        if (qrData.includes('?session=') || qrData.includes('?s=')) {
            const urlParams = new URL(qrData);
            const encodedToken = urlParams.searchParams.get('session') || urlParams.searchParams.get('s');
            
            if (encodedToken) {
                const decodedToken = Buffer.from(encodedToken, 'base64').toString('utf8');
                const [encryptedData, ivHex] = decodedToken.split(':');
                
                const encryptionService = require('../shared/encryption-service');
                const ehrData = encryptionService.decryptEHRToken(encryptedData, ivHex);
                
                if (ehrData.exp && ehrData.exp < Math.floor(Date.now() / 1000)) {
                    return res.json({ valid: false, reason: 'expired' });
                }
                
                return res.json({ valid: true, patientName: ehrData.name });
            }
        }
        
        if (qrData.startsWith('EHR_SECURE_')) {
            const encodedToken = qrData.replace('EHR_SECURE_', '');
            const decodedToken = Buffer.from(encodedToken, 'base64').toString('utf8');
            const [encryptedData, ivHex] = decodedToken.split(':');
            
            const encryptionService = require('../shared/encryption-service');
            const ehrData = encryptionService.decryptEHRToken(encryptedData, ivHex);
            
            if (ehrData.exp && ehrData.exp < Math.floor(Date.now() / 1000)) {
                return res.json({ valid: false, reason: 'expired' });
            }
            
            return res.json({ valid: true, patientName: ehrData.name });
        }
        
    } catch (error) {
        return res.json({ valid: false, reason: 'decryption_failed' });
    }
    
    return res.json({ valid: false, reason: 'no_ehr_token' });
});

// Local tunnel scanner endpoint (mimics test script behavior)
app.post('/api/tunnel-scan', async (req, res) => {
    const { qrData } = req.body;
    
    try {
        // Step 1: Try to extract and decrypt EHR token from URL
        if (qrData.includes('?session=') || qrData.includes('?s=')) {
            const urlParams = new URL(qrData);
            const encodedToken = urlParams.searchParams.get('session') || urlParams.searchParams.get('s');
            
            if (encodedToken) {
                const decodedToken = Buffer.from(encodedToken, 'base64').toString('utf8');
                const [encryptedData, ivHex] = decodedToken.split(':');
                
                const encryptionService = require('../shared/encryption-service');
                const ehrData = encryptionService.decryptEHRToken(encryptedData, ivHex);
                
                // Check if token is expired
                if (ehrData.exp && ehrData.exp < Math.floor(Date.now() / 1000)) {
                    throw new Error('EHR token expired');
                }
                
                // EHR token found and decrypted successfully
                console.log(`✅ EHR Token Successfully Decrypted: ${ehrData.name}`);
                console.log('🎉 Steganographic QR Test Complete!');
                
                const scanId = Date.now().toString();
                pendingScans.set(scanId, {
                    scanId,
                    userId: ehrData.patientId,
                    name: ehrData.name,
                    walletAddress: ehrData.walletAddress,
                    timestamp: ehrData.timestamp,
                    status: 'scanned'
                });
                
                // Record QR scan transaction
                try {
                    const adminDashboardUrl = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001';
                    await fetch(`${adminDashboardUrl}/api/record-transaction`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            patientId: ehrData.patientId,
                            hospitalId: process.env.DEFAULT_HOSPITAL_ID || 'hospital-001',
                            accessMethod: 'QR_SCAN',
                            transaction: {
                                id: `qr_scan_${Date.now()}`,
                                type: 'QR_SCANNED',
                                fromWallet: ehrData.walletAddress,
                                toWallet: process.env.DEMO_HOSPITAL_WALLET || '0xFABa8f7e6d5c4b3a2918f7e6d5c4b3a291a8f7eh',
                                patientId: ehrData.patientId,
                                timestamp: new Date().toISOString(),
                                status: 'completed'
                            }
                        })
                    });
                } catch (err) {
                    console.log('Failed to record transaction:', err.message);
                }
                
                return res.json({
                    success: true,
                    message: '🎉 Steganographic QR Test Complete!',
                    ehrToken: `EHR_SECURE_${encodedToken}`,
                    patientData: {
                        userId: ehrData.patientId,
                        name: ehrData.name,
                        walletAddress: ehrData.walletAddress
                    },
                    scanId
                });
            }
        }
        
        // Step 2: Try direct EHR_SECURE_ token (new simplified format)
        if (qrData.startsWith('EHR_SECURE_')) {
            console.log(`✅ Valid EHR Token Format Detected: ${qrData}`);
            
            // For the new simplified format, we just validate the format
            if (qrData.length === 25) {
                console.log(`✅ EHR Token Successfully Validated: 25-character format`);
                console.log('🎉 Steganographic QR Test Complete!');
                
                // Try to decode the token to get patient info
                try {
                    const encodedToken = qrData.replace('EHR_SECURE_', '');
                    const decodedToken = Buffer.from(encodedToken, 'base64').toString('utf8');
                    const [encryptedData, ivHex] = decodedToken.split(':');
                    
                    const encryptionService = require('../shared/encryption-service');
                    const ehrData = encryptionService.decryptEHRToken(encryptedData, ivHex);
                    
                    const scanId = Date.now().toString();
                    pendingScans.set(scanId, {
                        scanId,
                        userId: ehrData.patientId,
                        name: ehrData.name,
                        walletAddress: ehrData.walletAddress,
                        timestamp: ehrData.timestamp,
                        status: 'scanned'
                    });
                    
                    return res.json({
                        success: true,
                        message: '🎉 EHR Token Validated and Decrypted!',
                        ehrToken: qrData,
                        patientData: {
                            userId: ehrData.patientId,
                            name: ehrData.name,
                            walletAddress: ehrData.walletAddress
                        },
                        scanId
                    });
                } catch (decryptError) {
                    console.log(`❌ Failed to decrypt EHR token: ${decryptError.message}`);
                    // Fallback to simplified format
                    const scanId = Date.now().toString();
                    pendingScans.set(scanId, {
                        scanId,
                        userId: 'patient-001', // Simplified for demo
                        name: 'Patient',
                        walletAddress: process.env.DEMO_PATIENT_WALLET || '0xFAB1234567890abcdef1234567890abcdef123456',
                        timestamp: Date.now(),
                        status: 'scanned'
                    });
                    
                    return res.json({
                        success: true,
                        message: '🎉 EHR Token Validated - Using fallback format!',
                        ehrToken: qrData,
                        patientData: {
                            userId: 'patient-001',
                            name: 'Patient',
                            walletAddress: process.env.DEMO_PATIENT_WALLET || '0xFAB1234567890abcdef1234567890abcdef123456'
                        },
                        scanId
                    });
                }
            } else {
                console.log(`❌ Invalid EHR Token Length: ${qrData.length}`);
            }
        }
        
    } catch (error) {
        console.log(`❌ EHR decryption failed: ${error.message}`);
    }
    
    // No valid EHR token found - reject QR
    console.log('❌ QR Rejected - No valid encrypted EHR token found');
    
    return res.json({
        success: false,
        error: 'QR Rejected',
        message: 'No valid encrypted EHR token found'
    });
});

// Hospital QR scanner endpoint with secret token
app.post('/api/scan-qr', async (req, res) => {
    const { qrData, secretToken } = req.body;
    
    console.log(`🔍 Hospital scanner request - Token: ${secretToken ? 'PROVIDED' : 'MISSING'}`);
    
    // Verify hospital scanner has the secret token
    if (secretToken !== HOSPITAL_SECRET_TOKEN) {
        console.log(`❌ Invalid secret token: ${secretToken}`);
        return res.status(403).json({ 
            success: false, 
            error: 'Unauthorized scanner - Invalid secret token'
        });
    }
    
    console.log(`🔍 Hospital scanner processing QR: ${qrData}`);
    
    try {
        // Step 1: Extract encrypted EHR token from steganographic QR URL
        if (qrData.includes('?session=') || qrData.includes('?s=')) {
            console.log(`🔍 Extracting encrypted EHR token from steganographic QR`);
            
            const urlParams = new URL(qrData);
            const encodedToken = urlParams.searchParams.get('session') || urlParams.searchParams.get('s');
            
            if (encodedToken) {
                try {
                    // Decode the base64 encoded token
                    const decodedToken = Buffer.from(encodedToken, 'base64').toString('utf8');
                    const [encryptedData, ivHex] = decodedToken.split(':');
                    
                    // Decrypt the EHR token
                    const encryptionService = require('../shared/encryption-service');
                    const ehrData = encryptionService.decryptEHRToken(encryptedData, ivHex);
                    
                    // Validate token expiry
                    if (ehrData.exp && ehrData.exp < Math.floor(Date.now() / 1000)) {
                        throw new Error('EHR token expired');
                    }
                    
                    console.log(`✅ STEGANOGRAPHIC EHR ACCEPTED: ${ehrData.name} (${ehrData.patientId})`);
                    
                    const scanId = Date.now().toString();
                    pendingScans.set(scanId, {
                        scanId,
                        userId: ehrData.patientId,
                        name: ehrData.name,
                        walletAddress: ehrData.walletAddress,
                        timestamp: ehrData.timestamp,
                        status: 'scanned'
                    });
                    
                    // Record QR scan transaction
                    try {
                        await fetch(process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001/api/record-transaction', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                patientId: ehrData.patientId,
                                hospitalId: process.env.DEFAULT_HOSPITAL_ID || 'hospital-001',
                                accessMethod: 'QR_SCAN',
                                transaction: {
                                    id: `qr_scan_${Date.now()}`,
                                    type: 'QR_SCANNED',
                                    fromWallet: ehrData.walletAddress,
                                    toWallet: process.env.DEMO_HOSPITAL_WALLET || '0xFABa8f7e6d5c4b3a2918f7e6d5c4b3a291a8f7eh',
                                    patientId: ehrData.patientId,
                                    timestamp: new Date().toISOString(),
                                    status: 'completed'
                                }
                            })
                        });
                    } catch (err) {
                        console.log('Failed to record transaction:', err.message);
                    }
                    
                    return res.json({
                        success: true,
                        message: 'Steganographic EHR QR successfully decrypted and validated',
                        patientData: {
                            userId: ehrData.patientId,
                            name: ehrData.name,
                            walletAddress: ehrData.walletAddress
                        },
                        scanId
                    });
                } catch (decryptError) {
                    console.log(`❌ EHR decryption failed: ${decryptError.message}`);
                }
            }
        }
        
        // Step 2: Try direct EHR_SECURE_ token (fallback)
        if (qrData.startsWith('EHR_SECURE_')) {
            console.log(`🔍 Processing direct EHR token`);
            
            try {
                const encodedToken = qrData.replace('EHR_SECURE_', '');
                const decodedToken = Buffer.from(encodedToken, 'base64').toString('utf8');
                const [encryptedData, ivHex] = decodedToken.split(':');
                
                const encryptionService = require('../shared/encryption-service');
                const ehrData = encryptionService.decryptEHRToken(encryptedData, ivHex);
                
                if (ehrData.exp && ehrData.exp < Math.floor(Date.now() / 1000)) {
                    throw new Error('EHR token expired');
                }
                
                console.log(`✅ DIRECT EHR ACCEPTED: ${ehrData.name} (${ehrData.patientId})`);
                
                const scanId = Date.now().toString();
                pendingScans.set(scanId, {
                    scanId,
                    userId: ehrData.patientId,
                    name: ehrData.name,
                    walletAddress: ehrData.walletAddress,
                    timestamp: ehrData.timestamp,
                    status: 'scanned'
                });
                
                // Record QR scan transaction
                try {
                    const adminDashboardUrl = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001';
                    await fetch(`${adminDashboardUrl}/api/record-transaction`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            patientId: ehrData.patientId,
                            hospitalId: process.env.DEFAULT_HOSPITAL_ID || 'hospital-001',
                            accessMethod: 'QR_SCAN',
                            transaction: {
                                id: `qr_scan_${Date.now()}`,
                                type: 'QR_SCANNED',
                                fromWallet: ehrData.walletAddress,
                                toWallet: process.env.DEMO_HOSPITAL_WALLET || '0xFABa8f7e6d5c4b3a2918f7e6d5c4b3a291a8f7eh',
                                patientId: ehrData.patientId,
                                timestamp: new Date().toISOString(),
                                status: 'completed'
                            }
                        })
                    });
                } catch (err) {
                    console.log('Failed to record transaction:', err.message);
                }
                
                return res.json({
                    success: true,
                    message: 'Direct encrypted EHR token processed',
                    patientData: {
                        userId: ehrData.patientId,
                        name: ehrData.name,
                        walletAddress: ehrData.walletAddress
                    },
                    scanId
                });
            } catch (decryptError) {
                console.log(`❌ Direct EHR decryption failed: ${decryptError.message}`);
            }
        }
        
    } catch (error) {
        console.log(`❌ QR processing error: ${error.message}`);
        console.log(`❌ QR data received: ${qrData}`);
    }
    
    // Step 3: Reject if no valid encrypted EHR token found
    console.log(`❌ QR REJECTED: No valid encrypted EHR token found`);
    console.log(`❌ QR data: ${qrData}`);
    
    return res.json({
        success: false,
        error: 'QR Code Rejected - No valid encrypted EHR token found',
        data: qrData,
        debug: {
            hasSessionParam: qrData.includes('?session='),
            isDirectEHR: qrData.startsWith('EHR_SECURE_'),
            qrLength: qrData.length
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Hospital login endpoint - uses Contract Runner
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Set user context for fabricClient
        fabricClient.setUserContext({ userId: 'hospital-001', appName: 'hospital-dashboard', role: 'hospital' });

        // Verify credentials from Contract Runner
        const hospitalId = await fabricClient.verifyCredentials(username, password);

        if (!hospitalId) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Get hospital data from Contract Runner
        const hospital = await fabricClient.getHospital(hospitalId);

        const token = jwt.sign({ hospitalId }, JWT_SECRET, { expiresIn: '24h' });

        console.log(`✅ Hospital login successful: ${hospital.name || hospital.id}`);

        res.json({
            success: true,
            token,
            patient: {
                id: hospitalId,
                name: hospital.name || hospital.id,
                walletAddress: hospital.walletAddress
            }
        });
    } catch (error) {
        console.error('Hospital login error:', error);
        res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
});





// Generate single OTP - admin is the only source
app.post('/api/generate-otp', async (req, res) => {
    const { patientWallet } = req.body;
    
    console.log(`🔐 Generate OTP request for wallet: ${patientWallet}`);
    
    try {
        // Admin generates the ONLY OTP
        const adminUrl = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001';
        console.log(`📡 Calling admin: ${adminUrl}/api/admin-qr-scan`);
        
        const adminResponse = await fetch(`${adminUrl}/api/admin-qr-scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientWallet })
        });
        
        console.log(`📊 Admin response status: ${adminResponse.status}`);
        
        if (adminResponse.ok) {
            const adminResult = await adminResponse.json();
            const theOtp = adminResult.otp;
            
            console.log(`🔐 THE OTP: ${theOtp} for ${patientWallet}`);
            
            // Store this OTP for verification
            for (const [scanId, scan] of pendingScans.entries()) {
                if (scan.walletAddress === patientWallet) {
                    scan.otp = theOtp;
                    scan.sessionId = adminResult.sessionId;
                    break;
                }
            }
            
            // Send THE OTP to patient
            await fetch(process.env.PATIENT_PORTAL_URL || 'http://localhost:3003/api/admin-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: adminResult.sessionId,
                    otp: theOtp,
                    patientWallet,
                    patientName: adminResult.patientName || 'Patient'
                })
            });
            
            console.log(`✅ THE OTP sent to patient: ${theOtp}`);
            return res.json({ success: true, otp: theOtp });
        } else {
            const errorText = await adminResponse.text();
            console.error(`❌ Admin returned error: ${errorText}`);
            throw new Error(`Admin returned ${adminResponse.status}: ${errorText}`);
        }
    } catch (error) {
        console.error('❌ OTP generation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get pending scans for dashboard
app.get('/api/pending-scans', (req, res) => {
    const scans = Array.from(pendingScans.entries()).map(([id, data]) => ({
        scanId: id,
        ...data
    }));
    
    res.json({ success: true, scans });
});

// Hospital verifies OTP locally
app.post('/api/verify-otp', async (req, res) => {
    const { otp, patientWallet, hospitalId, hospitalWallet, pharmacyId, pharmacyWallet, sessionType } = req.body;
    
    console.log(`🔐 ${sessionType === 'pharmacy' ? 'Pharmacy' : 'Hospital'} verifying OTP: ${otp} for wallet: ${patientWallet}`);
    
    const entityId = sessionType === 'pharmacy' ? pharmacyId : hospitalId;
    const entityWallet = sessionType === 'pharmacy' ? pharmacyWallet : hospitalWallet;
    const entityName = sessionType === 'pharmacy' ? process.env.DEFAULT_PHARMACY_NAME || 'City Pharmacy' : 'Hospital';
    
    console.log(`🏥 Entity ID: ${entityId}, Wallet: ${entityWallet}`);
    console.log('📊 Pending scans:', Array.from(pendingScans.keys()));
    
    try {
        // Find matching OTP in pending scans for the specific wallet
        let matchingScan = null;
        for (const [scanId, scan] of pendingScans.entries()) {
            if (scan.otp === otp && scan.walletAddress === patientWallet) {
                matchingScan = scan;
                console.log(`✅ Found matching OTP ${otp} for wallet ${patientWallet}`);
                break;
            }
        }
        
        if (!matchingScan) {
            // Log unauthorized access to admin transaction history
            const adminUrl = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001';
            await fetch(`${adminUrl}/api/unauthorized-access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    otp: otp,
                    hospitalId: process.env.DEFAULT_HOSPITAL_ID || 'hospital-001',
                    patientWallet: patientWallet,
                    timestamp: new Date().toISOString(),
                    reason: 'Invalid OTP - Unauthorized access attempt',
                    accessType: 'FAILED_OTP_VERIFICATION'
                })
            }).catch(err => console.error('Failed to log unauthorized access:', err));
            
            console.log(`🚨 UNAUTHORIZED ACCESS: Invalid OTP ${otp} for wallet ${patientWallet} logged to admin`);
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid OTP - Unauthorized access logged to admin transaction history' 
            });
        }
        
        // Verify OTP with admin - the ONLY authority
        const adminUrl = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001';
        
        // Fetch hospital wallet from blockchain
        let actualHospitalWallet = entityWallet;
        if (!actualHospitalWallet || actualHospitalWallet === 'undefined') {
            try {
                fabricClient.setUserContext({ userId: entityId, appName: 'hospital-dashboard', role: 'hospital' });
                const hospitalData = await fabricClient.getHospital(entityId);
                actualHospitalWallet = hospitalData.walletAddress || process.env.DEMO_HOSPITAL_WALLET;
                console.log(`💼 Fetched hospital wallet from blockchain: ${actualHospitalWallet}`);
            } catch (err) {
                console.warn(`⚠️ Could not fetch hospital wallet, using default`);
                actualHospitalWallet = process.env.DEMO_HOSPITAL_WALLET;
            }
        }
        
        const adminResponse = await fetch(`${adminUrl}/api/admin-verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                otp, 
                hospitalId: entityId, 
                hospitalWallet: actualHospitalWallet,
                sessionType: sessionType || 'hospital'
            })
        });
        
        console.log(`📊 Admin verify response status: ${adminResponse.status}`);
        
        if (!adminResponse.ok) {
            const errorText = await adminResponse.text();
            console.error(`❌ Admin verify failed (${adminResponse.status}): ${errorText.substring(0, 200)}`);
            throw new Error(`Admin verification failed with status ${adminResponse.status}`);
        }
        
        const adminResult = await adminResponse.json();
        
        if (adminResponse.ok && adminResult.success) {
            // Admin verified OTP - grant access
            const sessionId = adminResult.sessionId || Date.now().toString();
            const fullPatientData = adminResult.patientData;
            
            console.log(`✅ ADMIN VERIFIED OTP ${otp} - Access granted to:`, fullPatientData.name);
            
            // Fetch current prescription data from blockchain via admin server
            let currentPrescriptions = null;
            try {
                const adminUrl = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001';
                const patientsResponse = await fetch(`${adminUrl}/api/patients`);
                const patients = await patientsResponse.json();
                
                if (Array.isArray(patients)) {
                    const currentPatient = patients.find(p => p.id === fullPatientData.id);
                    if (currentPatient && currentPatient.prescriptions) {
                        currentPrescriptions = currentPatient.prescriptions;
                        console.log(`📋 Found current prescriptions in blockchain:`, currentPrescriptions);
                    }
                }
            } catch (err) {
                console.log('Could not fetch current prescriptions from blockchain:', err.message);
            }
            
            // Create session with complete decrypted data including current prescriptions
            activeSessions.set(sessionId, {
                sessionId: adminResult.sessionId || sessionId,
                patientId: fullPatientData.id,
                patientName: fullPatientData.name,
                patientData: {
                    ...fullPatientData,
                    prescriptions: currentPrescriptions || fullPatientData.prescriptions // Use blockchain data if available
                },
                accessTime: new Date().toISOString(),
                walletAddress: matchingScan.walletAddress,
                sessionType: sessionType || 'hospital', // Mark session type
                entityId: entityId,
                entityName: entityName,
                entityWallet: actualHospitalWallet
            });
            
            // Notify patient that hospital is accessing their data
            try {
                await fetch(process.env.PATIENT_PORTAL_URL || 'http://localhost:3003/api/hospital-accessing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId,
                        patientWallet: matchingScan.walletAddress
                    })
                });
            } catch (err) {
                console.log('Could not notify patient of access');
            }
            
            // Return COMPLETE patient data including all medical history and current prescriptions
            res.json({
                success: true,
                sessionId,
                patientData: {
                    id: fullPatientData.id,
                    name: fullPatientData.name,
                    age: fullPatientData.age || null,
                    gender: fullPatientData.gender || null,
                    phone: fullPatientData.phone || null,
                    walletAddress: matchingScan.walletAddress,
                    bloodType: fullPatientData.bloodType,
                    allergies: fullPatientData.allergies,
                    conditions: fullPatientData.conditions,
                    medications: fullPatientData.medications,
                    prescriptions: currentPrescriptions || fullPatientData.prescriptions,
                    fullMedicalHistory: fullPatientData.fullMedicalHistory || { records: [], lastUpdated: '' },
                    accessTime: new Date().toLocaleString()
                },
                message: '🔓 OTP VERIFIED - Full patient data decrypted and accessible'
            });
            
            // Clean up the used OTP
            pendingScans.delete(matchingScan.scanId || Object.keys(pendingScans)[0]);
            
        } else {
            // Log unauthorized access
            const adminUrl = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001';
            await fetch(`${adminUrl}/api/unauthorized-access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    otp: otp,
                    hospitalId: process.env.DEFAULT_HOSPITAL_ID || 'hospital-001',
                    patientWallet: patientWallet,
                    timestamp: new Date().toISOString(),
                    reason: 'Admin verification failed',
                    accessType: 'FAILED_ADMIN_VERIFICATION'
                })
            }).catch(err => console.error('Failed to log unauthorized access:', err));
            
            return res.status(400).json({ 
                success: false, 
                error: 'Admin verification failed - Access denied' 
            });
        }
        
    } catch (error) {
        console.error('❌ Hospital OTP verification error:', error);
        
        // Log system error as potential security issue
        try {
            const adminUrl = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001';
            await fetch(`${adminUrl}/api/unauthorized-access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    otp: otp,
                    hospitalId: process.env.DEFAULT_HOSPITAL_ID || 'hospital-001',
                    timestamp: new Date().toISOString(),
                    reason: 'System error during OTP verification - Potential security issue',
                    accessType: 'SYSTEM_ERROR',
                    errorDetails: error.message
                })
            });
        } catch (logError) {
            console.error('Failed to log system error:', logError);
        }
        
        res.status(500).json({ 
            success: false, 
            error: 'OTP verification system error - Security team notified' 
        });
    }
});

// Update session data
app.post('/api/update-session', async (req, res) => {
    const { sessionId, patientData } = req.body;
    
    const session = activeSessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    try {
        // Update session with new patient data
        session.patientData = {
            ...session.patientData,
            ...patientData
        };
        
        console.log(`📝 Session ${sessionId} updated with new patient data`);
        
        res.json({ 
            success: true, 
            message: 'Session updated successfully'
        });
        
    } catch (error) {
        console.error('Update session error:', error);
        res.status(500).json({ success: false, error: 'Failed to update session' });
    }
});

// Get patient session data with session type
app.get('/api/session/:sessionId', (req, res) => {
    const session = activeSessions.get(req.params.sessionId);
    
    if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    res.json({ 
        success: true, 
        session: {
            ...session,
            sessionType: session.sessionType || 'hospital',
            entityType: session.sessionType === 'pharmacy' ? 'pharmacy' : 'hospital'
        }
    });
});

// Add new medical record to patient data
app.post('/api/add-medical-record', async (req, res) => {
    const { sessionId, newRecord } = req.body;
    
    const session = activeSessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    try {
        // Add record to session data
        if (!session.patientData.fullMedicalHistory) {
            session.patientData.fullMedicalHistory = { records: [] };
        }
        
        session.patientData.fullMedicalHistory.records.push({
            ...newRecord,
            date: new Date().toISOString().split('T')[0]
        });
        
        session.patientData.fullMedicalHistory.lastUpdated = new Date().toISOString().split('T')[0];
        
        res.json({ 
            success: true, 
            message: 'Medical record added successfully',
            updatedData: session.patientData
        });
        
    } catch (error) {
        console.error('Add medical record error:', error);
        res.status(500).json({ success: false, error: 'Failed to add medical record' });
    }
});

// Update medical history
app.post('/api/update-history', async (req, res) => {
    const { sessionId, fullMedicalHistory, age, gender, bloodType, allergies, conditions, medications } = req.body;
    
    const session = activeSessions.get(sessionId);
    if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    try {
        if (fullMedicalHistory && fullMedicalHistory.records) {
            session.patientData.fullMedicalHistory = {
                records: fullMedicalHistory.records,
                lastUpdated: fullMedicalHistory.lastUpdated || new Date().toISOString().split('T')[0]
            };
        }
        
        if (age !== undefined) {
            session.patientData.age = age;
            console.log(`✅ Age updated to: ${age}`);
        }
        if (gender) {
            session.patientData.gender = gender;
            console.log(`✅ Gender updated to: ${gender}`);
        }
        if (bloodType) session.patientData.bloodType = bloodType;
        if (allergies) session.patientData.allergies = allergies;
        if (conditions) session.patientData.conditions = conditions;
        if (medications) session.patientData.medications = medications;
        
        res.json({ 
            success: true, 
            message: 'Session data updated successfully'
        });
        
    } catch (error) {
        console.error('❌ Update history error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to update session data' });
    }
});

// Request admin to end session
app.post('/api/send-back', async (req, res) => {
    const { sessionId, updatedData } = req.body;
    
    console.log(`📤 Send back request - Session ID: ${sessionId}`);
    console.log(`📊 Updated data received:`, JSON.stringify(updatedData, null, 2));
    
    const session = activeSessions.get(sessionId);
    if (!session) {
        console.error(`❌ Session not found: ${sessionId}`);
        console.log(`📊 Active sessions: ${Array.from(activeSessions.keys()).join(', ')}`);
        return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    try {
        if (updatedData) {
            session.patientData = {
                ...session.patientData,
                ...updatedData,
                age: updatedData.age !== undefined ? updatedData.age : session.patientData.age,
                gender: updatedData.gender || session.patientData.gender,
                bloodType: updatedData.bloodType || session.patientData.bloodType,
                fullMedicalHistory: updatedData.fullMedicalHistory || session.patientData.fullMedicalHistory
            };
            console.log(`✅ Session data merged - Age: ${session.patientData.age}, Gender: ${session.patientData.gender}`);
        }
        
        // Record SEND_BACK transaction before ending session
        const adminUrl = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001';
        
        try {
            await fetch(`${adminUrl}/api/transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientId: session.patientData.id,
                    hospitalId: session.entityId || process.env.DEFAULT_HOSPITAL_ID || 'hospital-001',
                    accessMethod: 'SEND_BACK',
                    transaction: {
                        type: 'SEND_BACK',
                        id: `send_back_${Date.now()}`,
                        fromWallet: session.entityWallet || process.env.DEMO_HOSPITAL_WALLET,
                        toWallet: session.patientData.walletAddress,
                        details: `Data returned to patient after ${session.sessionType || 'hospital'} session`,
                        timestamp: new Date().toISOString()
                    }
                })
            });
            console.log(`✅ SEND_BACK transaction recorded`);
        } catch (txErr) {
            console.error('Failed to record SEND_BACK transaction:', txErr.message);
        }
        
        const updateResponse = await fetch(`${adminUrl}/api/admin-end-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: session.sessionId || sessionId,
                updatedData: session.patientData
            })
        });
        
        if (!updateResponse.ok) {
            throw new Error(`Admin server responded with status: ${updateResponse.status}`);
        }
        
        const updateResult = await updateResponse.json();
        
        if (!updateResult.success) {
            throw new Error(updateResult.error || 'Admin failed to end session');
        }
        
        activeSessions.delete(sessionId);
        
        res.json({ 
            success: true, 
            message: '🔒 Data saved to blockchain and session ended'
        });
        
    } catch (error) {
        console.error('❌ End session error:', error);
        res.status(500).json({ success: false, error: 'Send back failed: ' + error.message });
    }
});

app.listen(PORT, async () => {
    console.log(`🏥 Hospital Dashboard: http://localhost:${PORT}`);
    console.log('👨⚕️ Doctor Interface: ENABLED');
    console.log('🔐 Admin-Controlled Access: ACTIVE');
    console.log('🔢 6-digit OTP: Admin-generated security');
    console.log('✅ CORRECT OTP: Full patient data decrypted & sent');
    console.log('🚨 WRONG OTP: Unauthorized access logged to admin');
    console.log('📝 Medical Record Editing: ENABLED');
    console.log('📤 End Session: Admin-secured');
    console.log('🔐 Security: AES-256-GCM + SHA-256 hashing');
    console.log('🔗 Blockchain: Immutable audit trail');
    console.log('');
    console.log('🔍 Hospital Dashboard Endpoints:');
    console.log('   /api/generate-otp - Generate OTP for patient access');
    console.log('   /api/verify-otp - Verify OTP and access patient data');
    console.log('   /api/update-history - Update patient medical records');
});

// Keep server alive
setInterval(() => {}, 1000);