import os
import subprocess

def get_conflicted_files():
    result = subprocess.run(['git', 'diff', '--name-only', '--diff-filter=U'], capture_output=True, text=True)
    return result.stdout.strip().split('\n')

def resolve_file(filepath):
    if not filepath:
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    out_lines = []
    in_conflict = False
    keep_lines = False

    for line in lines:
        if line.startswith('<<<<<<< HEAD'):
            in_conflict = True
            keep_lines = True
            continue
        elif line.startswith('======='):
            if in_conflict:
                keep_lines = False
            else:
                out_lines.append(line)
            continue
        elif line.startswith('>>>>>>> origin/main') or line.startswith('>>>>>>>'):
            if in_conflict:
                in_conflict = False
            else:
                out_lines.append(line)
            continue
        
        if not in_conflict:
            out_lines.append(line)
        elif in_conflict and keep_lines:
            out_lines.append(line)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(out_lines)

files = get_conflicted_files()

for file in files:
    try:
        if file:
            resolve_file(file)
            os.system(f"git add {file}")
            print(f"Resolved {file}")
    except Exception as e:
        print(f"Error on {file}: {e}")

