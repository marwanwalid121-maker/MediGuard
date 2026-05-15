"use client";
import type { Metadata } from "next";
import React, { useState, useEffect } from "react";
import { ShieldCheck, Users, Activity, ArrowUp, Heart, FileText, Settings, Plus, FilePenLine, FlaskConical, Calendar, AlertTriangle } from "lucide-react";
import { API_CONFIG, buildUrl } from "@/config/api-config";
import { ApiClient } from "@/services/api-client";

// Function to get updated prescription data from blockchain
const getPrescriptionsFromBlockchain = async (patientId: string) => {
  try {
    console.log('🔍 Fetching updated prescription data from blockchain...');

    // Get patient data from admin server which has the updated prescriptions
    const patientsUrl = buildUrl(API_CONFIG.adminApi, '/api/patients');
    const patients = await ApiClient.get(patientsUrl);

    if (Array.isArray(patients)) {
      // Find the current patient
      const currentPatient = patients.find((p: any) => p.id === patientId);

      if (currentPatient && currentPatient.prescriptions) {
        console.log('📋 Found updated prescriptions in blockchain:', currentPatient.prescriptions);
        return currentPatient.prescriptions.map((p: any) => ({
          id: p.id,
          medication: p.name,
          dosage: p.dosage,
          status: p.status,
          date: new Date().toISOString().split('T')[0],
          doctor: 'Hospital Staff',
          hospital: 'Medical Center'
        }));
      }
    }
    
    return [];
  } catch (error) {
    console.error('❌ Failed to fetch prescriptions from blockchain:', error);
    return [];
  }
};

export default function AdminDashboard() {
  const [patientData, setPatientData] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const token = localStorage.getItem('patientToken');
        if (!token) {
          console.error("No token found");
          setLoading(false);
          return;
        }
        
        const res = await fetch(buildUrl(API_CONFIG.patientApi, '/api/profile'), {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        
        if (data.success && data.profile) {
          setPatientData({
            name: data.profile.name,
            age: data.profile.medicalData?.age || data.profile.age || 45,
            bloodType: data.profile.medicalData?.bloodType,
            allergies: data.profile.medicalData?.allergies,
            conditions: data.profile.medicalData?.conditions,
            medications: data.profile.medicalData?.medications
          });
          
          // Load prescriptions from medical history - check both visits and fullMedicalHistory
          const medicalHistory = data.profile.medicalData?.fullMedicalHistory;
          const visits = data.profile.medicalData?.visits;
          let allPrescriptions = [];
          
          console.log('Full Profile Data:', data.profile);
          console.log('Medical Data:', data.profile.medicalData);
          console.log('Medical History:', medicalHistory);
          console.log('Visits:', visits);
          
          // Check visits array first (this seems to be where your data is)
          if (visits && Array.isArray(visits)) {
            console.log('Processing visits array:', visits.length, 'visits found');
            console.log('First few visits:', visits.slice(0, 3)); // Show first 3 visits in detail
            
            allPrescriptions = visits
              .filter((visit, index) => {
                console.log(`Visit ${index}:`, visit);
                console.log(`Visit ${index} note:`, visit.note); // Changed from 'notes' to 'note'
                console.log(`Visit ${index} prescription:`, visit.prescription);
                
                // Look for prescription in note field (singular, not notes)
                const hasNoteWithPrescription = visit.note && visit.note.includes('Prescription:');
                const hasPrescriptionField = visit.prescription && visit.prescription !== "N/A" && visit.prescription.trim() !== "";
                
                console.log(`Visit ${index} - hasNoteWithPrescription:`, hasNoteWithPrescription);
                console.log(`Visit ${index} - hasPrescriptionField:`, hasPrescriptionField);
                
                return hasNoteWithPrescription || hasPrescriptionField;
              })
              .map((visit, index) => {
                // Extract prescription from note or prescription field
                let prescriptionText = "";
                if (visit.note && visit.note.includes('Prescription:')) {
                  prescriptionText = visit.note; // Changed from 'notes' to 'note'
                } else if (visit.prescription) {
                  prescriptionText = visit.prescription;
                }
                
                console.log('Processing prescription text:', prescriptionText);
                
                // Extract medication name - look for pattern "Prescription: MedicationName - ..."
                let medicationName = "";
                if (prescriptionText.includes("Prescription: ")) {
                  const afterPrescription = prescriptionText.split("Prescription: ")[1];
                  medicationName = afterPrescription.split(" - ")[0] || afterPrescription.split(" ")[0];
                } else {
                  medicationName = prescriptionText.split(" - ")[0] || prescriptionText.split(" ")[0];
                }
                
                // Extract dosage (everything after medication name)
                let dosageInfo = "";
                if (prescriptionText.includes("Prescription: ")) {
                  const afterPrescription = prescriptionText.split("Prescription: ")[1];
                  if (afterPrescription.includes(" - ")) {
                    dosageInfo = afterPrescription.split(" - ").slice(1).join(" - ");
                  }
                } else if (prescriptionText.includes(" - ")) {
                  dosageInfo = prescriptionText.split(" - ").slice(1).join(" - ");
                }
                
                // All new prescriptions default to PENDING status
                let status = "PENDING";
                
                const prescription = {
                  id: `${visit.date}-${index}`,
                  medication: medicationName.trim(),
                  dosage: dosageInfo.trim(),
                  date: visit.date,
                  status: status,
                  doctor: visit.doctor || "Unknown",
                  hospital: visit.hospital || "Unknown"
                };
                
                console.log('Created prescription object:', prescription);
                return prescription;
              })
              .filter(prescription => {
                const isValidStatus = prescription.status === "PENDING" || prescription.status === "DISPENSED";
                const hasMedication = prescription.medication && prescription.medication.trim() !== "";
                console.log(`Prescription ${prescription.medication} - Status: ${prescription.status}, Valid: ${isValidStatus && hasMedication}`);
                return isValidStatus && hasMedication;
              })
              .slice(-10) // Show last 10 prescriptions
              .reverse(); // Show newest first
          }
          
          // Fallback to fullMedicalHistory.records if visits didn't work
          if (allPrescriptions.length === 0 && medicalHistory && medicalHistory.records && Array.isArray(medicalHistory.records)) {
            console.log('Fallback: Processing medical history records:', medicalHistory.records.length);
            
            allPrescriptions = medicalHistory.records
              .filter(record => {
                console.log('Processing record:', record);
                return record.prescription && 
                       record.prescription !== "N/A" && 
                       record.prescription.trim() !== "" &&
                       record.prescription.toLowerCase() !== "n/a";
              })
              .map((record, index) => {
                const prescriptionText = record.prescription;
                console.log('Processing prescription:', prescriptionText);
                
                let medicationName = "";
                if (prescriptionText.includes("Prescription: ")) {
                  const afterPrescription = prescriptionText.split("Prescription: ")[1];
                  medicationName = afterPrescription.split(" - ")[0] || afterPrescription.split(" ")[0];
                } else {
                  medicationName = prescriptionText.split(" - ")[0] || prescriptionText.split(" ")[0];
                }
                
                let dosageInfo = "";
                if (prescriptionText.includes(" - ")) {
                  const parts = prescriptionText.split(" - ");
                  dosageInfo = parts.slice(1).join(" - ");
                }
                
                let status = "PENDING";
                
                const prescription = {
                  id: `${record.date}-${index}`,
                  medication: medicationName.trim(),
                  dosage: dosageInfo.trim(),
                  date: record.date,
                  status: status,
                  doctor: record.doctor || "Unknown",
                  hospital: record.hospital || "Unknown"
                };
                
                console.log('Created prescription object:', prescription);
                return prescription;
              })
              .filter(prescription => {
                const isValidStatus = prescription.status === "PENDING" || prescription.status === "DISPENSED";
                console.log(`Prescription ${prescription.medication} - Status: ${prescription.status}, Valid: ${isValidStatus}`);
                return isValidStatus;
              })
              .slice(-10)
              .reverse();
          }
          
          console.log('Final filtered prescriptions:', allPrescriptions);
          
          // First try to get prescriptions from blockchain (updated data)
          const token = localStorage.getItem('patientToken');
          let patientId = 'patient-002'; // Default fallback
          
          // Try to extract patient ID from token or profile
          if (data.profile && data.profile.id) {
            patientId = data.profile.id;
          }
          
          console.log('🔍 Looking for prescriptions for patient ID:', patientId);
          
          // Get updated prescriptions from blockchain first
          const blockchainPrescriptions = await getPrescriptionsFromBlockchain(patientId);
          
          if (blockchainPrescriptions.length > 0) {
            console.log('✅ Using prescriptions from blockchain:', blockchainPrescriptions);
            setPrescriptions(blockchainPrescriptions);
          } else if (allPrescriptions.length > 0) {
            // If no blockchain prescriptions found, use prescriptions from medical history
            console.log('⚠️ No blockchain prescriptions found, using medical history prescriptions:', allPrescriptions);
            setPrescriptions(allPrescriptions);
          } else {
            console.log('⚠️ No prescriptions found in blockchain or medical history');
            setPrescriptions([]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch patient data:", error);
        setPrescriptions([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, []);
  return (
    <div className="space-y-6">
      {/* welcome message */}
      <div 
        className="rounded-xl border-[1px] border-dashed p-6 relative"
        style={{
          borderColor: "#03b580",
          background: "linear-gradient(to right, #fe9900, #ff6a00)",
        }}
      >
        <div className="flex items-start gap-4">
          
          <div className="flex-1">
            <h3 className="mb-2 text-2xl font-semibold text-white">
              Welcome back, {loading ? "Loading..." : patientData?.name || "Patient"}!
            </h3>
            <p className="text-sm text-white/90">
              Here is your health summary
            </p>
          </div>
        </div>
        <div className="absolute top-6 right-6 flex items-center gap-6">
          <div className="text-right">
            <div className="text-white font-semibold text-lg">{loading ? "..." : (patientData?.age || "--")}</div>
            <div className="text-white/90 text-sm">Age</div>
          </div>
          <div className="text-right">
            <div className="text-white font-semibold text-lg">{loading ? "..." : (patientData?.bloodType || "--")}</div>
            <div className="text-white/90 text-sm">Blood Type</div>
          </div>
        </div>
      </div>

      {/* Three Action Sections */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 md:gap-6">
        {/* Health Records */}
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
                Health Records
              </h4>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                View your medical history
              </p>
            </div>
          </div>
        </div>
        {/* Prescriptions */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center justify-center w-12 h-12 rounded-xl"
              style={{ 
                backgroundColor: "#9967cf" + "20", // 20 hex = ~12.5% opacity
              }}
            >
              <FlaskConical className="size-6" style={{ color: "#9967cf" }} />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                Prescriptions
              </h4>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Track your medications
              </p>
            </div>
          </div>
        </div>
        {/* QR Access */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/[0.12]">
              <svg className="size-6" style={{ color: "#03b580" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                QR Access
              </h4>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Generate QR for hospital access
              </p>
            </div>
          </div>
        </div>
        {/* My Profile */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center justify-center w-12 h-12 rounded-xl"
              style={{ 
                backgroundColor: "#ca8a04" + "20", // 20 hex = ~12.5% opacity
              }}
            >
              <Users className="size-6" style={{ color: "#ca8a04" }} />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                My Profile
              </h4>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                View your medical information
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Appointments and Recent Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 md:gap-6">
        {/* Medical Information Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <h3 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
            📋 Medical Information
          </h3>
          <div className="space-y-4">
            {/* Blood Type */}
            <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
              <div 
                className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                style={{ backgroundColor: "rgba(220, 38, 38, 0.125)" }}
              >
                <Heart className="size-4" style={{ color: "#dc2626" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-white/90">
                  <span className="font-semibold">Blood Type</span>
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {loading ? "Loading..." : (patientData?.bloodType || "Not available")}
                </p>
              </div>
            </div>

            {/* Allergies */}
            <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
              <div 
                className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                style={{ backgroundColor: "rgba(234, 88, 12, 0.125)" }}
              >
                <AlertTriangle className="size-4" style={{ color: "#ea580c" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-white/90">
                  <span className="font-semibold">Allergies</span>
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {loading ? "Loading..." : (patientData?.allergies?.join(", ") || "Not available")}
                </p>
              </div>
            </div>

            {/* Conditions */}
            <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
              <div 
                className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                style={{ backgroundColor: "rgba(66, 128, 210, 0.125)" }}
              >
                <Activity className="size-4" style={{ color: "#4280d2" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-white/90">
                  <span className="font-semibold">Conditions</span>
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {loading ? "Loading..." : (patientData?.conditions?.join(", ") || "Not available")}
                </p>
              </div>
            </div>

            {/* Medications */}
            <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
              <div 
                className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                style={{ backgroundColor: "rgba(153, 103, 207, 0.125)" }}
              >
                <FlaskConical className="size-4" style={{ color: "#9967cf" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-white/90">
                  <span className="font-semibold">Medications</span>
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {loading ? "Loading..." : (patientData?.medications?.join(", ") || "Not available")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Prescriptions Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <h3 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
            Recent Prescriptions
          </h3>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">Loading prescriptions...</p>
              </div>
            ) : prescriptions.length > 0 ? (
              prescriptions.map((prescription, index) => (
                <div key={prescription.id} className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                  <div 
                    className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                    style={{ 
                      backgroundColor: "#9967cf" + "20", // 20 hex = ~12.5% opacity
                    }}
                  >
                    <FlaskConical className="size-4" style={{ color: "#9967cf" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-gray-800 dark:text-white/90">
                          <span className="font-semibold">{prescription.medication}</span>
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {prescription.dosage.replace(prescription.medication, '').replace(' - ', '').trim()}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                        prescription.status === 'DISPENSED' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {prescription.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No pending or dispensed prescriptions found.</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

