const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3006;

// Inventory storage file path
const INVENTORY_FILE = path.join(__dirname, 'inventory-data.json');

// Load inventory from file
function loadInventory() {
    try {
        if (fs.existsSync(INVENTORY_FILE)) {
            const data = fs.readFileSync(INVENTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        // Silent error
    }
    return null;
}

// Save inventory to file
function saveInventory(inventory) {
    try {
        fs.writeFileSync(INVENTORY_FILE, JSON.stringify(inventory, null, 2));
    } catch (error) {
        // Silent error
    }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for now (will work immediately)
let pharmacyInventory = loadInventory() || {
    'pharmacy-001': [
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
    ]
};

// Store pharmacy inventory (in-memory for now)
app.post('/api/pharmacy/inventory', async (req, res) => {
    try {
        const { pharmacyId, inventory } = req.body;
        pharmacyInventory[pharmacyId] = inventory;
        saveInventory(pharmacyInventory);
        res.json({ success: true, message: 'Inventory stored successfully' });
    } catch (error) {
        console.error('Error storing inventory:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get pharmacy inventory
app.get('/api/pharmacy/inventory/:pharmacyId', async (req, res) => {
    try {
        const { pharmacyId } = req.params;
        const inventory = pharmacyInventory[pharmacyId] || [];
        res.json({ success: true, inventory });
    } catch (error) {
        console.error('Error getting inventory:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update medication quantity
app.put('/api/pharmacy/inventory/update', async (req, res) => {
    try {
        const { pharmacyId, medicationId, quantity } = req.body;
        const inventory = pharmacyInventory[pharmacyId];
        
        if (!inventory) {
            return res.status(404).json({ success: false, error: 'Pharmacy not found' });
        }
        
        const medicationIndex = inventory.findIndex(med => med.id === medicationId);
        if (medicationIndex === -1) {
            return res.status(404).json({ success: false, error: 'Medication not found' });
        }
        
        inventory[medicationIndex].quantity = quantity;
        saveInventory(pharmacyInventory);
        res.json({ success: true, message: 'Quantity updated successfully' });
    } catch (error) {
        console.error('Error updating quantity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Deduct medication quantity (for dispensing prescriptions)
app.post('/api/pharmacy/inventory/deduct', async (req, res) => {
    try {
        const { pharmacyId, medicationName, quantity } = req.body;
        
        const inventory = pharmacyInventory[pharmacyId || 'pharmacy-001'];
        
        if (!inventory) {
            return res.status(404).json({ success: false, error: 'Pharmacy inventory not found' });
        }
        
        const medicationIndex = inventory.findIndex(
            med => med.medication.toLowerCase() === medicationName.toLowerCase()
        );
        
        if (medicationIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: `Medication "${medicationName}" not found in inventory` 
            });
        }
        
        const medication = inventory[medicationIndex];
        const oldQuantity = medication.quantity;
        const newQuantity = oldQuantity - quantity;
        
        if (newQuantity < 0 && quantity > 0) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient stock. Available: ${oldQuantity}, Requested: ${quantity}`,
                availableQuantity: oldQuantity
            });
        }
        
        inventory[medicationIndex].quantity = newQuantity;
        saveInventory(pharmacyInventory);
        
        res.json({ 
            success: true, 
            message: `Inventory updated: ${medicationName}`,
            medicationName: medicationName,
            oldQuantity: oldQuantity,
            newQuantity: newQuantity,
            deducted: quantity
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🏥 Pharmacy Portal: http://localhost:${PORT}`);
});