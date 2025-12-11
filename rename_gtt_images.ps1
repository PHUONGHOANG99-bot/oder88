# Script PowerShell de doi ten anh giay the thao
$imageDir = "assets\image\giay-nu\giay-the-thao"

if (-not (Test-Path $imageDir)) {
    Write-Host "Thu muc khong ton tai: $imageDir"
    exit
}

$imageFiles = Get-ChildItem -Path $imageDir -File | Where-Object {
    $_.Extension -match '\.(jpg|jpeg|png|JPG|JPEG|PNG)$'
} | Sort-Object Name

if ($imageFiles.Count -eq 0) {
    Write-Host "Khong tim thay anh nao"
    exit
}

Write-Host "Tim thay $($imageFiles.Count) anh"

$renamedCount = 0
$index = 1

foreach ($file in $imageFiles) {
    $newName = "gtt$index.jpg"
    $newPath = Join-Path $imageDir $newName
    
    if ($file.Name -eq $newName) {
        Write-Host "OK: $($file.Name)"
        $index++
        continue
    }
    
    if (Test-Path $newPath -PathType Leaf) {
        Write-Host "Bo qua: $($file.Name) - $newName da ton tai"
        $index++
        continue
    }
    
    try {
        Rename-Item -Path $file.FullName -NewName $newName -ErrorAction Stop
        Write-Host "Doi ten: $($file.Name) -> $newName"
        $renamedCount++
    } catch {
        Write-Host "Loi: $($file.Name) - $_"
    }
    
    $index++
}

Write-Host "Hoan thanh! Da doi ten $renamedCount file"
Write-Host "Tong so anh: $($imageFiles.Count)"
