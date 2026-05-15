require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const encryptionService = require('../shared/encryption-service');
const fabricClient = require('../shared/fabric-client');
const { requireAdmin } = require('../shared/rbac-middleware');
const app = express();
const PORT = process.env.ADMIN_DASHBOARD_PORT || 3001;

app.use(express.json());
app.use(express.static('public'));
app.use(require('cors')({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'control-center.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/control', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'control-center.html'));
});

app.get('/api/patients', async (req, res) => {
    try {
        // Set admin context
        fabricClient.setUserContext({ userId: 'admin-system', appName: 'admin-dashboard', role: 'admin' });

        // Get all patients from blockchain via Contract Runner
        const patients = await fabricClient.getAllPatients();

        // ALWAYS extract prescriptions from medical history (source of truth)
        const patientsWithPrescriptions = patients.map(patient => {
            let extractedPrescriptions = [];
            let medicalHistory = null;

            // Check if medical data is encrypted
            if (patient.medicalData && patient.medicalData.encrypted && patient.medicalData.encryptedData) {
                const encData = patient.medicalData.encryptedData;
                // Check if properly formatted encrypted data
                const isProperlyEncrypted = encData && encData.iv && encData.ciphertext && encData.authTag;

                if (isProperlyEncrypted) {
                    try {
                        const patientKey = encryptionService.generatePatientKey(patient.walletAddress, patient.id);
                        const decryptedData = encryptionService.decryptMedicalData(encData, patientKey);
                        medicalHistory = decryptedData.fullMedicalHistory;
                    } catch (decryptError) {
                        console.error(`Failed to decrypt medical data for ${patient.id}:`, decryptError.message);
                    }
                }
            } else if (patient.medicalData && patient.medicalData.fullMedicalHistory) {
                medicalHistory = patient.medicalData.fullMedicalHistory;
            }

            if (medicalHistory && medicalHistory.records) {
                extractedPrescriptions = medicalHistory.records
                    .filter(record => {
                        return record.prescription &&
                               record.prescription !== 'N/A' &&
                               record.prescription.trim() !== '';
                    })
                    .map((record, index) => {
                        const prescriptionText = record.prescription;
                        let medicationName = '';
                        let dosageInfo = '';

                        // Extract medication name and dosage
                        if (prescriptionText.includes(' - ')) {
                            const parts = prescriptionText.split(' - ');
                            medicationName = parts[0].trim();
                            dosageInfo = parts.slice(1).join(' - ').trim();
                        } else {
                            medicationName = prescriptionText.trim();
                        }

                        // Check if this prescription has a status in the existing prescriptions array
                        let status = 'PENDING'; // Default status
                        let lastUpdated = null;
                        let updatedBy = null;

                        if (patient.prescriptions && Array.isArray(patient.prescriptions)) {
                            const existingPrescription = patient.prescriptions.find(p =>
                                p.name && p.name.toLowerCase() === medicationName.toLowerCase()
                            );
                            if (existingPrescription) {
                                status = existingPrescription.status || 'PENDING';
                                lastUpdated = existingPrescription.lastUpdated;
                                updatedBy = existingPrescription.updatedBy;
                            }
                        }

                        const prescription = {
                            id: index + 1,
                            name: medicationName,
                            dosage: dosageInfo || prescriptionText,
                            status: status
                        };

                        if (lastUpdated) prescription.lastUpdated = lastUpdated;
                        if (updatedBy) prescription.updatedBy = updatedBy;

                        return prescription;
                    });
            }

            // Replace prescriptions array with extracted data from medical history
            patient.prescriptions = extractedPrescriptions;

            return patient;
        });

        res.json(patientsWithPrescriptions);
    } catch (error) {
        console.error('Error fetching patients from blockchain:', error);
        // Return empty array if blockchain not available
        res.json([]);
    }
});

app.get('/api/hospitals', async (req, res) => {
    try {
        // Set admin context
        fabricClient.setUserContext({ userId: 'admin-system', appName: 'admin-dashboard', role: 'admin' });

        const hospitals = [];
        const hospitalIdsFromTx = new Set();

        // Get all transactions to find hospital IDs
        try {
            const transactions = await fabricClient.getAllTransactions();
            transactions.forEach(tx => {
                // Find hospital IDs from transactions (exclude pharmacies)
                if (tx.hospitalId && tx.hospitalId.includes('hospital')) {
                    hospitalIdsFromTx.add(tx.hospitalId);
                }
                // Find USER_CREATED transactions for hospitals
                if (tx.transaction?.type === 'USER_CREATED' &&
                    (tx.transaction.role === 'Hospital' ||
                     tx.transaction.role === 'Hospital Staff')) {
                    hospitalIdsFromTx.add(tx.transaction.userId);
                }
            });
        } catch (err) {
            console.log('Could not get transactions:', err.message);
        }

        // Add seeded demo hospital ID
        const defaultHospitalId = process.env.DEFAULT_HOSPITAL_ID || 'hospital-001';
        const defaultHospitalName = process.env.DEFAULT_HOSPITAL_NAME || 'City General Hospital';
        hospitalIdsFromTx.add(defaultHospitalId);

        console.log('🔍 Looking for hospital IDs:', Array.from(hospitalIdsFromTx));

        // Fetch each hospital data from blockchain
        for (const hospitalId of hospitalIdsFromTx) {
            try {
                const hospital = await fabricClient.getHospital(hospitalId);
                console.log(`✅ Found hospital: ${hospital.name} (${hospitalId})`);
                hospitals.push({
                    id: hospitalId,
                    name: hospital.name,
                    walletAddress: hospital.walletAddress
                });
            } catch (err) {
                console.log(`❌ Could not fetch ${hospitalId}:`, err.message);
                if (hospitalId === defaultHospitalId) {
                    hospitals.push({ id: defaultHospitalId, name: defaultHospitalName });
                }
            }
        }

        res.json(hospitals);
    } catch (error) {
        console.error('Error fetching hospitals:', error);
        const defaultHospitalId = process.env.DEFAULT_HOSPITAL_ID || 'hospital-001';
        const defaultHospitalName = process.env.DEFAULT_HOSPITAL_NAME || 'City General Hospital';
        res.json([{ id: defaultHospitalId, name: defaultHospitalName }]);
    }
});

app.get('/api/pharmacies', async (req, res) => {
    try {
        // Set admin context
        fabricClient.setUserContext({ userId: 'admin-system', appName: 'admin-dashboard', role: 'admin' });

        const pharmacies = [];
        const pharmacyIdsFromTx = new Set();

        // Get all transactions to find pharmacy IDs
        try {
            const transactions = await fabricClient.getAllTransactions();
            transactions.forEach(tx => {
                // Find pharmacy IDs from transactions
                if (tx.hospitalId && tx.hospitalId.includes('pharmacy')) {
                    pharmacyIdsFromTx.add(tx.hospitalId);
                }
                // Find USER_CREATED transactions for pharmacies
                if (tx.transaction?.type === 'USER_CREATED' && tx.transaction.role === 'Pharmacy') {
                    pharmacyIdsFromTx.add(tx.transaction.userId);
                }
            });
        } catch (err) {
            console.log('Could not get transactions:', err.message);
        }

        console.log('🔍 Looking for pharmacy IDs:', Array.from(pharmacyIdsFromTx));

        // Fetch each pharmacy data from blockchain
        for (const pharmacyId of pharmacyIdsFromTx) {
            try {
                const pharmacy = await fabricClient.getHospital(pharmacyId);
                console.log(`✅ Found pharmacy: ${pharmacy.name} (${pharmacyId})`);
                pharmacies.push({
                    id: pharmacyId,
                    name: pharmacy.name,
                    walletAddress: pharmacy.walletAddress
                });
            } catch (err) {
                console.log(`❌ Could not fetch ${pharmacyId}:`, err.message);
            }
        }

        res.json(pharmacies);
    } catch (error) {
        console.error('Error fetching pharmacies:', error);
        res.json([]);
    }
});

app.get('/api/transactions', async (req, res) => {
    try {
        // Set admin context
        fabricClient.setUserContext({ userId: 'admin-system', appName: 'admin-dashboard', role: 'admin' });

        const transactions = await fabricClient.getAllTransactions();
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions from blockchain:', error);
        res.json([]);
    }
});

// Clear all transactions - MUST be before other transaction routes
app.delete('/api/transactions/clear', async (req, res) => {
    try {
        console.log('DELETE /api/transactions/clear called');
        // Set admin context
        fabricClient.setUserContext({ userId: 'admin-system', appName: 'admin-dashboard', role: 'admin' });

        const result = await fabricClient.clearAllTransactions();
        console.log('Transactions cleared from blockchain:', result);
        res.json({ success: true, message: 'Transaction history cleared', result });
    } catch (error) {
        console.error('Error clearing transactions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Record transaction when data is accessed
app.post('/api/transaction', async (req, res) => {
    const { patientId, hospitalId, accessMethod, transaction } = req.body;

    try {
        // Set admin context
        fabricClient.setUserContext({ userId: 'admin-system', appName: 'admin-dashboard', role: 'admin' });

        const txRecord = {
            id: Date.now().toString(),
            patientId,
            hospitalId,
            accessMethod,
            timestamp: new Date().toISOString(),
            transaction: transaction || null
        };

        await fabricClient.recordTransaction(txRecord);
        res.json({ success: true, transaction: txRecord });
    } catch (error) {
        console.error('Error recording transaction:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all users from blockchain
app.get('/api/all-users', async (req, res) => {
    try {
        // Set admin context
        fabricClient.setUserContext({ userId: 'admin-system', appName: 'admin-dashboard', role: 'admin' });

        const users = [];
        const deletedUserIds = new Set();

        // Get deleted users from transactions
        try {
            const transactions = await fabricClient.getAllTransactions();
            transactions.forEach(tx => {
                if (tx.transaction?.type === 'USER_DELETED') {
                    deletedUserIds.add(tx.transaction.userId);
                }
            });
        } catch (err) {
            console.log('Could not get transactions:', err.message);
        }

        // Get ALL patients from blockchain
        try {
            const patients = await fabricClient.getAllPatients();
            const seenPatientIds = new Set();
            
            patients.forEach(patient => {
                if (patient.id === 'patient-001' ||
                    patient.name === 'Test User' ||
                    patient.name === 'Your Profile' ||
                    deletedUserIds.has(patient.id) ||
                    seenPatientIds.has(patient.id)) {
                    return;
                }

                seenPatientIds.add(patient.id);
                users.push({
                    id: patient.id,
                    avatar: '/images/user/user-18.jpg',
                    name: patient.name,
                    email: '',
                    role: 'Patient',
                    linkedEntity: patient.name,
                    status: 'Active',
                    created: new Date(patient.medicalData?.lastUpdated || Date.now()).toISOString().split('T')[0]
                });
            });
            
            console.log(`👥 Found ${users.length} patients`);
        } catch (err) {
            console.error('Error fetching patients:', err.message);
        }

        // Get ALL hospitals and pharmacies from blockchain
        try {
            const allHospitals = await fabricClient.getAllHospitals();
            console.log(`🏭 Found ${allHospitals.length} hospitals/pharmacies in blockchain`);
            
            allHospitals.forEach(entity => {
                if (deletedUserIds.has(entity.id)) {
                    console.log(`⏭️ Skipping deleted: ${entity.id}`);
                    return;
                }
                
                const isPharmacy = entity.id.includes('pharmacy') || entity.type === 'pharmacy';
                console.log(`✅ Adding ${isPharmacy ? 'pharmacy' : 'hospital'}: ${entity.name} (${entity.id})`);
                
                users.push({
                    id: entity.id,
                    avatar: isPharmacy ? '/images/user/user-20.jpg' : '/images/user/user-19.jpg',
                    name: entity.name,
                    email: '',
                    role: isPharmacy ? 'Pharmacy' : 'Hospital',
                    linkedEntity: entity.name,
                    status: 'Active',
                    created: new Date().toISOString().split('T')[0]
                });
            });
        } catch (err) {
            console.error('Error fetching hospitals/pharmacies:', err.message);
        }

        console.log(`👥 Total users found: ${users.length}`);
        res.json({ success: true, users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.json({ success: true, users: [] });
    }
});

// Unified login endpoint for all user types
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password required' });
        }

        // Set admin context
        fabricClient.setUserContext({ userId: 'system', appName: 'admin-dashboard', role: 'admin' });

        // Verify credentials in blockchain
        const userId = await fabricClient.verifyCredentials(username, password);

        if (!userId || userId === null || userId === 'null') {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Get user role and name from transactions or blockchain data
        let userRole = 'Patient'; // Default
        let userName = username;
        let walletAddress = null;

        // Determine role from userId pattern first
        if (userId && userId.includes('patient')) {
            userRole = 'Patient';
        } else if (userId && userId.includes('pharmacy')) {
            userRole = 'Pharmacy';
        } else if (userId && userId.includes('hospital')) {
            userRole = 'Hospital';
        }

        try {
            const transactions = await fabricClient.getAllTransactions();
            const userCreatedTx = transactions.find(tx =>
                tx.transaction?.type === 'USER_CREATED' &&
                tx.transaction.userId === userId
            );

            if (userCreatedTx) {
                userRole = userCreatedTx.transaction.role;
                userName = userCreatedTx.transaction.name || username;
            } else {
                // Try to get user data from blockchain
                try {
                    if (userId.includes('patient')) {
                        const patient = await fabricClient.getPatient(userId);
                        if (patient) {
                            userName = patient.name || username;
                            walletAddress = patient.walletAddress;
                        }
                    } else if (userId.includes('hospital') || userId.includes('pharmacy')) {
                        const hospital = await fabricClient.getHospital(userId);
                        if (hospital) {
                            userName = hospital.name || username;
                            walletAddress = hospital.walletAddress;
                        }
                    }
                } catch (dataErr) {
                    console.log('Could not fetch user data from blockchain:', dataErr.message);
                }
            }
        } catch (err) {
            console.log('Could not determine user role:', err.message);
        }

        // Generate JWT token based on role
        const jwt = require('jsonwebtoken');
        let jwtSecret;
        let redirectUrl;
        
        if (userRole === 'Patient') {
            jwtSecret = process.env.JWT_SECRET_PATIENT;
            redirectUrl = process.env.PATIENT_PORTAL_URL || 'http://localhost:3003';
        } else if (userRole === 'Hospital' || userRole === 'Hospital Staff') {
            jwtSecret = process.env.JWT_SECRET_HOSPITAL;
            redirectUrl = process.env.HOSPITAL_PORTAL_URL || 'http://localhost:3005';
        } else if (userRole === 'Pharmacy') {
            jwtSecret = process.env.JWT_SECRET_PHARMACY;
            redirectUrl = process.env.PHARMACY_PORTAL_URL || 'http://localhost:3006';
        } else {
            return res.status(403).json({ success: false, error: 'Unknown user role' });
        }

        const token = jwt.sign({ userId, username, role: userRole.toLowerCase() }, jwtSecret, { expiresIn: '24h' });

        // Record login transaction
        try {
            await fabricClient.recordTransaction({
                id: `login_${Date.now()}`,
                patientId: userId,
                hospitalId: 'system',
                accessMethod: 'LOGIN',
                timestamp: new Date().toISOString(),
                transaction: {
                    type: 'LOGIN',
                    userId: userId,
                    role: userRole
                }
            });
        } catch (txErr) {
            // Non-critical
        }

        res.json({
            success: true,
            token,
            user: {
                id: userId,
                username,
                name: userName,
                role: userRole.toLowerCase(),
                walletAddress: walletAddress
            },
            redirectUrl
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ success: false, error: 'Invalid username or password' });
    }
});

// Delete (hide) user from display
app.post('/api/delete-user', async (req, res) => {
    const { userId } = req.body;

    try {
        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID is required' });
        }

        // Set admin context
        fabricClient.setUserContext({ userId: 'admin-system', appName: 'admin-dashboard', role: 'admin' });

        // Record deletion in transaction history (blockchain is immutable, so we mark as deleted)
        await fabricClient.recordTransaction({
            id: `user-deleted-${userId}-${Date.now()}`,
            patientId: userId,
            hospitalId: 'system',
            accessMethod: 'USER_DELETED',
            timestamp: new Date().toISOString(),
            transaction: {
                type: 'USER_DELETED',
                userId: userId,
                deletedAt: new Date().toISOString()
            }
        });
        
        // Also delete the actual entity from blockchain
        try {
            if (userId.includes('patient')) {
                await fabricClient.deletePatient(userId);
                console.log(`🗑️ Patient entity deleted: ${userId}`);
            } else if (userId.includes('hospital') || userId.includes('pharmacy')) {
                await fabricClient.deleteHospital(userId);
                console.log(`🗑️ Hospital/Pharmacy entity deleted: ${userId}`);
            }
        } catch (deleteErr) {
            console.log(`⚠️ Could not delete entity (may not exist): ${userId}`);
        }
        
        // Delete credentials
        try {
            await fabricClient.deleteCredentials(userId);
            console.log(`🗑️ Credentials deleted: ${userId}`);
        } catch (credErr) {
            console.log(`⚠️ Could not delete credentials: ${userId}`);
        }

        console.log(`🗑️ User marked as deleted: ${userId}`);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to delete user' });
    }
});

// Create new user with blockchain credentials and wallet
app.post('/api/create-user', async (req, res) => {
    const { username, name, password, role } = req.body;

    try {
        if (!username || !name || !password || !role) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        // Set admin context
        fabricClient.setUserContext({ userId: 'admin-system', appName: 'admin-dashboard', role: 'admin' });

        // Generate unique patient/user ID
        const userId = `${role.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

        // Generate wallet address
        const walletAddress = generateWalletAddress(userId);

        // Hash password with bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        // Store credentials in blockchain
        await fabricClient.storeCredentials({
            username,
            hashedPassword,
            userId,
            role
        });

        // Store a registry entry for easy lookup
        try {
            await fabricClient.recordTransaction({
                id: `user-registry-${userId}`,
                patientId: userId,
                hospitalId: 'system',
                accessMethod: 'USER_CREATED',
                timestamp: new Date().toISOString(),
                transaction: {
                    type: 'USER_CREATED',
                    userId: userId,
                    username: username,
                    role: role,
                    name: name
                }
            });
        } catch (err) {
            console.log('Could not create registry entry:', err.message);
        }

        // Create patient/user data based on role
        if (role === 'Patient') {
            const patientKey = encryptionService.generatePatientKey(walletAddress, userId);
            const medicalData = {
                bloodType: '',
                allergies: [],
                conditions: [],
                medications: [],
                fullMedicalHistory: { records: [], lastUpdated: new Date().toISOString().split('T')[0] }
            };

            const encrypted = encryptionService.encryptMedicalData(medicalData, patientKey);

            const patientData = {
                id: userId,
                name: name,
                age: 0,
                walletAddress: walletAddress,
                phone: '',
                faceIdEnabled: false,
                medicalData: {
                    encrypted: true,
                    encryptedData: encrypted
                }
            };
            await fabricClient.storePatient(patientData);
        } else if (role === 'Hospital' || role === 'Hospital Staff') {
            const hospitalData = {
                id: userId,
                name: name,
                walletAddress: walletAddress,
                location: process.env.DEFAULT_HOSPITAL_LOCATION || 'City Center',
                specialization: 'General',
                contactEmail: `${username}@hospital.com`,
                contactPhone: '+1234567890'
            };
            await fabricClient.storeHospital(hospitalData);
        } else if (role === 'Pharmacy') {
            const pharmacyData = {
                id: userId,
                name: name,
                walletAddress: walletAddress,
                location: 'City Center',
                specialization: 'Pharmacy',
                contactEmail: `${username}@pharmacy.com`,
                contactPhone: '+1234567890',
                type: 'pharmacy'
            };
            await fabricClient.storeHospital(pharmacyData);
        }

        console.log(`✅ User created: ${username} (${role}) - Wallet: ${walletAddress}`);

        res.json({
            success: true,
            message: 'User created successfully',
            userId: userId,
            walletAddress: walletAddress,
            role: role
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to create user' });
    }
});

// Helper function to parse dosage and calculate total tablets needed
const calculateTotalQuantity = (dosage) => {
    try {
        // Parse dosage string like "2 tablets, 2 times daily • 15 days supply"
        const match = dosage.match(/(\d+)\s*tablets?,\s*(\d+)\s*times?\s*daily\s*•\s*(\d+)\s*days?\s*supply/i);
        
        if (match) {
            const tabletsPerDose = parseInt(match[1]);
            const timesPerDay = parseInt(match[2]);
            const daysSupply = parseInt(match[3]);
            const total = tabletsPerDose * timesPerDay * daysSupply;
            
            console.log(`📊 Dosage calculation: ${tabletsPerDose} tablets × ${timesPerDay} times/day × ${daysSupply} days = ${total} tablets`);
            return total;
        }
        
        console.log('⚠️ Could not parse dosage string:', dosage);
        return 0;
    } catch (error) {
        console.error('Error calculating quantity:', error);
        return 0;
    }
};

// Helper function to update pharmacy inventory
const updatePharmacyInventory = async (medicationName, quantityToDeduct, pharmacyId) => {
    const defaultPharmacyId = process.env.DEFAULT_PHARMACY_ID || 'pharmacy-001';
    const effectivePharmacyId = pharmacyId || defaultPharmacyId;

    try {
        console.log(`📦 Updating inventory: ${medicationName} - deducting ${quantityToDeduct} tablets`);

        // Call pharmacy server internal endpoint (no auth required)
        const pharmacyPortalUrl = process.env.PHARMACY_PORTAL_URL || 'http://localhost:3006';
        const response = await fetch(`${pharmacyPortalUrl}/api/pharmacy/inventory/deduct-internal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pharmacyId: effectivePharmacyId,
                medicationName: medicationName,
                quantity: quantityToDeduct
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log(`✅ Inventory updated: ${medicationName} - ${result.newQuantity} remaining`);
            return result;
        } else {
            const error = await response.json();
            console.error('❌ Failed to update inventory:', error);
            return null;
        }
    } catch (error) {
        console.error('❌ Error updating inventory:', error);
        return null;
    }
};

// Update patient prescription status in blockchain
app.post('/api/update-patient-prescription', async (req, res) => {
    const { patientId, prescriptionId, medicationName, dosage, newStatus, pharmacyId, pharmacyName, timestamp } = req.body;

    try {
        // Set admin context
        fabricClient.setUserContext({ userId: 'admin-system', appName: 'admin-dashboard', role: 'admin' });

        // Get current patient data
        const patientData = await fabricClient.getPatient(patientId);

        if (!patientData) {
            return res.status(404).json({ success: false, error: 'Patient not found' });
        }

        // Initialize prescriptions array if it doesn't exist OR is empty - extract from medical history
        if (!patientData.prescriptions || patientData.prescriptions.length === 0) {
            console.log('⚠️ Prescriptions field is missing or empty, extracting from medical history...');

            // Try to extract prescriptions from medical history
            let extractedPrescriptions = [];
            let medicalHistory = null;

            // Check if medical data is encrypted
            if (patientData.medicalData && patientData.medicalData.encrypted && patientData.medicalData.encryptedData) {
                console.log('🔐 Medical data is encrypted, decrypting...');
                const encData = patientData.medicalData.encryptedData;
                // Check if properly formatted encrypted data
                const isProperlyEncrypted = encData && encData.iv && encData.ciphertext && encData.authTag;

                if (isProperlyEncrypted) {
                    try {
                        const patientKey = encryptionService.generatePatientKey(patientData.walletAddress, patientData.id);
                        const decryptedData = encryptionService.decryptMedicalData(encData, patientKey);
                        medicalHistory = decryptedData.fullMedicalHistory;
                        console.log('✅ Medical data decrypted successfully');
                    } catch (decryptError) {
                        console.error('❌ Failed to decrypt medical data:', decryptError.message);
                    }
                } else {
                    console.warn('⚠️ Encrypted data format is incomplete, using unencrypted fallback');
                }
            } else if (patientData.medicalData && patientData.medicalData.fullMedicalHistory) {
                // Medical data is not encrypted
                medicalHistory = patientData.medicalData.fullMedicalHistory;
            }

            if (medicalHistory && medicalHistory.records) {
                console.log(`📋 Found ${medicalHistory.records.length} medical records`);

                extractedPrescriptions = medicalHistory.records
                    .filter(record => {
                        const hasPrescription = record.prescription &&
                                              record.prescription !== 'N/A' &&
                                              record.prescription.trim() !== '';
                        if (hasPrescription) {
                            console.log(`  ✅ Record has prescription: ${record.prescription}`);
                        }
                        return hasPrescription;
                    })
                    .map((record, index) => {
                        const prescriptionText = record.prescription;
                        let medicationName = '';
                        let dosageInfo = '';

                        // Extract medication name and dosage
                        if (prescriptionText.includes(' - ')) {
                            const parts = prescriptionText.split(' - ');
                            medicationName = parts[0].trim();
                            dosageInfo = parts.slice(1).join(' - ').trim();
                        } else {
                            medicationName = prescriptionText.trim();
                        }

                        return {
                            id: index + 1,
                            name: medicationName,
                            dosage: dosageInfo || prescriptionText,
                            status: 'PENDING'
                        };
                    });
            }

            if (extractedPrescriptions.length > 0) {
                console.log(`✅ Extracted ${extractedPrescriptions.length} prescriptions from medical history:`);
                extractedPrescriptions.forEach(p => console.log(`   - ${p.name}: ${p.dosage}`));
                patientData.prescriptions = extractedPrescriptions;
            } else {
                console.log('⚠️ No prescriptions found in medical history, initializing empty array');
                patientData.prescriptions = [];
            }

            // Save the initialized prescriptions to blockchain
            await fabricClient.storePatient(patientData);
        }

        // Update the specific prescription status
        const prescriptionIndex = patientData.prescriptions.findIndex(p => p.id === prescriptionId);
        if (prescriptionIndex !== -1) {
            const oldStatus = patientData.prescriptions[prescriptionIndex].status;
            patientData.prescriptions[prescriptionIndex].status = newStatus;
            patientData.prescriptions[prescriptionIndex].lastUpdated = timestamp;
            patientData.prescriptions[prescriptionIndex].updatedBy = pharmacyName;

            console.log(`✅ Updated prescription at index ${prescriptionIndex}:`);
            console.log(`   Old status: ${oldStatus} → New status: ${newStatus}`);

            // If status changed to DISPENSED, deduct from inventory
            if (newStatus === 'DISPENSED' && oldStatus !== 'DISPENSED') {
                const totalQuantity = calculateTotalQuantity(dosage);

                if (totalQuantity > 0) {
                    console.log(`📊 Medication dispensed: ${medicationName} - ${totalQuantity} tablets needed`);

                    // Update pharmacy inventory
                    const inventoryResult = await updatePharmacyInventory(medicationName, totalQuantity, pharmacyId);

                    if (inventoryResult) {
                        console.log(`✅ Inventory deducted: ${medicationName} - ${inventoryResult.newQuantity} remaining`);
                    } else {
                        console.warn('⚠️ Inventory update failed, but prescription status will still be updated');
                    }
                } else {
                    console.warn('⚠️ Could not calculate quantity from dosage, inventory not updated');
                }
            }

            // If status changed from DISPENSED back to PENDING, add back to inventory
            if (newStatus === 'PENDING' && oldStatus === 'DISPENSED') {
                const totalQuantity = calculateTotalQuantity(dosage);

                if (totalQuantity > 0) {
                    console.log(`🔄 Medication returned: ${medicationName} - adding ${totalQuantity} tablets back`);

                    // Add back to inventory (negative deduction)
                    const inventoryResult = await updatePharmacyInventory(medicationName, -totalQuantity, pharmacyId);

                    if (inventoryResult) {
                        console.log(`✅ Inventory restored: ${medicationName} - ${inventoryResult.newQuantity} remaining`);
                    }
                }
            }

            console.log(`💾 Saving updated prescriptions to blockchain...`);

            // Save updated patient data back to blockchain FIRST
            await fabricClient.storePatient(patientData);
            console.log(`✅ Patient prescription updated in blockchain: ${patientId} - ${medicationName} → ${newStatus}`);

            // Record the prescription status change transaction for analytics
            const defaultPharmacyId = process.env.DEFAULT_PHARMACY_ID || 'pharmacy-001';
            const effectivePharmacyId = pharmacyId || defaultPharmacyId;
            
            // Get pharmacy wallet address from blockchain
            let pharmacyWalletAddress = null;
            try {
                const pharmacyData = await fabricClient.getHospital(effectivePharmacyId);
                if (pharmacyData && pharmacyData.walletAddress) {
                    pharmacyWalletAddress = pharmacyData.walletAddress;
                }
            } catch (err) {
                console.warn(`⚠️ Could not fetch pharmacy wallet for ${effectivePharmacyId}`);
            }
            
            if (!pharmacyWalletAddress) {
                console.error('❌ Pharmacy wallet address not found, cannot record transaction');
                return res.status(400).json({ success: false, error: 'Pharmacy wallet address not found' });
            }
            
            const statusChangeTransaction = {
                id: `prescription_status_${prescriptionId}_${Date.now()}`,
                patientId: patientId,
                hospitalId: effectivePharmacyId,
                accessMethod: 'PRESCRIPTION_STATUS_UPDATE',
                timestamp: new Date().toISOString(),
                transaction: {
                    type: 'PRESCRIPTION_STATUS_UPDATE',
                    id: `prescription_${prescriptionId}_${Date.now()}`,
                    fromWallet: pharmacyWalletAddress,
                    toWallet: patientData.walletAddress,
                    details: `${medicationName} status changed from ${oldStatus} to ${newStatus}`,
                    medicationName: medicationName,
                    dosage: dosage,
                    oldStatus: oldStatus,
                    newStatus: newStatus,
                    pharmacyName: pharmacyName
                }
            };

            // Record the status change transaction
            try {
                await fabricClient.recordTransaction(statusChangeTransaction);
                console.log(`📝 Status change transaction recorded: ${medicationName} ${oldStatus} → ${newStatus}`);
            } catch (txError) {
                console.error('⚠️ Failed to record transaction (patient data already updated):', txError.message);
            }
        } else {
            console.error(`❌ Prescription not found! ID: ${prescriptionId}, Name: ${medicationName}`);
            console.error(`📋 Available prescriptions:`, JSON.stringify(patientData.prescriptions, null, 2));
        }

        console.log(`✅ Patient prescription updated in blockchain: ${patientId} - ${medicationName} → ${newStatus}`);

        res.json({
            success: true,
            message: 'Patient prescription status updated in blockchain',
            updatedPrescription: patientData.prescriptions[prescriptionIndex]
        });
    } catch (error) {
        console.error('Error updating patient prescription:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get ngrok tunnel URL from monitor service
app.get('/api/ngrok-url', async (req, res) => {
    try {
        // Try to get from ngrok monitor service first
        try {
            const ngrokApiUrl = process.env.NGROK_API_URL || 'http://localhost:4040';
            const monitorResponse = await fetch(`${ngrokApiUrl}/api/ngrok-url`);
            const monitorData = await monitorResponse.json();
            
            if (monitorData.success && monitorData.url) {
                return res.json({
                    success: true,
                    url: monitorData.url,
                    source: 'monitor-service',
                    lastUpdated: monitorData.lastUpdated
                });
            }
        } catch (monitorError) {
            console.log('Monitor service not available, trying direct ngrok API...');
        }
        
        // Try direct ngrok API
        try {
            const ngrokResponse = await fetch('http://localhost:4040/api/tunnels');
            const data = await ngrokResponse.json();
            const httpsTunnel = data.tunnels.find(tunnel => 
                tunnel.proto === 'https'
            );
            
            if (httpsTunnel) {
                return res.json({ 
                    success: true, 
                    url: httpsTunnel.public_url,
                    source: 'ngrok-api-direct'
                });
            }
        } catch (apiError) {
            console.log('Direct ngrok API failed, using fallback...');
        }
        
        // No tunnel available
        res.json({ success: false, error: 'Tunnel not available' });
        
    } catch (error) {
        console.error('Error getting ngrok URL:', error);
        res.json({ success: false, error: 'Tunnel not available' });
    }
});

// Handle hospital ending session - receives updated patient data and saves to blockchain
app.post('/api/admin-end-session', async (req, res) => {
    const { sessionId, updatedData } = req.body;

    try {
        if (!updatedData || !updatedData.id) {
            return res.status(400).json({ success: false, error: 'Missing patient ID in updated data' });
        }

        const patientId = updatedData.id;

        // Set admin context
        fabricClient.setUserContext({
            userId: 'admin-system',
            appName: 'admin-dashboard',
            role: 'admin'
        });

        // Get current patient data from blockchain
        const currentPatient = await fabricClient.getPatient(patientId);
        if (!currentPatient) {
            return res.status(404).json({ success: false, error: 'Patient not found on blockchain' });
        }

        // Prepare medical data for re-encryption
        const medicalDataToEncrypt = {
            age: updatedData.age !== undefined ? updatedData.age : currentPatient.age,
            bloodType: updatedData.bloodType || currentPatient.bloodType || 'Unknown',
            allergies: updatedData.allergies || currentPatient.allergies || [],
            conditions: updatedData.conditions || currentPatient.conditions || [],
            medications: updatedData.medications || currentPatient.medications || [],
            fullMedicalHistory: updatedData.fullMedicalHistory || currentPatient.fullMedicalHistory || { records: [], lastUpdated: new Date().toISOString() },
            gender: updatedData.gender || currentPatient.gender
        };

        // Re-encrypt the medical data with the patient's key
        const patientKey = encryptionService.generatePatientKey(currentPatient.walletAddress, patientId);
        const encryptedData = encryptionService.encryptMedicalData(medicalDataToEncrypt, patientKey);

        // Prepare the complete patient record for blockchain
        const patientDataToSave = {
            id: patientId,
            name: updatedData.name || currentPatient.name,
            age: updatedData.age !== undefined ? updatedData.age : currentPatient.age,
            phone: updatedData.phone || currentPatient.phone,
            walletAddress: currentPatient.walletAddress,
            faceIdEnabled: currentPatient.faceIdEnabled || false,
            gender: updatedData.gender || currentPatient.gender,
            medicalData: {
                encrypted: true,
                encryptedData: encryptedData
            }
        };

        // Save updated patient data to blockchain
        await fabricClient.storePatient(patientDataToSave);

        console.log(`✅ Patient data updated on blockchain: ${patientId}`);
        console.log(`   - Age: ${medicalDataToEncrypt.age}`);
        console.log(`   - Gender: ${medicalDataToEncrypt.gender}`);
        console.log(`   - Medical data re-encrypted and saved`);

        // Record the update transaction
        try {
            await fabricClient.recordTransaction({
                id: `update_${Date.now()}`,
                patientId: patientId,
                type: 'patient-data-update',
                status: 'UPDATE_SUCCESS',
                timestamp: new Date().toISOString(),
                transaction: {
                    type: 'PATIENT_DATA_UPDATE',
                    updatedFields: ['age', 'gender', 'medical_history']
                }
            });
        } catch (txError) {
            console.warn('Could not record update transaction:', txError.message);
        }

        res.json({
            success: true,
            message: 'Patient data updated and encrypted on blockchain',
            patientId: patientId
        });

    } catch (error) {
        console.error('Admin end session error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save patient data: ' + error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🏥 Admin Dashboard: http://localhost:${PORT}`);
    console.log('Routes registered:');
    console.log('- GET /api/patients');
    console.log('- GET /api/hospitals');
    console.log('- GET /api/transactions');
    console.log('- DELETE /api/transactions/clear');
    console.log('- POST /api/transaction');
    console.log('- POST /api/create-user');
    console.log('- POST /api/update-patient-prescription');
    console.log('- POST /api/admin-end-session');
    console.log('🔐 Encryption: AES-256-GCM enabled');
    console.log('🔗 Blockchain: Data integrity verification');
});

// Keep server alive to prevent process exit
setInterval(() => {}, 1000);

/**
 * Generate a random wallet address
 * @param {string} userId - User ID
 * @returns {string} Wallet address
 */
function generateWalletAddress(userId) {
    const crypto = require('crypto');
    const randomBytes = crypto.randomBytes(19).toString('hex');
    return `0xFAB${randomBytes}`;
}

// Initialize default admin credentials
async function initializeDefaultAdminCredentials() {
    const adminCredentials = [
        { username: 'admin', password: 'admin123', name: 'Admin User', userId: 'admin-001' }
    ];

    for (const cred of adminCredentials) {
        try {
            const hashedPassword = await bcrypt.hash(cred.password, 10);

            fabricClient.setUserContext({ userId: 'admin-system', appName: 'admin-dashboard', role: 'admin' });
            
            // Store admin credentials
            await fabricClient.storeCredentials({
                username: cred.username,
                hashedPassword,
                userId: cred.userId,
                role: 'admin'
            });

            console.log(`✅ Default admin initialized: ${cred.username}`);
        } catch (error) {
            console.log(`ℹ️  Admin may already exist: ${cred.username}`);
        }
    }
}

// Load secure endpoints
require('./secure-endpoints')(app);