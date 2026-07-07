@echo off
title Jujum AI Startup Script
echo ===================================================
echo               Jujum AI Starter
echo ===================================================
echo.

:: Verify node_modules in backend
if not exist "backend\node_modules\" (
    echo [ERROR] backend/node_modules not found. Running npm install...
    cd backend
    call npm install
    cd ..
)

:: Verify node_modules in frontend
if not exist "frontend\node_modules\" (
    echo [ERROR] frontend/node_modules not found. Running npm install...
    cd frontend
    call npm install
    cd ..
)

echo Starting Backend API Worker on port 4000...
start "Jujum Backend" cmd /k "cd backend && npm run dev"

echo Starting Frontend UI on port 3000...
start "Jujum Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo [SUCCESS] Both services launched in separate windows!
echo - Backend: http://localhost:4000/health
echo - Frontend: http://localhost:3000
echo.
echo Close the newly opened terminal windows to stop services.
echo ===================================================
pause
