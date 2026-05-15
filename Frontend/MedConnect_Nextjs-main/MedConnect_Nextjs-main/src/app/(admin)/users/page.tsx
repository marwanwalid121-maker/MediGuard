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
import { PencilIcon, TrashBinIcon, HorizontaLDots, PlusIcon, ChevronDownIcon } from "@/icons";
import Select from "@/components/form/Select";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { API_CONFIG, buildUrl } from "@/config/api-config";
import { ApiClient } from "@/services/api-client";

// Note: Metadata export removed for client component

interface User {
  id: string;
  avatar: string;
  name: string;
  email: string;
  role: string;
  linkedEntity: string;
  status: "Active" | "Disabled";
  created: string;
}

const usersData: User[] = [
  {
    id: "2",
    avatar: "/images/user/user-18.jpg",
    name: "John Doe",
    email: "",
    role: "Patient",
    linkedEntity: "John Doe",
    status: "Active",
    created: "2024-02-20",
  },
  {
    id: "3",
    avatar: "/images/user/user-19.jpg",
    name: "City General Hospital",
    email: "",
    role: "Hospital",
    linkedEntity: "City General Hospital",
    status: "Active",
    created: "2024-03-10",
  },
];

export default function Users() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    name: "",
    password: "",
    role: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const usersUrl = buildUrl(API_CONFIG.adminApi, '/api/all-users');
      const result = await ApiClient.get(usersUrl);
      if (result.success) {
        // Filter out the "Attacker" patient user
        const filteredUsers = result.users.filter((user: User) => 
          user.name !== 'Attacker' && user.id !== 'patient-attacker'
        );
        setUsers(filteredUsers);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  React.useEffect(() => {
    loadUsers();
  }, []);

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}?`)) {
      return;
    }

    setDeletingUserId(userId);

    try {
      const deleteUrl = buildUrl(API_CONFIG.adminApi, '/api/delete-user');
      const result = await ApiClient.post(deleteUrl, { userId });

      if (result.success) {
        loadUsers(); // Reload users list
      } else {
        alert('Failed to delete user: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Network error: Could not connect to server');
    } finally {
      setDeletingUserId(null);
    }
  };

  const roleOptions = [
    { value: "", label: "All Roles" },
    { value: "Hospital", label: "Hospital" },
    { value: "Pharmacy", label: "Pharmacy" },
    { value: "Patient", label: "Patient" },
  ];

  const userRoleOptions = [
    { value: "Hospital", label: "Hospital" },
    { value: "Pharmacy", label: "Pharmacy" },
    { value: "Patient", label: "Patient" },
  ];

  const handleRoleChange = (value: string) => {
    setSelectedRole(value);
  };

  const handleFormRoleChange = (value: string) => {
    setFormData({ ...formData, role: value });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCreateUser = async () => {
    setCreateError("");
    setCreateSuccess("");

    if (!formData.username || !formData.name || !formData.password || !formData.role) {
      setCreateError("All fields are required");
      return;
    }

    setIsCreating(true);

    try {
      const createUrl = buildUrl(API_CONFIG.adminApi, '/api/create-user');
      const result = await ApiClient.post(createUrl, formData);

      if (result.success) {
        setCreateSuccess(`User created successfully!`);
        setTimeout(() => {
          setFormData({ username: "", name: "", password: "", role: "" });
          setIsAddUserModalOpen(false);
          setCreateSuccess("");
          loadUsers(); // Reload users
        }, 1500);
      } else {
        setCreateError(result.error || 'Failed to create user');
      }
    } catch (error) {
      setCreateError('Network error: Could not connect to server');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setFormData({ username: "", name: "", password: "", role: "" });
    setCreateError("");
    setCreateSuccess("");
    setIsAddUserModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
      {/* Total Users Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex flex-col items-center text-center">
          <h4 className="font-bold text-gray-800 text-title-sm dark:text-white/90">
            {users.length}
          </h4>
          <span className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Total Users
          </span>
        </div>
      </div>

      {/* Active Users Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex flex-col items-center text-center">
          <h4 className="font-bold text-title-sm" style={{ color: "#5be9b5" }}>
            {users.filter(u => u.status === 'Active').length}
          </h4>
          <span className="mt-2 text-sm" style={{ color: "#5be9b5" }}>
            Active
          </span>
        </div>
      </div>

      {/* Hospitals Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex flex-col items-center text-center">
          <h4 className="font-bold text-title-sm" style={{ color: "#8dc5ff" }}>
            {users.filter(u => u.role === 'Hospital').length}
          </h4>
          <span className="mt-2 text-sm" style={{ color: "#8dc5ff" }}>
            Hospitals
          </span>
        </div>
      </div>

      {/* Pharmacies Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex flex-col items-center text-center">
          <h4 className="font-bold text-title-sm" style={{ color: "#9173e5" }}>
            {users.filter(u => u.role === 'Pharmacy').length}
          </h4>
          <span className="mt-2 text-sm" style={{ color: "#9173e5" }}>
            Pharmacies
          </span>
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
              placeholder="Search Users"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>

          {/* Role Select */}
          <div className="relative sm:w-48">
            <Select
              options={roleOptions}
              placeholder="Select Role"
              onChange={handleRoleChange}
              defaultValue={selectedRole}
              className="dark:bg-white/[0.03]"
            />
            <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
              <ChevronDownIcon />
            </span>
          </div>
        </div>

        {/* Add User Button */}
        <button
          onClick={() => setIsAddUserModalOpen(true)}
          className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-[#00bc83] to-[#00b9d1] text-white font-medium text-sm shadow-theme-xs hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Add New User Modal */}
      <Modal
        key={isAddUserModalOpen ? "open" : "closed"}
        isOpen={isAddUserModalOpen}
        onClose={handleCancel}
        className="max-w-[600px] p-6 lg:p-8"
      >
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h4 className="font-semibold text-gray-800 text-title-sm dark:text-white/90">
              Add New User
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              create a new system user account
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Username and Name Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  type="text"
                  id="username"
                  name="username"
                  defaultValue={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter username"
                />
              </div>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  type="text"
                  id="name"
                  name="name"
                  defaultValue={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter full name"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                type="password"
                id="password"
                name="password"
                defaultValue={formData.password}
                onChange={handleInputChange}
                placeholder="Enter password"
              />
            </div>
            
            {/* Error/Success Messages */}
            {createError && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {createError}
              </div>
            )}
            {createSuccess && (
              <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
                {createSuccess}
              </div>
            )}

            {/* Role Select */}
            <div>
              <Label htmlFor="role">Role</Label>
              <div className="relative">
                <Select
                  options={userRoleOptions}
                  placeholder="Select Role"
                  onChange={handleFormRoleChange}
                  defaultValue={formData.role}
                  className="dark:bg-white/[0.03]"
                />
                <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
                  <ChevronDownIcon />
                </span>
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
              onClick={handleCreateUser}
              disabled={isCreating}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#00bc83] to-[#00b9d1] text-white font-medium text-sm shadow-theme-xs hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Users Table */}
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
                    USERS
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    ROLE
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    ENTITY NAME
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
                    CREATED
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
                {isLoadingUsers ? (
                  <TableRow>
                    <TableCell className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      <div>Loading users...</div>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      <div>No users found</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="px-5 py-4 sm:px-6 text-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30">
                          <span className="text-2xl">
                            {user.role === 'Patient' ? '👤' : user.role === 'Hospital' ? '🏥' : '💊'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                            {user.name}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <Badge
                        size="sm"
                        color={
                          user.role === "Hospital"
                            ? "info"
                            : user.role === "Pharmacy"
                            ? "success"
                            : user.role === "Patient"
                            ? "warning"
                            : "light"
                        }
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400 text-start">
                      {user.linkedEntity}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <Badge
                        size="sm"
                        color={user.status === "Active" ? "success" : "error"}
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-gray-500 text-theme-sm dark:text-gray-400 text-start">
                      {user.created}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                          title="Edit"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          disabled={deletingUserId === user.id}
                          className="p-2 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete"
                        >
                          <TrashBinIcon className="w-4 h-4" />
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

