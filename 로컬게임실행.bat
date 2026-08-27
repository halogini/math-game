@echo off
echo ========================================================
echo HaloMath Local Arcade Server
echo ========================================================
echo.
start http://127.0.0.1:8080/
powershell -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8080 -Root "%~dp0\"
