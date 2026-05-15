const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

class EHRContract extends Contract {

    /**
     * Get caller identity from certificate
     * Extracts the common name from the client certificate
     */
    getCallerIdentity(ctx) {
        try {
            // Try multiple methods to get the identity
            let creator = ctx.clientIdentity.getAttributeValue('hf.EnrollmentID');
            if (!creator) {
                // Fallback: get the ID from the certificate
                creator = ctx.clientIdentity.getID();
            }
            console.log(`🔍 Caller Identity: ${creator}`);
            return creator || 'unknown';
        } catch (error) {
            console.log(`❌ Error getting identity: ${error.message}`);
            return 'unknown';
        }
    }

    /**
     * Check if caller is an admin
     * Checks for admin role in certificate attributes or organization
     */
    isAdmin(ctx) {
        try {
            const caller = this.getCallerIdentity(ctx);
            // Check enrollment ID
            if (caller && typeof caller === 'string' && caller.toLowerCase().includes('admin')) {
                return true;
            }

            // Check for admin role in certificate attributes
            try {
                const mspId = ctx.clientIdentity.getMSPID();
                const adminRole = ctx.clientIdentity.getAttributeValue('admin');
                if (adminRole === 'true' || adminRole === true) {
                    return true;
                }
            } catch (e) {
                // Attribute not available
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    async initLedger(ctx) {
        console.log('EHR Chaincode initialized');
        return 'EHR Chaincode initialized successfully';
    }

    async storePatient(ctx, patientData) {
        // Validate input
        if (!patientData) {
            throw new Error('Patient data is required');
        }

        try {
            const patient = JSON.parse(patientData);

            // Input validation
            if (!patient.id) {
                throw new Error('Patient ID is required');
            }
            if (typeof patient.id !== 'string' || patient.id.length > 256) {
                throw new Error('Invalid patient ID format');
            }

            const key = `PATIENT_${patient.id}`;
            await ctx.stub.putState(key, Buffer.from(patientData));
            return patientData;
        } catch (error) {
            throw new Error(`Failed to store patient: ${error.message}`);
        }
    }

    async getPatient(ctx, patientId) {
        // Validate input
        if (!patientId || typeof patientId !== 'string' || patientId.length > 256) {
            throw new Error('Invalid patient ID');
        }

        const key = `PATIENT_${patientId}`;
        const data = await ctx.stub.getState(key);
        if (!data || data.length === 0) {
            throw new Error(`Patient ${patientId} not found`);
        }
        return data.toString();
    }

    async getAllPatients(ctx) {
        // ACCESS CONTROL: Only admins can fetch all patients
        if (!this.isAdmin(ctx)) {
            throw new Error('Access denied: Only admins can retrieve all patients');
        }

        const iterator = await ctx.stub.getStateByRange('PATIENT_', 'PATIENT_~');
        const patients = [];
        let result = await iterator.next();
        while (!result.done) {
            patients.push(JSON.parse(result.value.value.toString()));
            result = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(patients);
    }

    async storeHospital(ctx, hospitalData) {
        const hospital = JSON.parse(hospitalData);
        const key = `HOSPITAL_${hospital.id}`;
        await ctx.stub.putState(key, Buffer.from(hospitalData));
        return hospitalData;
    }

    async getHospital(ctx, hospitalId) {
        const key = `HOSPITAL_${hospitalId}`;
        const data = await ctx.stub.getState(key);
        if (!data || data.length === 0) {
            throw new Error(`Hospital ${hospitalId} not found`);
        }
        return data.toString();
    }

    async getAllHospitals(ctx) {
        const iterator = await ctx.stub.getStateByRange('HOSPITAL_', 'HOSPITAL_~');
        const hospitals = [];
        let result = await iterator.next();
        while (!result.done) {
            hospitals.push(JSON.parse(result.value.value.toString()));
            result = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(hospitals);
    }

    async recordTransaction(ctx, transactionData) {
        const tx = JSON.parse(transactionData);
        const key = `TX_${tx.id}`;
        await ctx.stub.putState(key, Buffer.from(transactionData));
        return transactionData;
    }

    async getAllTransactions(ctx) {
        const iterator = await ctx.stub.getStateByRange('TX_', 'TX_~');
        const transactions = [];
        let result = await iterator.next();
        while (!result.done) {
            transactions.push(JSON.parse(result.value.value.toString()));
            result = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(transactions);
    }

    async getPatientByWallet(ctx, walletAddress) {
        const iterator = await ctx.stub.getStateByRange('PATIENT_', 'PATIENT_~');
        let result = await iterator.next();
        while (!result.done) {
            const patient = JSON.parse(result.value.value.toString());
            if (patient.walletAddress === walletAddress) {
                await iterator.close();
                return JSON.stringify(patient);
            }
            result = await iterator.next();
        }
        await iterator.close();
        throw new Error(`Patient with wallet ${walletAddress} not found`);
    }

    async storeCredentials(ctx, credentialsData) {
        const cred = JSON.parse(credentialsData);
        const key = `CRED_${cred.username}`;
        console.log(`💾 Storing credentials for: ${cred.username} with key: ${key}`);
        await ctx.stub.putState(key, Buffer.from(credentialsData));
        console.log(`✅ Credentials stored successfully for: ${cred.username}`);
        return credentialsData;
    }

    async getAllCredentials(ctx) {
        if (!this.isAdmin(ctx)) {
            throw new Error('Access denied: Only admins can retrieve all credentials');
        }
        const iterator = await ctx.stub.getStateByRange('CRED_', 'CRED_~');
        const credentials = [];
        let result = await iterator.next();
        while (!result.done) {
            credentials.push(JSON.parse(result.value.value.toString()));
            result = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(credentials);
    }

    async verifyCredentials(ctx, username, password) {
        console.log(`🔐 Verifying credentials for username: ${username}`);
        const key = `CRED_${username}`;
        console.log(`🔑 Looking for key: ${key}`);
        const data = await ctx.stub.getState(key);
        if (!data || data.length === 0) {
            console.log(`❌ Credentials not found for: ${username}`);
            throw new Error(`Credentials for ${username} not found`);
        }
        console.log(`✅ Credentials found for: ${username}`);
        const cred = JSON.parse(data.toString());

        // Use bcrypt for secure password comparison
        const isPasswordValid = await bcrypt.compare(password, cred.hashedPassword);
        console.log(`🔒 Password validation result: ${isPasswordValid}`);
        if (isPasswordValid) {
            console.log(`✅ Login successful for: ${username}`);
            return cred.userId || cred.patientId;
        }
        console.log(`❌ Invalid password for: ${username}`);
        throw new Error('Invalid password');
    }

    async clearAllTransactions(ctx) {
        // ACCESS CONTROL: Only admins can clear all transactions
        if (!this.isAdmin(ctx)) {
            throw new Error('Access denied: Only admins can clear transaction history');
        }

        const iterator = await ctx.stub.getStateByRange('TX_', 'TX_~');
        let result = await iterator.next();
        let count = 0;
        while (!result.done) {
            await ctx.stub.deleteState(result.value.key);
            count++;
            result = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify({ success: true, cleared: count });
    }

    async storePharmacyInventory(ctx, inventoryData) {
        const data = JSON.parse(inventoryData);
        const key = `PHARMACY_INVENTORY_${data.pharmacyId}`;
        await ctx.stub.putState(key, Buffer.from(inventoryData));
        return inventoryData;
    }

    async getPharmacyInventory(ctx, pharmacyId) {
        const key = `PHARMACY_INVENTORY_${pharmacyId}`;
        const data = await ctx.stub.getState(key);
        if (!data || data.length === 0) {
            return JSON.stringify({ pharmacyId, inventory: [] });
        }
        return data.toString();
    }

    async updateMedicationQuantity(ctx, updateData) {
        const update = JSON.parse(updateData);
        const key = `PHARMACY_INVENTORY_${update.pharmacyId}`;
        const data = await ctx.stub.getState(key);
        
        if (!data || data.length === 0) {
            throw new Error(`Pharmacy inventory ${update.pharmacyId} not found`);
        }
        
        const inventoryData = JSON.parse(data.toString());
        const medicationIndex = inventoryData.inventory.findIndex(med => med.id === update.medicationId);
        
        if (medicationIndex === -1) {
            throw new Error(`Medication ${update.medicationId} not found`);
        }
        
        inventoryData.inventory[medicationIndex].quantity = update.quantity;
        inventoryData.timestamp = update.timestamp;
        
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(inventoryData)));
        return JSON.stringify(inventoryData);
    }

    async updateTransactionStatus(ctx, transactionId, newStatus) {
        const key = `TX_${transactionId}`;
        const data = await ctx.stub.getState(key);
        
        if (!data || data.length === 0) {
            throw new Error(`Transaction ${transactionId} not found`);
        }
        
        const transaction = JSON.parse(data.toString());
        transaction.status = newStatus;
        transaction.lastUpdated = new Date().toISOString();
        
        await ctx.stub.putState(key, Buffer.from(JSON.stringify(transaction)));
        return JSON.stringify(transaction);
    }

    async getTransactionById(ctx, transactionId) {
        const key = `TX_${transactionId}`;
        const data = await ctx.stub.getState(key);
        if (!data || data.length === 0) {
            throw new Error(`Transaction ${transactionId} not found`);
        }
        return data.toString();
    }
}

module.exports = EHRContract;