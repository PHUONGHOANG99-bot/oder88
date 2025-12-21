@echo off
REM Batch file để cập nhật giá sản phẩm an toàn
REM Cách dùng: update-price.bat <productId> <newPrice>

if "%~1"=="" (
    echo Cách dùng: update-price.bat ^<productId^> ^<newPrice^>
    echo Ví dụ: update-price.bat 1 2500
    echo         update-price.bat 1 ¥2500
    pause
    exit /b 1
)

node update-price-safe.js %1 %2
echo.
pause

