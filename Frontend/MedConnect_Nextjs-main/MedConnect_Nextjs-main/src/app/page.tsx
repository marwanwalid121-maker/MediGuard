import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";
import GridShape from "@/components/common/GridShape";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export const metadata: Metadata = {
  title: "Sign In Page | MediGuard - Healthcare Dashboard",
  description: "Sign in to MediGuard Healthcare Dashboard",
};

export default function Home() {
  return (
    <div className="relative bg-white z-1 dark:bg-gray-900">
      <div className="relative flex lg:flex-row w-full min-h-screen justify-center flex-col dark:bg-gray-900">
        <SignInForm />
        <div className="lg:w-1/2 w-full min-h-screen bg-brand-950 dark:bg-white/5 lg:grid items-center hidden">
          <div className="relative items-center justify-center  flex z-1">
            {/* <!-- ===== Common Grid Shape Start ===== --> */}
            <GridShape />
            <div className="flex flex-col items-center max-w-md">
              <div className="block mb-4">
                <img
                  width={400}
                  height={120}
                  src="./images/logo/auth-logo.png"
                  alt="Logo"
                  className="w-full h-auto"
                />
              </div>
              <p className="text-center text-gray-400 dark:text-white/60">
                MediGuard EHR
              </p>
              <p className="text-center text-gray-400 dark:text-white/60">
                 Blockchain-based EHR system with QR code verification for diagnosis and medication
              </p>
            </div>
          </div>
        </div>
        <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}

