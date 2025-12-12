@echo off
chcp 65001 >nul
echo ========================================
echo    TẠO BACKUP CODE - ODER 88 WEBSITE
echo ========================================
echo.

set "backup_dir=backup_%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "backup_dir=%backup_dir: =0%"

echo Đang tạo thư mục backup: %backup_dir%
mkdir "%backup_dir%" 2>nul
mkdir "%backup_dir%\assets" 2>nul

echo.
echo Đang copy các file...
copy "index.html" "%backup_dir%\index.html" >nul
if %errorlevel% equ 0 (
    echo [OK] index.html
) else (
    echo [ERROR] Không thể copy index.html
)

copy "assets\style.css" "%backup_dir%\assets\style.css" >nul
if %errorlevel% equ 0 (
    echo [OK] assets\style.css
) else (
    echo [ERROR] Không thể copy assets\style.css
)

copy "assets\script.js" "%backup_dir%\assets\script.js" >nul
if %errorlevel% equ 0 (
    echo [OK] assets\script.js
) else (
    echo [ERROR] Không thể copy assets\script.js
)

echo.
echo ========================================
echo    BACKUP HOÀN TẤT!
echo ========================================
echo.
echo Thư mục backup: %backup_dir%
echo.
echo Để khôi phục, copy các file từ thư mục backup về vị trí gốc.
echo.
pause

