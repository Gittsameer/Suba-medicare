@echo off

cd /d "c:\PROJECTS\HMS\Suba-medicare"

echo Starting backend...
start "Suba Medicare Backend" cmd /k "cd /d backend && node server.js"

echo Starting frontend...
start "Suba Medicare Frontend" cmd /k "cd /d frontend && node server.js"

echo Starting MySQL service...
net start MySQL80

echo All services started.
pause