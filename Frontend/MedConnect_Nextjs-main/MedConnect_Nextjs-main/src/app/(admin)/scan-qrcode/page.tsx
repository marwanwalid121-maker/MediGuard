"use client";

import React, { useState, useEffect } from "react";
import { QrCode, ScanLine } from "lucide-react";
import QRCodeLib from 'qrcode';
import { API_CONFIG, buildUrl } from "@/config/api-config";
import { ApiClient } from "@/services/api-client";

export default function ScanQRCode() {
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    generateQRCode();
  }, []);

  const generateQRCode = async () => {
    try {
      setIsLoading(true);

      // Fetch the current ngrok URL from our admin server
      let ngrokUrl = 'http://localhost:3004'; // fallback

      try {
        const ngrokUrlEndpoint = buildUrl(API_CONFIG.adminApi, '/api/ngrok-url');
        const data = await ApiClient.get(ngrokUrlEndpoint);

        if (data.success && data.url) {
          ngrokUrl = data.url;
          console.log(`🔗 Using ngrok URL (${data.source}):`, ngrokUrl);
        } else {
          console.log('⚠️ Could not get ngrok URL from server');
        }
      } catch (fetchError) {
        console.warn('Could not fetch ngrok URL from admin server:', (fetchError as Error).message);

        // Try direct ngrok API as fallback
        try {
          const ngrokResponse = await fetch('http://localhost:4040/api/tunnels');
          const ngrokData = await ngrokResponse.json();
          const httpsTunnel = ngrokData.tunnels.find((tunnel: any) =>
            tunnel.proto === 'https' && tunnel.config.addr === 'localhost:3004'
          );

          if (httpsTunnel) {
            ngrokUrl = httpsTunnel.public_url;
            console.log('🔗 Using ngrok URL from direct API:', ngrokUrl);
          }
        } catch (directError) {
          console.warn('Direct ngrok API also failed:', (directError as Error).message);
        }
      }
      
      const qrCodeDataURL = await QRCodeLib.toDataURL(ngrokUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataURL(qrCodeDataURL);
      setCurrentUrl(ngrokUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    {
      number: 1,
      title: "Open Camera Phone",
      description: "Open your phone's camera app to scan the QR code.",
    },
    {
      number: 2,
      title: "Scan QR Code",
      description: "Point your camera at this QR code to scan it.",
    },
    {
      number: 3,
      title: "Access MediGuard Scanner",
      description: "You will be directed to the MediGuard QR scanner portal.",
    },
    {
      number: 4,
      title: "Scan Patient QR",
      description: "Use the scanner to scan patient's QR code for secure access to medical records.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main QR Code Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-white/[0.03] md:p-10">
        <div className="flex flex-col items-center justify-center text-center space-y-6">
          {/* QR Code Display */}
          <div className="flex items-center justify-center">
            {isLoading ? (
              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                <QrCode className="w-16 h-16 text-blue-500 dark:text-blue-400 animate-pulse" />
              </div>
            ) : (
              <div className="p-4 bg-white rounded-xl shadow-lg border border-gray-200">
                <img 
                  src={qrCodeDataURL} 
                  alt="Access QR Code" 
                  className="w-64 h-64"
                />
              </div>
            )}
          </div>

          {/* QR Code Info */}
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
              MediGuard Access QR Code
            </h2>
            <p className="text-base text-gray-600 dark:text-gray-400 max-w-md">
              Show this QR code to patients for secure access to the system
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 font-mono break-all">
              {currentUrl || 'Loading URL...'}
            </p>
          </div>

          {/* Regenerate Button */}
          <button
            onClick={generateQRCode}
            className="flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-[#00bc83] to-[#00b9d1] text-white font-medium text-sm rounded-lg shadow-theme-xs hover:opacity-90 transition-opacity"
          >
            <ScanLine className="w-4 h-4" />
            Regenerate QR Code
          </button>
        </div>
      </div>

      {/* How it Works Section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] md:p-8">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90 mb-6">
          How it works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map((step) => (
            <div
              key={step.number}
              className="flex gap-4 p-4 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.02] hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
            >
              {/* Step Number */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 dark:bg-blue-600 text-white font-semibold">
                  {step.number}
                </div>
              </div>

              {/* Step Content */}
              <div className="flex-1 space-y-1">
                <h4 className="font-semibold text-gray-800 dark:text-white/90">
                  {step.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

