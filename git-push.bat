@echo off
REM Script tự động add products.json và push code
REM Cách dùng: git-push.bat [commit message]

echo Đang kiểm tra thay đổi trong products.json...
git add assets/products.json

if %errorlevel% neq 0 (
    echo Lỗi: Không thể add products.json
    pause
    exit /b 1
)

echo Đã thêm products.json vào staging area

REM Kiểm tra xem có thay đổi nào để commit không
git diff --cached --quiet assets/products.json
if %errorlevel% equ 0 (
    echo Không có thay đổi trong products.json
) else (
    echo Có thay đổi trong products.json, đang commit...
    if "%~1"=="" (
        git commit -m "Auto-update products.json"
    ) else (
        git commit -m "%~1"
    )
)

REM Push code
echo Đang push code lên remote...
git push

if %errorlevel% equ 0 (
    echo.
    echo ✓ Push thành công!
) else (
    echo.
    echo ✗ Lỗi khi push code
    pause
    exit /b 1
)

pause

