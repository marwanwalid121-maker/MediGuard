"use client";

import React, { useState } from "react";
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

// Note: Metadata export removed for client component

interface HealthRecord {
  id: number;
  patientAvatar: string;
  patientName: string;
  patientEmail: string;
  diagnosis: string;
  treatment: string;
  hospital: string;
  date: string;
}

const healthRecordsData: HealthRecord[] = [
  {
    id: 1,
    patientAvatar: "/images/user/user-17.jpg",
    patientName: "John Doe",
    patientEmail: "john.doe@example.com",
    diagnosis: "Hypertension",
    treatment: "Medication and lifestyle changes",
    hospital: "Main Hospital",
    date: "2024-01-15",
  },
  {
    id: 2,
    patientAvatar: "/images/user/user-18.jpg",
    patientName: "Jane Smith",
    patientEmail: "jane.smith@example.com",
    diagnosis: "Diabetes Type 2",
    treatment: "Insulin therapy and diet plan",
    hospital: "City Hospital",
    date: "2024-02-20",
  },
  {
    id: 3,
    patientAvatar: "/images/user/user-19.jpg",
    patientName: "Michael Brown",
    patientEmail: "michael.brown@example.com",
    diagnosis: "Pneumonia",
    treatment: "Antibiotics and rest",
    hospital: "Regional Hospital",
    date: "2024-03-10",
  },
  {
    id: 4,
    patientAvatar: "/images/user/user-20.jpg",
    patientName: "Sarah Johnson",
    patientEmail: "sarah.johnson@example.com",
    diagnosis: "Migraine",
    treatment: "Pain management and preventive medication",
    hospital: "Main Hospital",
    date: "2024-04-05",
  },
  {
    id: 5,
    patientAvatar: "/images/user/user-21.jpg",
    patientName: "Robert Wilson",
    patientEmail: "robert.wilson@example.com",
    diagnosis: "Arthritis",
    treatment: "Physical therapy and anti-inflammatory drugs",
    hospital: "City Hospital",
    date: "2024-05-12",
  },
];

export default function HealthRecords() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [isViewRecordModalOpen, setIsViewRecordModalOpen] = useState(false);
  const [isEditRecordModalOpen, setIsEditRecordModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [formData, setFormData] = useState({
    patientName: "",
    diagnosis: "",
    treatment: "",
    hospital: "",
    date: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCreateRecord = () => {
    // Handle create record logic here
    console.log("Creating health record:", formData);
    // Reset form and close modal
    setFormData({ patientName: "", diagnosis: "", treatment: "", hospital: "", date: "" });
    setIsAddRecordModalOpen(false);
  };

  const handleCancel = () => {
    setFormData({ patientName: "", diagnosis: "", treatment: "", hospital: "", date: "" });
    setIsAddRecordModalOpen(false);
  };

  const handleViewRecord = (record: HealthRecord) => {
    setSelectedRecord(record);
    setIsViewRecordModalOpen(true);
  };

  const handleCloseViewModal = () => {
    setIsViewRecordModalOpen(false);
    setSelectedRecord(null);
  };

  const handleEditRecord = (record: HealthRecord) => {
    setSelectedRecord(record);
    // Pre-fill form with record data
    setFormData({
      patientName: record.patientName,
      diagnosis: record.diagnosis,
      treatment: record.treatment,
      hospital: record.hospital,
      date: record.date,
    });
    setIsEditRecordModalOpen(true);
  };

  const handleUpdateRecord = () => {
    // Handle update record logic here
    console.log("Updating health record:", selectedRecord?.id, formData);
    // Reset form and close modal
    setFormData({ patientName: "", diagnosis: "", treatment: "", hospital: "", date: "" });
    setIsEditRecordModalOpen(false);
    setSelectedRecord(null);
  };

  const handleCancelEdit = () => {
    setFormData({ patientName: "", diagnosis: "", treatment: "", hospital: "", date: "" });
    setIsEditRecordModalOpen(false);
    setSelectedRecord(null);
  };

  return (
    <div className="space-y-6">

      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
          {/* Search Patients Input */}
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
                placeholder="Search by patient, diagnosis, or hospital..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>

        </div>

        {/* Add Health Record Button */}
        <button
          onClick={() => setIsAddRecordModalOpen(true)}
          className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-[#00bc83] to-[#00b9d1] text-white font-medium text-sm shadow-theme-xs hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add Record</span>
        </button>
      </div>

      {/* Add Health Record Modal */}
      <Modal
        key={isAddRecordModalOpen ? "add-record-open" : "add-record-closed"}
        isOpen={isAddRecordModalOpen}
        onClose={handleCancel}
        className="max-w-[600px] p-6 lg:p-8"
      >
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h4 className="font-semibold text-gray-800 text-title-sm dark:text-white/90">
              Add Health Record
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Enter the health record information below
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Patient Name */}
            <div>
              <Label htmlFor="patientName">Patient Name</Label>
              <Input
                type="text"
                id="patientName"
                name="patientName"
                defaultValue={formData.patientName}
                onChange={handleInputChange}
                placeholder="Enter patient name"
              />
            </div>

            {/* Diagnosis */}
            <div>
              <Label htmlFor="diagnosis">Diagnosis</Label>
              <Input
                type="text"
                id="diagnosis"
                name="diagnosis"
                defaultValue={formData.diagnosis}
                onChange={handleInputChange}
                placeholder="Enter diagnosis"
              />
            </div>

            {/* Treatment */}
            <div>
              <Label htmlFor="treatment">Treatment</Label>
              <Input
                type="text"
                id="treatment"
                name="treatment"
                defaultValue={formData.treatment}
                onChange={handleInputChange}
                placeholder="Enter treatment"
              />
            </div>

            {/* Hospital and Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hospital">Hospital</Label>
                <Input
                  type="text"
                  id="hospital"
                  name="hospital"
                  defaultValue={formData.hospital}
                  onChange={handleInputChange}
                  placeholder="Enter hospital"
                />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  type="date"
                  id="date"
                  name="date"
                  defaultValue={formData.date}
                  onChange={handleInputChange}
                />
              </div>
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
              onClick={handleCreateRecord}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#00bc83] to-[#00b9d1] text-white font-medium text-sm shadow-theme-xs hover:opacity-90 transition-opacity"
            >
              Create Record
            </button>
          </div>
        </div>
      </Modal>

      {/* View Health Record Modal */}
      <Modal
        key={isViewRecordModalOpen ? "view-record-open" : "view-record-closed"}
        isOpen={isViewRecordModalOpen}
        onClose={handleCloseViewModal}
        className="max-w-[600px] p-6 lg:p-8"
      >
        {selectedRecord && (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h4 className="font-semibold text-gray-800 text-title-sm dark:text-white/90">
                Health Record Details
              </h4>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                View health record information
              </p>
            </div>

            {/* Record Information */}
            <div className="space-y-4">
              {/* Patient Info */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
                <div className="w-16 h-16 overflow-hidden rounded-full">
                  <Image
                    width={64}
                    height={64}
                    src={selectedRecord.patientAvatar}
                    alt={selectedRecord.patientName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h5 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                    {selectedRecord.patientName}
                  </h5>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedRecord.patientEmail}
                  </p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Diagnosis
                  </p>
                  <span 
                    className="inline-flex items-center px-2.5 py-0.5 justify-center gap-1 rounded-full font-medium text-theme-xs"
                    style={{
                      backgroundColor: "#4280d2" + "20",
                      color: "#4280d2"
                    }}
                  >
                    {selectedRecord.diagnosis}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Hospital
                  </p>
                  <p className="text-sm text-gray-800 dark:text-white/90">
                    {selectedRecord.hospital}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Treatment
                  </p>
                  <p className="text-sm text-gray-800 dark:text-white/90">
                    {selectedRecord.treatment}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Date
                  </p>
                  <p className="text-sm text-gray-800 dark:text-white/90">
                    {selectedRecord.date}
                  </p>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex items-center justify-end pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={handleCloseViewModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Health Record Modal */}
      <Modal
        key={isEditRecordModalOpen ? "edit-record-open" : "edit-record-closed"}
        isOpen={isEditRecordModalOpen}
        onClose={handleCancelEdit}
        className="max-w-[600px] p-6 lg:p-8"
      >
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h4 className="font-semibold text-gray-800 text-title-sm dark:text-white/90">
              Edit Health Record
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Update the health record information below
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Patient Name */}
            <div>
              <Label htmlFor="edit-patientName">Patient Name</Label>
              <Input
                type="text"
                id="edit-patientName"
                name="patientName"
                defaultValue={formData.patientName}
                onChange={handleInputChange}
                placeholder="Enter patient name"
              />
            </div>

            {/* Diagnosis */}
            <div>
              <Label htmlFor="edit-diagnosis">Diagnosis</Label>
              <Input
                type="text"
                id="edit-diagnosis"
                name="diagnosis"
                defaultValue={formData.diagnosis}
                onChange={handleInputChange}
                placeholder="Enter diagnosis"
              />
            </div>

            {/* Treatment */}
            <div>
              <Label htmlFor="edit-treatment">Treatment</Label>
              <Input
                type="text"
                id="edit-treatment"
                name="treatment"
                defaultValue={formData.treatment}
                onChange={handleInputChange}
                placeholder="Enter treatment"
              />
            </div>

            {/* Hospital and Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-hospital">Hospital</Label>
                <Input
                  type="text"
                  id="edit-hospital"
                  name="hospital"
                  defaultValue={formData.hospital}
                  onChange={handleInputChange}
                  placeholder="Enter hospital"
                />
              </div>
              <div>
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  type="date"
                  id="edit-date"
                  name="date"
                  defaultValue={formData.date}
                  onChange={handleInputChange}
                />
              </div>
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
              onClick={handleUpdateRecord}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#00bc83] to-[#00b9d1] text-white font-medium text-sm shadow-theme-xs hover:opacity-90 transition-opacity"
            >
              Update Record
            </button>
          </div>
        </div>
      </Modal>

      {/* Health Records Table */}
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
                    DIAGNOSIS
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    TREATMENT
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    HOSPITAL
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    DATE
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    ACTIONS
                  </TableCell>
                </TableRow>
              </TableHeader>

              {/* Table Body */}
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {healthRecordsData.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="px-5 py-4 sm:px-6 text-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 overflow-hidden rounded-full">
                          <Image
                            width={40}
                            height={40}
                            src={record.patientAvatar}
                            alt={record.patientName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                            {record.patientName}
                          </p>
                          <span className="text-gray-500 text-theme-xs dark:text-gray-400">
                            {record.patientEmail}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 justify-center gap-1 rounded-full font-medium text-theme-xs"
                        style={{
                          backgroundColor: "#4280d2" + "20",
                          color: "#4280d2"
                        }}
                      >
                        {record.diagnosis}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400 text-start">
                      {record.treatment}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400 text-start">
                      {record.hospital}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400 text-start">
                      {record.date}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewRecord(record)}
                          className="p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                          title="View"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditRecord(record)}
                          className="p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                          title="Edit"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                          title="More options"
                        >
                          <HorizontaLDots className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

