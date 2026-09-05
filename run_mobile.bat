@echo off
title DOOR Mobile App (Expo Metro Server)
echo ===================================================
echo               DOOR Mobile App Starter
echo ===================================================
echo.

cd /d "%~dp0mobile"

if not exist "node_modules\" (
    echo [ERROR] mobile/node_modules not found. Running npm install...
    call npm install
)

echo Starting Expo Development Server...
call npm start
pause
