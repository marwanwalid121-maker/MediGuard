/**
 * API Configuration
 * All backend API URLs are managed here via environment variables
 * This ensures frontend can work with any backend server setup
 */

export const API_CONFIG = {
  adminApi: process.env.NEXT_PUBLIC_ADMIN_API || 'http://localhost:3001',
  patientApi: process.env.NEXT_PUBLIC_PATIENT_API || 'http://localhost:3003',
  hospitalApi: process.env.NEXT_PUBLIC_HOSPITAL_API || 'http://localhost:3005',
  pharmacyApi: process.env.NEXT_PUBLIC_PHARMACY_API || 'http://localhost:3006',
  contractRunner: process.env.NEXT_PUBLIC_CONTRACT_RUNNER_API || 'http://localhost:6000',
  env: process.env.NEXT_PUBLIC_APP_ENV || 'development',
};

/**
 * Default Entity IDs and Wallet Addresses
 * These are used when entity IDs/wallets are not available from authentication
 * Used primarily for testing and demo purposes
 */
export const DEFAULT_ENTITIES = {
  hospital: {
    id: process.env.NEXT_PUBLIC_DEFAULT_HOSPITAL_ID || 'hospital-001',
    wallet: process.env.NEXT_PUBLIC_DEFAULT_HOSPITAL_WALLET || '0xFABa8f7e6d5c4b3a2918f7e6d5c4b3a291a8f7eh',
    name: 'City General Hospital',
  },
  pharmacy: {
    id: process.env.NEXT_PUBLIC_DEFAULT_PHARMACY_ID || 'pharmacy-001',
    wallet: process.env.NEXT_PUBLIC_DEFAULT_PHARMACY_WALLET || '0xPHARa8f7e6d5c4b3a2918f7e6d5c4b3a291a8f7ph',
    name: 'City Pharmacy',
  },
  patient: {
    id: process.env.NEXT_PUBLIC_DEFAULT_PATIENT_ID || 'patient-001',
    wallet: process.env.NEXT_PUBLIC_DEFAULT_PATIENT_WALLET || '0xFAB1234567890abcdef1234567890abcdef123456',
    name: 'Patient',
  },
};

/**
 * Get API endpoint based on user role
 */
export function getApiEndpoint(role: 'admin' | 'patient' | 'hospital' | 'pharmacy'): string {
  switch (role) {
    case 'admin':
      return API_CONFIG.adminApi;
    case 'patient':
      return API_CONFIG.patientApi;
    case 'hospital':
      return API_CONFIG.hospitalApi;
    case 'pharmacy':
      return API_CONFIG.pharmacyApi;
    default:
      return API_CONFIG.patientApi;
  }
}

/**
 * Add endpoint to base URL
 */
export function buildUrl(baseApi: string, endpoint: string): string {
  if (!endpoint.startsWith('/')) {
    endpoint = '/' + endpoint;
  }
  return `${baseApi}${endpoint}`;
}
