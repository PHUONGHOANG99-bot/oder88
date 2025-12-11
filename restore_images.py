#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Khôi phục ảnh từ backup về đúng thư mục"""

import os
import shutil
from pathlib import Path

BACKUP_DIR = "backup_images"
IMAGE_DIR = "assets/image"

# Mapping prefix -> thư mục
PREFIX_MAP = {
    'ak': 'ao-khoac-nu',
    'b': 'Boot-cao',
    'qd': 'quan-dai-nu',
    'sd': 'set-do-nu',
    'txn': 'tui-xach/tui-xach-nam',
    'tx': 'tui-xach/tui-xach-nu',
    'cv': 'chan-vay'
}

def get_folder_for_file(filename):
    """Xác định thư mục dựa trên tên file"""
    name_lower = filename.lower()
    for prefix, folder in sorted(PREFIX_MAP.items(), key=lambda x: -len(x[0])):
        if name_lower.startswith(prefix):
            return folder
    return None

def main():
    print("=" * 60)
    print("🔄 KHÔI PHỤC ẢNH TỪ BACKUP")
    print("=" * 60)
    
    if not os.path.exists(BACKUP_DIR):
        print(f"❌ Không tìm thấy thư mục backup: {BACKUP_DIR}")
        return
    
    backup_files = [f for f in os.listdir(BACKUP_DIR) 
                    if os.path.isfile(os.path.join(BACKUP_DIR, f))]
    
    print(f"\n📂 Tìm thấy {len(backup_files)} file trong backup")
    
    restored = 0
    skipped = 0
    
    for filename in backup_files:
        folder = get_folder_for_file(filename)
        if not folder:
            print(f"  ⚠️  Không xác định được thư mục cho: {filename}")
            skipped += 1
            continue
        
        dest_dir = os.path.join(IMAGE_DIR, folder)
        dest_path = os.path.join(dest_dir, filename)
        
        # Tạo thư mục nếu chưa có
        os.makedirs(dest_dir, exist_ok=True)
        
        # Copy file
        src_path = os.path.join(BACKUP_DIR, filename)
        if not os.path.exists(dest_path):
            shutil.copy2(src_path, dest_path)
            print(f"  ✓ Khôi phục: {folder}/{filename}")
            restored += 1
        else:
            print(f"  ⊘ Đã tồn tại: {folder}/{filename}")
            skipped += 1
    
    print("\n" + "=" * 60)
    print(f"✅ HOÀN TẤT!")
    print(f"  • Đã khôi phục: {restored} file")
    print(f"  • Đã bỏ qua: {skipped} file")
    print("=" * 60)

if __name__ == "__main__":
    main()

