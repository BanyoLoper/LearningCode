@echo off
echo ================================================================
echo  POO en C# para Unity — Servidor Local
echo ================================================================
echo.
echo Iniciando servidor en http://localhost:3000
echo Abre tu navegador y ve a esa URL.
echo Presiona Ctrl+C para detener el servidor.
echo.

:: Try npx serve first
where npx >nul 2>&1
if %ERRORLEVEL% == 0 (
    npx serve . -p 3000 --no-clipboard
    goto :end
)

:: Fallback to Python
where python >nul 2>&1
if %ERRORLEVEL% == 0 (
    python -m http.server 3000
    goto :end
)

:: Fallback to Python3
where python3 >nul 2>&1
if %ERRORLEVEL% == 0 (
    python3 -m http.server 3000
    goto :end
)

echo ERROR: No se encontro Node.js (npx) ni Python.
echo Instala Node.js desde https://nodejs.org o Python desde https://python.org
echo.
pause

:end
