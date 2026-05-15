const crypto = require('crypto');

class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16;  // 128 bits
        this.tagLength = 16; // 128 bits
        // CRITICAL: ENCRYPTION_SECRET_EHR MUST be set in environment
        this.ehrSecret = process.env.ENCRYPTION_SECRET_EHR;
        if (!this.ehrSecret) {
            throw new Error('CRITICAL: ENCRYPTION_SECRET_EHR is not set in environment (.env file)');
        }
    }

    // Encrypt EHR token for steganographic QR
    encryptEHRToken(ehrData) {
        const key = crypto.scryptSync(this.ehrSecret, 'ehr_salt', this.keyLength);
        const iv = crypto.randomBytes(this.ivLength);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        
        let encrypted = cipher.update(JSON.stringify(ehrData), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return {
            encrypted: encrypted,
            iv: iv.toString('hex')
        };
    }

    // Decrypt EHR token from steganographic QR
    decryptEHRToken(encryptedData, ivHex) {
        try {
            const key = crypto.scryptSync(this.ehrSecret, 'ehr_salt', this.keyLength);
            const iv = Buffer.from(ivHex, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            throw new Error('EHR token decryption failed');
        }
    }

    // Generate patient encryption key from wallet address
    generatePatientKey(walletAddress, patientId) {
        const seed = `${walletAddress}_${patientId}_MEDICAL_KEY`;
        return crypto.scryptSync(seed, 'patient_salt', this.keyLength);
    }

    // Generate temporary hospital access key
    generateHospitalKey(sessionId, patientKey) {
        const seed = `${sessionId}_HOSPITAL_ACCESS`;
        const hospitalSalt = crypto.createHash('sha256').update(patientKey).digest();
        return crypto.scryptSync(seed, hospitalSalt, this.keyLength);
    }

    // Encrypt medical data with patient key using AES-256-GCM
    encryptMedicalData(data, patientKey) {
        const dataString = JSON.stringify(data);
        const iv = crypto.randomBytes(this.ivLength);
        const cipher = crypto.createCipheriv('aes-256-gcm', patientKey, iv);

        let encrypted = cipher.update(dataString, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return {
            iv: iv.toString('hex'),
            ciphertext: encrypted,
            authTag: authTag.toString('hex'),
            algorithm: 'aes-256-gcm'
        };
    }

    // Decrypt medical data with patient key using AES-256-GCM
    decryptMedicalData(encryptedData, patientKey) {
        const { iv, ciphertext, authTag } = encryptedData;

        if (!iv || !ciphertext || !authTag) {
            throw new Error('Invalid encrypted data format');
        }

        try {
            const decipher = crypto.createDecipheriv(
                'aes-256-gcm',
                patientKey,
                Buffer.from(iv, 'hex')
            );

            decipher.setAuthTag(Buffer.from(authTag, 'hex'));

            let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return JSON.parse(decrypted);
        } catch (error) {
            throw new Error('Medical data decryption failed: invalid key or corrupted data');
        }
    }

    // Create data hash for blockchain verification
    createDataHash(data) {
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }

    // Verify data integrity
    verifyDataIntegrity(data, expectedHash) {
        const actualHash = this.createDataHash(data);
        return actualHash === expectedHash;
    }

    // Generate steganographic QR data
    generateSteganographicQR(patientData) {
        // Create proper EHR token with patient identification
        const ehrToken = {
            patientId: patientData.id,
            name: patientData.name,
            walletAddress: patientData.walletAddress,
            timestamp: Date.now(),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        };

        const encrypted = this.encryptEHRToken(ehrToken);
        const encodedToken = Buffer.from(`${encrypted.encrypted}:${encrypted.iv}`).toString('base64');

        const baseUrl = process.env.PATIENT_PORTAL_URL || 'http://localhost:3003';
        const demoPatientWallet = process.env.DEMO_PATIENT_WALLET || '0xFAB1234567890abcdef1234567890abcdef123456';

        let publicUrl;
        if (patientData.walletAddress === demoPatientWallet || patientData.name === 'Your Profile') {
            publicUrl = `${baseUrl}/p?u=${encodedToken}`;
        } else if (patientData.id === 'patient-attacker' || patientData.name === 'Attacker') {
            // Attacker user uses u? parameter (unsecured)
            publicUrl = `${baseUrl}/p?u=${encodedToken}`;
        } else {
            publicUrl = `${baseUrl}/p?s=${encodedToken}`;
        }

        return {
            publicUrl,
            ehrToken: `EHR_SECURE_${encodedToken}`,
            encrypted: {
                encrypted: encrypted.encrypted,
                iv: encrypted.iv
            }
        };
    }
}

module.exports = new EncryptionService();