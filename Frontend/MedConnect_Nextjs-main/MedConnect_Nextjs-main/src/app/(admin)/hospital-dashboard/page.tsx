"use client";
import type { Metadata } from "next";
import React, { useState, useEffect } from "react";
import { ShieldCheck, Users, Activity, ArrowUp, Heart, FileText, Settings, Plus, FilePenLine, Clock, CalendarCheck, CirclePlus } from "lucide-react";
import Avatar from "@/components/ui/avatar/Avatar";
import Badge from "@/components/ui/badge/Badge";
import { API_CONFIG, buildUrl, DEFAULT_ENTITIES } from "@/config/api-config";
import { ApiClient } from "@/services/api-client";

// Get hospital info from localStorage (set during login)
const getHospitalInfo = () => {
  if (typeof window !== 'undefined') {
    return {
      id: localStorage.getItem('hospitalId') || DEFAULT_ENTITIES.hospital.id,
      wallet: localStorage.getItem('hospitalWallet') || DEFAULT_ENTITIES.hospital.wallet,
      name: localStorage.getItem('hospitalName') || DEFAULT_ENTITIES.hospital.name
    };
  }
  return DEFAULT_ENTITIES.hospital;
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

export default function HospitalDashboard() {
  const [pendingScans, setPendingScans] = useState<PendingScan[]>([]);
  const [otpInputs, setOtpInputs] = useState<{[key: string]: string}>({});
  const [accessingScans, setAccessingScans] = useState<{[key: string]: boolean}>({});
  const [totalAppointments, setTotalAppointments] = useState(0);

  useEffect(() => {
    fetchPendingScans();
    const interval = setInterval(fetchPendingScans, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingScans = async () => {
    try {
      const res = await ApiClient.get(buildUrl(API_CONFIG.hospitalApi, '/api/pending-scans'));
      const data = res;
      if (data.success) {
        setPendingScans(data.scans);
        // Update total appointments: current pending + all previous appointments
        setTotalAppointments(prev => {
          // If this is first load, set to pending count
          if (prev === 0) return data.scans.length;
          // Otherwise keep accumulating
          return prev;
        });
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
        alert(`OTP Sent`);
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
    
    const hospitalInfo = getHospitalInfo();

    try {
      const res = await ApiClient.post(buildUrl(API_CONFIG.hospitalApi, '/api/verify-otp'), {
        otp,
        patientWallet: scan.walletAddress,
        hospitalId: hospitalInfo.id,
        hospitalWallet: hospitalInfo.wallet
      });
      const data = res;

      if (data.success) {
        // Log OTP_VERIFIED transaction and WAIT for it to complete
        try {
          const txRes = await ApiClient.post(buildUrl(API_CONFIG.adminApi, '/api/record-transaction'), {
            patientId: scan.userId,
            hospitalId: hospitalInfo.id,
            accessMethod: 'OTP_VERIFIED',
            transaction: {
              id: `otp_verified_${Date.now()}`,
              type: 'OTP_VERIFIED',
              fromWallet: scan.walletAddress,
              toWallet: hospitalInfo.wallet,
              timestamp: new Date().toISOString(),
              status: 'completed'
            }
          });
          await txRes;
          console.log('OTP_VERIFIED transaction logged successfully');
        } catch (err) {
          console.error('Failed to log OTP_VERIFIED transaction:', err);
        }
        
        // Small delay to ensure transaction is saved
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Increment total appointments when accessing a patient
        setTotalAppointments(prev => prev + 1);
        
        // Navigate to patients page with session ID (hospital-specific)
        window.location.href = `/patients?sessionId=${data.sessionId}&type=hospital`;
      } else {
        alert('Access Denied: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to verify OTP:', error);
      alert('Verification failed');
    } finally {
      setAccessingScans(prev => ({ ...prev, [scan.scanId]: false }));
    }
  };

  return (
    <div className="space-y-6">
   
      {/* Two Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
        {/* Pending Appointments */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Pending Appointments
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {pendingScans.length}
              </h4>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/[0.12]">
              <Clock className="size-6" style={{ color: "#03b580" }} />
            </div>
          </div>
        </div>

        {/* Total Appointments */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Appointments
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {totalAppointments}
              </h4>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/[0.12]">
              <CalendarCheck className="size-6" style={{ color: "#03b580" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Pending QR Scans */}
      <div className="grid grid-cols-1 gap-4 md:gap-6">
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
                        Wallet: {scan.walletAddress.substring(0, 6)}{'•'.repeat(36)}
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


      </div>
    </div>
  );
}
