@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Necesitas instalar Node.js LTS desde https://nodejs.org/
 pause
 exit /b 1
)
if not exist "node_modules\electron" (
 echo Instalando dependencias de escritorio...
 call npm install
 if errorlevel 1 (pause & exit /b 1)
)
call npm start
if errorlevel 1 pause
