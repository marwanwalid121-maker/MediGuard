"use client";
import React, { useState, useEffect } from "react";
import { ShieldCheck, Users, Activity, ArrowUp, Heart, FileText, Settings, Plus, FilePenLine, Clock, CalendarCheck, CirclePlus, AlertTriangle, FlaskConical } from "lucide-react";
import Avatar from "@/components/ui/avatar/Avatar";
import Badge from "@/components/ui/badge/Badge";
import { API_CONFIG, buildUrl, DEFAULT_ENTITIES } from "@/config/api-config";
import { ApiClient } from "@/services/api-client";

// Get pharmacy info from localStorage (set during login)
const getPharmacyInfo = () => {
  if (typeof window !== 'undefined') {
    return {
      id: localStorage.getItem('pharmacyId') || DEFAULT_ENTITIES.pharmacy.id,
      wallet: localStorage.getItem('pharmacyWallet') || DEFAULT_ENTITIES.pharmacy.wallet,
      name: localStorage.getItem('pharmacyName') || DEFAULT_ENTITIES.pharmacy.name
    };
  }
  return DEFAULT_ENTITIES.pharmacy;
};

interface PendingScan {
  scanId: string;
  userId: string;
  name: string;
  walletAddress: string;
  timestamp: number;
  status: string;
  otp?: string;
}

export default function PharmacyDashboard() {
  const [pendingScans, setPendingScans] = useState<PendingScan[]>([]);
  const [otpInputs, setOtpInputs] = useState<{[key: string]: string}>({});
  const [accessingScans, setAccessingScans] = useState<{[key: string]: boolean}>({});
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [pendingPrescriptions, setPendingPrescriptions] = useState(0);

  useEffect(() => {
    fetchPendingScans();
    fetchInventoryData();
    const interval = setInterval(() => {
      fetchPendingScans();
      fetchInventoryData();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchInventoryData = async () => {
    try {
      const token = localStorage.getItem('patientToken');
      const pharmacyInfo = getPharmacyInfo();
      const res = await ApiClient.get(buildUrl(API_CONFIG.pharmacyApi, `/api/pharmacy/inventory/${pharmacyInfo.id}`), token);
      const data = res;
      if (data.success && data.inventory) {
        setInventoryData(data.inventory);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    }
  };

  const fetchPendingScans = async () => {
    try {
      const res = await ApiClient.get(buildUrl(API_CONFIG.hospitalApi, '/api/pending-scans'));
      const data = res;
      if (data.success) {
        setPendingScans(data.scans);
        // Count pending prescriptions from scans
        setPendingPrescriptions(data.scans.length);
      }
    } catch (error) {
      console.error('Failed to fetch pending scans:', error);
    }
  };

  const handleGenerateOTP = async (scan: PendingScan) => {
    try {
      const res = await ApiClient.post(buildUrl(API_CONFIG.hospitalApi, '/api/generate-otp'), { patientWallet: scan.walletAddress });
      const data = res;
      if (data.success) {
        alert('OTP sent to patient\'s device');
        fetchPendingScans();
      }
    } catch (error) {
      console.error('Failed to generate OTP:', error);
    }
  };

  const handleVerifyAccess = async (scan: PendingScan) => {
    const otp = otpInputs[scan.scanId];
    if (!otp) {
      alert('Please enter OTP');
      return;
    }

    setAccessingScans(prev => ({ ...prev, [scan.scanId]: true }));

    const pharmacyInfo = getPharmacyInfo();

    try {
      const verifyOtpUrl = buildUrl(API_CONFIG.hospitalApi, '/api/verify-otp');
      const res = await ApiClient.post(verifyOtpUrl, {
        otp,
        patientWallet: scan.walletAddress,
        pharmacyId: pharmacyInfo.id,
        pharmacyWallet: pharmacyInfo.wallet,
        sessionType: 'pharmacy' // Mark as pharmacy session
      });

      if (res.success) {
        // Log OTP_VERIFIED transaction for pharmacy and WAIT for it to complete
        try {
          const txUrl = buildUrl(API_CONFIG.adminApi, '/api/record-transaction');
          await ApiClient.post(txUrl, {
            patientId: scan.userId,
            pharmacyId: pharmacyInfo.id,
            accessMethod: 'OTP_VERIFIED_PHARMACY',
            transaction: {
              id: `pharmacy_otp_verified_${Date.now()}`,
              type: 'OTP_VERIFIED_PHARMACY',
              fromWallet: scan.walletAddress,
              toWallet: pharmacyInfo.wallet,
              timestamp: new Date().toISOString(),
              status: 'completed',
              pharmacyName: pharmacyInfo.name,
              pharmacyWallet: pharmacyInfo.wallet
            }
          });
          console.log('OTP_VERIFIED_PHARMACY transaction logged successfully');
        } catch (err) {
          console.error('Failed to log OTP_VERIFIED_PHARMACY transaction:', err);
        }

        // Small delay to ensure transaction is saved
        await new Promise(resolve => setTimeout(resolve, 500));

        // Navigate to prescription queue with session ID (pharmacy-specific)
        window.location.href = `/prescription-queue?sessionId=${res.sessionId}&type=pharmacy`;
      } else {
        alert('Access Denied: ' + res.error);
      }
    } catch (error) {
      console.error('Failed to verify OTP:', error);
      alert('Verification failed');
    } finally {
      setAccessingScans(prev => ({ ...prev, [scan.scanId]: false }));
    }
  };

  // Calculate inventory metrics
  const totalItems = inventoryData.length;
  const lowStockItems = inventoryData.filter(item => item.quantity > 0 && item.quantity <= 100);
  const outOfStockItems = inventoryData.filter(item => item.quantity === 0);
  const lowStockCount = lowStockItems.length + outOfStockItems.length;

  return (
    <div className="space-y-6">
   
      {/* Four Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
        {/* Pending Prescriptions */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Pending Prescriptions
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {pendingPrescriptions}
              </h4>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/[0.12]">
              <Users className="size-6" style={{ color: "#03b580" }} />
            </div>
          </div>
        </div>

        {/* Total Inventory Items */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Inventory Items
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                 {totalItems}
              </h4>
            
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/[0.12]">
              <ArrowUp className="size-6" style={{ color: "#03b580" }} />
            </div>
          </div>
        </div>

        {/* Low Stock Alerts*/}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Low Stock Alerts
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {lowStockCount}
              </h4>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/[0.12]">
              <Heart className="size-6" style={{ color: "#03b580" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Two Actions Sections */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
        {/* View Queue*/}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/[0.12]">
              <Users className="size-6" style={{ color: "#03b580" }} />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                View Queue
              </h4>
            </div>
          </div>
        </div>

        {/* Manage Inventory */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center justify-center w-12 h-12 rounded-xl"
              style={{ 
                backgroundColor: "#4280d2" + "20", // 20 hex = ~12.5% opacity
              }}
            >
              <FileText className="size-6" style={{ color: "#4280d2" }} />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                Manage Inventory
              </h4>
            </div>
          </div>
        </div>
      
      </div>

      {/* Pending Prescriptions and QR Scans */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 md:gap-6">
        {/* Pending QR Scans Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <h3 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
            📱 Pending QR Scans
          </h3>
          <div className="space-y-3">
            {pendingScans.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                No pending scans...
              </p>
            ) : (
              pendingScans.map((scan) => (
                <div key={scan.scanId} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                      📱 {scan.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Patient ID: {scan.userId}
                    </p>
                    {accessingScans[scan.scanId] ? (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                        Accessing....
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Wallet: {scan.walletAddress}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Time: {new Date(scan.timestamp).toLocaleString()}
                    </p>
                  </div>
                  
                  {!accessingScans[scan.scanId] && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Enter OTP"
                        value={otpInputs[scan.scanId] || ''}
                        onChange={(e) => setOtpInputs(prev => ({ ...prev, [scan.scanId]: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGenerateOTP(scan)}
                          className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                        >
                          🔐 Generate OTP
                        </button>
                        <button
                          onClick={() => handleVerifyAccess(scan)}
                          className="flex-1 px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                        >
                          🔓 Verify & Access
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <h3 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
            Low Stock Alerts
          </h3>
          <div className="space-y-4">
            {lowStockCount === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">All items are well stocked</p>
              </div>
            ) : (
              <>
                {outOfStockItems.length > 0 && outOfStockItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                    <div 
                      className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: "rgba(220, 38, 38, 0.125)" }}
                    >
                      <FlaskConical className="size-4" style={{ color: "#dc2626" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm text-gray-800 dark:text-white/90">
                            <span className="font-semibold">{item.medication}</span>
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            0 {item.unit}
                          </p>
                        </div>
                        <span className="px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          OUT OF STOCK
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {lowStockItems.length > 0 && lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                    <div 
                      className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: "rgba(234, 88, 12, 0.125)" }}
                    >
                      <FlaskConical className="size-4" style={{ color: "#ea580c" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm text-gray-800 dark:text-white/90">
                            <span className="font-semibold">{item.medication}</span>
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {item.quantity} {item.unit}
                          </p>
                        </div>
                        <span className="px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                          LOW STOCK
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

