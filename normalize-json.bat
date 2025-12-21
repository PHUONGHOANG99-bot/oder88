@echo off
REM Batch file để normalize products.json sau khi chỉnh sửa
REM Đảm bảo encoding UTF-8 đúng và không có lỗi "Â" trước giá

echo 🔄 Đang normalize file products.json...
node normalize-products-json.js
echo.
pause

