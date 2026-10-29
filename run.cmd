@echo off
REM SwiftMedNav one-terminal launcher for Windows. Double-click or: run.cmd [dev|start] [reseed]
REM   dev    - Next.js dev server, default
REM   start  - production build + start
REM   reseed - force re-run of the MongoDB demo seed, otherwise seeded once
REM Needs: Node.js 20+ and Python 3.10+ on PATH. First run does npm install, pip install, model training, DB seed.
title SwiftMedNav - web :3000 + ML :8001
cd /d "%~dp0"
if "%~1"=="clean" (
  echo [clean] removing web\.next dev cache...
  rmdir /s /q "web\.next" 2>nul
  echo [clean] done. Run run.cmd again to start fresh.
  pause
  exit /b 0
)
set MODE=dev
set RESEED=
set FAILED=
if "%~1"=="start" set MODE=start
if "%~1"=="reseed" set RESEED=1
if "%~2"=="start" set MODE=start
if "%~2"=="reseed" set RESEED=1

where node >nul 2>&1
if errorlevel 1 echo [error] node.exe not found on PATH. Install Node.js 20+ from https://nodejs.org then retry.
if errorlevel 1 set FAILED=1
where npm >nul 2>&1
if errorlevel 1 echo [error] npm not found on PATH. Install Node.js 20+ from https://nodejs.org then retry.
if errorlevel 1 set FAILED=1
where python >nul 2>&1
if errorlevel 1 echo [warn] python not found on PATH. Web will run, ML will use built-in fallback.
if defined FAILED goto FAIL

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if not errorlevel 1 echo [error] port 3000 is already in use. Stop the other server and retry.
if not errorlevel 1 set FAILED=1
netstat -ano | findstr ":8001" | findstr "LISTENING" >nul
if not errorlevel 1 echo [error] port 8001 is already in use. Stop the other ML service and retry.
if not errorlevel 1 set FAILED=1
if defined FAILED goto FAIL

if not exist "web\.env.local" copy "web\.env.example" "web\.env.local" >nul
if not exist "web\.env.local" echo [warn] could not create web\.env.local
if not exist "web\node_modules" call npm --prefix web install --no-audit --no-fund
if not exist "web\node_modules" echo [error] web dependencies missing and install failed.
if not exist "web\node_modules" set FAILED=1
if defined FAILED goto FAIL

python -c "import fastapi, uvicorn, sklearn, pandas" 2>nul
if errorlevel 1 python -m pip install -r ml-service\requirements.txt
python -c "import fastapi, uvicorn, sklearn, pandas" 2>nul
if errorlevel 1 echo [warn] Python ML deps unavailable. Continuing - API will use the heuristic fallback.

if not exist "ml-service\models\rf_model.pkl" python ml-service\train.py
if not exist "ml-service\models\rf_model.pkl" echo [warn] model training failed. Continuing - API will use the heuristic fallback.

if defined RESEED del /f /q "web\.seeded" 2>nul
if exist "web\.seeded" goto SEEDED
call npm --prefix web run seed
if errorlevel 1 echo [warn] seed failed - is MongoDB running? Demo works without it.
if not errorlevel 1 echo ok > "web\.seeded"
goto SEEDDONE
:SEEDED
echo [setup] demo data already seeded - use run.cmd reseed to force
:SEEDDONE

echo(
echo [ml] starting FastAPI on http://127.0.0.1:8001 ...
start /b "" python -m uvicorn app:app --port 8001 --app-dir ml-service
echo [web] starting MODE=%MODE% on http://localhost:3000 ...
if "%MODE%"=="start" call npm --prefix web run build
if "%MODE%"=="start" call npm --prefix web run start -- -p 3000
if not "%MODE%"=="start" call npm --prefix web run dev -- -p 3000
if errorlevel 1 echo [error] web server exited with an error.
if errorlevel 1 set FAILED=1

echo(
echo [shutdown] stopping ML service on :8001 ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
if defined FAILED goto FAIL
echo Done. Window will stay open - close it when finished.
pause >nul
exit /b 0

:FAIL
echo(
echo Launch FAILED - read the messages above. Fix the issue and run again.
echo This window stays open so you can read the error.
pause
exit /b 1
