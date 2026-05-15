const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

/**
 * Fabric Client - HTTP Client Wrapper
 *
 * All applications use this client to call chaincode functions
 * instead of calling fabric-service directly.
 *
 * This centralizes all security handling:
 * - JWT token injection
 * - Request signing (HMAC-SHA256)
 * - Response handling
 * - Error management
 */
class FabricClient {
    constructor(contractRunnerUrl) {
        this.baseUrl = contractRunnerUrl || process.env.CONTRACT_RUNNER_URL || 'http://localhost:6000';
        this.secret = process.env.CONTRACT_RUNNER_SECRET;
        this.jwtSecrets = {
            patient: process.env.JWT_SECRET_PATIENT,
            hospital: process.env.JWT_SECRET_HOSPITAL,
            admin: process.env.JWT_SECRET_ADMIN,
            pharmacy: process.env.JWT_SECRET_PHARMACY,
            hospitalDashboard: process.env.JWT_SECRET_ADMIN // reuse admin secret
        };
        this.userContext = null; // Will be set by calling code
    }

    /**
     * Set user context for JWT signing
     * @param {Object} user - User context {userId, role, appName}
     */
    setUserContext(user) {
        this.userContext = user;
    }

    /**
     * Get or create JWT token for this client
     * Uses stored user context or creates a default one
     * @returns {string} JWT token
     */
    getToken() {
        if (!this.userContext) {
            throw new Error('User context not set. Call setUserContext() first.');
        }

        // Determine which secret to use based on user role or appName
        let secret = this.jwtSecrets.patient; // default

        if (this.userContext.appName) {
            if (this.userContext.appName.includes('admin')) {
                secret = this.jwtSecrets.admin;
            } else if (this.userContext.appName.includes('hospital')) {
                secret = this.jwtSecrets.hospital;
            } else if (this.userContext.appName.includes('pharmacy')) {
                secret = this.jwtSecrets.pharmacy;
            }
        }

        if (!secret) {
            throw new Error('JWT secret not configured for this user context');
        }

        // Create JWT token valid for 24 hours
        const token = jwt.sign(
            {
                userId: this.userContext.userId,
                appName: this.userContext.appName,
                role: this.userContext.role || 'user'
            },
            secret,
            { expiresIn: '24h' }
        );

        return token;
    }

    /**
     * Sign a request with HMAC-SHA256
     * @param {Object} body - Request body
     * @returns {Object} {signature, timestamp}
     */
    async signRequest(body) {
        if (!this.secret) {
            throw new Error('CONTRACT_RUNNER_SECRET not configured in .env');
        }

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const payload = JSON.stringify(body) + timestamp;
        const signature = crypto
            .createHmac('sha256', this.secret)
            .update(payload)
            .digest('hex');

        return { signature, timestamp };
    }

    /**
     * Internal method to call Contract Runner API
     * @private
     * @param {string} method - HTTP method (GET, POST)
     * @param {string} endpoint - API endpoint path (e.g., 'getAllPatients' or 'getPatient/123')
     * @param {Object} data - Request body (for POST)
     * @returns {Object} Response data
     */
    async call(method, endpoint, data = {}) {
        try {
            const token = this.getToken();
            const bodyForSigning = method === 'GET' ? {} : data;
            const { signature, timestamp } = await this.signRequest(bodyForSigning);

            const url = `${this.baseUrl}/api/chaincode/${endpoint}`;

            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Signature': signature,
                    'X-Timestamp': timestamp
                }
            };

            // Only add body for POST requests
            if (method === 'POST') {
                options.body = JSON.stringify(data);
            }

            console.log(`🔗 ${method} ${url}`);

            // Use http.request instead of fetch to avoid URL parsing issues
            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? https : http;
            
            return new Promise((resolve, reject) => {
                const req = protocol.request({
                    hostname: urlObj.hostname,
                    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                    path: urlObj.pathname + urlObj.search,
                    method: method,
                    headers: options.headers
                }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        try {
                            const result = JSON.parse(body);
                            
                            if (res.statusCode !== 200) {
                                console.error(`❌ Contract Runner error: ${result.error}`);
                                reject(new Error(result.error || `HTTP ${res.statusCode}`));
                                return;
                            }

                            if (!result.success) {
                                reject(new Error(result.error || 'Contract Runner returned success:false'));
                                return;
                            }

                            console.log(`✅ ${endpoint} completed`);
                            resolve(result.data);
                        } catch (error) {
                            reject(new Error('Failed to parse response: ' + error.message));
                        }
                    });
                });

                req.on('error', (error) => {
                    reject(error);
                });

                if (method === 'POST' && options.body) {
                    req.write(options.body);
                }

                req.end();
            });
        } catch (error) {
            console.error(`❌ Fabric Client error in ${endpoint}:`, error.message);
            throw error;
        }
    }

    // ==================== WRITE OPERATIONS ====================

    async storePatient(patientData) {
        return this.call('POST', 'storePatient', { patientData });
    }

    async storeHospital(hospitalData) {
        return this.call('POST', 'storeHospital', { hospitalData });
    }

    async recordTransaction(transactionData) {
        return this.call('POST', 'recordTransaction', { transactionData });
    }

    async storeCredentials(credentialsData) {
        return this.call('POST', 'storeCredentials', { credentialsData });
    }

    async storePharmacyInventory(inventoryData) {
        return this.call('POST', 'storePharmacyInventory', { inventoryData });
    }

    async updateMedicationQuantity(updateData) {
        return this.call('POST', 'updateMedicationQuantity', { updateData });
    }

    async updateTransactionStatus(transactionId, newStatus) {
        return this.call('POST', 'updateTransactionStatus', {
            transactionId,
            newStatus
        });
    }

    async clearAllTransactions() {
        return this.call('POST', 'clearAllTransactions', {});
    }

    async verifyCredentials(username, password) {
        return this.call('POST', 'verifyCredentials', {
            username,
            password
        });
    }

    // ==================== READ OPERATIONS ====================

    async getPatient(patientId) {
        return this.call('GET', `getPatient/${patientId}`);
    }

    async getAllPatients() {
        return this.call('GET', 'getAllPatients');
    }

    async getPatientByWallet(walletAddress) {
        return this.call('GET', `getPatientByWallet/${walletAddress}`);
    }

    async getHospital(hospitalId) {
        return this.call('GET', `getHospital/${hospitalId}`);
    }

    async getAllHospitals() {
        return this.call('GET', 'getAllHospitals');
    }

    async getAllTransactions() {
        return this.call('GET', 'getAllTransactions');
    }

    async getTransactionById(transactionId) {
        return this.call('GET', `getTransactionById/${transactionId}`);
    }

    async getCredentials(username) {
        return this.call('GET', `getCredentials/${username}`);
    }

    async getAllCredentials() {
        return this.call('GET', 'getAllCredentials');
    }

    async getPharmacyInventory(pharmacyId) {
        return this.call('GET', `getPharmacyInventory/${pharmacyId}`);
    }
}

// Export single instance for use across applications
module.exports = new FabricClient();
