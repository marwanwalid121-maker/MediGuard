"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useRef } from "react";
import { useUser } from "@/context/UserContext";
import { getApiEndpoint, buildUrl } from "@/config/api-config";
import { ApiClient } from "@/services/api-client";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { setRole } = useUser();

  const handleDemoCredentials = (email: string, password: string) => {
    if (emailRef.current) {
      emailRef.current.value = email;
      // Trigger input event to ensure React recognizes the change
      emailRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (passwordRef.current) {
      passwordRef.current.value = password;
      passwordRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
    // Clear errors when demo credentials are filled
    setEmailError("");
    setPasswordError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Get current values
    const email = emailRef.current?.value.trim() || "";
    const password = passwordRef.current?.value.trim() || "";

    // Reset errors
    setEmailError("");
    setPasswordError("");

    // Validate fields
    let isValid = true;

    if (!email) {
      setEmailError("Email or Username is required");
      isValid = false;
    }

    if (!password) {
      setPasswordError("Password is required");
      isValid = false;
    }

    // Only proceed if validation passes
    if (isValid) {
      const emailLower = email.toLowerCase();

      // Handle frontend-only authentication for admin demo account
      if (emailLower === "admin" && password === "admin123") {
        localStorage.setItem('patientToken', 'frontend-auth-token');
        localStorage.setItem('patientName', 'Ministry of Health');
        setRole("Admin");
        router.push("/admin-dashboard");
        return;
      }

      // Call unified login API at admin dashboard for all other users
      const apiEndpoint = buildUrl(getApiEndpoint('admin'), '/api/login');
      console.log('🔍 Calling unified login:', apiEndpoint, { username: email });
      
      const result = await ApiClient.post(apiEndpoint, { username: email, password });
      console.log('📥 Login response:', result);

      if (result.success && result.token) {
        const backendRole = (result.user.role || '').toLowerCase();
        const userName = result.user.name || result.user.username || email;
        console.log('👤 User role from backend:', backendRole);
        console.log('👤 User name from backend:', userName);

        // Map backend role to frontend role type
        let actualRole: "Admin" | "Hospital" | "Pharmacy" | "Patient" = "Patient";
        let actualDashboard = "/patient-dashboard";

        if (backendRole === 'pharmacy') {
          actualRole = "Pharmacy";
          actualDashboard = "/pharmacy-dashboard";
        } else if (backendRole === 'hospital' || backendRole === 'hospital staff') {
          actualRole = "Hospital";
          actualDashboard = "/hospital-dashboard";
        } else if (backendRole === 'patient') {
          actualRole = "Patient";
          actualDashboard = "/patient-dashboard";
        }

        console.log('🎯 Routing to:', actualDashboard, 'with role:', actualRole);

        // Store common fields
        localStorage.setItem('patientToken', result.token);
        localStorage.setItem('patientName', userName);
        localStorage.setItem('userId', result.user.id);
        localStorage.setItem('userRole', backendRole);

        // Store role-specific fields
        if (actualRole === 'Hospital') {
          localStorage.setItem('hospitalId', result.user.id);
          localStorage.setItem('hospitalName', userName);
          if (result.user.walletAddress) {
            localStorage.setItem('hospitalWallet', result.user.walletAddress);
          }
        } else if (actualRole === 'Pharmacy') {
          localStorage.setItem('pharmacyId', result.user.id);
          localStorage.setItem('pharmacyName', userName);
          if (result.user.walletAddress) {
            localStorage.setItem('pharmacyWallet', result.user.walletAddress);
          }
        }

        console.log('✅ Login successful:', { userName, userRole: backendRole, userId: result.user.id, walletAddress: result.user.walletAddress, dashboard: actualDashboard });

        setRole(actualRole);
        router.push(actualDashboard);
      } else {
        // Show the error message from backend or default to "Invalid username or password"
        const errorMessage = result.error || "Invalid username or password";
        setPasswordError(errorMessage);
        console.log('❌ Login failed:', errorMessage);
      }
    }
  };
  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full pt-20">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Sign In
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your username and password to sign in!
            </p>
          </div>
          <div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <Label>
                    Username <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input 
                    ref={emailRef}
                    placeholder="Enter username" 
                    type="text"
                    error={!!emailError}
                    hint={emailError}
                    onChange={() => setEmailError("")}
                  />
                </div>
                <div>
                  <Label>
                    Password <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      ref={passwordRef}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      error={!!passwordError}
                      hint={passwordError}
                      onChange={() => setPasswordError("")}
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isChecked} onChange={setIsChecked} />
                    <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                      Keep me logged in
                    </span>
                  </div>
                </div>
                <div>
                  <Button className="w-full" size="sm">
                    Sign in
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-6">
              <p className="mb-3 text-sm font-medium text-center text-gray-600 dark:text-gray-400">
                Demo Credentials
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  onClick={() => handleDemoCredentials("admin", "admin123")}
                  className="flex flex-col items-center px-4 py-2.5 text-xs font-normal text-center text-gray-700 transition-colors bg-gray-100 rounded-lg hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
                >
                  <span className="font-medium" style={{ color: "#08ab7f" }}>Admin</span>
                  <span className="text-gray-500">admin/admin123</span>
                </button>
                <button
                  onClick={() => handleDemoCredentials("doctor", "doctor123")}
                  className="flex flex-col items-center px-4 py-2.5 text-xs font-normal text-center text-gray-700 transition-colors bg-gray-100 rounded-lg hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
                >
                  <span className="font-medium" style={{ color: "#4c97ed" }}>Hospital</span>
                  <span className="text-gray-500">doctor/doctor123</span>
                </button>
                <button
                  onClick={() => handleDemoCredentials("Pharma", "Pharma")}
                  className="flex flex-col items-center px-4 py-2.5 text-xs font-normal text-center text-gray-700 transition-colors bg-gray-100 rounded-lg hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
                >
                  <span className="font-medium" style={{ color: "#9967cf" }}>Pharmacy</span>
                  <span className="text-gray-500">Pharma/Pharma</span>
                </button>
                <button
                  onClick={() => handleDemoCredentials("patient", "patient123")}
                  className="flex flex-col items-center px-4 py-2.5 text-xs font-normal text-center text-gray-700 transition-colors bg-gray-100 rounded-lg hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
                >
                  <span className="font-medium" style={{ color: "#ce9a0f" }}>Patient</span>
                  <span className="text-gray-500">patient/patient123</span>
                </button>
              </div>
            </div>


          </div>
        </div>
      </div>
    </div>
  );
}
