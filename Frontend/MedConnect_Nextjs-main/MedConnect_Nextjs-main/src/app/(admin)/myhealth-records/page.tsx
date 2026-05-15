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
import { PencilIcon, TrashBinIcon, HorizontaLDots, PlusIcon, ChevronDownIcon, EyeIcon, CheckCircleIcon } from "@/icons";
import Select from "@/components/form/Select";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";

// Note: Metadata export removed for client component

interface Appointment {
  id: number;
  patientAvatar: string;
  patientName: string;
  patientEmail: string;
  dateTime: string;
  purpose: string;
  status: "Scheduled" | "Completed" | "Cancelled" | "No Show";
  notes: string;
}

const appointmentsData: Appointment[] = [
  {
    id: 1,
    patientAvatar: "/images/user/user-17.jpg",
    patientName: "John Doe",
    patientEmail: "john.doe@example.com",
    dateTime: "2024-01-15 10:00 AM",
    purpose: "General Checkup",
    status: "Scheduled",
    notes: "Follow-up appointment",
  },
  {
    id: 2,
    patientAvatar: "/images/user/user-18.jpg",
    patientName: "Jane Smith",
    patientEmail: "jane.smith@example.com",
    dateTime: "2024-02-20 02:30 PM",
    purpose: "Dental Cleaning",
    status: "Completed",
    notes: "Regular cleaning",
  },
  {
    id: 3,
    patientAvatar: "/images/user/user-19.jpg",
    patientName: "Michael Brown",
    patientEmail: "michael.brown@example.com",
    dateTime: "2024-03-10 09:15 AM",
    purpose: "Consultation",
    status: "Completed",
    notes: "Initial consultation",
  },
  {
    id: 4,
    patientAvatar: "/images/user/user-20.jpg",
    patientName: "Sarah Johnson",
    patientEmail: "sarah.johnson@example.com",
    dateTime: "2024-04-05 11:00 AM",
    purpose: "Vaccination",
    status: "Scheduled",
    notes: "Annual flu shot",
  },
  {
    id: 5,
    patientAvatar: "/images/user/user-21.jpg",
    patientName: "Robert Wilson",
    patientEmail: "robert.wilson@example.com",
    dateTime: "2024-05-12 03:45 PM",
    purpose: "Follow-up",
    status: "No Show",
    notes: "Patient did not arrive",
  },
];

export default function Appointments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isAddAppointmentModalOpen, setIsAddAppointmentModalOpen] = useState(false);
  const [isViewAppointmentModalOpen, setIsViewAppointmentModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState({
    patientName: "",
    dateTime: "",
    purpose: "",
    status: "",
    notes: "",
  });

  const statusOptions = [
    { value: "", label: "All Status" },
    { value: "Scheduled", label: "Scheduled" },
    { value: "Completed", label: "Completed" },
    { value: "Cancelled", label: "Cancelled" },
    { value: "No Show", label: "No Show" },
  ];

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCreateAppointment = () => {
    // Handle create appointment logic here
    console.log("Creating appointment:", formData);
    // Reset form and close modal
    setFormData({ patientName: "", dateTime: "", purpose: "", status: "", notes: "" });
    setIsAddAppointmentModalOpen(false);
  };

  const handleCancel = () => {
    setFormData({ patientName: "", dateTime: "", purpose: "", status: "", notes: "" });
    setIsAddAppointmentModalOpen(false);
  };

  const handleViewAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsViewAppointmentModalOpen(true);
  };

  const handleCloseViewModal = () => {
    setIsViewAppointmentModalOpen(false);
    setSelectedAppointment(null);
  };

  const handleCompleteAppointment = (appointment: Appointment) => {
    // Handle complete appointment logic here
    console.log("Completing appointment:", appointment.id);
    // Update appointment status to Completed
    // In a real app, you would update the state or make an API call
  };

  const handleCancelAppointment = (appointment: Appointment) => {
    // Handle cancel appointment logic here
    console.log("Cancelling appointment:", appointment.id);
    // Update appointment status to Cancelled
    // In a real app, you would update the state or make an API call
  };

  return (
    <div className="space-y-6">
      {/* Four Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
        {/* Total Appointments Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Total Appointments
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              1,234
            </h4>
          </div>
        </div>

        {/* Today's Scheduled Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Today's Scheduled
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              24
            </h4>
          </div>
        </div>

        {/* Completed Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Completed
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              856
            </h4>
          </div>
        </div>

        {/* No Shows Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              No Shows
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              42
            </h4>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
          {/* Search Users Input */}
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
              placeholder="Search by patient or purpose..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>

          {/* Status Select */}
          <div className="relative sm:w-48">
            <Select
              options={statusOptions}
              placeholder="Select Status"
              onChange={handleStatusChange}
              defaultValue={selectedStatus}
              className="dark:bg-white/[0.03]"
            />
            <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
              <ChevronDownIcon />
            </span>
          </div>
        </div>

        {/* Schedule Appointment Button */}
        <button
          onClick={() => setIsAddAppointmentModalOpen(true)}
          className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-[#00bc83] to-[#00b9d1] text-white font-medium text-sm shadow-theme-xs hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Schedule Appointment</span>
        </button>
      </div>

      {/* Add New Appointment Modal */}
      <Modal
        key={isAddAppointmentModalOpen ? "add-appointment-open" : "add-appointment-closed"}
        isOpen={isAddAppointmentModalOpen}
        onClose={handleCancel}
        className="max-w-[600px] p-6 lg:p-8"
      >
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h4 className="font-semibold text-gray-800 text-title-sm dark:text-white/90">
              Schedule New Appointment
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Create a new appointment record
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

            {/* Date & Time and Purpose Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dateTime">Date & Time</Label>
                <Input
                  type="datetime-local"
                  id="dateTime"
                  name="dateTime"
                  defaultValue={formData.dateTime}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="purpose">Purpose</Label>
                <Input
                  type="text"
                  id="purpose"
                  name="purpose"
                  defaultValue={formData.purpose}
                  onChange={handleInputChange}
                  placeholder="Enter purpose"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status">Status</Label>
              <div className="relative">
                <Select
                  options={statusOptions.filter(opt => opt.value !== "")}
                  placeholder="Select Status"
                  onChange={(value) => setFormData({ ...formData, status: value })}
                  defaultValue={formData.status}
                  className="dark:bg-white/[0.03]"
                />
                <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
                  <ChevronDownIcon />
                </span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                type="text"
                id="notes"
                name="notes"
                defaultValue={formData.notes}
                onChange={handleInputChange}
                placeholder="Enter notes"
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
              onClick={handleCreateAppointment}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#00bc83] to-[#00b9d1] text-white font-medium text-sm shadow-theme-xs hover:opacity-90 transition-opacity"
            >
              Schedule Appointment
            </button>
          </div>
        </div>
      </Modal>

      {/* View Appointment Modal */}
      <Modal
        key={isViewAppointmentModalOpen ? "view-appointment-open" : "view-appointment-closed"}
        isOpen={isViewAppointmentModalOpen}
        onClose={handleCloseViewModal}
        className="max-w-[600px] p-6 lg:p-8"
      >
        {selectedAppointment && (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h4 className="font-semibold text-gray-800 text-title-sm dark:text-white/90">
                Appointment Details
              </h4>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                View appointment information
              </p>
            </div>

            {/* Appointment Information */}
            <div className="space-y-4">
              {/* Patient Info */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
                <div className="w-16 h-16 overflow-hidden rounded-full">
                  <Image
                    width={64}
                    height={64}
                    src={selectedAppointment.patientAvatar}
                    alt={selectedAppointment.patientName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h5 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                    {selectedAppointment.patientName}
                  </h5>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedAppointment.patientEmail}
                  </p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Date & Time
                  </p>
                  <p className="text-sm text-gray-800 dark:text-white/90">
                    {selectedAppointment.dateTime}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Purpose
                  </p>
                  <p className="text-sm text-gray-800 dark:text-white/90">
                    {selectedAppointment.purpose}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Status
                  </p>
                  <div>
                    <Badge
                      size="sm"
                      color={
                        selectedAppointment.status === "Completed"
                          ? "success"
                          : selectedAppointment.status === "Scheduled"
                          ? "info"
                          : selectedAppointment.status === "No Show"
                          ? "error"
                          : "warning"
                      }
                    >
                      {selectedAppointment.status}
                    </Badge>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-gray-800 dark:text-white/90">
                    {selectedAppointment.notes}
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

      {/* Appointments Table */}
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
                    DATE&TIME
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    PURPOSE
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
                    NOTES
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 w-32"
                  >
                    ACTIONS
                  </TableCell>
                </TableRow>
              </TableHeader>

              {/* Table Body */}
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {appointmentsData.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell className="px-5 py-4 sm:px-6 text-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 overflow-hidden rounded-full">
                          <Image
                            width={40}
                            height={40}
                            src={appointment.patientAvatar}
                            alt={appointment.patientName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                            {appointment.patientName}
                          </p>
                          <span className="text-gray-500 text-theme-xs dark:text-gray-400">
                            {appointment.patientEmail}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400 text-start">
                      {appointment.dateTime}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400 text-start">
                      {appointment.purpose}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <Badge
                        size="sm"
                        color={
                          appointment.status === "Completed"
                            ? "success"
                            : appointment.status === "Scheduled"
                            ? "info"
                            : appointment.status === "No Show"
                            ? "error"
                            : "warning"
                        }
                      >
                        {appointment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400 text-start">
                      {appointment.notes}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start w-32">
                      <div className="flex items-center gap-2">
                        {appointment.status === "Scheduled" ? (
                          <>
                            <button
                              onClick={() => handleCompleteAppointment(appointment)}
                              className="flex items-center justify-center p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                              title="Complete"
                            >
                              <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                            </button>
                            <button
                              onClick={() => handleCancelAppointment(appointment)}
                              className="flex items-center justify-center p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                              title="Cancel"
                            >
                              <TrashBinIcon className="w-4 h-4 flex-shrink-0" />
                            </button>
                          </>
                        ) : appointment.status === "Completed" ? (
                          <button
                            onClick={() => handleViewAppointment(appointment)}
                            className="flex items-center justify-center p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                            title="View"
                          >
                            <EyeIcon className="w-4 h-4 flex-shrink-0" />
                          </button>
                        ) : null}
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

