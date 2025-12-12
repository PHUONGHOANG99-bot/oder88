#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script khôi phục code từ file backup
Chạy: python restore_backup.py BACKUP_FULL_CODE_YYYYMMDD_HHMMSS.json
"""

import json
import sys
import os
from datetime import datetime

def restore_backup(backup_file):
    """Khôi phục code từ file backup"""
    
    if not os.path.exists(backup_file):
        print(f'✗ Không tìm thấy file backup: {backup_file}')
        return False
    
    try:
        # Đọc file backup
        with open(backup_file, 'r', encoding='utf-8') as f:
            backup_data = json.load(f)
        
        print(f'✓ Đã đọc file backup')
        print(f'  Thời gian backup: {backup_data.get("timestamp", "N/A")}')
        print(f'  Mô tả: {backup_data.get("description", "N/A")}')
        
        # Mapping file backup -> file thực tế
        file_mapping = {
            'index.html': 'index.html',
            'style.css': 'assets/style.css',
            'script.js': 'assets/script.js'
        }
        
        # Khôi phục từng file
        restored_count = 0
        for backup_name, real_path in file_mapping.items():
            if backup_name in backup_data['files']:
                content = backup_data['files'][backup_name]
                
                # Tạo thư mục nếu chưa có
                os.makedirs(os.path.dirname(real_path), exist_ok=True)
                
                # Ghi file
                try:
                    with open(real_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f'✓ Đã khôi phục: {real_path}')
                    restored_count += 1
                except Exception as e:
                    print(f'✗ Lỗi khi khôi phục {real_path}: {e}')
        
        print(f'\n✓ Đã khôi phục {restored_count}/{len(file_mapping)} file')
        return True
        
    except Exception as e:
        print(f'✗ Lỗi khi đọc file backup: {e}')
        return False

if __name__ == '__main__':
    print('=' * 50)
    print('KHÔI PHỤC CODE TỪ BACKUP')
    print('=' * 50)
    
    if len(sys.argv) < 2:
        print('\nCách sử dụng:')
        print('  python restore_backup.py BACKUP_FULL_CODE_YYYYMMDD_HHMMSS.json')
        print('\nHoặc tìm file backup mới nhất:')
        import glob
        backups = glob.glob('BACKUP_FULL_CODE_*.json')
        if backups:
            latest = max(backups, key=os.path.getctime)
            print(f'\nFile backup mới nhất: {latest}')
            print(f'Bạn có muốn khôi phục từ file này? (y/n): ', end='')
            choice = input().strip().lower()
            if choice == 'y':
                restore_backup(latest)
        else:
            print('  Không tìm thấy file backup nào!')
    else:
        restore_backup(sys.argv[1])
    
    print('\nHoàn tất!')

