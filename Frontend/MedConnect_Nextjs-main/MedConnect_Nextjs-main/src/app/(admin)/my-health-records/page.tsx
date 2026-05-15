"use client";

import React, { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { API_CONFIG, buildUrl } from "@/config/api-config";
import { ApiClient } from "@/services/api-client";

interface HealthRecord {
  hospital: string;
  date: string;
  notes: string;
}

export default function MyHealthRecords() {
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const token = localStorage.getItem('patientToken');
        if (!token) {
          setLoading(false);
          return;
        }
        
        const res = await ApiClient.get(buildUrl(API_CONFIG.patientApi, '/api/profile'), localStorage.getItem('patientToken') || undefined);
        const data = res;
        
        if (data.success && data.profile) {
          const visits = data.profile.medicalData?.visits || [];
          const records = visits.map((visit: any) => {
            return {
              hospital: visit.hospital,
              date: visit.date,
              notes: visit.note
            };
          });
          setHealthRecords(records);
        }
      } catch (error) {
        console.error("Failed to fetch patient data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Metric Card */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Health Records
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {healthRecords.length}
              </h4>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/[0.12]">
              <FileText className="size-6" style={{ color: "#03b580" }} />
            </div>
          </div>
        </div>
      </div>

      {/* My Health Records Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <h3 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
          My Health Records
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : healthRecords.length > 0 ? (
            healthRecords.map((record, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                <div 
                  className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                  style={{ 
                    backgroundColor: "#4280d2" + "20",
                  }}
                >
                  <FileText className="size-4" style={{ color: "#4280d2" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 dark:text-white/90 font-semibold">
                        {record.hospital}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        📅 {record.date}
                      </p>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {record.notes}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No health records available</p>
          )}
        </div>
      </div>
    </div>
  );
}
