@echo off
TITLE EmprendeMarket - Instalando dependencias (primera vez)
cd /d "%~dp0"

echo.
echo  ====================================================
echo    EmprendeMarket ^| Instalando dependencias
echo    Ejecutar UNA sola vez antes de start-all.bat
echo  ====================================================
echo.

echo  [1/7] gateway...
cd /d "%~dp0gateway" && npm install
echo.

echo  [2/7] auth-service...
cd /d "%~dp0auth-service" && npm install
echo.

echo  [3/7] productos-service...
cd /d "%~dp0productos-service" && npm install
echo.

echo  [4/7] pedidos-service...
cd /d "%~dp0pedidos-service" && npm install
echo.

echo  [5/7] notificaciones-service...
cd /d "%~dp0notificaciones-service" && npm install
echo.

echo  [6/7] frontend-service...
cd /d "%~dp0frontend-service" && npm install
echo.

echo  [7/7] reportes-service...
cd /d "%~dp0reportes-service" && npm install
echo.

echo  ====================================================
echo    Instalacion completada.
echo    Ahora ejecuta start-all.bat
echo  ====================================================
pause
