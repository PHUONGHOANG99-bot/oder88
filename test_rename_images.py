#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script test - chỉ hiển thị thông tin, không thay đổi file
"""

import os
import hashlib
from pathlib import Path
from collections import defaultdict

# Cấu hình
IMAGE_DIR = "assets/image"
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.JPG', '.JPEG', '.PNG'}

def get_file_hash(file_path):
    """Tính hash MD5 của file"""
    hash_md5 = hashlib.md5()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except Exception as e:
        print(f"❌ Lỗi khi đọc file {file_path}: {e}")
        return None

def find_all_images(root_dir):
    """Tìm tất cả ảnh trong thư mục"""
    images = []
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            ext = Path(file).suffix
            if ext in IMAGE_EXTENSIONS:
                full_path = os.path.join(root, file)
                images.append(full_path)
    return images

def find_duplicates(images):
    """Tìm ảnh trùng lặp dựa trên hash"""
    hash_to_files = defaultdict(list)
    
    print("🔍 Đang quét và tính hash cho các ảnh...")
    for i, img_path in enumerate(images):
        if (i + 1) % 10 == 0:
            print(f"  Đã xử lý {i + 1}/{len(images)} ảnh...")
        file_hash = get_file_hash(img_path)
        if file_hash:
            hash_to_files[file_hash].append(img_path)
    
    duplicates = {}
    for file_hash, files in hash_to_files.items():
        if len(files) > 1:
            duplicates[file_hash] = {
                'keep': files[0],
                'duplicates': files[1:]
            }
    
    return duplicates

def analyze_extensions(images):
    """Phân tích các extension hiện có"""
    ext_count = defaultdict(int)
    for img_path in images:
        ext = Path(img_path).suffix.lower()
        if ext == '.jpeg':
            ext = '.jpg'
        ext_count[ext] += 1
    return ext_count

def main():
    print("=" * 60)
    print("🖼️  TEST SCRIPT - PHÁT HIỆN ẢNH TRÙNG LẶP")
    print("=" * 60)
    
    # Kiểm tra thư mục ảnh
    if not os.path.exists(IMAGE_DIR):
        print(f"❌ Không tìm thấy thư mục {IMAGE_DIR}")
        return
    
    # Tìm tất cả ảnh
    print(f"\n📂 Đang quét thư mục {IMAGE_DIR}...")
    images = find_all_images(IMAGE_DIR)
    print(f"  ✓ Tìm thấy {len(images)} ảnh")
    
    if not images:
        print("⚠️  Không tìm thấy ảnh nào!")
        return
    
    # Phân tích extension
    print("\n📊 Phân tích extension:")
    ext_count = analyze_extensions(images)
    for ext, count in sorted(ext_count.items()):
        print(f"  • {ext}: {count} file")
    
    # Tìm duplicates
    print("\n" + "=" * 60)
    duplicates = find_duplicates(images)
    
    if duplicates:
        print(f"\n⚠️  Phát hiện {len(duplicates)} nhóm ảnh trùng lặp!")
        print("\n📋 Chi tiết các ảnh trùng:")
        for i, (file_hash, dup_info) in enumerate(duplicates.items(), 1):
            print(f"\n  Nhóm {i}:")
            print(f"    ✓ Giữ lại: {dup_info['keep']}")
            for dup in dup_info['duplicates']:
                print(f"    ✗ Xóa: {dup}")
        
        total_duplicates = sum(len(dup_info['duplicates']) for dup_info in duplicates.values())
        print(f"\n📊 Tổng kết:")
        print(f"  • Số nhóm trùng: {len(duplicates)}")
        print(f"  • Số file sẽ xóa: {total_duplicates}")
        print(f"  • Số file giữ lại: {len(images) - total_duplicates}")
    else:
        print("\n✓ Không có ảnh trùng lặp!")
    
    # Kiểm tra tên file cần đổi
    print("\n" + "=" * 60)
    print("📝 Phân tích tên file cần đổi:")
    needs_rename = 0
    for img_path in images:
        path_obj = Path(img_path)
        ext = path_obj.suffix
        if ext != ext.lower() or ext.lower() == '.jpeg':
            needs_rename += 1
    
    print(f"  • Số file cần đổi extension: {needs_rename}")
    print(f"  • Số file đã đúng format: {len(images) - needs_rename}")
    
    print("\n" + "=" * 60)
    print("✅ HOÀN TẤT TEST!")
    print("=" * 60)
    print("\n💡 Để thực hiện đổi tên, chạy: python rename_images.py")

if __name__ == "__main__":
    main()

