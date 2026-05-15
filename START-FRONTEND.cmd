@echo off
echo ========================================
echo  MEDIGUARD FRONTEND - NEXT.JS
echo ========================================
echo.

cd /d "%~dp0Frontend\MedConnect_Nextjs-main\MedConnect_Nextjs-main"

echo Starting Next.js development server...
echo.
echo Access URLs:
echo - Frontend: http://localhost:3000
echo - Admin Dashboard: http://localhost:3000/admin-dashboard
echo - Patient Dashboard: http://localhost:3000/patient-dashboard
echo - Hospital Dashboard: http://localhost:3000/hospital-dashboard
echo - Analytics Logs: http://localhost:3000/analytics-logs
echo - Patients: http://localhost:3000/patients
echo.

npm run dev
