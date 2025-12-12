#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script tạo backup toàn bộ code
Chạy: python create_backup.py
"""

import json
import os
from datetime import datetime

def create_backup():
    """Tạo file backup chứa toàn bộ code"""
    
    # Đường dẫn các file cần backup
    files_to_backup = {
        'index.html': 'index.html',
        'style.css': 'assets/style.css',
        'script.js': 'assets/script.js'
    }
    
    backup_data = {
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'version': '1.0',
        'description': 'Backup toàn bộ code ODER 88 Website',
        'files': {}
    }
    
    # Đọc nội dung từng file
    for name, path in files_to_backup.items():
        try:
            with open(path, 'r', encoding='utf-8') as f:
                backup_data['files'][name] = f.read()
            print(f'✓ Đã đọc: {path}')
        except Exception as e:
            print(f'✗ Lỗi khi đọc {path}: {e}')
            backup_data['files'][name] = f'ERROR: {str(e)}'
    
    # Lưu vào file backup
    backup_filename = f'BACKUP_FULL_CODE_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    
    try:
        with open(backup_filename, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, ensure_ascii=False, indent=2)
        print(f'\n✓ Đã tạo file backup: {backup_filename}')
        print(f'  Kích thước: {os.path.getsize(backup_filename) / 1024:.2f} KB')
        return backup_filename
    except Exception as e:
        print(f'\n✗ Lỗi khi tạo backup: {e}')
        return None

if __name__ == '__main__':
    print('=' * 50)
    print('TẠO BACKUP CODE - ODER 88 WEBSITE')
    print('=' * 50)
    create_backup()
    print('\nHoàn tất!')

