# Healthcare QR System - Build 1

## 3 Isolated Local Environments

### 1. local-admin (Port 3001) - Admin Dashboard
- Monitor all transactions
- Store patient groups: name → wallet address
- Store hospital groups: name → wallet address
- Data only transfers during transactions

### 2. local-hospital (Port 3002) - Hospital Scanner
- QR scanner interface
- Patient data access via OTP/Face ID
- Isolated from admin data

### 3. local-patient (Port 3003) - Patient Portal
- QR code generation
- Profile management
- Isolated environment

## Test Profiles
- **Your Profile**: Face ID enabled
- **John Doe**: OTP only

## Quick Start
```bash
cd build1
npm install
npm run start:all
```