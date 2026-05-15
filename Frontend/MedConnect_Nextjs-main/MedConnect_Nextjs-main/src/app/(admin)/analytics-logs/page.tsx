"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import { ChevronDownIcon } from "@/icons";
import Select from "@/components/form/Select";
import { API_CONFIG, buildUrl } from "@/config/api-config";
import { ApiClient } from "@/services/api-client";

interface Transaction {
  id: string;
  patientId: string;
  hospitalId: string;
  accessMethod: string;
  type?: string;
  timestamp: string;
  patientWallet?: string;
  hospitalWallet?: string;
  patientName?: string;
  hospitalName?: string;
  isPharmacy?: boolean;
  transaction?: {
    type: string;
    id: string;
    fromWallet: string;
    toWallet: string;
    details?: string;
    failedOTP?: string;
    pharmacyName?: string;
    pharmacyWallet?: string;
  };
}

interface Stats {
  activeSessions: number;
  totalTransactions: number;
  patients: number;
  hospitals: number;
}

const getActionColor = (action: string) => {
  const colors: Record<string, string> = {
    QR_SCAN: "#5be9b5",
    QR_SCANNED: "#5be9b5",
    DATA_ACCESSED: "#8dc5ff",
    OTP_VERIFIED: "#10B981",
    OTP_VERIFIED_PHARMACY: "#059669", // Darker green for pharmacy
    PRESCRIPTION_STATUS_UPDATE: "#8B5CF6", // Purple for prescription status changes
    DISPENSED_MEDICATION: "#0EA5E9", // Blue for dispensed
    RETURNED_TO_PENDING: "#F59E0B", // Orange for returned to pending
    STATUS_UPDATE: "#8B5CF6", // Purple for status updates
    SEND_BACK: "#10B981", // Green for send back
    MEDICATION_STATUS_UPDATE: "#8B5CF6", // Purple for medication status updates
    MEDICATION_COMPLETED: "#059669", // Dark green for completed
    EDIT_DATA: "#F59E0B",
    DATA_SAVED: "#8B5CF6",
    MEDICAL_RECORD_EDITED: "#F59E0B",
    MEDICAL_INFO_UPDATED: "#F59E0B",
    NEW_APPOINTMENT: "#9173e5",
    SENT_BACK: "#5be9b5",
    UNAUTHORIZED_ACCESS: "#EF4444",
  };
  return colors[action] || "#9173e5";
};

const getActionBadgeColor = (action: string) => {
  if (action === "UNAUTHORIZED_ACCESS") return "danger";
  return "light";
};

const getBadgeClasses = (action: string) => {
  if (action === "UNAUTHORIZED_ACCESS") {
    return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400";
  }
  return "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400";
};

export default function AnalyticsLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({
    activeSessions: 0,
    totalTransactions: 0,
    patients: 0,
    hospitals: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async (isAutoRefresh = false) => {
    try {
      // Show loading on manual refresh, but not on auto-refresh
      if (!isAutoRefresh) {
        setLoading(true);
      }
      const [txRes, patientsRes, hospitalsRes] = await Promise.all([
        ApiClient.get(buildUrl(API_CONFIG.adminApi, '/api/transactions')),
        ApiClient.get(buildUrl(API_CONFIG.adminApi, '/api/patients')),
        ApiClient.get(buildUrl(API_CONFIG.adminApi, '/api/hospitals')),
      ]);

      const txData = txRes;
      const patientsData = patientsRes;
      const hospitalsData = hospitalsRes;

      // Count only actual patients (exclude test users)
      const actualPatients = patientsData.filter((p: any) => 
        p.id !== 'patient-1774034742709' && 
        p.id !== 'patient-001' && 
        p.name !== 'Test User' && 
        p.name !== 'Your Profile'
      );

      // Count active sessions: OTP_VERIFIED_PHARMACY that haven't been sent back yet
      const otpVerifiedSessions = txData.filter((tx: any) => 
        tx.accessMethod === 'OTP_VERIFIED_PHARMACY'
      );
      const sendBackSessions = txData.filter((tx: any) => 
        tx.accessMethod === 'SEND_BACK'
      );
      const activeSessions = Math.max(0, otpVerifiedSessions.length - sendBackSessions.length);

      // Count only visible transactions (filtered by allowedTypes)
      const allowedTypes = [
        'OTP_VERIFIED',
        'OTP_VERIFIED_PHARMACY',
        'PRESCRIPTION_STATUS_UPDATE',
        'DISPENSED_MEDICATION',
        'RETURNED_TO_PENDING',
        'STATUS_UPDATE',
        'SEND_BACK',
        'MEDICATION_STATUS_UPDATE',
        'MEDICATION_COMPLETED',
        'EDIT_DATA',
        'DATA_SAVED',
        'NEW_APPOINTMENT',
        'SENT_BACK',
        'QR_SCANNED',
        'UNAUTHORIZED_ACCESS'
      ];
      const visibleTransactions = txData.filter((tx: any) => 
        allowedTypes.includes(tx.accessMethod) || allowedTypes.includes(tx.type)
      );

      // Create wallet and name lookup maps for both hospitals and pharmacies
      const patientWallets = patientsData.reduce((acc: any, p: any) => {
        acc[p.id] = p.walletAddress;
        return acc;
      }, {});
      
      // Fetch all pharmacies from blockchain to get accurate names
      let pharmaciesData: any[] = [];
      try {
        const pharmaciesRes = await ApiClient.get(buildUrl(API_CONFIG.adminApi, '/api/pharmacies'));
        pharmaciesData = pharmaciesRes || [];
      } catch (err) {
        console.warn('Could not fetch pharmacies:', err);
      }
      
      const hospitalWallets = hospitalsData.reduce((acc: any, h: any) => {
        acc[h.id] = h.walletAddress;
        return acc;
      }, {});
      const pharmacyWallets = pharmaciesData.reduce((acc: any, p: any) => {
        acc[p.id] = p.walletAddress;
        return acc;
      }, {});
      const patientNames = patientsData.reduce((acc: any, p: any) => {
        acc[p.id] = p.name;
        return acc;
      }, {});
      const hospitalNames = hospitalsData.reduce((acc: any, h: any) => {
        acc[h.id] = h.name;
        return acc;
      }, {});
      const pharmacyNames = pharmaciesData.reduce((acc: any, p: any) => {
        acc[p.id] = p.name;
        return acc;
      }, {});

      // Enrich transactions with wallet addresses and names
      const enrichedTx = txData.map((tx: Transaction) => {
        // Check if this is a pharmacy transaction
        const isPharmacyTx = tx.hospitalId?.startsWith('pharmacy-') || tx.accessMethod === 'OTP_VERIFIED_PHARMACY';
        
        // Get pharmacy name from blockchain data, then transaction data, then hospitalId
        let entityName = '';
        if (isPharmacyTx) {
          entityName = pharmacyNames[tx.hospitalId] || tx.transaction?.pharmacyName || hospitalNames[tx.hospitalId] || tx.hospitalId;
        } else {
          entityName = hospitalNames[tx.hospitalId] || tx.hospitalId;
        }
        
        return {
          ...tx,
          patientWallet: patientWallets[tx.patientId] || 'N/A',
          hospitalWallet: isPharmacyTx ? (pharmacyWallets[tx.hospitalId] || hospitalWallets[tx.hospitalId] || 'N/A') : (hospitalWallets[tx.hospitalId] || 'N/A'),
          patientName: patientNames[tx.patientId] || tx.patientId,
          hospitalName: entityName,
          isPharmacy: isPharmacyTx
        };
      });

      // Sort by timestamp (oldest first - chronological order)
      (enrichedTx as Transaction[]).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      setTransactions(enrichedTx);
      setStats({
        activeSessions: activeSessions,
        totalTransactions: visibleTransactions.length,
        patients: actualPatients.length,
        hospitals: hospitalsData.length,
      });
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false);
    
    // Auto-refresh every 3 seconds in background
    const interval = setInterval(() => {
      fetchData(true);
    }, 3000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  const handleClearTransactions = async () => {
    if (!confirm("Are you sure you want to clear all transactions?")) return;
    try {
      await ApiClient.delete(buildUrl(API_CONFIG.adminApi, '/api/transactions/clear'));
      fetchData(false);
    } catch (error) {
      console.error("Failed to clear transactions:", error);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    // Show specific transaction types including pharmacy transactions
    const allowedTypes = [
      'OTP_VERIFIED',
      'OTP_VERIFIED_PHARMACY', // Add pharmacy OTP verification
      'PRESCRIPTION_STATUS_UPDATE', // Add prescription status updates (PENDING ↔ DISPENSED)
      'DISPENSED_MEDICATION', // Add dispensed medication
      'RETURNED_TO_PENDING', // Add returned to pending
      'STATUS_UPDATE', // Add status updates (PENDING → DISPENSED)
      'SEND_BACK', // Add send back transactions
      'MEDICATION_STATUS_UPDATE', // Add medication status updates
      'MEDICATION_COMPLETED', // Add medication completed
      'EDIT_DATA',
      'DATA_SAVED',
      'NEW_APPOINTMENT',
      'SENT_BACK',
      'QR_SCANNED',
      'UNAUTHORIZED_ACCESS'
    ];
    
    const accessMethod = tx.accessMethod as string | undefined;
    const txType = tx.type as string | undefined;
    if (!allowedTypes.includes(accessMethod || '') && !allowedTypes.includes(txType || '')) return false;
    
    const matchesSearch = searchQuery
      ? (tx.accessMethod && tx.accessMethod.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.type && tx.type.toLowerCase().includes(searchQuery.toLowerCase())) ||
        tx.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.hospitalId.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesEntity = selectedEntity
      ? tx.hospitalId === selectedEntity
      : true;
    return matchesSearch && matchesEntity;
  });

  // Remove duplicate OTP_VERIFIED entries (keep only the first one per patient-hospital session)
  const deduplicatedTransactions = filteredTransactions.reduce((acc, tx) => {
    const action = tx.accessMethod || tx.type;
    if (action === 'OTP_VERIFIED' || action === 'OTP_VERIFIED_PHARMACY') {
      const key = `${action}_${tx.patientId}_${tx.hospitalId}`;
      const existing = acc.find(t => {
        const existingAction = t.accessMethod || t.type;
        return `${existingAction}_${t.patientId}_${t.hospitalId}` === key;
      });
      if (!existing) {
        acc.push(tx);
      }
    } else {
      acc.push(tx);
    }
    return acc;
  }, [] as Transaction[]);

  const actionCounts = transactions.reduce((acc: Record<string, number>, tx) => {
    const action = (tx.accessMethod || tx.type) as string | undefined;
    if (action) {
      acc[action] = (acc[action] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const entityOptions = [
    { value: "", label: "All Entities" },
    ...Array.from(new Set(transactions.map(tx => tx.hospitalId)))
      .filter(id => id && id.trim()) // Remove empty/null/undefined values
      .map((id) => ({
        value: id,
        label: id.startsWith('pharmacy-') ? `Pharmacy: ${id}` : `Hospital: ${id}`,
      })),
  ];

  const handleEntityChange = (value: string) => {
    setSelectedEntity(value);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
      {/* Active Sessions */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex flex-col items-center text-center">
          <h4 className="font-bold text-gray-800 text-title-sm dark:text-white/90">
            {stats.activeSessions}
          </h4>
          <span className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Active Sessions
          </span>
        </div>
      </div>

      {/* Total Transactions */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex flex-col items-center text-center">
          <h4 className="font-bold text-title-sm" style={{ color: "#5be9b5" }}>
            {stats.totalTransactions}
          </h4>
          <span className="mt-2 text-sm" style={{ color: "#5be9b5" }}>
            Total Transactions
          </span>
        </div>
      </div>

      {/* Registered Patients */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex flex-col items-center text-center">
          <h4 className="font-bold text-title-sm" style={{ color: "#8dc5ff" }}>
            {stats.patients}
          </h4>
          <span className="mt-2 text-sm" style={{ color: "#8dc5ff" }}>
            Registered Patients
          </span>
        </div>
      </div>

      {/* Connected Hospitals */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex flex-col items-center text-center">
          <h4 className="font-bold text-title-sm" style={{ color: "#9173e5" }}>
            {stats.hospitals}
          </h4>
          <span className="mt-2 text-sm" style={{ color: "#9173e5" }}>
            Connected Hospitals
          </span>
        </div>
      </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
          {/* Search Logs Input */}
          <div className="relative flex-1 sm:max-w-md">
            <span className="absolute -translate-y-1/2 left-4 top-1/2 pointer-events-none">
              <svg
                className="fill-gray-500 dark:fill-gray-400"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
                  fill=""
                />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by action, entity, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>

          {/* Entity Select */}
          <div className="relative sm:w-48">
            <Select
              options={entityOptions}
              placeholder="Select Type"
              onChange={handleEntityChange}
              defaultValue={selectedEntity}
              className="dark:bg-white/[0.03]"
            />
            <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
              <ChevronDownIcon />
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(false)}
            disabled={loading}
            className="flex items-center justify-center gap-2 h-11 px-4 rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 disabled:opacity-50"
            title="Refresh"
          >
            <svg
              className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span className="text-sm font-medium">Refresh</span>
          </button>
          
          {/* Clear Button */}
          <button
            onClick={handleClearTransactions}
            className="flex items-center justify-center gap-2 h-11 px-4 rounded-lg border border-red-200 bg-white text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:bg-white/[0.03] dark:text-red-400 dark:hover:bg-red-900/10"
            title="Clear All"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-sm font-medium">Clear All</span>
          </button>
        </div>
      </div>

      {/* Analytics Logs Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[1200px]">
            <Table>
              {/* Table Header */}
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-white/[0.02]">
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-5 py-4 font-semibold text-gray-700 text-start text-xs uppercase tracking-wider dark:text-gray-300"
                  >
                    Timestamp
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-4 font-semibold text-gray-700 text-start text-xs uppercase tracking-wider dark:text-gray-300"
                  >
                    Action
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-4 font-semibold text-gray-700 text-start text-xs uppercase tracking-wider dark:text-gray-300"
                  >
                    TX ID
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-4 font-semibold text-gray-700 text-start text-xs uppercase tracking-wider dark:text-gray-300"
                  >
                    From Wallet
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-4 font-semibold text-gray-700 text-start text-xs uppercase tracking-wider dark:text-gray-300"
                  >
                    To Wallet
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-4 font-semibold text-gray-700 text-start text-xs uppercase tracking-wider dark:text-gray-300"
                  >
                    Patient / Entity
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-4 font-semibold text-gray-700 text-start text-xs uppercase tracking-wider dark:text-gray-300"
                  >
                    Details
                  </TableCell>
                </TableRow>
              </TableHeader>

              {/* Table Body */}
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {loading ? (
                  <TableRow>
                    <TableCell className="px-5 py-8 text-center text-gray-500">
                      <div className="text-center">Loading transactions...</div>
                    </TableCell>
                  </TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell className="px-5 py-8 text-center text-gray-500">
                      <div className="text-center">No transactions found</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  deduplicatedTransactions.map((tx) => {
                    const action = tx.accessMethod || tx.type;
                    
                    // Determine fromWallet and toWallet based on action type
                    let fromWallet = tx.transaction?.fromWallet || 'N/A';
                    let toWallet = tx.transaction?.toWallet || 'N/A';
                    
                    // If transaction data doesn't have wallet info, infer from action type
                    if (fromWallet === 'N/A' || toWallet === 'N/A') {
                      if (action === 'OTP_VERIFIED' || action === 'OTP_VERIFIED_PHARMACY') {
                        // Patient sends data to hospital/pharmacy
                        fromWallet = tx.patientWallet || 'N/A';
                        toWallet = tx.hospitalWallet || 'N/A';
                      } else if (action === 'SEND_BACK' || action === 'SENT_BACK') {
                        // Hospital sends data back to patient
                        fromWallet = tx.hospitalWallet || 'N/A';
                        toWallet = tx.patientWallet || 'N/A';
                      } else if (action === 'EDIT_DATA' || action === 'DATA_SAVED' || action === 'NEW_APPOINTMENT') {
                        // Hospital edits/saves data, destination is patient
                        fromWallet = tx.hospitalWallet || 'N/A';
                        toWallet = tx.patientWallet || 'N/A';
                      } else {
                        // Default fallback
                        fromWallet = fromWallet === 'N/A' ? (tx.hospitalWallet || 'N/A') : fromWallet;
                        toWallet = toWallet === 'N/A' ? (tx.patientWallet || 'N/A') : toWallet;
                      }
                    }
                    const txId = tx.transaction?.id || tx.id;
                    const details = tx.transaction?.details ? 
                      (tx.transaction.details.includes('http://localhost:3003/p?session=') ? 
                        tx.transaction.details.split('http://localhost:3003/p?session=')[0].trim() :
                        tx.transaction.details) : 
                      'N/A';
                    
                    return (
                    <TableRow key={tx.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <TableCell className="px-5 py-4 text-gray-600 text-sm dark:text-gray-400 text-start whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium">{new Date(tx.timestamp).toLocaleDateString()}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-500">{new Date(tx.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start">
                        <span className={`inline-flex items-center px-3 py-1.5 justify-center gap-1.5 rounded-full font-semibold text-xs whitespace-nowrap shadow-sm ${getBadgeClasses(((tx.accessMethod || tx.type) || '') as string)}`}>
                          {(tx.accessMethod || tx.type) === "UNAUTHORIZED_ACCESS" ? "❌ " : "✅ "}
                          {tx.accessMethod || tx.type}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-600 text-sm dark:text-gray-400 text-start font-mono text-xs break-all max-w-[150px]">
                        {txId}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-600 text-sm dark:text-gray-400 text-start font-mono text-xs break-all max-w-[180px]">
                        {fromWallet}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-600 text-sm dark:text-gray-400 text-start font-mono text-xs break-all max-w-[180px]">
                        {toWallet}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start">
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-800 text-sm dark:text-white/90">
                            Patient: {tx.patientName || tx.patientId}
                          </p>
                          <p className="text-gray-600 text-xs dark:text-gray-400">
                            {tx.isPharmacy || tx.hospitalId?.startsWith('pharmacy-') ? 'Pharmacy' : 'Hospital'}: {tx.hospitalName || tx.hospitalId || 'Unknown'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-gray-600 text-sm dark:text-gray-400 text-start max-w-md">
                        <div className="break-words">
                          {details}
                          {tx.transaction?.failedOTP && (
                            <div className="mt-1.5 text-red-600 font-semibold text-xs dark:text-red-400">
                              Failed OTP: {tx.transaction.failedOTP}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )})
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

