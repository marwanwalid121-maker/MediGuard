require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fabricService = require('../shared/fabric-service');
const fabricClient = require('../shared/fabric-client');
const { requirePharmacy, requireRole } = require('../shared/rbac-middleware');

const app = express();
const PORT = process.env.PORT || 3006;

const JWT_SECRET = process.env.JWT_SECRET_PHARMACY;
if (!JWT_SECRET) throw new Error('JWT_SECRET_PHARMACY is required in .env file');

app.use(cors());
app.use(express.json());

// Pharmacy login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        fabricClient.setUserContext({ userId: 'pharmacy-system', appName: 'pharmacy-portal', role: 'pharmacy' });

        let pharmacyId;

        try {
            pharmacyId = await fabricClient.verifyCredentials(username, password);
        } catch (fabricError) {
            console.log('⚠️  Fabric unavailable');
        }

        if (!pharmacyId) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Get pharmacy data from blockchain to get actual name and wallet
        let pharmacyName = username;
        let pharmacyWallet = null;
        
        try {
            const pharmacyData = await fabricClient.getHospital(pharmacyId);
            if (pharmacyData) {
                pharmacyName = pharmacyData.name || username;
                pharmacyWallet = pharmacyData.walletAddress;
            }
        } catch (err) {
            console.log('⚠️  Could not fetch pharmacy data from blockchain:', err.message);
        }

        const token = jwt.sign({
            id: pharmacyId,
            pharmacyId,
            username,
            role: 'pharmacy'
        }, JWT_SECRET, { expiresIn: '24h' });

        console.log(`✅ Pharmacy login successful: ${pharmacyName} (${pharmacyId})`);

        res.json({
            success: true,
            token,
            user: {
                id: pharmacyId,
                name: pharmacyName,
                role: 'pharmacy',
                walletAddress: pharmacyWallet
            },
            patient: {
                id: pharmacyId,
                name: pharmacyName,
                walletAddress: pharmacyWallet || '0x0000000000000000000000000000000000000000'
            }
        });
    } catch (error) {
        console.error('Pharmacy login error:', error);
        res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
});

// Store pharmacy inventory
app.post('/api/pharmacy/inventory', requireRole(['pharmacy', 'admin']), async (req, res) => {
    try {
        const { pharmacyId, inventory } = req.body;
        
        global.pharmacyInventory = {
            pharmacyId,
            inventory,
            timestamp: new Date().toISOString()
        };
        
        res.json({ success: true, message: 'Inventory stored successfully (in-memory)', result: global.pharmacyInventory });
    } catch (error) {
        console.error('Error storing inventory:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Public endpoint - Get pharmacy inventory (read-only, no auth required)
app.get('/api/pharmacy/inventory-public/:pharmacyId', async (req, res) => {
    try {
        const { pharmacyId } = req.params;
        const inventory = global.pharmacyInventory || { pharmacyId, inventory: [] };
        res.json({ success: true, inventory: inventory.inventory || [] });
    } catch (error) {
        console.error('Error getting inventory:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get pharmacy inventory (with auth)
app.get('/api/pharmacy/inventory/:pharmacyId', requireRole(['pharmacy', 'admin', 'hospital']), async (req, res) => {
    try {
        const { pharmacyId } = req.params;
        const inventory = global.pharmacyInventory || { pharmacyId, inventory: [] };
        res.json({ success: true, inventory: inventory.inventory || [] });
    } catch (error) {
        console.error('Error getting inventory:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update medication quantity
app.put('/api/pharmacy/inventory/update', requireRole(['pharmacy', 'admin']), async (req, res) => {
    try {
        const { pharmacyId, medicationId, quantity } = req.body;
        
        if (!global.pharmacyInventory) {
            return res.status(404).json({ success: false, error: 'Inventory not found' });
        }
        
        const medicationIndex = global.pharmacyInventory.inventory.findIndex(med => med.id === medicationId);
        
        if (medicationIndex === -1) {
            return res.status(404).json({ success: false, error: `Medication ${medicationId} not found` });
        }
        
        global.pharmacyInventory.inventory[medicationIndex].quantity = quantity;
        global.pharmacyInventory.timestamp = new Date().toISOString();
        
        res.json({ success: true, message: 'Quantity updated successfully (in-memory)', result: global.pharmacyInventory });
    } catch (error) {
        console.error('Error updating quantity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Deduct medication quantity (for dispensing)
app.post('/api/pharmacy/inventory/deduct', requireRole(['pharmacy', 'admin']), async (req, res) => {
    try {
        const { pharmacyId, medicationName, quantity } = req.body;
        
        console.log(`📦 Deduction request: ${medicationName} - ${quantity} tablets`);
        
        if (!global.pharmacyInventory) {
            return res.status(404).json({ success: false, error: 'Inventory not found' });
        }
        
        const medicationIndex = global.pharmacyInventory.inventory.findIndex(
            med => med.medication.toLowerCase() === medicationName.toLowerCase()
        );
        
        if (medicationIndex === -1) {
            console.warn(`⚠️ Medication not found in inventory: ${medicationName}`);
            return res.status(404).json({ 
                success: false, 
                error: `Medication "${medicationName}" not found in inventory` 
            });
        }
        
        const medication = global.pharmacyInventory.inventory[medicationIndex];
        const oldQuantity = medication.quantity;
        const newQuantity = oldQuantity - quantity;
        
        if (newQuantity < 0 && quantity > 0) {
            console.warn(`⚠️ Insufficient stock: ${medicationName} - Available: ${oldQuantity}, Requested: ${quantity}`);
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient stock. Available: ${oldQuantity}, Requested: ${quantity}`,
                availableQuantity: oldQuantity
            });
        }
        
        global.pharmacyInventory.inventory[medicationIndex].quantity = newQuantity;
        global.pharmacyInventory.timestamp = new Date().toISOString();
        
        console.log(`✅ Inventory updated: ${medicationName} - ${oldQuantity} → ${newQuantity} (${quantity > 0 ? '-' : '+'}${Math.abs(quantity)} tablets)`);
        
        res.json({ 
            success: true, 
            message: `Inventory updated: ${medicationName}`,
            medicationName: medicationName,
            oldQuantity: oldQuantity,
            newQuantity: newQuantity,
            deducted: quantity
        });
    } catch (error) {
        console.error('Error deducting quantity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Internal endpoint for admin server to deduct inventory (no auth required)
app.post('/api/pharmacy/inventory/deduct-internal', async (req, res) => {
    try {
        const { pharmacyId, medicationName, quantity } = req.body;
        
        console.log(`📦 Internal deduction request: ${medicationName} - ${quantity} tablets`);
        
        if (!global.pharmacyInventory) {
            return res.status(404).json({ success: false, error: 'Inventory not found' });
        }
        
        const medicationIndex = global.pharmacyInventory.inventory.findIndex(
            med => med.medication.toLowerCase() === medicationName.toLowerCase()
        );
        
        if (medicationIndex === -1) {
            console.warn(`⚠️ Medication not found in inventory: ${medicationName}`);
            return res.status(404).json({ 
                success: false, 
                error: `Medication "${medicationName}" not found in inventory` 
            });
        }
        
        const medication = global.pharmacyInventory.inventory[medicationIndex];
        const oldQuantity = medication.quantity;
        const newQuantity = oldQuantity - quantity;
        
        if (newQuantity < 0 && quantity > 0) {
            console.warn(`⚠️ Insufficient stock: ${medicationName} - Available: ${oldQuantity}, Requested: ${quantity}`);
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient stock. Available: ${oldQuantity}, Requested: ${quantity}`,
                availableQuantity: oldQuantity
            });
        }
        
        global.pharmacyInventory.inventory[medicationIndex].quantity = newQuantity;
        global.pharmacyInventory.timestamp = new Date().toISOString();
        
        console.log(`✅ Inventory updated (internal): ${medicationName} - ${oldQuantity} → ${newQuantity} (${quantity > 0 ? '-' : '+'}${Math.abs(quantity)} tablets)`);
        
        res.json({ 
            success: true, 
            message: `Inventory updated: ${medicationName}`,
            medicationName: medicationName,
            oldQuantity: oldQuantity,
            newQuantity: newQuantity,
            deducted: quantity
        });
    } catch (error) {
        console.error('Error deducting quantity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update medication status (PENDING → DISPENSED)
app.post('/api/pharmacy/update-status', requireRole(['pharmacy', 'admin']), async (req, res) => {
    try {
        const { transactionId, newStatus, patientId, patientName, pharmacyId, pharmacyName, pharmacyWallet, medication, dosage, supply, toWallet } = req.body;
        
        const statusUpdateTransaction = {
            id: `status_update_${Date.now()}`,
            originalTransactionId: transactionId,
            patientId: patientId,
            patientName: patientName,
            hospitalId: pharmacyId,
            pharmacyId: pharmacyId,
            pharmacyName: pharmacyName,
            pharmacyWallet: pharmacyWallet,
            status: newStatus,
            medication: medication,
            dosage: dosage,
            supply: supply,
            type: 'STATUS_UPDATE',
            timestamp: new Date().toISOString(),
            transaction: {
                type: 'MEDICATION_STATUS_UPDATE',
                id: `status_update_${Date.now()}`,
                fromWallet: pharmacyWallet,
                toWallet: toWallet,
                details: `Status updated to ${newStatus}`,
                pharmacyName: pharmacyName
            }
        };
        
        const result = await fabricClient.recordTransaction(statusUpdateTransaction);
        res.json({ success: true, message: `Status updated to ${newStatus}`, result });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send back to patient (records final transaction)
app.post('/api/pharmacy/send-back', requireRole(['pharmacy', 'admin']), async (req, res) => {
    try {
        const { transactionId, patientId, patientName, pharmacyId, pharmacyName, pharmacyWallet, medication, dosage, supply, toWallet } = req.body;
        
        const sendBackTransaction = {
            id: `sendback_${Date.now()}`,
            originalTransactionId: transactionId,
            patientId: patientId,
            patientName: patientName,
            hospitalId: pharmacyId,
            pharmacyId: pharmacyId,
            pharmacyName: pharmacyName,
            pharmacyWallet: pharmacyWallet,
            status: 'COMPLETED',
            medication: medication,
            dosage: dosage,
            supply: supply,
            type: 'SEND_BACK',
            timestamp: new Date().toISOString(),
            transaction: {
                type: 'MEDICATION_COMPLETED',
                id: `sendback_${Date.now()}`,
                fromWallet: pharmacyWallet,
                toWallet: toWallet,
                details: 'All medications processed and sent back',
                pharmacyName: pharmacyName
            }
        };
        
        const result = await fabricClient.recordTransaction(sendBackTransaction);
        res.json({ success: true, message: 'Medication completed and sent back to patient', result });
    } catch (error) {
        console.error('Error sending back:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Static file serving after API routes
app.use(express.static(path.join(__dirname, 'public')));

// Initialize default inventory
async function initializeDefaultInventory() {
    try {
        const defaultInventory = [
            {
                id: "med-001",
                medication: "Amoxicillin",
                description: "Antibiotic used to treat bacterial infections",
                quantity: 150,
                unit: "Tablets"
            },
            {
                id: "med-002",
                medication: "Metformin",
                description: "Oral medication for type 2 diabetes management",
                quantity: 25,
                unit: "Tablets"
            },
            {
                id: "med-003",
                medication: "Ibuprofen",
                description: "Nonsteroidal anti-inflammatory drug for pain relief",
                quantity: 0,
                unit: "Tablets"
            },
            {
                id: "med-004",
                medication: "Paracetamol",
                description: "Pain reliever and fever reducer",
                quantity: 200,
                unit: "Tablets"
            },
            {
                id: "med-005",
                medication: "Aspirin",
                description: "Used to reduce pain, fever, or inflammation",
                quantity: 30,
                unit: "Tablets"
            }
        ];

        global.pharmacyInventory = {
            pharmacyId: 'pharmacy-001',
            inventory: defaultInventory,
            timestamp: new Date().toISOString()
        };
        
        console.log('✅ Default inventory loaded - 5 medications available');
        console.log('📝 Note: Using in-memory storage');
    } catch (error) {
        console.log('ℹ️  Inventory initialization skipped');
    }
}

// Initialize default credentials
async function initializeDefaultCredentials() {
    const testCredentials = [
        { username: 'Pharma', password: 'Pharma', pharmacyId: 'pharmacy-001' },
    ];

    for (const cred of testCredentials) {
        try {
            // Hash password with bcrypt
            const hashedPassword = await bcrypt.hash(cred.password, 10);

            // Store in blockchain
            fabricClient.setUserContext({ userId: 'pharmacy-system', appName: 'pharmacy-portal', role: 'pharmacy' });
            await fabricClient.storeCredentials({
                username: cred.username,
                hashedPassword,
                patientId: cred.pharmacyId,
                role: 'pharmacy'
            });
            console.log(`✅ Test credential initialized: ${cred.username}`);
        } catch (error) {
            console.log(`ℹ️  Test credential may already exist: ${cred.username}`);
        }
    }
}

app.listen(PORT, async () => {
    console.log(`🏥 Pharmacy Portal: http://localhost:${PORT}`);
    console.log('💊 Pharmacy ID: pharmacy-001 (City Pharmacy)');
    console.log('📦 Inventory Management: ACTIVE (In-Memory Mode)');
    
    await initializeDefaultInventory();
    await initializeDefaultCredentials();
    
    console.log('\n📋 API Endpoints:');
    console.log('  POST /api/pharmacy/inventory');
    console.log('  GET  /api/pharmacy/inventory/:pharmacyId');
    console.log('  PUT  /api/pharmacy/inventory/update');
    console.log('  POST /api/pharmacy/inventory/deduct ⭐');
    console.log('  POST /api/pharmacy/update-status');
    console.log('  POST /api/pharmacy/send-back');
});

// Keep server alive to prevent process exit
setInterval(() => {}, 1000);
