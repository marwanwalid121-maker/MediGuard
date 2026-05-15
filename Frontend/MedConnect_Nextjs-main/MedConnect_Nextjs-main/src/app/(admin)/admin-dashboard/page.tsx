"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Users, Activity, ArrowUp, Heart, FileText, Settings, AlertTriangle } from "lucide-react";
import { API_CONFIG, buildUrl } from "@/config/api-config";
import { ApiClient } from "@/services/api-client";

interface UnauthorizedAccess {
  id: string;
  patientId: string;
  hospitalId: string;
  accessMethod: string;
  timestamp: string;
  transaction?: {
    details?: string;
  };
}

function getTimeAgo(timestamp: string) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return past.toLocaleDateString();
}

export default function AdminDashboard() {
  const [unauthorizedAccess, setUnauthorizedAccess] = useState<UnauthorizedAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [adminCount, setAdminCount] = useState(1);
  const [patientCount, setPatientCount] = useState(0);
  const [hospitalCount, setHospitalCount] = useState(0);
  const [pharmacyCount, setPharmacyCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all users
        const usersUrl = buildUrl(API_CONFIG.adminApi, '/api/all-users');
        const usersData = await ApiClient.get(usersUrl);
        const allUsers = usersData.users || [];

        // Filter out the Attacker user
        const users = allUsers.filter((u: any) => 
          u.name !== 'Attacker' && u.id !== 'patient-attacker'
        );

        // Count users by role
        const patients = users.filter((u: any) => u.role === 'Patient');
        const hospitals = users.filter((u: any) => u.role === 'Hospital');
        const pharmacies = users.filter((u: any) => u.role === 'Pharmacy');

        setPatientCount(patients.length);
        setHospitalCount(hospitals.length);
        setPharmacyCount(pharmacies.length);
        setTotalUsers(users.length);

        // Fetch transactions
        const txUrl = buildUrl(API_CONFIG.adminApi, '/api/transactions');
        const txData = await ApiClient.get(txUrl);

        // Count only visible transactions
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

        const unauthorized = txData.filter((tx: UnauthorizedAccess) =>
          tx.accessMethod === "UNAUTHORIZED_ACCESS"
        );
        setUnauthorizedAccess(unauthorized.slice(0, 4));
        setTotalTransactions(visibleTransactions.length);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="space-y-6">
      {/* Security Module Integration Zone */}
      <div 
        className="rounded-xl border-[1px] border-dashed bg-brand-50 dark:bg-brand-500/[0.12] p-6"
        style={{
          borderColor: "#03b580",
        }}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-brand-50 dark:bg-brand-500/[0.12]">
              <ShieldCheck className="w-6 h-6" style={{ color: "#03b580" }} />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
              MediGuard Blockchain Monitoring System
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Tracking transactions
            </p>
          </div>
        </div>
      </div>

      {/* Four Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
        {/* Total Users */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Users
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {totalUsers}
              </h4>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/[0.12]">
              <Users className="size-6" style={{ color: "#03b580" }} />
            </div>
          </div>
        </div>

        {/* Security Alerts */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Security Alerts
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {unauthorizedAccess.length}
              </h4>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 dark:bg-red-500/[0.12]">
              <AlertTriangle className="size-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        {/* Total Transactions */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Transactions
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {totalTransactions}
              </h4>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/[0.12]">
              <Activity className="size-6" style={{ color: "#03b580" }} />
            </div>
          </div>
        </div>
      </div>



      {/* Users by Role and Recent Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 md:gap-6">
        {/* Users by Role Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <h3 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
            Users by Role
          </h3>
          <div className="space-y-4">
            {/* Admin */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: "#08ab7f" }}
                ></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Patients
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                {patientCount}
              </span>
            </div>

            {/* Hospital */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: "#4c97ed" }}
                ></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Hospitals
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                {hospitalCount}
              </span>
            </div>

            {/* Pharmacy */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: "#9967cf" }}
                ></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Pharmacies
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                {pharmacyCount}
              </span>
            </div>

            {/* Single Stacked Progress Bar */}
            <div className="mt-6">
              <div className="w-full h-4 bg-gray-100 rounded-full dark:bg-gray-800 overflow-hidden flex">
                <div 
                  className="h-full"
                  style={{ 
                    width: `${totalUsers > 0 ? (patientCount / totalUsers * 100) : 0}%`,
                    backgroundColor: "#08ab7f"
                  }}
                  title={`Patients: ${patientCount}`}
                ></div>
                <div 
                  className="h-full"
                  style={{ 
                    width: `${totalUsers > 0 ? (hospitalCount / totalUsers * 100) : 0}%`,
                    backgroundColor: "#4c97ed"
                  }}
                  title={`Hospitals: ${hospitalCount}`}
                ></div>
                <div 
                  className="h-full"
                  style={{ 
                    width: `${totalUsers > 0 ? (pharmacyCount / totalUsers * 100) : 0}%`,
                    backgroundColor: "#9967cf"
                  }}
                  title={`Pharmacies: ${pharmacyCount}`}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Alerts Section - UNAUTHORIZED ACCESS ONLY */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <h3 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
            Security Alerts
          </h3>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Loading...
              </div>
            ) : unauthorizedAccess.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                No unauthorized access attempts
              </div>
            ) : (
              unauthorizedAccess.map((access) => (
                <div key={access.id} className="flex items-start gap-3">
                  <div 
                    className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: "rgba(239, 68, 68, 0.125)" }}
                  >
                    <AlertTriangle className="size-4" style={{ color: "#EF4444" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-gray-800 dark:text-white/90">
                          <span className="font-semibold text-red-600 dark:text-red-400">Unauthorized Access</span>{" "}
                          <span className="text-gray-500 dark:text-gray-400">
                            {access.transaction?.details?.split('http://localhost:3003/')[0]?.split(' - ')[1]?.trim() || 'Invalid access attempt'}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Hospital: {access.hospitalId}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {getTimeAgo(access.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

