# 🛡️ MediGuard EHR - Blockchain-Based Electronic Health Records

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)

A secure, decentralized Electronic Health Records (EHR) system built on Hyperledger Fabric. MediGuard ensures data integrity, patient privacy, and transparent access logging through blockchain technology, featuring QR code verification for diagnoses and medications.

---

## 📋 Table of Contents

1.  [Project Description](#-project-description)
2.  [Key Features](#-key-features)
3.  [Tech Stack](#-tech-stack)
4.  [Getting Started](#-getting-started)
    *   [Prerequisites](#prerequisites)
    *   [Installation & Running the System](#installation--running-the-system)
5.  [Usage](#-usage)
    *   [Access URLs](#access-urls)
    *   [Test Credentials](#test-credentials)
6.  [Screenshots](#-screenshots)
7.  [Project Structure](#-project-structure)
8.  [Contributing](#-contributing)
9.  [License](#-license)
10. [Contact](#-contact)

---

## 📝 Project Description

**MediGuard EHR** is a next-generation healthcare platform that leverages blockchain to create a secure and immutable record of patient health information. By storing encrypted medical data on a distributed ledger, it provides a single source of truth, prevents unauthorized data tampering, and empowers patients with control over their own health records. The system uses QR codes to streamline the verification of prescriptions and diagnoses, reducing errors and improving patient safety.

---

## ✨ Key Features

*   **Decentralized Data**: Patient records are stored on a Hyperledger Fabric blockchain, ensuring immutability and data integrity.
*   **End-to-End Encryption**: Medical data is encrypted with AES-256-GCM, ensuring only authorized parties can access sensitive information.
*   **Role-Based Access Control (RBAC)**: Different portals for Patients, Doctors (Hospitals), Pharmacies, and Admins with distinct permissions.
*   **QR Code Verification**: Securely verify prescriptions and diagnoses via QR codes, linking physical items to their digital, unalterable records on the blockchain.
*   **Transparent Audit Trails**: All transactions and data access events are recorded on the blockchain, creating an immutable audit log.
*   **Separate Portals**: Dedicated web applications for each user role (Admin, Patient, Hospital, Pharmacy).
*   **Real-time Monitoring**: Dashboards for visualizing patient data, transactions, and system activity.

---

## 💻 Tech Stack

*   **Blockchain**: Hyperledger Fabric
*   **Backend**: Node.js, Express.js
*   **Frontend**: Next.js, React, TypeScript
*   **Containerization**: Docker, Docker Compose
*   **Cryptography**: bcrypt, AES-256-GCM

---

## 🚀 Getting Started

Follow these instructions to get the MediGuard EHR system up and running on your local machine.

### Prerequisites

*   [Docker](https://www.docker.com/get-started) and Docker Compose
*   [Node.js](https://nodejs.org/) (v16 or later recommended)
*   A terminal or command prompt (like PowerShell or Command Prompt on Windows)

### Installation & Running the System

The project includes convenient scripts to automate the setup process. Here is a breakdown of what each script does and how to use them.

#### 1. `START-BLOCKCHAIN-EHR.cmd`

This is the main script to launch the entire backend infrastructure. It performs the following steps:
*   Checks if the Hyperledger Fabric network is already running.
*   Generates fresh cryptographic materials and channel artifacts.
*   Starts the Hyperledger Fabric network using Docker Compose (Orderer, Peer, CA).
*   Deploys and initializes the `ehr-chaincode` smart contract on the network.
*   Starts all the backend Node.js application servers for the different portals (Admin, Patient, Hospital, etc.).

**To use it, simply double-click the file or run it from your terminal:**
```bash
./START-BLOCKCHAIN-EHR.cmd
```

#### 2. `START-FRONTEND.cmd`

This script starts the Next.js frontend development server.

**Run this script *after* the backend is running.** It will allow you to access the user interfaces for all the portals.
```bash
./START-FRONTEND.cmd
```
The frontend will be accessible at `http://localhost:3000`.

#### 3. `STOP-BLOCKCHAIN-EHR.cmd`

This script safely stops and removes all the Docker containers associated with the Hyperledger Fabric network. It also removes the volumes to ensure a clean state for the next startup.

**Use this script when you are finished and want to shut down the backend.**
```bash
./STOP-BLOCKCHAIN-EHR.cmd
```

#### 4. `START-TUNNEL-ONLY.cmd`

This is an optional utility script that uses `ngrok` to create a secure public URL (a tunnel) for your locally running services. This is useful for testing integrations with external services or for demonstrating your project to others. It starts both the `ngrok` tunnel and a small monitoring service to track the tunnel's URL.

**Run this if you need to expose your local environment to the internet.**
```bash
./START-TUNNEL-ONLY.cmd
```

---

## 💡 Usage

Once the backend and frontend are running, you can access the various parts of the application through your web browser.

### Access URLs

*   **Frontend / Login Page**: `http://localhost:3000`
*   **Blockchain API (Contract Runner)**: `http://localhost:6000`
*   **Admin Dashboard (Backend Service)**: `http://localhost:3001`
*   **Patient Portal (Backend Service)**: `http://localhost:3003`
*   **Hospital Scanner (Backend Service)**: `http://localhost:3004`
*   **Hospital Dashboard (Backend Service)**: `http://localhost:3005`
*   **Pharmacy Portal (Backend Service)**: `http://localhost:3006`

### Test Credentials

You can use the following credentials to log in and test the different roles:

*   **Admin**:
    *   Username: `admin`
    *   Password: `admin123`
*   **Attacker (Test Patient)**:
    *   Username: `attacker`
    *   Password: `123`

---

## 📸 Screenshots

---

## 📂 Project Structure

The repository is organized into several key directories:

```
/
├── applications/       # Backend Node.js services for each portal
│   ├── admin-dashboard/
│   ├── contract-runner/  # Interacts directly with the blockchain
│   ├── hospital-dashboard/
│   ├── patient-portal/
│   ├── pharmacy-portal/
│   └── shared/           # Shared modules (fabric client, encryption)
│
├── Frontend/           # Next.js frontend application
│   └── MedConnect_Nextjs-main/
│
├── hyperledger-fabric/ # Blockchain network configuration
│   ├── network/
│   │   ├── chaincode/    # Smart contract (ehr-chaincode.js)
│   │   ├── crypto-config/
│   │   └── docker-compose.yml
│
├── *.cmd               # Startup and shutdown scripts
└── README.md           # This file
```

---

## 🤝 Contributing

Contributions are welcome! If you'd like to contribute, please follow these steps:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/YourFeature`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/YourFeature`).
6.  Open a Pull Request.

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 📧 Contact

Created by **MARWAN WALID FOUAD ZAKARIA HASSAN** - [Marwan-walid@outlook.my]

