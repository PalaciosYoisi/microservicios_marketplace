@echo off
TITLE EmprendeMarket - Panel de Control
cd /d "%~dp0"

echo.
echo  ====================================================
echo    EmprendeMarket ^| Iniciando Microservicios
echo  ====================================================
echo.

echo  Verificando dependencias...
IF NOT EXIST "%~dp0gateway\node_modules"                echo  [FALTA] Ejecuta install-all.bat primero: gateway
IF NOT EXIST "%~dp0auth-service\node_modules"           echo  [FALTA] Ejecuta install-all.bat primero: auth-service
IF NOT EXIST "%~dp0productos-service\node_modules"      echo  [FALTA] Ejecuta install-all.bat primero: productos-service
IF NOT EXIST "%~dp0pedidos-service\node_modules"        echo  [FALTA] Ejecuta install-all.bat primero: pedidos-service
IF NOT EXIST "%~dp0notificaciones-service\node_modules" echo  [FALTA] Ejecuta install-all.bat primero: notificaciones-service
IF NOT EXIST "%~dp0reportes-service\node_modules"       echo  [FALTA] Ejecuta install-all.bat primero: reportes-service
IF NOT EXIST "%~dp0frontend-service\node_modules"       echo  [FALTA] Ejecuta install-all.bat primero: frontend-service
echo.

echo  [1/7] API Gateway          ^- Puerto 3000
start "Gateway  :3000" cmd /k "cd /d %~dp0gateway && npm start"
timeout /t 1 /nobreak >nul

echo  [2/7] Auth Service         ^- Puerto 3001
start "Auth     :3001" cmd /k "cd /d %~dp0auth-service && npm start"
timeout /t 1 /nobreak >nul

echo  [3/7] Productos Service    ^- Puerto 3002
start "Productos:3002" cmd /k "cd /d %~dp0productos-service && npm start"
timeout /t 1 /nobreak >nul

echo  [4/7] Pedidos Service      ^- Puerto 3003
start "Pedidos  :3003" cmd /k "cd /d %~dp0pedidos-service && npm start"
timeout /t 1 /nobreak >nul

echo  [5/7] Notificaciones Svc   ^- Puerto 3004
start "Notific  :3004" cmd /k "cd /d %~dp0notificaciones-service && npm start"
timeout /t 1 /nobreak >nul

echo  [6/7] Frontend Service     ^- Puerto 3005
start "Frontend :3005" cmd /k "cd /d %~dp0frontend-service && npm start"
timeout /t 1 /nobreak >nul

echo  [7/7] Reportes Service     ^- Puerto 3006
start "Reportes :3006" cmd /k "cd /d %~dp0reportes-service && npm start"

echo.
echo  ====================================================
echo.
echo    IMPORTANTE: Accede SIEMPRE por el Gateway:
echo    >>> http://localhost:3000 <<<
echo.
echo    (Puerto 3005 es solo el servidor de archivos,
echo     no tiene las rutas /api - NO lo uses directamente)
echo.
echo    Health de todos los servicios:
echo    http://localhost:3000/gateway/services
echo  ====================================================
echo.
pause
