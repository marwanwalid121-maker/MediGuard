"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import Image from "next/image";
import { PencilIcon, TrashBinIcon, HorizontaLDots, PlusIcon, ChevronDownIcon, EyeIcon, CheckCircleIcon } from "@/icons";
import Select from "@/components/form/Select";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { FileText, Clock, ShieldCheck, User, Heart, Calendar, Pill } from "lucide-react";
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

interface PatientData {
  id: string;
  name: string;
  age: string;
  phone: string;
  walletAddress: string;
  bloodType: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  prescriptionStatuses?: { [key: number]: string }; // Add prescription statuses
  fullMedicalHistory: {
    records: Array<{
      date: string;
      hospital: string;
      doctor: string;
      notes: string;
      prescription: string;
    }>;
    lastUpdated: string;
  };
  accessTime: string;
}

interface Prescription {
  id: number;
  patientAvatar: string;
  patientName: string;
  patientEmail: string;
  medication: string;
  dosage: string;
  pharmacy: string;
  status: "Pending" | "Dispensed" | "Cancelled";
  dateIssued: string;
}

// Function to get updated prescription data from blockchain (copied from patient dashboard)
const getPrescriptionsFromBlockchain = async (patientId: string) => {
  try {
    console.log('🔍 Fetching updated prescription data from blockchain...');

    // Get patient data from admin server which has the updated prescriptions
    const response = await ApiClient.get(buildUrl(API_CONFIG.adminApi, '/api/patients'));
    const patients = response;
    
    if (Array.isArray(patients)) {
      // Find the current patient
      const currentPatient = patients.find((p: any) => p.id === patientId);
      
      if (currentPatient && currentPatient.prescriptions) {
        console.log('📋 Found updated prescriptions in blockchain:', currentPatient.prescriptions);
        return currentPatient.prescriptions.map((p: any) => ({
          id: p.id,
          name: p.name, // Keep as 'name' for prescription queue
          dosage: p.dosage,
          status: p.status
        }));
      }
    }
    
    return [];
  } catch (error) {
    console.error('❌ Failed to fetch prescriptions from blockchain:', error);
    return [];
  }
};

// Removed hardcoded stub data - prescriptions now come from blockchain only

export default function PrescriptionQueue() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const sessionType = searchParams.get('type');
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isAddPrescriptionModalOpen, setIsAddPrescriptionModalOpen] = useState(false);
  const [isViewPrescriptionModalOpen, setIsViewPrescriptionModalOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(false);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  
  // Load prescriptions from blockchain when patient data is available
  useEffect(() => {
    console.log('🔄 useEffect triggered - patientData:', patientData);
    
    if (patientData && patientData.id) {
      // Always fetch fresh data from blockchain to get latest prescription statuses
      const fetchBlockchainPrescriptions = async () => {
        console.log('🔍 Fetching latest prescriptions from blockchain for patient:', patientData.id);
        const blockchainPrescriptions = await getPrescriptionsFromBlockchain(patientData.id);
        
        if (blockchainPrescriptions.length > 0) {
          console.log('✅ Using prescriptions from blockchain:', blockchainPrescriptions);
          setPrescriptions(blockchainPrescriptions);
        } else {
          console.log('⚠️ No prescriptions found in blockchain');
          setPrescriptions([]);
        }
      };
      
      fetchBlockchainPrescriptions();
    } else {
      console.log('❌ No patient data available yet');
    }
  }, [patientData]);
  const [formData, setFormData] = useState({
    patientName: "",
    medication: "",
    dosage: "",
    pharmacy: "",
    status: "",
    dateIssued: "",
  });

  // Fetch patient session data if sessionId exists
  useEffect(() => {
    if (sessionId && sessionType === 'pharmacy') {
      fetchPatientSession();
    }
  }, [sessionId, sessionType]);

  const fetchPatientSession = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const response = await ApiClient.get(buildUrl(API_CONFIG.hospitalApi, `/api/session/${sessionId}`));
      const data = response;
      
      if (data.success && data.session) {
        console.log('📋 Full session data received:', data.session);
        console.log('📋 Patient data:', data.session.patientData);
        console.log('📋 Prescriptions in patient data:', data.session.patientData?.prescriptions);
        
        setPatientData(data.session.patientData);
      }
    } catch (error) {
      console.error('Failed to fetch patient session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendBack = async () => {
    if (!sessionId || !patientData) return;
    
    try {
      const pharmacyInfo = getPharmacyInfo();
      const token = typeof window !== 'undefined' ? localStorage.getItem('patientToken') : null;
      
      // Get patient wallet - if not in session data, fetch from blockchain
      let patientWallet = patientData.walletAddress;
      
      if (!patientWallet) {
        console.log('⚠️ Patient wallet not in session, fetching from blockchain...');
        try {
          const patientsResponse = await ApiClient.get(buildUrl(API_CONFIG.adminApi, '/api/patients'));
          const patients = patientsResponse;
          const patient = patients.find((p: any) => p.id === patientData.id);
          if (patient && patient.walletAddress) {
            patientWallet = patient.walletAddress;
            console.log('✅ Patient wallet fetched:', patientWallet);
          }
        } catch (err) {
          console.error('❌ Failed to fetch patient wallet:', err);
        }
      }
      
      if (!patientWallet) {
        alert('❌ Cannot send back: Patient wallet address not found');
        return;
      }
      
      // Update all pending to dispensed
      setPrescriptions(prev => 
        prev.map(p => 
          p.status === 'PENDING' 
            ? { ...p, status: 'DISPENSED' }
            : p
        )
      );
      
      // Call pharmacy server to record send back transaction
      console.log('Recording send back transaction...');

      const response = await ApiClient.post(
        buildUrl(API_CONFIG.pharmacyApi, '/api/pharmacy/send-back'),
        {
          transactionId: sessionId,
          patientId: patientData.id,
          patientName: patientData.name,
          pharmacyId: pharmacyInfo.id,
          pharmacyName: pharmacyInfo.name,
          pharmacyWallet: pharmacyInfo.wallet,
          toWallet: patientWallet
        },
        token || undefined
      );

      if (response) {
        console.log('✅ Send back recorded in blockchain');
        alert('✅ All medications processed!');
        
        // Verify pharmacy info is still in localStorage before redirect
        const pharmacyInfo = getPharmacyInfo();
        console.log('📋 Pharmacy info before redirect:', pharmacyInfo);
        console.log('📋 localStorage patientName:', localStorage.getItem('patientName'));
        console.log('📋 localStorage pharmacyName:', localStorage.getItem('pharmacyName'));
        
        // Use router.push instead of window.location.href to avoid full page reload
        window.location.href = '/pharmacy-dashboard';
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
      
    } catch (error) {
      console.error('Send back error:', error);
      alert('❌ Failed to send back: ' + error.message);
    }
  };

  const handleToggleMedicationStatus = async (prescriptionId: number) => {
    const prescription = prescriptions.find(p => p.id === prescriptionId);
    if (!prescription) return;
    
    const newStatus = prescription.status === 'PENDING' ? 'DISPENSED' : 'PENDING';
    const pharmacyInfo = getPharmacyInfo();
    
    console.log(`Button clicked: ${prescription.name} - ${prescription.status} → ${newStatus}`);
    console.log(`Pharmacy info:`, pharmacyInfo);
    
    try {
      // Update local state first
      setPrescriptions(prev => 
        prev.map(p => 
          p.id === prescriptionId 
            ? { ...p, status: newStatus }
            : p
        )
      );
      
      // Call admin server using the correct endpoint
      console.log('Recording status update in blockchain...');

      const response = await ApiClient.post(buildUrl(API_CONFIG.adminApi, '/api/update-patient-prescription'), {
        patientId: patientData?.id || 'patient-001',
        prescriptionId: prescriptionId,
        medicationName: prescription.name,
        dosage: prescription.dosage,
        newStatus: newStatus,
        pharmacyId: pharmacyInfo.id,
        pharmacyName: pharmacyInfo.name,
        timestamp: new Date().toISOString()
      });

      if (response) {
        console.log(`✅ Status updated in blockchain: ${prescription.name} → ${newStatus}`);
        
        // Refresh prescriptions from blockchain to get updated status
        if (patientData && patientData.id) {
          const blockchainPrescriptions = await getPrescriptionsFromBlockchain(patientData.id);
          if (blockchainPrescriptions.length > 0) {
            setPrescriptions(blockchainPrescriptions);
          }
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
      
    } catch (error) {
      console.error('Failed to update medication status:', error);
      // Revert state change if update fails
      setPrescriptions(prev => 
        prev.map(p => 
          p.id === prescriptionId 
            ? { ...p, status: prescription.status }
            : p
        )
      );
    }
  };

  // If we have a pharmacy session, show patient data view
  if (sessionId && sessionType === 'pharmacy') {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading patient data...</p>
          </div>
        </div>
      );
    }

    if (!patientData) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400">❌ No patient data found for this session</p>
            <button 
              onClick={() => window.location.href = '/pharmacy-dashboard'}
              className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }

    // Pharmacy Patient Data View (Read-only)
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
              Patient Information - Pharmacy View
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Read-only access • Session ID: {sessionId}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.href = '/pharmacy-dashboard'}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
            >
              Back to Dashboard
            </button>
            <button
              onClick={handleSendBack}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors"
            >
              📤 Send Back to Admin
            </button>
          </div>
        </div>

        {/* Patient Basic Info Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/[0.12]">
                <User className="size-6" style={{ color: "#03b580" }} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                  {patientData.name}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Patient Name</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/[0.12]">
                <Calendar className="size-6" style={{ color: "#3B82F6" }} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                  {patientData.age} years
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Age</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 dark:bg-red-500/[0.12]">
                <Heart className="size-6" style={{ color: "#EF4444" }} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                  {patientData.bloodType}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Blood Type</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-500/[0.12]">
                <Pill className="size-6" style={{ color: "#8B5CF6" }} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                  {prescriptions.filter(p => p.status === 'PENDING').length + prescriptions.filter(p => p.status === 'DISPENSED').length}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Recent Prescriptions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Patient Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Medical Information */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
              Medical Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Allergies</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {patientData.allergies?.length > 0 ? (
                    patientData.allergies.map((allergy, index) => (
                      <span key={index} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full dark:bg-red-500/15 dark:text-red-400">
                        {allergy}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">No known allergies</span>
                  )}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Conditions</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {patientData.conditions?.length > 0 ? (
                    patientData.conditions.map((condition, index) => (
                      <span key={index} className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full dark:bg-yellow-500/15 dark:text-yellow-400">
                        {condition}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">No conditions recorded</span>
                  )}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Medications</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {patientData.medications?.length > 0 ? (
                    patientData.medications.map((medication, index) => (
                      <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full dark:bg-blue-500/15 dark:text-blue-400">
                        {medication}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">No current medications</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Prescriptions */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
              Recent Prescriptions
            </h3>
            <div className="space-y-4">
              {prescriptions.map((prescription) => (
                <div key={prescription.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800 dark:text-white/90">{prescription.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {prescription.dosage}
                    </p>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => handleToggleMedicationStatus(prescription.id)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        prescription.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-500/25'
                          : 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/25'
                      }`}
                    >
                      {prescription.status}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Medical History */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
            Medical History (Read-Only)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Hospital</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Doctor</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Notes</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">Prescription</th>
                </tr>
              </thead>
              <tbody>
                {patientData.fullMedicalHistory?.records?.length > 0 ? (
                  patientData.fullMedicalHistory.records.map((record, index) => (
                    <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-3 px-3 text-sm text-gray-800 dark:text-white/90">{record.date}</td>
                      <td className="py-3 px-3 text-sm text-gray-800 dark:text-white/90">{record.hospital}</td>
                      <td className="py-3 px-3 text-sm text-gray-800 dark:text-white/90">{record.doctor}</td>
                      <td className="py-3 px-3 text-sm text-gray-800 dark:text-white/90">{record.notes}</td>
                      <td className="py-3 px-3 text-sm text-gray-800 dark:text-white/90">{record.prescription}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 dark:text-gray-400">
                      No medical history available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const statusOptions = [
    { value: "", label: "All Status" },
    { value: "Pending", label: "Pending" },
    { value: "Dispensed", label: "Dispensed" },
    { value: "Cancelled", label: "Cancelled" },
  ];

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCreatePrescription = () => {
    // Handle create prescription logic here
    console.log("Creating prescription:", formData);
    // Reset form and close modal
    setFormData({ patientName: "", medication: "", dosage: "", pharmacy: "", status: "", dateIssued: "" });
    setIsAddPrescriptionModalOpen(false);
  };

  const handleCancel = () => {
    setFormData({ patientName: "", medication: "", dosage: "", pharmacy: "", status: "", dateIssued: "" });
    setIsAddPrescriptionModalOpen(false);
  };

  const handleViewPrescription = (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    setIsViewPrescriptionModalOpen(true);
  };

  const handleCloseViewModal = () => {
    setIsViewPrescriptionModalOpen(false);
    setSelectedPrescription(null);
  };

  const handleCancelPrescription = (prescription: Prescription) => {
    // Handle cancel prescription logic here
    console.log("Cancelling prescription:", prescription.id);
    // Update prescription status to Cancelled
    // In a real app, you would update the state or make an API call
  };

  return (
    <div className="space-y-6">
      {/* Prescriptions Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-8 dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="flex flex-col items-center gap-2">
          <CheckCircleIcon className="w-16 h-16 text-gray-500 dark:text-gray-400" />
          <p className="text-center text-lg font-semibold text-gray-800 dark:text-white/90">
            No Prescription In queue
          </p>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            All prescriptions have been processed!
          </p>
        </div>
      </div>
    </div>
  );
}

