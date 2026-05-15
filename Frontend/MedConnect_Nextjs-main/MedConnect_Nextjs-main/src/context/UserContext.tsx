"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

type UserRole = "Admin" | "Hospital" | "Pharmacy" | "Patient" | null;

type UserContextType = {
  role: UserRole;
  setRole: (role: UserRole) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [role, setRoleState] = useState<UserRole>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Load role from localStorage on mount
    const savedRole = localStorage.getItem("userRole") as UserRole | null;
    if (savedRole) {
      setRoleState(savedRole);
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    // Save role to localStorage when it changes
    if (isInitialized) {
      if (role) {
        localStorage.setItem("userRole", role);
      } else {
        localStorage.removeItem("userRole");
      }
    }
  }, [role, isInitialized]);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
  };

  const logout = () => {
    setRoleState(null);
    localStorage.removeItem("userRole");
  };

  return (
    <UserContext.Provider value={{ role, setRole, logout }}>
      {children}
    </UserContext.Provider>
  );
};

