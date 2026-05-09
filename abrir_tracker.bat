@echo off
echo Prendiendo el motor del servidor...
start cmd /k "python -m http.server 8000"
timeout /t 2 > nul
start http://localhost:8000