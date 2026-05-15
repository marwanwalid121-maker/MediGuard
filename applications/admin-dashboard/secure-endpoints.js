const crypto = require('crypto');
const encryptionService = require('../shared/encryption-service');
const fabricClient = require('../shared/fabric-client');

// Session Configuration
const SESSION_EXPIRY = 30 * 60 * 1000; // 30 minutes
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// In-memory session store (ONLY for temporary OTP sessions)
const activeSessions = new Map();

function cleanExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of activeSessions.entries()) {
        if (now - session.createdAt > SESSION_EXPIRY) {
            activeSessions.delete(sessionId);
        }
    }
}

// Clean expired sessions every minute
setInterval(cleanExpiredSessions, 60000);



module.exports = (app) => {
    console.log('🔒 Admin Security Endpoints Loaded:');
    console.log('   ✅ Correct OTP: Full patient data decrypted');
    console.log('   🚨 Wrong OTP: Logged to transaction history');
    console.log('   📊 All unauthorized access tracked');
    console.log('   📝 Transaction recording: ENABLED');
    console.log('');
    // QR scan detection - automatically creates session when QR is scanned
    app.post('/api/qr-scanned', async (req, res) => {
        const { patientWallet, hospitalWallet } = req.body;

        try {
            cleanExpiredSessions();

            // Get patient from blockchain
            fabricClient.setUserContext({ userId: 'admin', appName: 'admin-dashboard', role: 'admin' });
            const patient = await fabricClient.getPatientByWallet(patientWallet);

            if (!patient) {
                return res.status(400).json({ success: false, error: 'Patient not found' });
            }
            
            const sessionId = crypto.randomUUID();
            const otp = generateOTP();

            const defaultHospitalId = process.env.DEFAULT_HOSPITAL_ID || 'hospital-001';
            const demoHospitalWallet = process.env.DEMO_HOSPITAL_WALLET || '0xFABa8f7e6d5c4b3a2918f7e6d5c4b3a291a8f7eh';

            const session = {
                sessionId,
                otp,
                patientId: patient.id,
                hospitalId: defaultHospitalId,
                patientWallet,
                hospitalWallet: demoHospitalWallet,
                createdAt: Date.now(),
                status: 'PENDING'
            };

            activeSessions.set(sessionId, session);

            const transaction = {
                id: Date.now().toString(),
                patientId: patient.id,
                hospitalId: defaultHospitalId,
                accessMethod: 'QR_SCANNED',
                timestamp: new Date().toISOString(),
                transaction: {
                    id: `qr_scanned_${Date.now()}`,
                    type: 'QR_SCANNED',
                    fromWallet: patientWallet,
                    toWallet: demoHospitalWallet,
                    patientId: patient.id,
                    timestamp: new Date().toISOString(),
                    status: 'completed'
                }
            };

            await fabricClient.recordTransaction(transaction);

            // Send same OTP to patient
            const patientPortalUrl = process.env.PATIENT_PORTAL_URL || 'http://localhost:3003';
            try {
                const response = await fetch(`${patientPortalUrl}/api/admin-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId,
                        otp,
                        patientWallet,
                        patientName: patient.name
                    })
                });
            } catch (error) {
            }

            // Send same OTP to hospital
            const hospitalDashboardUrl = process.env.HOSPITAL_DASHBOARD_URL || 'http://localhost:3005';
            try {
                const hospitalResponse = await fetch(`${hospitalDashboardUrl}/api/qr-detected`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        scanId: sessionId,
                        patientData: {
                            userId: patient.id,
                            name: patient.name,
                            walletAddress: patientWallet
                        },
                        timestamp: new Date().toISOString(),
                        otp: otp
                    })
                });
            } catch (error) {
            }
            

            
            res.json({ 
                success: true, 
                sessionId,
                otp,
                patientName: patient.name,
                message: 'OTP sent to patient and hospital'
            });
        } catch (error) {
            console.error('QR scan detection error:', error);
            res.status(500).json({ success: false, error: 'QR scan detection failed' });
        }
    });

    // Admin-controlled QR scan - generates OTP for security
    app.post('/api/admin-qr-scan', async (req, res) => {
        const { patientWallet } = req.body;
        const demoHospitalWallet = process.env.DEMO_HOSPITAL_WALLET || '0xFABa8f7e6d5c4b3a2918f7e6d5c4b3a291a8f7eh';
        const defaultHospitalId = process.env.DEFAULT_HOSPITAL_ID || 'hospital-001';

        try {
            cleanExpiredSessions();

            // Get patient from blockchain
            fabricClient.setUserContext({ userId: 'admin', appName: 'admin-dashboard', role: 'admin' });
            
            console.log(`🔍 Searching for patient with wallet: ${patientWallet}`);
            let patient;
            try {
                patient = await fabricClient.getPatientByWallet(patientWallet);
                console.log(`✅ Patient found: ${patient.name}`);
            } catch (error) {
                console.error(`❌ getPatientByWallet failed: ${error.message}`);
                // Fallback: try to find patient by iterating all patients
                console.log('🔄 Trying fallback: getAllPatients...');
                const allPatients = await fabricClient.getAllPatients();
                patient = allPatients.find(p => p.walletAddress === patientWallet);
                
                if (!patient) {
                    console.error(`❌ Patient not found with wallet: ${patientWallet}`);
                    return res.status(400).json({ success: false, error: 'Patient not found' });
                }
                console.log(`✅ Patient found via fallback: ${patient.name}`);
            }

            const sessionId = crypto.randomUUID();
            const otp = generateOTP();

            const session = {
                sessionId,
                otp,
                patientId: patient.id,
                hospitalId: defaultHospitalId,
                patientWallet,
                hospitalWallet: demoHospitalWallet,
                createdAt: Date.now(),
                status: 'PENDING'
            };

            activeSessions.set(sessionId, session);

            const transaction = {
                id: Date.now().toString(),
                patientId: patient.id,
                hospitalId: defaultHospitalId,
                accessMethod: 'ADMIN_QR_SCAN',
                timestamp: new Date().toISOString(),
                transaction: {
                    id: `admin_qr_${Date.now()}`,
                    type: 'ADMIN_CONTROLLED_ACCESS',
                    fromWallet: patientWallet,
                    toWallet: demoHospitalWallet,
                    patientId: patient.id,
                    timestamp: new Date().toISOString(),
                    status: 'admin_secured'
                }
            };

            await fabricClient.recordTransaction(transaction);

            // Admin sends OTP to patient
            const patientPortalUrl = process.env.PATIENT_PORTAL_URL || 'http://localhost:3003';
            try {
                const response = await fetch(`${patientPortalUrl}/api/admin-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId,
                        otp,
                        patientWallet,
                        patientName: patient.name
                    })
                });
            } catch (error) {
            }

            res.json({
                success: true,
                sessionId,
                otp,
                patientName: patient.name,
                message: 'Admin manual OTP generated'
            });
        } catch (error) {
            console.error('Admin QR scan error:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({ success: false, error: 'Admin scan failed: ' + error.message });
        }
    });

    // Admin verifies hospital OTP access
    app.post('/api/admin-verify-otp', async (req, res) => {
        const { otp, hospitalId, hospitalWallet } = req.body;
        
        console.log('🔍 Admin verify OTP received:', { otp, hospitalId, hospitalWallet });
        
        try {
            cleanExpiredSessions();
            
            let foundSession = null;
            for (const [sessionId, session] of activeSessions.entries()) {
                if (session.otp === otp && session.status === 'PENDING') {
                    foundSession = { sessionId, ...session };
                    break;
                }
            }
            
            if (!foundSession) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Admin security: Invalid OTP' 
                });
            }
            
            activeSessions.set(foundSession.sessionId, {
                ...foundSession,
                status: 'ADMIN_APPROVED',
                accessedAt: Date.now(),
                hospitalId: hospitalId || foundSession.hospitalId,
                hospitalWallet: hospitalWallet || foundSession.hospitalWallet
            });
            
            console.log('✅ Session updated with hospital info:', {
                hospitalId: hospitalId || foundSession.hospitalId,
                hospitalWallet: hospitalWallet || foundSession.hospitalWallet
            });

            // Get patient from blockchain
            fabricClient.setUserContext({ userId: 'admin', appName: 'admin-dashboard', role: 'admin' });
            const patient = await fabricClient.getPatient(foundSession.patientId);

            const patientKey = encryptionService.generatePatientKey(foundSession.patientWallet, foundSession.patientId);
            
            let decryptedData;
            if (patient.medicalData.encrypted && patient.medicalData.encryptedData) {
                try {
                    decryptedData = encryptionService.decryptMedicalData(patient.medicalData.encryptedData, patientKey);
                } catch (decryptError) {
                    throw decryptError;
                }
            } else {
                decryptedData = {
                    bloodType: patient.medicalData.bloodType,
                    allergies: patient.medicalData.allergies,
                    conditions: patient.medicalData.conditions,
                    medications: patient.medicalData.medications || [],
                    fullMedicalHistory: patient.medicalData.fullMedicalHistory || {
                        records: [],
                        lastUpdated: new Date().toISOString().split('T')[0]
                    }
                };
                
                const encrypted = encryptionService.encryptMedicalData(decryptedData, patientKey);
                patient.medicalData = {
                    encrypted: true,
                    encryptedData: encrypted,
                    dataHash: encrypted.hash
                };
                await fabricClient.storePatient(patient);
            }
            
            // Record OTP_VERIFIED transaction with proper wallet addresses
            const transaction = {
                id: Date.now().toString(),
                patientId: patient.id,
                hospitalId: hospitalId || foundSession.hospitalId,
                accessMethod: 'OTP_VERIFIED',
                timestamp: new Date().toISOString(),
                transaction: {
                    id: `otp_verified_${Date.now()}`,
                    type: 'OTP_VERIFIED',
                    fromWallet: foundSession.patientWallet,
                    toWallet: hospitalWallet || foundSession.hospitalWallet,
                    patientId: patient.id,
                    timestamp: new Date().toISOString(),
                    status: 'admin_secured'
                }
            };

            await fabricClient.recordTransaction(transaction);

            // Notify patient
            const patientPortalUrl = process.env.PATIENT_PORTAL_URL || 'http://localhost:3003';
            try {
                const response = await fetch(`${patientPortalUrl}/api/admin-approved`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: foundSession.sessionId,
                        patientWallet: foundSession.patientWallet
                    })
                });
            } catch (error) {
            }
            
            res.json({ 
                success: true, 
                sessionId: foundSession.sessionId,
                patientData: {
                    id: patient.id,
                    name: patient.name,
                    phone: patient.phone,
                    age: decryptedData.age,
                    gender: decryptedData.gender,
                    bloodType: decryptedData.bloodType,
                    allergies: decryptedData.allergies,
                    conditions: decryptedData.conditions,
                    medications: decryptedData.medications,
                    fullMedicalHistory: decryptedData.fullMedicalHistory
                },
                message: 'Admin-approved access granted'
            });
        } catch (error) {
            console.error('Admin verify OTP error:', error);
            res.status(500).json({ success: false, error: 'Admin verification failed' });
        }
    });

    // Admin securely ends session
    app.post('/api/admin-end-session', async (req, res) => {
        const { sessionId, updatedData } = req.body;
        
        console.log('\n🔒 Admin end session request:');
        console.log('   Session ID:', sessionId);
        console.log('   Has updated data:', !!updatedData);
        if (updatedData) {
            console.log('   Blood Type:', updatedData.bloodType);
            console.log('   Allergies:', updatedData.allergies);
            console.log('   Medical Records:', updatedData.fullMedicalHistory?.records?.length);
        }
        
        try {
            cleanExpiredSessions();
            let session = activeSessions.get(sessionId);
            
            if (!session) {
                console.log('⚠️  Session not found, using fallback');
                if (!updatedData?.id || !updatedData?.walletAddress) {
                    return res.status(400).json({ success: false, error: 'Session expired and no patient data provided' });
                }
                session = {
                    sessionId: sessionId,
                    patientId: updatedData.id,
                    hospitalId: process.env.DEFAULT_HOSPITAL_ID || 'hospital-001',
                    patientWallet: updatedData.walletAddress,
                    hospitalWallet: null,
                    status: 'FALLBACK'
                };
            }
            
            console.log('📊 Session info:');
            console.log('   Patient ID:', session.patientId);
            console.log('   Patient Wallet:', session.patientWallet);

            // Get patient from blockchain
            fabricClient.setUserContext({ userId: 'admin', appName: 'admin-dashboard', role: 'admin' });
            let patient;
            try {
                patient = await fabricClient.getPatient(session.patientId);
            } catch (error) {
                console.log('⚠️  Patient not found by ID, searching by wallet');
                patient = await fabricClient.getPatientByWallet(session.patientWallet);
            }
            
            if (!patient) {
                console.log('❌ Patient not found in blockchain');
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }
            
            console.log('✅ Patient found:', patient.name);
            
            if (updatedData) {
                console.log('💾 Saving updated data to blockchain...');
                const patientKey = encryptionService.generatePatientKey(session.patientWallet, session.patientId);
                const medicalData = {
                    age: updatedData.age || patient.medicalData.age,
                    gender: updatedData.gender || patient.medicalData.gender,
                    bloodType: updatedData.bloodType || patient.medicalData.bloodType,
                    allergies: updatedData.allergies || patient.medicalData.allergies,
                    conditions: updatedData.conditions || patient.medicalData.conditions,
                    medications: updatedData.medications || patient.medicalData.medications,
                    fullMedicalHistory: updatedData.fullMedicalHistory || patient.medicalData.fullMedicalHistory
                };
                
                console.log('📝 Medical data to encrypt:');
                console.log('   Age:', medicalData.age);
                console.log('   Gender:', medicalData.gender);
                console.log('   Blood Type:', medicalData.bloodType);
                console.log('   Records:', medicalData.fullMedicalHistory?.records?.length);

                const encrypted = encryptionService.encryptMedicalData(medicalData, patientKey);
                patient.medicalData = {
                    encrypted: true,
                    encryptedData: encrypted,
                    dataHash: encrypted.hash,
                    lastUpdated: new Date().toISOString()
                };
                await fabricClient.storePatient(patient);
                console.log('✅ Patient data saved to blockchain');
            }
            
            const transaction = {
                id: Date.now().toString(),
                patientId: patient.id,
                hospitalId: session.hospitalId,
                accessMethod: 'SENT_BACK',
                timestamp: new Date().toISOString(),
                transaction: {
                    id: `sent_back_${Date.now()}`,
                    type: 'SENT_BACK',
                    fromWallet: session.hospitalWallet,
                    toWallet: session.patientWallet,
                    patientId: patient.id,
                    timestamp: new Date().toISOString(),
                    status: 'completed'
                }
            };

            await fabricClient.recordTransaction(transaction);

            // Notify patient
            const patientPortalUrl = process.env.PATIENT_PORTAL_URL || 'http://localhost:3003';
            try {
                const response = await fetch(`${patientPortalUrl}/api/admin-session-end`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId,
                        patientWallet: session.patientWallet
                    })
                });
            } catch (error) {
            }
            
            // Admin ends session
            activeSessions.delete(sessionId);
            
            console.log('🎉 Session ended successfully\n');
            
            res.json({ 
                success: true, 
                message: 'Data sent back to patient and encrypted'
            });
        } catch (error) {
            console.error('❌ Admin end session error:', error);
            res.status(500).json({ success: false, error: 'Admin session end failed: ' + error.message });
        }
    });



    // Get active sessions (for debugging)
    app.get('/api/active-sessions', (req, res) => {
        cleanExpiredSessions();
        const sessions = Array.from(activeSessions.entries()).map(([id, session]) => ({
            sessionId: id,
            patientId: session.patientId,
            status: session.status,
            createdAt: new Date(session.createdAt).toISOString()
        }));
        
        res.json({ success: true, sessions });
    });

    // Record transaction endpoint
    app.post('/api/record-transaction', async (req, res) => {
        const { patientId, hospitalId, accessMethod, transaction } = req.body;

        try {
            const txRecord = {
                id: Date.now().toString(),
                patientId,
                hospitalId,
                accessMethod,
                timestamp: new Date().toISOString(),
                transaction: transaction || null
            };

            fabricClient.setUserContext({ userId: 'admin', appName: 'admin-dashboard', role: 'admin' });
            await fabricClient.recordTransaction(txRecord);

            console.log(`📝 Transaction recorded: ${accessMethod} for ${patientId}`);

            res.json({ success: true, transaction: txRecord });
        } catch (error) {
            console.error('Transaction recording error:', error);
            res.status(500).json({ success: false, error: 'Failed to record transaction' });
        }
    });

    // Log unauthorized access attempts
    app.post('/api/unauthorized-access', async (req, res) => {
        const { otp, hospitalId, patientWallet, timestamp, reason, accessType, errorDetails } = req.body;

        try {
            let patientId = 'unknown';
            let patientName = 'Unknown Patient';
            if (patientWallet) {
                try {
                    fabricClient.setUserContext({ userId: 'admin', appName: 'admin-dashboard', role: 'admin' });
                    const patient = await fabricClient.getPatientByWallet(patientWallet);
                    if (patient) {
                        patientId = patient.id;
                        patientName = patient.name;
                    }
                } catch (error) {
                    console.log('Patient not found for unauthorized access log');
                }
            }
            
            const transaction = {
                id: Date.now().toString(),
                patientId: patientId,
                hospitalId: hospitalId || (process.env.DEFAULT_HOSPITAL_ID || 'hospital-001'),
                accessMethod: 'UNAUTHORIZED_ACCESS',
                timestamp: timestamp || new Date().toISOString(),
                transaction: {
                    id: `unauthorized_${Date.now()}`,
                    type: accessType || 'UNAUTHORIZED_ACCESS',
                    fromWallet: patientWallet || 'unknown',
                    toWallet: 'system',
                    patientId: patientId,
                    patientName: patientName,
                    timestamp: timestamp || new Date().toISOString(),
                    status: 'SECURITY_BREACH_BLOCKED',
                    details: `🚨 UNAUTHORIZED ACCESS: OTP ${otp} - ${reason || 'Invalid OTP attempt'}`,
                    securityLevel: 'HIGH_ALERT',
                    attemptedOTP: otp,
                    errorDetails: errorDetails || null
                }
            };

            await fabricClient.recordTransaction(transaction);

            res.json({
                success: true,
                message: 'Unauthorized access attempt logged to transaction history',
                transactionId: transaction.id,
                securityAlert: 'HIGH_PRIORITY'
            });
        } catch (error) {
            console.error('❌ CRITICAL: Failed to log unauthorized access:', error);
            res.status(500).json({
                success: false,
                error: 'CRITICAL: Failed to log security breach to transaction history'
            });
        }
    });

};