#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script để đổi tên ảnh và phát hiện ảnh trùng lặp
- Đổi tên tất cả ảnh theo format nhất quán (lowercase extension)
- Phát hiện và xử lý ảnh trùng lặp
- Cập nhật products.json với đường dẫn mới
"""

import os
import json
import hashlib
import sys
from pathlib import Path
from collections import defaultdict
import shutil

# Fix encoding for Windows console
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Cấu hình
IMAGE_DIR = "assets/image"
PRODUCTS_JSON = "assets/products.json"
BACKUP_DIR = "backup_images"

# Các định dạng ảnh được hỗ trợ
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

def normalize_extension(ext):
    """Chuẩn hóa extension về lowercase và jpeg -> jpg"""
    ext = ext.lower()
    if ext == '.jpeg':
        return '.jpg'
    return ext

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
    for img_path in images:
        file_hash = get_file_hash(img_path)
        if file_hash:
            hash_to_files[file_hash].append(img_path)
    
    duplicates = {}
    for file_hash, files in hash_to_files.items():
        if len(files) > 1:
            # Giữ file đầu tiên, các file còn lại là duplicate
            duplicates[file_hash] = {
                'keep': files[0],
                'duplicates': files[1:]
            }
    
    return duplicates

def generate_new_filename(old_path, index=0):
    """Tạo tên file mới dựa trên thư mục và index"""
    path_obj = Path(old_path)
    directory = path_obj.parent
    old_name = path_obj.stem  # Tên không có extension
    
    # Lấy prefix từ thư mục
    folder_name = directory.name
    
    # Tạo prefix dựa trên thư mục
    prefix_map = {
        'quan-dai-nu': 'qd',
        'Boot-cao': 'b',
        'tui-xach-nu': 'tx',
        'tui-xach-nam': 'txn',
        'ao-khoac-nu': 'ak',
        'chan-vay': 'cv',
        'set-do-nu': 'sd'
    }
    
    prefix = prefix_map.get(folder_name, folder_name[:2].lower())
    
    # Lấy số từ tên file cũ (nếu có)
    import re
    numbers = re.findall(r'\d+', old_name)
    if numbers:
        number = numbers[0]
    else:
        number = str(index + 1).zfill(2)
    
    # Extension mới (chuẩn hóa)
    old_ext = path_obj.suffix
    new_ext = normalize_extension(old_ext)
    
    new_name = f"{prefix}{number}{new_ext}"
    new_path = directory / new_name
    
    return str(new_path)

def rename_images(images, duplicates):
    """Đổi tên tất cả ảnh và xử lý trùng lặp"""
    # Tạo backup
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
        print(f"📁 Đã tạo thư mục backup: {BACKUP_DIR}")
    
    rename_map = {}  # old_path -> new_path
    files_to_remove = set()  # Các file duplicate sẽ bị xóa
    
    # Xử lý duplicates trước
    print("\n🔄 Xử lý ảnh trùng lặp...")
    for file_hash, dup_info in duplicates.items():
        keep_file = dup_info['keep']
        dup_files = dup_info['duplicates']
        
        print(f"\n  📸 Phát hiện {len(dup_files) + 1} ảnh trùng:")
        print(f"     ✓ Giữ lại: {keep_file}")
        for dup in dup_files:
            print(f"     ✗ Xóa: {dup}")
            files_to_remove.add(dup)
    
    # Đổi tên các file không bị duplicate
    print("\n📝 Đang đổi tên ảnh...")
    index = 0
    for img_path in images:
        if img_path in files_to_remove:
            continue
        
        path_obj = Path(img_path)
        old_ext = path_obj.suffix
        new_ext = normalize_extension(old_ext)
        
        # Nếu extension đã đúng, bỏ qua
        if old_ext == new_ext:
            continue
        
        # Chỉ đổi extension, giữ nguyên tên file
        new_path = str(path_obj.with_suffix(new_ext))
        
        # Kiểm tra xem file đích đã tồn tại chưa (chỉ khi đổi extension)
        if os.path.exists(new_path) and new_path != img_path:
            # Nếu file đích đã tồn tại và khác file nguồn, bỏ qua (không đổi)
            print(f"  ⚠️  Bỏ qua {os.path.basename(img_path)} - file đích đã tồn tại")
            continue
        
        rename_map[img_path] = new_path
        index += 1
    
    # Thực hiện rename
    print(f"\n✏️  Đang đổi tên {len(rename_map)} file...")
    for old_path, new_path in rename_map.items():
        try:
            # Backup file cũ
            backup_path = os.path.join(BACKUP_DIR, os.path.basename(old_path))
            if not os.path.exists(backup_path):
                shutil.copy2(old_path, backup_path)
            
            # Rename
            os.rename(old_path, new_path)
            print(f"  ✓ {os.path.basename(old_path)} -> {os.path.basename(new_path)}")
        except Exception as e:
            print(f"  ❌ Lỗi khi đổi tên {old_path}: {e}")
    
    # Xóa các file duplicate
    print(f"\n🗑️  Đang xóa {len(files_to_remove)} file trùng lặp...")
    for dup_file in files_to_remove:
        try:
            # Backup trước khi xóa
            backup_path = os.path.join(BACKUP_DIR, os.path.basename(dup_file))
            if not os.path.exists(backup_path):
                shutil.copy2(dup_file, backup_path)
            
            os.remove(dup_file)
            print(f"  ✓ Đã xóa: {os.path.basename(dup_file)}")
        except Exception as e:
            print(f"  ❌ Lỗi khi xóa {dup_file}: {e}")
    
    return rename_map, files_to_remove

def update_products_json(rename_map, files_to_remove):
    """Cập nhật products.json với đường dẫn mới"""
    if not os.path.exists(PRODUCTS_JSON):
        print(f"⚠️  Không tìm thấy {PRODUCTS_JSON}")
        return
    
    print(f"\n📄 Đang cập nhật {PRODUCTS_JSON}...")
    
    # Backup JSON
    backup_json = PRODUCTS_JSON + ".backup"
    shutil.copy2(PRODUCTS_JSON, backup_json)
    print(f"  ✓ Đã backup: {backup_json}")
    
    # Đọc JSON (xử lý BOM nếu có)
    try:
        with open(PRODUCTS_JSON, 'r', encoding='utf-8-sig') as f:
            products = json.load(f)
    except UnicodeDecodeError:
        with open(PRODUCTS_JSON, 'r', encoding='utf-8') as f:
            products = json.load(f)
    
    # Tạo reverse map (old -> new) và normalize paths
    path_map = {}
    for old_path, new_path in rename_map.items():
        # Chuyển đổi sang format relative path
        old_rel = old_path.replace('\\', '/')
        new_rel = new_path.replace('\\', '/')
        path_map[old_rel] = new_rel
    
    # Cập nhật products
    updated_count = 0
    for product in products:
        # Cập nhật image
        if 'image' in product:
            old_image = product['image']
            if old_image in path_map:
                product['image'] = path_map[old_image]
                updated_count += 1
            elif old_image.replace('\\', '/') in path_map:
                product['image'] = path_map[old_image.replace('\\', '/')]
                updated_count += 1
        
        # Cập nhật images array
        if 'images' in product and isinstance(product['images'], list):
            for i, img in enumerate(product['images']):
                if img in path_map:
                    product['images'][i] = path_map[img]
                    updated_count += 1
                elif img.replace('\\', '/') in path_map:
                    product['images'][i] = path_map[img.replace('\\', '/')]
                    updated_count += 1
    
    # Ghi lại JSON
    with open(PRODUCTS_JSON, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, indent=4)
    
    print(f"  ✓ Đã cập nhật {updated_count} đường dẫn trong products.json")

def main():
    print("=" * 60)
    print("🖼️  SCRIPT ĐỔI TÊN ẢNH VÀ PHÁT HIỆN TRÙNG LẶP")
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
    
    # Tìm duplicates
    duplicates = find_duplicates(images)
    files_to_remove_count = 0
    if duplicates:
        print(f"\n⚠️  Phát hiện {len(duplicates)} nhóm ảnh trùng lặp!")
        files_to_remove_count = sum(len(dup_info['duplicates']) for dup_info in duplicates.values())
    else:
        print("\n✓ Không có ảnh trùng lặp")
    
    # Xác nhận
    print("\n" + "=" * 60)
    print("⚠️  CHẾ ĐỘ TEST - Chỉ hiển thị, không thay đổi file")
    print("=" * 60)
    print("\n📋 Tóm tắt sẽ thực hiện:")
    print(f"  • Đổi tên: ~{len(images) - files_to_remove_count} file")
    print(f"  • Xóa duplicate: {files_to_remove_count} file")
    print(f"  • Cập nhật products.json")
    
    # Tự động tiếp tục nếu có tham số --auto
    import sys
    auto_mode = '--auto' in sys.argv or '-y' in sys.argv
    
    if not auto_mode:
        response = input("\nBạn có muốn tiếp tục THẬT SỰ? (y/n): ").strip().lower()
        if response != 'y':
            print("❌ Đã hủy")
            return
    else:
        print("\n⚡ Chế độ tự động - Bỏ qua xác nhận")
    
    # Đổi tên và xử lý duplicates
    rename_map, files_to_remove = rename_images(images, duplicates)
    
    # Cập nhật products.json
    if rename_map or files_to_remove:
        update_products_json(rename_map, files_to_remove)
    
    # Tóm tắt
    print("\n" + "=" * 60)
    print("✅ HOÀN TẤT!")
    print("=" * 60)
    print(f"  • Đã đổi tên: {len(rename_map)} file")
    print(f"  • Đã xóa duplicate: {len(files_to_remove)} file")
    print(f"  • Backup được lưu tại: {BACKUP_DIR}/")
    print(f"  • JSON backup: {PRODUCTS_JSON}.backup")
    print("\n💡 Lưu ý: Kiểm tra lại website trước khi xóa thư mục backup!")

if __name__ == "__main__":
    main()

