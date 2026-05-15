"use client";
import React, { useRef, useState, useEffect } from "react";
import { Download, Mail, Phone, Droplet } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { API_CONFIG, buildUrl } from "@/config/api-config";
import { ApiClient } from "@/services/api-client";

export default function MyQRCode() {
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [patientData, setPatientData] = useState<any>(null);
  const [qrData, setQrData] = useState<any>(null);
  const [currentOTP, setCurrentOTP] = useState<string>("");
  const [sessionStatus, setSessionStatus] = useState<string>("");
  const [otpTimer, setOtpTimer] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showWallet, setShowWallet] = useState(false);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const token = localStorage.getItem('patientToken');
        if (!token) {
          setLoading(false);
          return;
        }
        
        const res = await ApiClient.get(buildUrl(API_CONFIG.patientApi, '/api/profile'), localStorage.getItem('patientToken') || undefined);
        const data = res;
        
        if (data.success && data.profile) {
          setPatientData(data.profile);
        }
      } catch (error) {
        console.error("Failed to fetch patient data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, []);

  useEffect(() => {
    if (!patientData) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await ApiClient.get(buildUrl(API_CONFIG.patientApi, `/api/session-status/${patientData.walletAddress}`));
        const result = response;
        
        if (result.success && result.session && result.session.otp) {
          if (result.session.otp !== currentOTP) {
            setCurrentOTP(result.session.otp);
            setOtpTimer(5 * 60); // 5 minutes in seconds
          }
          setSessionStatus(result.session.status || "");
        } else {
          // No session - reset OTP
          if (currentOTP) {
            setCurrentOTP("");
            setSessionStatus("");
            setOtpTimer(0);
          }
        }
      } catch (error) {
        console.log('OTP polling error:', error);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [patientData, currentOTP]);

  useEffect(() => {
    if (otpTimer > 0 && sessionStatus !== 'HOSPITAL_ACCESSING') {
      const timer = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [otpTimer, sessionStatus]);

  const generateQR = async () => {
    const token = localStorage.getItem('patientToken');
    if (!token) return;
    
    try {
      const response = await ApiClient.post(buildUrl(API_CONFIG.patientApi, '/api/generate-qr'), {
        patientId: patientData.id,
        timestamp: Date.now(),
        version: '2.0'
      }, token);

      const result = response;
      
      if (result.success) {
        setQrData(result);
      }
    } catch (error) {
      console.error('Failed to generate QR:', error);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-6">Loading...</div>;
  }

  if (!patientData) {
    return <div className="flex justify-center p-6">Please login first</div>;
  }

  return (
    <div className="flex justify-center">
      <div className="w-2/5 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Name and Wallet Address Section */}
      <div 
        className="rounded-xl border-[1px] border-dashed p-6 mb-6"
        style={{
          borderColor: "#03b580",
          background: "linear-gradient(to right, #fe9900, #ff6a00)",
        }}
      >
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-white">
            {patientData.name}
          </h2>
          <div className="flex items-center gap-2">
            <p className="text-sm text-white/90 font-mono break-all flex-1">
              {showWallet ? patientData.walletAddress : '•'.repeat(42)}
            </p>
            <button
              onClick={() => setShowWallet(!showWallet)}
              className="px-3 py-1 text-xs font-medium text-white bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-1"
              title={showWallet ? "Hide wallet address" : "Show wallet address"}
            >
              {showWallet ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  Hide
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Show
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* QR Code Section */}
      <div className="mb-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
          Hospital Access QR
        </h3>
        <div className="flex flex-col items-center gap-4">
          {qrData ? (
            <div ref={qrCodeRef} className="flex items-center justify-center p-4 bg-white rounded-lg border border-gray-200 dark:border-gray-700">
              <img src={qrData.qrImage} alt="QR Code" className="w-[200px] h-[200px]" />
            </div>
          ) : (
            <div className="flex items-center justify-center p-4 bg-gray-100 rounded-lg border border-gray-200 dark:border-gray-700 w-[232px] h-[232px]">
              <p className="text-sm text-gray-500">Tap to generate your secure QR code</p>
            </div>
          )}
          <button
            onClick={generateQR}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
          >
            🔐 Generate QR Code
          </button>
          <div className="text-center mt-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Present this QR code when visiting a hospital or Pharmacy
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Staff will scan this to access your medical records securely
            </p>
          </div>
        </div>
      </div>

      {/* OTP Section */}
      {qrData && (
        <div className="mb-6">
          <div 
            className="rounded-xl p-6"
            style={{
              background: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
            }}
          >
            <h4 className="text-center font-semibold text-gray-800 mb-4">🔢 Hospital OTP</h4>
            <div 
              className="bg-white text-gray-800 text-3xl font-bold font-mono text-center py-4 px-6 rounded-lg mb-3"
              style={{ letterSpacing: '8px' }}
            >
              {sessionStatus === 'HOSPITAL_ACCESSING' ? "ACCESSING..." : (currentOTP || "------")}
            </div>
            <p className="text-center text-sm text-gray-700">
              {sessionStatus === 'HOSPITAL_ACCESSING' 
                ? `Valid for ${Math.floor(otpTimer / 60)}:${(otpTimer % 60).toString().padStart(2, '0')} - Hospital can use this OTP`
                : currentOTP 
                  ? "Show this OTP to hospital staff for data access" 
                  : "Waiting for QR scan..."}
            </p>
            {!currentOTP && (
              <p className="text-center text-xs text-gray-600 mt-2">
                OTP will appear instantly when hospital scans your QR code
              </p>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
