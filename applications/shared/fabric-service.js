const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

class FabricService {
    constructor() {
        // Load from environment variables with defaults for backward compatibility
        this.channelName = process.env.FABRIC_CHANNEL_NAME || 'mychannel';
        this.chaincodeName = process.env.FABRIC_CHAINCODE_NAME || 'ehr-chaincode';
        this.mspId = process.env.FABRIC_MSP_ID || 'Org1MSP';
        this.orgName = process.env.FABRIC_ORG_NAME || 'Org1';
        this.orgDomain = process.env.FABRIC_ORG_DOMAIN || 'org1.example.com';
        this.peerDomain = process.env.FABRIC_PEER_DOMAIN || 'peer0.org1.example.com';
        this.caDomain = process.env.FABRIC_CA_DOMAIN || 'ca.org1.example.com';
        this.ordererDomain = process.env.FABRIC_ORDERER_DOMAIN || 'orderer.example.com';
        this.adminUser = process.env.FABRIC_ADMIN_USER || 'Admin@org1.example.com';
        this.walletIdentity = process.env.FABRIC_WALLET_IDENTITY || 'admin';
        this.cryptoConfigPath = process.env.FABRIC_CRYPTO_CONFIG_PATH || 'hyperledger-fabric/network/crypto-config';
        this.certFileName = process.env.FABRIC_CERT_FILENAME || 'Admin@org1.example.com-cert.pem';
        // Use a single shared wallet location for all services
        this.walletPath = path.join(__dirname, '..', '..', 'wallet');
        this.ccpPath = path.resolve(__dirname, '..', '..', 'hyperledger-fabric', 'network', 'connection-org1.json');
        
        // Persistent gateway and network connections
        this.gateway = null;
        this.network = null;
        this.contract = null;
    }

    async connectToGateway(retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // Return existing connection if available
                if (this.gateway && this.network && this.contract) {
                    return this.gateway;
                }

                const ccp = this.buildCCP();
                const wallet = await Wallets.newFileSystemWallet(this.walletPath);

                const identity = await wallet.get(this.walletIdentity);
                if (!identity) {
                    console.log('Identity not found, enrolling...');
                    await this.enrollUser(wallet, ccp);
                }

                this.gateway = new Gateway();
                await this.gateway.connect(ccp, {
                    wallet,
                    identity: this.walletIdentity,
                    discovery: { enabled: false },
                    eventHandlerOptions: {
                        commitTimeout: 300
                    }
                });

                this.network = await this.gateway.getNetwork(this.channelName);
                this.contract = this.network.getContract(this.chaincodeName);

                console.log('✅ Connected to Fabric network');
                return this.gateway;
            } catch (error) {
                console.error(`Connection attempt ${attempt}/${retries} failed:`, error.message);
                this.gateway = null;
                this.network = null;
                this.contract = null;
                
                if (attempt < retries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    console.log(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
    }

    buildCCP() {
        try {
            const ccpPath = path.resolve(__dirname, '..', '..', 'hyperledger-fabric', 'network', 'connection-org1.json');
            const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
            return JSON.parse(ccpJSON);
        } catch (error) {
            console.log('Using default connection profile');
            // Use environment variables for network endpoints
            // Phase 5: Enable TLS by default - use grpcs and https
            const tlsEnabled = process.env.ENABLE_TLS !== 'false';
            const peerUrl = process.env.FABRIC_PEER_URL || (tlsEnabled ? 'grpcs://127.0.0.1:7051' : 'grpc://127.0.0.1:7051');
            const caUrl = process.env.FABRIC_CA_URL || (tlsEnabled ? 'https://127.0.0.1:7054' : 'http://127.0.0.1:7054');
            const ordererUrl = process.env.FABRIC_ORDERER_URL || (tlsEnabled ? 'grpcs://127.0.0.1:7050' : 'grpc://127.0.0.1:7050');

            return {
                name: 'test-network-org1',
                version: '1.0.0',
                client: { organization: this.orgName },
                organizations: {
                    [this.orgName]: {
                        mspid: this.mspId,
                        peers: [this.peerDomain],
                        certificateAuthorities: [this.caDomain]
                    }
                },
                peers: {
                    [this.peerDomain]: {
                        url: peerUrl,
                        grpcOptions: {
                            'ssl-target-name-override': this.peerDomain,
                            'grpc.max_receive_message_length': -1,
                            'grpc.max_send_message_length': -1
                        }
                    }
                },
                certificateAuthorities: {
                    [this.caDomain]: {
                        url: caUrl,
                        caName: this.caDomain,
                        ...(tlsEnabled && { tlsCACerts: { pem: process.env.FABRIC_CA_CERT || '' } })
                    }
                },
                orderers: {
                    [this.ordererDomain]: {
                        url: ordererUrl,
                        grpcOptions: {
                            'ssl-target-name-override': this.ordererDomain,
                            ...(tlsEnabled && { 'grpc.ssl_target_name_override': this.ordererDomain })
                        }
                    }
                },
                channels: {
                    [this.channelName]: {
                        orderers: [this.ordererDomain],
                        peers: {
                            [this.peerDomain]: {
                                endorsingPeer: true,
                                chaincodeQuery: true,
                                ledgerQuery: true,
                                eventSource: true
                            }
                        }
                    }
                }
            };
        }
    }

    async enrollUser(wallet, ccp) {
        try {
            // Load peer org admin credentials (Org1MSP is a channel member)
            const mspPath = path.resolve(__dirname, '..', '..', this.cryptoConfigPath, 'peerOrganizations', this.orgDomain, 'users', this.adminUser, 'msp');

            // Read certificate
            const certPath = path.join(mspPath, 'signcerts', this.certFileName);
            const cert = fs.readFileSync(certPath, 'utf8');

            // Read private key (find the actual file in keystore)
            const keystorePath = path.join(mspPath, 'keystore');
            const keyFiles = fs.readdirSync(keystorePath).filter(f => f.endsWith('_sk'));
            if (keyFiles.length === 0) {
                throw new Error(`No private key found in ${keystorePath}`);
            }
            const key = fs.readFileSync(path.join(keystorePath, keyFiles[0]), 'utf8');

            const x509Identity = {
                credentials: {
                    certificate: cert,
                    privateKey: key
                },
                mspId: this.mspId,  // Org1MSP (peer org)
                type: 'X.509'
            };

            await wallet.put(this.walletIdentity, x509Identity);
            console.log(`✅ Enrolled ${this.walletIdentity} with ${this.mspId} credentials`);
        } catch (error) {
            console.error('Failed to enroll user:', error);
            throw error;
        }
    }

    async storePatient(patientData) {
        await this.connectToGateway();
        const result = await this.contract.submitTransaction('storePatient', JSON.stringify(patientData));
        return JSON.parse(result.toString());
    }

    async getPatient(patientId) {
        await this.connectToGateway();
        const result = await this.contract.evaluateTransaction('getPatient', patientId);
        return JSON.parse(result.toString());
    }

    async getAllPatients() {
        await this.connectToGateway();
        const result = await this.contract.evaluateTransaction('getAllPatients');
        return JSON.parse(result.toString());
    }

    async getPatientByWallet(walletAddress) {
        await this.connectToGateway();
        const result = await this.contract.evaluateTransaction('getPatientByWallet', walletAddress);
        return JSON.parse(result.toString());
    }

    async storeHospital(hospitalData) {
        await this.connectToGateway();
        const result = await this.contract.submitTransaction('storeHospital', JSON.stringify(hospitalData));
        return JSON.parse(result.toString());
    }

    async recordTransaction(transactionData) {
        await this.connectToGateway();
        const result = await this.contract.submitTransaction('recordTransaction', JSON.stringify(transactionData));
        return JSON.parse(result.toString());
    }

    async getAllTransactions() {
        await this.connectToGateway();
        const result = await this.contract.evaluateTransaction('getAllTransactions');
        return JSON.parse(result.toString());
    }

    async clearAllTransactions() {
        await this.connectToGateway();
        const result = await this.contract.submitTransaction('clearAllTransactions');
        return JSON.parse(result.toString());
    }

    async storeCredentials(credData) {
        await this.connectToGateway();
        const credDataStr = typeof credData === 'string' ? credData : JSON.stringify(credData);
        const result = await this.contract.submitTransaction('storeCredentials', credDataStr);
        return JSON.parse(result.toString());
    }

    async getAllCredentials() {
        await this.connectToGateway();
        const result = await this.contract.evaluateTransaction('getAllCredentials');
        return JSON.parse(result.toString());
    }

    async getAllHospitals() {
        await this.connectToGateway();
        const result = await this.contract.evaluateTransaction('getAllHospitals');
        return JSON.parse(result.toString());
    }

    async verifyCredentials(username, password) {
        await this.connectToGateway();
        const result = await this.contract.evaluateTransaction('verifyCredentials', username, password);
        const patientId = result.toString();
        return patientId || null;
    }

    async storePatientData(patientId, encryptedData, walletAddress) {
        const patientData = { id: patientId, walletAddress, ...encryptedData };
        return await this.storePatient(patientData);
    }

    async getPatientData(patientId) {
        return await this.getPatient(patientId);
    }

    async createWallet(userId, publicKey) {
        const crypto = require('crypto');
        const walletAddress = `0xFAB${crypto.randomBytes(19).toString('hex')}`;
        return { walletAddress, userId, publicKey };
    }

    async recordAccessTransaction(patientId, source, type) {
        const txData = {
            id: Date.now().toString(),
            patientId,
            hospitalId: source,
            accessMethod: type,
            timestamp: new Date().toISOString(),
            transaction: { type, id: Date.now().toString(), fromWallet: 'patient', toWallet: 'hospital' }
        };
        return await this.recordTransaction(txData);
    }

    async getTransactionHistory(walletAddress) {
        const allTx = await this.getAllTransactions();
        return allTx.filter(tx => tx.transaction?.fromWallet === walletAddress || tx.transaction?.toWallet === walletAddress);
    }

    async getWallet(walletAddress) {
        return { walletAddress };
    }

    async getHospitalData(hospitalId) {
        await this.connectToGateway();
        const result = await this.contract.evaluateTransaction('getHospital', hospitalId);
        return JSON.parse(result.toString());
    }

    async getHospital(hospitalId) {
        return this.getHospitalData(hospitalId);
    }

    async storeHospitalData(hospitalId, hospitalData) {
        const hospital = { id: hospitalId, ...hospitalData };
        return await this.storeHospital(hospital);
    }

    async getHospitalWallet(hospitalId) {
        try {
            const hospital = await this.getHospitalData(hospitalId);
            return hospital.walletAddress || null;
        } catch (error) {
            return null;
        }
    }

    async getPatientWallet(patientId) {
        try {
            const patient = await this.getPatient(patientId);
            return patient.walletAddress || null;
        } catch (error) {
            return null;
        }
    }

    async storePharmacyInventory(pharmacyId, inventory) {
        await this.connectToGateway();
        const inventoryData = { pharmacyId, inventory, timestamp: new Date().toISOString() };
        const result = await this.contract.submitTransaction('storePharmacyInventory', JSON.stringify(inventoryData));
        return JSON.parse(result.toString());
    }

    async getPharmacyInventory(pharmacyId) {
        await this.connectToGateway();
        const result = await this.contract.evaluateTransaction('getPharmacyInventory', pharmacyId);
        return JSON.parse(result.toString());
    }

    async updateMedicationQuantity(pharmacyId, medicationId, quantity) {
        await this.connectToGateway();
        const updateData = { pharmacyId, medicationId, quantity, timestamp: new Date().toISOString() };
        const result = await this.contract.submitTransaction('updateMedicationQuantity', JSON.stringify(updateData));
        return JSON.parse(result.toString());
    }

    async updateTransactionStatus(transactionId, newStatus) {
        await this.connectToGateway();
        const result = await this.contract.submitTransaction('updateTransactionStatus', transactionId, newStatus);
        return JSON.parse(result.toString());
    }

    async getTransactionById(transactionId) {
        await this.connectToGateway();
        const result = await this.contract.evaluateTransaction('getTransactionById', transactionId);
        return JSON.parse(result.toString());
    }
}

module.exports = new FabricService();