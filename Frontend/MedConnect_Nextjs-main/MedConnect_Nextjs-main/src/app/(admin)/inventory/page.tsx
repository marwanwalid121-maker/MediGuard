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
import { PencilIcon, HorizontaLDots, PlusIcon, ChevronDownIcon, EyeIcon } from "@/icons";
import Select from "@/components/form/Select";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { API_CONFIG, buildUrl, DEFAULT_ENTITIES } from "@/config/api-config";
import { ApiClient } from "@/services/api-client";

// Note: Metadata export removed for client component

interface InventoryItem {
  id: string;
  medication: string;
  description: string;
  quantity: number;
  unit: string;
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

const calculateStatus = (quantity: number): "In Stock" | "Low Stock" | "Out of Stock" => {
  if (quantity > 100) return "In Stock";
  if (quantity > 0 && quantity <= 100) return "Low Stock";
  return "Out of Stock";
};

export default function Inventory() {
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isAddMedicationModalOpen, setIsAddMedicationModalOpen] = useState(false);
  const [isViewMedicationModalOpen, setIsViewMedicationModalOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<InventoryItem | null>(null);
  const [editingQuantities, setEditingQuantities] = useState<{[key: string]: number}>({});
  const [formData, setFormData] = useState({
    medication: "",
    description: "",
    quantity: "",
    unit: "",
  });

  // Load inventory from blockchain on component mount
  useEffect(() => {
    loadInventoryFromBlockchain();
  }, []);

  const loadInventoryFromBlockchain = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('patientToken');
      const response = await ApiClient.get(buildUrl(API_CONFIG.pharmacyApi, `/api/pharmacy/inventory/${DEFAULT_ENTITIES.pharmacy.id}`), token);
      if (response) {
        const data = response;
        if (data.success && data.inventory) {
          const processedInventory = data.inventory.map((item: any) => ({
            ...item,
            status: calculateStatus(item.quantity)
          }));
          setInventoryData(processedInventory);
        } else {
          // Initialize with default inventory if none exists
          await initializeDefaultInventory();
        }
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      // Initialize with default inventory on error
      await initializeDefaultInventory();
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultInventory = async () => {
    const defaultInventory = [
      {
        id: "med-001",
        medication: "Amoxicillin",
        description: "Antibiotic used to treat bacterial infections",
        quantity: 150,
        unit: "Tablets",
        status: calculateStatus(150)
      },
      {
        id: "med-002",
        medication: "Metformin",
        description: "Oral medication for type 2 diabetes management",
        quantity: 25,
        unit: "Tablets",
        status: calculateStatus(25)
      },
      {
        id: "med-003",
        medication: "Ibuprofen",
        description: "Nonsteroidal anti-inflammatory drug for pain relief",
        quantity: 0,
        unit: "Tablets",
        status: calculateStatus(0)
      },
      {
        id: "med-004",
        medication: "Paracetamol",
        description: "Pain reliever and fever reducer",
        quantity: 200,
        unit: "Tablets",
        status: calculateStatus(200)
      },
      {
        id: "med-005",
        medication: "Aspirin",
        description: "Used to reduce pain, fever, or inflammation",
        quantity: 30,
        unit: "Tablets",
        status: calculateStatus(30)
      }
    ];

    try {
      const token = localStorage.getItem('patientToken');
      const response = await ApiClient.post(buildUrl(API_CONFIG.pharmacyApi, '/api/pharmacy/inventory'), { pharmacyId: DEFAULT_ENTITIES.pharmacy.id, inventory: defaultInventory }, token);

      if (response) {
        setInventoryData(defaultInventory);
        console.log('✅ Default inventory initialized for City Pharmacy');
      }
    } catch (error) {
      console.error('Error initializing default inventory:', error);
      // Fallback to local state
      setInventoryData(defaultInventory);
    }
  };

  const statusOptions = [
    { value: "", label: "All Status" },
    { value: "In Stock", label: "In Stock" },
    { value: "Low Stock", label: "Low Stock" },
    { value: "Out of Stock", label: "Out of Stock" },
  ];

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCreateMedication = async () => {
    try {
      const newMedication = {
        id: `med-${Date.now()}`,
        medication: formData.medication,
        description: formData.description,
        quantity: parseInt(formData.quantity) || 0,
        unit: formData.unit,
        status: calculateStatus(parseInt(formData.quantity) || 0)
      };

      const updatedInventory = [...inventoryData, newMedication];

      // Save to local storage
      const token = localStorage.getItem('patientToken');
      const response = await ApiClient.post(buildUrl(API_CONFIG.pharmacyApi, '/api/pharmacy/inventory'), { pharmacyId: 'pharmacy-001', inventory: updatedInventory }, token);

      if (response) {
        setInventoryData(updatedInventory);
        console.log('✅ New medication saved to local storage');
      } else {
        console.error('Failed to save medication to local storage');
      }

      // Reset form and close modal
      setFormData({ medication: "", description: "", quantity: "", unit: "" });
      setIsAddMedicationModalOpen(false);
    } catch (error) {
      console.error('Error creating medication:', error);
    }
  };

  const handleUpdateQuantity = async (medicationId: string, newQuantity: number) => {
    try {
      const token = localStorage.getItem('patientToken');
      const response = await ApiClient.put(buildUrl(API_CONFIG.pharmacyApi, '/api/pharmacy/inventory/update'), {
        pharmacyId: 'pharmacy-001',
        medicationId,
        quantity: newQuantity
      }, token);

      if (response) {
        // Update local state
        setInventoryData(prev => prev.map(item => 
          item.id === medicationId 
            ? { ...item, quantity: newQuantity, status: calculateStatus(newQuantity) }
            : item
        ));
        // Remove from editing quantities
        setEditingQuantities(prev => {
          const newState = { ...prev };
          delete newState[medicationId];
          return newState;
        });
        console.log('✅ Quantity updated in local storage');
      } else {
        console.error('Failed to update quantity in local storage');
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const handleQuantityChange = (medicationId: string, change: number) => {
    const currentItem = inventoryData.find(item => item.id === medicationId);
    if (!currentItem) return;
    
    const currentEditingQuantity = editingQuantities[medicationId] ?? currentItem.quantity;
    const newQuantity = Math.max(0, currentEditingQuantity + change);
    
    setEditingQuantities(prev => ({
      ...prev,
      [medicationId]: newQuantity
    }));
  };

  const handleSaveQuantity = async (medicationId: string) => {
    const newQuantity = editingQuantities[medicationId];
    if (newQuantity !== undefined) {
      await handleUpdateQuantity(medicationId, newQuantity);
    }
  };

  const getDisplayQuantity = (item: InventoryItem) => {
    return editingQuantities[item.id] ?? item.quantity;
  };

  const hasQuantityChanged = (item: InventoryItem) => {
    return editingQuantities[item.id] !== undefined && editingQuantities[item.id] !== item.quantity;
  };

  const handleCancel = () => {
    setFormData({ medication: "", description: "", quantity: "", unit: "" });
    setIsAddMedicationModalOpen(false);
  };

  const handleViewMedication = (medication: InventoryItem) => {
    setSelectedMedication(medication);
    setIsViewMedicationModalOpen(true);
  };

  const handleCloseViewModal = () => {
    setIsViewMedicationModalOpen(false);
    setSelectedMedication(null);
  };

  // Calculate metrics
  const totalItems = inventoryData.length;
  const inStockCount = inventoryData.filter(item => item.status === "In Stock").length;
  const lowStockCount = inventoryData.filter(item => item.status === "Low Stock").length;
  const outOfStockCount = inventoryData.filter(item => item.status === "Out of Stock").length;

  // Filter inventory based on search and status
  const filteredInventory = inventoryData.filter(item => {
    const matchesSearch = item.medication.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === "" || item.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Four Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
        {/* Total Items Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total Items
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {totalItems}
              </h4>
            </div>
          </div>
        </div>

        {/* In Stock Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                In Stock
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {inStockCount}
              </h4>
            </div>
          </div>
        </div>

        {/* Low Stock Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Low Stock
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {lowStockCount}
              </h4>
            </div>
          </div>
        </div>

        {/* Out of Stock Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Out of Stock
              </span>
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {outOfStockCount}
              </h4>
            </div>
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
              placeholder="Search by medication..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>
        </div>

        {/* Add Medication Button */}
        <button
          onClick={() => setIsAddMedicationModalOpen(true)}
          className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-[#00bc83] to-[#00b9d1] text-white font-medium text-sm shadow-theme-xs hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add Medication</span>
        </button>
      </div>

      {/* Add New Medication Modal */}
      <Modal
        key={isAddMedicationModalOpen ? "add-medication-open" : "add-medication-closed"}
        isOpen={isAddMedicationModalOpen}
        onClose={handleCancel}
        className="max-w-[600px] p-6 lg:p-8"
      >
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h4 className="font-semibold text-gray-800 text-title-sm dark:text-white/90">
              Add New Medication
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Create a new medication record
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Medication */}
            <div>
              <Label htmlFor="medication">Medication Name</Label>
              <Input
                type="text"
                id="medication"
                name="medication"
                defaultValue={formData.medication}
                onChange={handleInputChange}
                placeholder="Enter medication name"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                type="text"
                id="description"
                name="description"
                defaultValue={formData.description}
                onChange={handleInputChange}
                placeholder="Enter medication description"
              />
            </div>

            {/* Quantity and Unit Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  type="number"
                  id="quantity"
                  name="quantity"
                  defaultValue={formData.quantity}
                  onChange={handleInputChange}
                  placeholder="Enter quantity"
                />
              </div>
              <div>
                <Label htmlFor="unit">Unit</Label>
                <Input
                  type="text"
                  id="unit"
                  name="unit"
                  defaultValue={formData.unit}
                  onChange={handleInputChange}
                  placeholder="Enter unit (e.g., Tablets)"
                />
              </div>
            </div>

            {/* Status - Removed since it's calculated automatically */}
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
              onClick={handleCreateMedication}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#00bc83] to-[#00b9d1] text-white font-medium text-sm shadow-theme-xs hover:opacity-90 transition-opacity"
            >
              Create Medication
            </button>
          </div>
        </div>
      </Modal>

      {/* View Medication Modal */}
      <Modal
        key={isViewMedicationModalOpen ? "view-medication-open" : "view-medication-closed"}
        isOpen={isViewMedicationModalOpen}
        onClose={handleCloseViewModal}
        className="max-w-[600px] p-6 lg:p-8"
      >
        {selectedMedication && (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h4 className="font-semibold text-gray-800 text-title-sm dark:text-white/90">
                Medication Details
              </h4>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                View medication information
              </p>
            </div>

            {/* Medication Information */}
            <div className="space-y-4">
              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Medication Name
                  </p>
                  <p className="text-sm text-gray-800 dark:text-white/90">
                    {selectedMedication.medication}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Quantity
                  </p>
                  <p className="text-sm text-gray-800 dark:text-white/90">
                    {selectedMedication.quantity}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Description
                  </p>
                  <p className="text-sm text-gray-800 dark:text-white/90">
                    {selectedMedication.description}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Unit
                  </p>
                  <p className="text-sm text-gray-800 dark:text-white/90">
                    {selectedMedication.unit}
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
                        selectedMedication.status === "In Stock"
                          ? "success"
                          : selectedMedication.status === "Low Stock"
                          ? "warning"
                          : "error"
                      }
                    >
                      {selectedMedication.status}
                    </Badge>
                  </div>
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

      {/* Prescriptions Table */}
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
                    MEDICATION
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    QUANTITY
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    UNIT
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
                </TableRow>
              </TableHeader>

              {/* Table Body */}
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {filteredInventory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="px-5 py-4 text-start">
                      <div>
                        <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                          {item.medication}
                        </p>
                        <span className="text-gray-500 text-theme-xs dark:text-gray-400">
                          {item.description}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400 text-start">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuantityChange(item.id, -1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:border-gray-500"
                          title="Decrease quantity"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <span className={`min-w-[3rem] text-center font-medium ${
                          hasQuantityChanged(item) ? 'text-blue-600 dark:text-blue-400' : ''
                        }`}>
                          {getDisplayQuantity(item)}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item.id, 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:border-gray-500"
                          title="Increase quantity"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400 text-start">
                      {item.unit}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <Badge
                        size="sm"
                        color={
                          item.status === "In Stock"
                            ? "success"
                            : item.status === "Low Stock"
                            ? "warning"
                            : "error"
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewMedication(item)}
                          className="p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                          title="View"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                          title="Edit"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        {hasQuantityChanged(item) ? (
                          <button
                            onClick={() => handleSaveQuantity(item.id)}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                            title="Save quantity changes"
                          >
                            Save
                          </button>
                        ) : (
                          <button
                            className="p-2 text-gray-400 cursor-not-allowed rounded-lg"
                            title="No changes to save"
                            disabled
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
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

