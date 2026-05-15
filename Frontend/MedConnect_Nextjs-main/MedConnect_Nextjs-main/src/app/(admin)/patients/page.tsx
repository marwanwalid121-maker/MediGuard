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
import Image from "next/image";
import { PencilIcon, TrashBinIcon, HorizontaLDots, PlusIcon, ChevronDownIcon, EyeIcon } from "@/icons";
import Select from "@/components/form/Select";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useSearchParams } from "next/navigation";
import { API_CONFIG, buildUrl, DEFAULT_ENTITIES } from "@/config/api-config";
import { ApiClient } from "@/services/api-client";

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

interface MedicalRecord {
  date: string;
  hospital: string;
  doctor: string;
  notes: string;
  prescription: string;
}

interface Patient {
  id: string;
  avatar: string;
  name: string;
  email: string;
  phone: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  bloodType: string;
  status: "New" | "Follow-up";
  walletAddress?: string;
  accessTime?: string;
  allergies?: string[];
  conditions?: string[];
  medications?: string[];
  fullMedicalHistory?: {
    records: MedicalRecord[];
    lastUpdated: string;
  };
}

export default function Patients() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const type = searchParams.get('type');
  
  const [patientsData, setPatientsData] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [isViewPatientModalOpen, setIsViewPatientModalOpen] = useState(false);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [newAppointment, setNewAppointment] = useState({
    date: "",
    hospital: "",
    doctor: "",
    type: "Routine Checkup",
    notes: "",
    prescription: "",
    dosageTablets: "",
    dosageTimesDaily: "",
    durationDays: ""
  });
  const [editingRecordIndex, setEditingRecordIndex] = useState<number | null>(null);
  const [editedRecord, setEditedRecord] = useState({ hospital: "", doctor: "", notes: "", prescription: "" });
  const [sentBack, setSentBack] = useState(false);
  const [isEditingView, setIsEditingView] = useState(false);
  const [editedData, setEditedData] = useState({
    age: "",
    gender: "",
    bloodType: "",
    allergies: "",
    conditions: "",
    medications: ""
  });
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    gender: "",
    bloodType: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    if (sessionId && type === 'hospital') {
      // Preserve existing hospital login, don't overwrite with defaults
      fetchPatientFromSession(sessionId);
    } else if (sessionId) {
      fetchPatientFromSession(sessionId);
    } else {
      setLoading(false);
    }
    // Load medications from pharmacy inventory
    loadMedications();
  }, [sessionId, type]);

  const loadMedications = async () => {
    try {
      const response = await ApiClient.get(buildUrl(API_CONFIG.pharmacyApi, `/api/pharmacy/inventory-public/${DEFAULT_ENTITIES.pharmacy.id}`));
      if (response) {
        const data = response;
        if (data.success && data.inventory) {
          setMedications(data.inventory);
        }
      }
    } catch (error) {
      console.error('Failed to load medications:', error);
    }
  };

  const fetchPatientFromSession = async (sessionId: string) => {
    try {
      const res = await ApiClient.get(buildUrl(API_CONFIG.hospitalApi, `/api/session/${sessionId}`));
      const data = res;
      
      if (data.success && data.session) {
        const patientData = data.session.patientData;
        const patient: Patient = {
          id: patientData.id,
          avatar: "/images/user/user-17.jpg",
          name: patientData.name,
          email: `${patientData.id}@mediguard.com`,
          phone: patientData.phone || "N/A",
          age: calculateAge(patientData),
          gender: patientData.gender || "Male",
          bloodType: patientData.bloodType,
          status: "New",
          walletAddress: patientData.walletAddress,
          accessTime: patientData.accessTime
        };
        setPatientsData([patient]);
      }
    } catch (error) {
      console.error('Failed to fetch patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (patientData: any) => {
    return patientData.age || 45;
  };

  const getMedicationOptions = () => {
    return medications.map(med => {
      const isAvailable = med.quantity > 100;
      const status = med.quantity > 100 ? 'In Stock' : med.quantity > 0 ? 'Low Stock' : 'Out of Stock';
      return {
        value: med.medication,
        label: `${med.medication} (${med.quantity} ${med.unit}) - ${status}`,
        disabled: !isAvailable,
        status: status
      };
    });
  };

  const formatPrescription = () => {
    if (newAppointment.prescription && newAppointment.dosageTablets && newAppointment.dosageTimesDaily && newAppointment.durationDays) {
      return `${newAppointment.prescription} - ${newAppointment.dosageTablets} tablets, ${newAppointment.dosageTimesDaily} times daily • ${newAppointment.durationDays} days supply`;
    }
    return newAppointment.prescription;
  };



  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCreatePatient = () => {
    // Handle create patient logic here
    console.log("Creating patient:", formData);
    // Reset form and close modal
    setFormData({ fullName: "", dateOfBirth: "", gender: "", bloodType: "", email: "", phone: "", address: "" });
    setIsAddPatientModalOpen(false);
  };

  const handleCancel = () => {
    setFormData({ fullName: "", dateOfBirth: "", gender: "", bloodType: "", email: "", phone: "", address: "" });
    setIsAddPatientModalOpen(false);
  };

  const handleViewPatient = async (patient: Patient) => {
    if (sessionId) {
      try {
        const res = await ApiClient.get(buildUrl(API_CONFIG.hospitalApi, `/api/session/${sessionId}`));
        const data = res;
        if (data.success && data.session) {
          const fullData = data.session.patientData;
          const patientData = {
            id: fullData.id,
            avatar: patient.avatar,
            name: fullData.name,
            email: `${fullData.id}@mediguard.com`,
            phone: fullData.phone || "N/A",
            age: patient.age,
            gender: fullData.gender || "Male",
            bloodType: fullData.bloodType,
            status: "New",
            walletAddress: fullData.walletAddress || patient.walletAddress,
            accessTime: fullData.accessTime,
            allergies: fullData.allergies || [],
            conditions: fullData.conditions || [],
            medications: fullData.medications || [],
            fullMedicalHistory: fullData.fullMedicalHistory
          };
          setSelectedPatient(patientData);
          setEditedData({
            age: patientData.age?.toString() || "45",
            gender: fullData.gender || "Male",
            bloodType: fullData.bloodType,
            allergies: fullData.allergies?.join(", ") || "",
            conditions: fullData.conditions?.join(", ") || "",
            medications: fullData.medications?.join(", ") || ""
          });
          setIsViewPatientModalOpen(true);
        }
      } catch (error) {
        console.error('Failed to fetch full patient data:', error);
      }
    } else {
      setSelectedPatient(patient);
      setIsViewPatientModalOpen(true);
    }
  };

  const handleCloseViewModal = () => {
    setIsViewPatientModalOpen(false);
    setSelectedPatient(null);
    setSentBack(false);
    setIsEditingView(false);
  };

  const handleSendBack = async () => {
    if (!sessionId) return;
    
    try {
      // Fetch latest session data from backend
      const sessionRes = await ApiClient.get(buildUrl(API_CONFIG.hospitalApi, `/api/session/${sessionId}`));
      if (!sessionRes.success) {
        throw new Error('Failed to fetch session data');
      }
      
      const latestPatientData = sessionRes.session.patientData;
      
      // Send back with latest data
      const res = await ApiClient.post(buildUrl(API_CONFIG.hospitalApi, '/api/send-back'), {
        sessionId,
        updatedData: latestPatientData
      });
      
      if (res.success) {
        setSentBack(true);
        alert('✅ Data sent back to patient and saved to blockchain!');
      } else {
        throw new Error(res.error || 'Send back failed');
      }
    } catch (error: any) {
      console.error('❌ Failed to send back:', error);
      alert('❌ Failed to send back data: ' + error.message);
    }
  };

  const handleSaveViewChanges = async () => {
    if (selectedPatient && sessionId) {
      try {
        const sessionRes = await ApiClient.get(buildUrl(API_CONFIG.hospitalApi, `/api/session/${sessionId}`));
        const sessionData = sessionRes;
        
        if (!sessionData.success) throw new Error('Failed to fetch session');
        
        const updatedData = {
          ...sessionData.session.patientData,
          age: editedData.age,
          gender: editedData.gender,
          bloodType: editedData.bloodType,
          allergies: editedData.allergies.split(", ").filter(a => a.trim()),
          conditions: editedData.conditions.split(", ").filter(c => c.trim()),
          medications: editedData.medications.split(", ").filter(m => m.trim())
        };
        
        const res = await ApiClient.post(buildUrl(API_CONFIG.hospitalApi, '/api/update-history'), {
          sessionId,
          fullMedicalHistory: updatedData.fullMedicalHistory,
          age: updatedData.age,
          gender: updatedData.gender,
          bloodType: updatedData.bloodType,
          allergies: updatedData.allergies,
          conditions: updatedData.conditions,
          medications: updatedData.medications
        });

        const result = res;
        
        if (result.success) {
          const updatedPatient = {
            ...selectedPatient,
            age: parseInt(editedData.age) || selectedPatient.age,
            gender: editedData.gender as "Male" | "Female" | "Other",
            bloodType: editedData.bloodType,
            allergies: editedData.allergies.split(", ").filter(a => a.trim()),
            conditions: editedData.conditions.split(", ").filter(c => c.trim()),
            medications: editedData.medications.split(", ").filter(m => m.trim())
          };
          setSelectedPatient(updatedPatient);
          setPatientsData(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
          alert('✅ Patient information saved successfully');
        }
      } catch (err) {
        console.error('Failed to update session:', err);
        alert('❌ Failed to save patient information');
      }
    }
    setIsEditingView(false);
  };

  const handleEditPatient = async (patient: Patient) => {
    if (sessionId) {
      try {
        const res = await ApiClient.get(buildUrl(API_CONFIG.hospitalApi, `/api/session/${sessionId}`));
        const data = res;
        if (data.success && data.session) {
          const fullData = data.session.patientData;
          setSelectedPatient({
            id: fullData.id,
            avatar: patient.avatar,
            name: fullData.name,
            email: `${fullData.id}@mediguard.com`,
            phone: fullData.phone || "N/A",
            age: patient.age,
            gender: fullData.gender || "Male",
            bloodType: fullData.bloodType,
            status: "New",
            walletAddress: fullData.walletAddress || patient.walletAddress,
            accessTime: fullData.accessTime,
            allergies: fullData.allergies || [],
            conditions: fullData.conditions || [],
            medications: fullData.medications || [],
            fullMedicalHistory: fullData.fullMedicalHistory
          });
          setIsEditPatientModalOpen(true);
        }
      } catch (error) {
        console.error('Failed to fetch full patient data:', error);
      }
    } else {
      setSelectedPatient(patient);
      setIsEditPatientModalOpen(true);
    }
  };

  const handleUpdatePatient = async () => {
    if (!selectedPatient || !sessionId) return;

    const hospitalInfo = getHospitalInfo();

    try {
      // Log DATA_SAVED transaction (not saving to blockchain yet)
      const txUrl = buildUrl(API_CONFIG.adminApi, '/api/record-transaction');
      await ApiClient.post(txUrl, {
        patientId: selectedPatient.id,
        hospitalId: hospitalInfo.id,
        accessMethod: 'DATA_SAVED',
        transaction: {
          id: `data_saved_${Date.now()}`,
          type: 'DATA_SAVED',
          fromWallet: hospitalInfo.wallet,
          toWallet: selectedPatient.walletAddress,
          timestamp: new Date().toISOString(),
          status: 'completed'
        }
      });

      alert('Changes saved');
      setIsEditPatientModalOpen(false);
      setSelectedPatient(null);
    } catch (error) {
      console.error('Failed to save changes:', error);
      alert('Failed to save changes');
    }
  };

  const handleCancelEdit = () => {
    setFormData({ fullName: "", dateOfBirth: "", gender: "", bloodType: "", email: "", phone: "", address: "" });
    setIsEditPatientModalOpen(false);
    setSelectedPatient(null);
  };

  return (
    <div className="space-y-6">

      {/* Add New User Modal */}
      <Modal
        key={isAddPatientModalOpen ? "add-patient-open" : "add-patient-closed"}
        isOpen={isAddPatientModalOpen}
        onClose={handleCancel}
        className="max-w-[600px] p-6 lg:p-8"
      >
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h4 className="font-semibold text-gray-800 text-title-sm dark:text-white/90">
                Register New Patient
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Enter the patient's information below
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Full Name and Date of Birth Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  type="text"
                  id="fullName"
                  name="fullName"
                  defaultValue={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  type="date"
                  id="dateOfBirth"
                  name="dateOfBirth"
                  defaultValue={formData.dateOfBirth}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Gender and Blood Type Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  options={[
                    { value: "Male", label: "Male" },
                    { value: "Female", label: "Female" },
                    { value: "Other", label: "Other" },
                  ]}
                  placeholder="Select gender"
                  onChange={(value) => setFormData({ ...formData, gender: value })}
                  defaultValue={formData.gender}
                />
                <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-[42px] dark:text-gray-400">
                  <ChevronDownIcon />
                </span>
              </div>
              <div className="relative">
                <Label htmlFor="bloodType">Blood Type</Label>
                <Select
                  options={[
                    { value: "O+", label: "O+" },
                    { value: "O-", label: "O-" },
                    { value: "A+", label: "A+" },
                    { value: "A-", label: "A-" },
                    { value: "B+", label: "B+" },
                    { value: "B-", label: "B-" },
                    { value: "AB+", label: "AB+" },
                    { value: "AB-", label: "AB-" },
                  ]}
                  placeholder="Select blood type"
                  onChange={(value) => setFormData({ ...formData, bloodType: value })}
                  defaultValue={formData.bloodType}
                />
                <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-[42px] dark:text-gray-400">
                  <ChevronDownIcon />
                </span>
              </div>
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                type="email"
                id="email"
                name="email"
                defaultValue={formData.email}
                onChange={handleInputChange}
                placeholder="Enter email"
              />
            </div>

            {/* Phone Number */}
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                type="text"
                id="phone"
                name="phone"
                defaultValue={formData.phone}
                onChange={handleInputChange}
                placeholder="Enter phone number"
              />
            </div>

            {/* Address */}
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                type="text"
                id="address"
                name="address"
                defaultValue={formData.address}
                onChange={handleInputChange}
                placeholder="Enter address"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePatient}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#00bc83] to-[#00b9d1] text-white font-medium text-sm shadow-theme-xs hover:opacity-90 transition-opacity"
            >
              Create Patient
            </button>
          </div>
        </div>
      </Modal>

      {/* View Patient Details Modal */}
      <Modal
        key={isViewPatientModalOpen ? "view-patient-open" : "view-patient-closed"}
        isOpen={isViewPatientModalOpen}
        onClose={handleCloseViewModal}
        className="max-w-[700px] p-6 lg:p-8 max-h-[90vh] overflow-y-auto"
      >
        {selectedPatient && (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h4 className="font-semibold text-gray-800 text-title-sm dark:text-white/90">
                Patient Data
              </h4>
            </div>

            {/* Patient Information */}
            <div className="space-y-6">
              {/* Name and ID */}
              <div className="pb-4 border-b border-gray-200 dark:border-gray-800">
                <h5 className="text-xl font-bold text-gray-800 dark:text-white/90">
                  👤 {selectedPatient.name}
                </h5>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  ID: {selectedPatient.id}
                </p>
                {selectedPatient.accessTime && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Access Time: {selectedPatient.accessTime}
                  </p>
                )}
              </div>

              {/* Medical Information */}
              <div>
                <h6 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-4">
                  📋 Medical Information
                </h6>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Age
                    </p>
                    {isEditingView ? (
                      <input
                        type="number"
                        value={editedData.age}
                        onChange={(e) => setEditedData({...editedData, age: e.target.value})}
                        className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                      />
                    ) : (
                      <p className="text-sm text-gray-800 dark:text-white/90">
                        {selectedPatient.age || 'Not available'}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Gender
                    </p>
                    {isEditingView ? (
                      <select
                        value={editedData.gender}
                        onChange={(e) => setEditedData({...editedData, gender: e.target.value})}
                        className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <p className="text-sm text-gray-800 dark:text-white/90">
                        {selectedPatient.gender || 'Not available'}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Blood Type
                    </p>
                    {isEditingView ? (
                      <input
                        type="text"
                        value={editedData.bloodType}
                        onChange={(e) => setEditedData({...editedData, bloodType: e.target.value})}
                        className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                      />
                    ) : (
                      <p className="text-sm text-gray-800 dark:text-white/90">
                        {selectedPatient.bloodType || 'Not available'}
                      </p>
                    )}
                  </div>
                  {selectedPatient.allergies && selectedPatient.allergies.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Allergies
                      </p>
                      {isEditingView ? (
                        <input
                          type="text"
                          value={editedData.allergies}
                          onChange={(e) => setEditedData({...editedData, allergies: e.target.value})}
                          className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                          placeholder="Enter allergies (comma-separated)"
                        />
                      ) : (
                        <p className="text-sm text-gray-800 dark:text-white/90">
                          {selectedPatient.allergies.join(", ")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Allergies
                      </p>
                      {isEditingView ? (
                        <input
                          type="text"
                          value={editedData.allergies}
                          onChange={(e) => setEditedData({...editedData, allergies: e.target.value})}
                          className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                          placeholder="Enter allergies (comma-separated)"
                        />
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Not available
                        </p>
                      )}
                    </div>
                  )}
                  {selectedPatient.conditions && selectedPatient.conditions.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Conditions
                      </p>
                      {isEditingView ? (
                        <input
                          type="text"
                          value={editedData.conditions}
                          onChange={(e) => setEditedData({...editedData, conditions: e.target.value})}
                          className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                          placeholder="Enter conditions (comma-separated)"
                        />
                      ) : (
                        <p className="text-sm text-gray-800 dark:text-white/90">
                          {selectedPatient.conditions.join(", ")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Conditions
                      </p>
                      {isEditingView ? (
                        <input
                          type="text"
                          value={editedData.conditions}
                          onChange={(e) => setEditedData({...editedData, conditions: e.target.value})}
                          className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                          placeholder="Enter conditions (comma-separated)"
                        />
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Not available
                        </p>
                      )}
                    </div>
                  )}
                  {selectedPatient.medications && selectedPatient.medications.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Medications
                      </p>
                      {isEditingView ? (
                        <input
                          type="text"
                          value={editedData.medications}
                          onChange={(e) => setEditedData({...editedData, medications: e.target.value})}
                          className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                          placeholder="Enter medications (comma-separated)"
                        />
                      ) : (
                        <p className="text-sm text-gray-800 dark:text-white/90">
                          {selectedPatient.medications.join(", ")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Medications
                      </p>
                      {isEditingView ? (
                        <input
                          type="text"
                          value={editedData.medications}
                          onChange={(e) => setEditedData({...editedData, medications: e.target.value})}
                          className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                          placeholder="Enter medications (comma-separated)"
                        />
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Not available
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={handleCloseViewModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                Close
              </button>
              {!isEditingView ? (
                <button
                  onClick={async () => {
                    setIsEditingView(true);
                    if (selectedPatient) {
                      const hospitalInfo = getHospitalInfo();
                      console.log('🔍 Edit button clicked:', {
                        patientWallet: selectedPatient.walletAddress,
                        hospitalId: hospitalInfo.id,
                        hospitalWallet: hospitalInfo.wallet,
                        hospitalName: hospitalInfo.name
                      });
                      try {
                        await ApiClient.post(buildUrl(API_CONFIG.adminApi, '/api/record-transaction'), {
                          patientId: selectedPatient.id,
                          hospitalId: hospitalInfo.id,
                          accessMethod: 'EDIT_DATA',
                          transaction: {
                            id: `edit_data_${Date.now()}`,
                            type: 'EDIT_DATA',
                            fromWallet: hospitalInfo.wallet,
                            toWallet: selectedPatient.walletAddress,
                            timestamp: new Date().toISOString(),
                            status: 'completed'
                          }
                        });
                      } catch (err) {
                        console.error('Failed to log EDIT_DATA transaction:', err);
                      }
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#00bc83] to-[#00b9d1] rounded-lg hover:opacity-90 transition-opacity"
                >
                  Edit
                </button>
              ) : (
                <button
                  onClick={handleSaveViewChanges}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#00bc83] to-[#00b9d1] rounded-lg hover:opacity-90 transition-opacity"
                >
                  Save
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Patient Modal */}
      <Modal
        key={isEditPatientModalOpen ? "edit-patient-open" : "edit-patient-closed"}
        isOpen={isEditPatientModalOpen}
        onClose={handleCancelEdit}
        className="max-w-[700px] p-6 lg:p-8 max-h-[90vh] overflow-y-auto"
      >
        {selectedPatient && (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h4 className="font-semibold text-gray-800 text-title-sm dark:text-white/90">
                Edit Patient Medical Records
              </h4>
            </div>

            {/* Add New Appointment Form */}
            <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
              <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90 mb-4">
                📅 Add New Appointment
              </h5>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="appointment-date">Date:</Label>
                  <Input
                    type="date"
                    id="appointment-date"
                    value={newAppointment.date}
                    onChange={(e) => setNewAppointment({...newAppointment, date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="appointment-hospital">Hospital:</Label>
                  <Input
                    type="text"
                    id="appointment-hospital"
                    placeholder="Hospital name"
                    value={newAppointment.hospital}
                    onChange={(e) => setNewAppointment({...newAppointment, hospital: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="appointment-doctor">Doctor:</Label>
                  <Input
                    type="text"
                    id="appointment-doctor"
                    placeholder="Doctor name"
                    value={newAppointment.doctor}
                    onChange={(e) => setNewAppointment({...newAppointment, doctor: e.target.value})}
                  />
                </div>
                <div className="relative">
                  <Label htmlFor="appointment-type">Type:</Label>
                  <Select
                    options={[
                      { value: "Routine Checkup", label: "Routine Checkup" },
                      { value: "Emergency", label: "Emergency" },
                      { value: "Follow-up", label: "Follow-up" },
                      { value: "Consultation", label: "Consultation" },
                      { value: "Surgery", label: "Surgery" },
                    ]}
                    placeholder="Select type"
                    onChange={(value) => setNewAppointment({...newAppointment, type: value})}
                    defaultValue={newAppointment.type}
                  />
                  <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-[42px] dark:text-gray-400">
                    <ChevronDownIcon />
                  </span>
                </div>
                <div>
                  <Label htmlFor="appointment-notes">Notes:</Label>
                  <textarea
                    id="appointment-notes"
                    placeholder="Medical notes and observations"
                    value={newAppointment.notes}
                    onChange={(e) => setNewAppointment({...newAppointment, notes: e.target.value})}
                    className="w-full h-20 rounded-lg border border-gray-200 bg-transparent p-2.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                  />
                </div>
                <div>
                  <Label htmlFor="appointment-prescription">Prescription:</Label>
                  <div className="relative">
                    <Select
                      options={getMedicationOptions()}
                      placeholder="Select medication"
                      onChange={(value) => {
                        // Only allow selection of in-stock medications
                        const selectedMed = medications.find(med => med.medication === value);
                        if (selectedMed && selectedMed.quantity > 100) {
                          setNewAppointment({...newAppointment, prescription: value});
                        } else {
                          alert('⚠️ This medication is not available for prescription due to insufficient stock.');
                        }
                      }}
                      defaultValue={newAppointment.prescription}
                      className="mb-3"
                    />
                    <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-[22px] dark:text-gray-400">
                      <ChevronDownIcon />
                    </span>
                  </div>
                  

                  {/* Dosage and Duration */}
                  {newAppointment.prescription && (
                    <div>
                      {/* Check if selected medication is available */}
                      {(() => {
                        const selectedMed = medications.find(med => med.medication === newAppointment.prescription);
                        if (selectedMed && selectedMed.quantity <= 100) {
                          return (
                            <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                              <p className="text-sm text-red-800 dark:text-red-200">
                                ⚠️ <strong>Warning:</strong> {newAppointment.prescription} is not available for prescription (Stock: {selectedMed.quantity} {selectedMed.unit})
                              </p>
                              <button
                                onClick={() => setNewAppointment({...newAppointment, prescription: "", dosageTablets: "", dosageTimesDaily: "", durationDays: ""})}
                                className="mt-2 px-3 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700"
                              >
                                Clear Selection
                              </button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Only show dosage fields for available medications */}
                      {(() => {
                        const selectedMed = medications.find(med => med.medication === newAppointment.prescription);
                        if (!selectedMed || selectedMed.quantity <= 100) {
                          return null;
                        }
                        return (
                          <div className="space-y-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="dosage-tablets">Dosage:</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    id="dosage-tablets"
                                    placeholder="2"
                                    value={newAppointment.dosageTablets}
                                    onChange={(e) => setNewAppointment({...newAppointment, dosageTablets: e.target.value})}
                                    className="flex-1"
                                  />
                                  <span className="text-sm text-gray-600 dark:text-gray-400">tablets,</span>
                                  <Input
                                    type="number"
                                    placeholder="3"
                                    value={newAppointment.dosageTimesDaily}
                                    onChange={(e) => setNewAppointment({...newAppointment, dosageTimesDaily: e.target.value})}
                                    className="flex-1"
                                  />
                                  <span className="text-sm text-gray-600 dark:text-gray-400">times daily</span>
                                </div>
                              </div>
                              <div>
                                <Label htmlFor="duration-days">Duration:</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    id="duration-days"
                                    placeholder="7"
                                    value={newAppointment.durationDays}
                                    onChange={(e) => setNewAppointment({...newAppointment, durationDays: e.target.value})}
                                    className="flex-1"
                                  />
                                  <span className="text-sm text-gray-600 dark:text-gray-400">days supply</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Preview */}
                            {newAppointment.dosageTablets && newAppointment.dosageTimesDaily && newAppointment.durationDays && (
                              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                  <strong>Preview:</strong> {formatPrescription()}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => {
                    if (selectedPatient?.fullMedicalHistory && newAppointment.date && newAppointment.hospital && newAppointment.doctor) {
                      const newRecord = {
                        date: newAppointment.date,
                        hospital: newAppointment.hospital,
                        doctor: newAppointment.doctor,
                        notes: newAppointment.notes || "N/A",
                        prescription: formatPrescription() || "N/A"
                      };
                      const updatedRecords = [...selectedPatient.fullMedicalHistory.records, newRecord];
                      const updatedHistory = { records: updatedRecords, lastUpdated: new Date().toISOString().split('T')[0] };
                      setSelectedPatient({ ...selectedPatient, fullMedicalHistory: updatedHistory });
                      setNewAppointment({date: "", hospital: "", doctor: "", type: "Routine Checkup", notes: "", prescription: "", dosageTablets: "", dosageTimesDaily: "", durationDays: ""});
                      
                      // Update session on backend
                      if (sessionId) {
                        try {
                          const res = await ApiClient.post(buildUrl(API_CONFIG.hospitalApi, '/api/update-history'), { sessionId, fullMedicalHistory: updatedHistory });
                          const result = res;
                          if (result.success) {
                            alert('✅ Appointment added successfully');
                          }
                        } catch (err) {
                          console.error('Failed to update session:', err);
                        }
                      }
                      
                      // Log NEW_APPOINTMENT transaction
                      const hospitalInfo = getHospitalInfo();
                      try {
                        await ApiClient.post(buildUrl(API_CONFIG.adminApi, '/api/record-transaction'), {
                          patientId: selectedPatient.id,
                          hospitalId: hospitalInfo.id,
                          accessMethod: 'NEW_APPOINTMENT',
                          transaction: {
                            id: `new_appointment_${Date.now()}`,
                            type: 'NEW_APPOINTMENT',
                            fromWallet: hospitalInfo.wallet,
                            toWallet: selectedPatient.walletAddress,
                            timestamp: new Date().toISOString(),
                            status: 'completed'
                          }
                        });
                      } catch (err) {
                        console.error('Failed to log NEW_APPOINTMENT transaction:', err);
                      }
                    }
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-[#00bc83] to-[#00b9d1] text-white font-medium text-sm"
                >
                  📅 Add New Appointment
                </button>
              </div>
            </div>

            {/* Medical History */}
            <div>
              <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90 mb-4">
                📋 Medical History
              </h5>
              <div className="space-y-4">
                {selectedPatient.fullMedicalHistory?.records.map((record, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg dark:border-gray-800">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                        📅 {record.date}
                      </p>
                      <button
                        onClick={async () => {
                          if (editingRecordIndex !== index) {
                            setEditedRecord({ hospital: record.hospital, doctor: record.doctor, notes: record.notes, prescription: record.prescription });
                            // Log EDIT_DATA transaction
                            if (selectedPatient) {
                              const hospitalInfo = getHospitalInfo();
                              try {
                                await ApiClient.post(buildUrl(API_CONFIG.adminApi, '/api/record-transaction'), {
                                  patientId: selectedPatient.id,
                                  hospitalId: hospitalInfo.id,
                                  accessMethod: 'EDIT_DATA',
                                  transaction: {
                                    id: `edit_data_${Date.now()}`,
                                    type: 'EDIT_DATA',
                                    fromWallet: hospitalInfo.wallet,
                                    toWallet: selectedPatient.walletAddress,
                                    timestamp: new Date().toISOString(),
                                    status: 'completed'
                                  }
                                });
                              } catch (err) {
                                console.error('Failed to log EDIT_DATA transaction:', err);
                              }
                            }
                          }
                          setEditingRecordIndex(editingRecordIndex === index ? null : index);
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        ✏️ {editingRecordIndex === index ? 'Cancel' : 'Edit'}
                      </button>
                    </div>
                    <div className={editingRecordIndex === index ? 'hidden' : ''}>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      🏥 {record.hospital}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      👨‍⚕️ {record.doctor}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      <span className="font-medium">Notes:</span> {record.notes}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Prescription:</span> {record.prescription}
                    </p>
                    </div>
                    <div className={editingRecordIndex === index ? 'space-y-2 mt-2' : 'hidden'}>
                      <Input 
                        type="text" 
                        value={editedRecord.hospital} 
                        onChange={(e) => setEditedRecord({...editedRecord, hospital: e.target.value})} 
                        placeholder="Hospital" 
                      />
                      <Input 
                        type="text" 
                        value={editedRecord.doctor} 
                        onChange={(e) => setEditedRecord({...editedRecord, doctor: e.target.value})} 
                        placeholder="Doctor" 
                      />
                      <textarea 
                        value={editedRecord.notes} 
                        onChange={(e) => setEditedRecord({...editedRecord, notes: e.target.value})} 
                        placeholder="Notes" 
                        className="w-full h-16 rounded-lg border border-gray-200 bg-transparent p-2.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90" 
                      />
                      <textarea 
                        value={editedRecord.prescription} 
                        onChange={(e) => setEditedRecord({...editedRecord, prescription: e.target.value})} 
                        placeholder="Prescription" 
                        className="w-full h-16 rounded-lg border border-gray-200 bg-transparent p-2.5 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90" 
                      />
                      <button onClick={async () => {
                        if (selectedPatient?.fullMedicalHistory) {
                          const updatedRecords = [...selectedPatient.fullMedicalHistory.records];
                          updatedRecords[index] = { 
                            ...record, 
                            hospital: editedRecord.hospital, 
                            doctor: editedRecord.doctor, 
                            notes: editedRecord.notes, 
                            prescription: editedRecord.prescription 
                          };
                          const updatedPatient = { 
                            ...selectedPatient, 
                            fullMedicalHistory: { 
                              ...selectedPatient.fullMedicalHistory, 
                              records: updatedRecords,
                              lastUpdated: new Date().toISOString().split('T')[0]
                            } 
                          };
                          setSelectedPatient(updatedPatient);
                          
                          if (sessionId) {
                            try {
                              const res = await ApiClient.post(buildUrl(API_CONFIG.hospitalApi, '/api/update-history'), {
                                sessionId,
                                fullMedicalHistory: updatedPatient.fullMedicalHistory
                              });
                              const result = res;
                              if (result.success) {
                                alert('✅ Record saved successfully');
                              }
                            } catch (err) {
                              console.error('Failed to update session:', err);
                              alert('❌ Failed to save record');
                            }
                          }
                        }
                        setEditingRecordIndex(null);
                        setEditedRecord({ hospital: "", doctor: "", notes: "", prescription: "" });
                      }} className="px-3 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700">💾 Save</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePatient}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#00bc83] to-[#00b9d1] text-white font-medium text-sm shadow-theme-xs hover:opacity-90 transition-opacity"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Patients Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[1000px]">
            <Table>
              {/* Table Header */}
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    PATIENT
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    AGE
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    GENDER
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    BLOOD TYPE
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    STATUS
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    ACTIONS
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400"
                  >
                  </TableCell>
                </TableRow>
              </TableHeader>

              {/* Table Body */}
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {patientsData.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="px-5 py-4 sm:px-6 text-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30">
                          <span className="text-2xl">👤</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                            {patient.name}
                          </p>
                          <span className="text-gray-500 text-theme-xs dark:text-gray-400">
                            {patient.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400 text-start">
                      {patient.age}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400 text-start">
                      {patient.gender}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded border border-gray-200 text-gray-500 text-theme-sm dark:border-gray-700 dark:text-gray-400">
                        {patient.bloodType}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      {patient.status === "Follow-up" ? (
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 justify-center gap-1 rounded-full font-medium text-theme-xs"
                          style={{
                            backgroundColor: "#4280d2" + "20",
                            color: "#4280d2"
                          }}
                        >
                          {patient.status}
                        </span>
                      ) : (
                        <Badge
                          size="sm"
                          color="warning"
                        >
                          {patient.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewPatient(patient)}
                          disabled={sentBack}
                          className="p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="View"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditPatient(patient)}
                          disabled={sentBack}
                          className="p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Edit"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-end">
                      <button
                        onClick={handleSendBack}
                        disabled={sentBack}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-[#00bc83] to-[#00b9d1] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Send Back to Patient"
                      >
                        📤 Send Back
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Completion Message */}
      <div className="text-center py-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          ✅ All appointments are completed
        </p>
      </div>
    </div>
  );
}

