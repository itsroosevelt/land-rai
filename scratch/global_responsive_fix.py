import os
import re

base_dir = '/home/julio_romero/roosevelt/src/app/nucleo/[entityId]'

def fix_file(path):
    with open(path, 'r') as f:
        content = f.read()
    
    # Target: <div className="... h-screen ... overflow-hidden ...">
    # Replace with: <div className="... min-h-screen overflow-y-auto md:h-screen md:overflow-hidden ...">
    
    # Regex to find div with h-screen and overflow-hidden
    pattern = r'(<div[^>]*className="[^"]*)\b(h-screen)\b([^"]*)\b(overflow-hidden)\b([^"]*")'
    
    def replacement(match):
        prefix = match.group(1)
        h_screen = match.group(2)
        middle = match.group(3)
        overflow = match.group(4)
        suffix = match.group(5)
        
        # Check if it's already fixed
        if 'md:h-screen' in prefix or 'md:h-screen' in middle or 'md:h-screen' in suffix:
            return match.group(0)
            
        return f'{prefix} min-h-screen overflow-y-auto md:{h_screen}{middle} md:{overflow}{suffix}'

    new_content = re.sub(pattern, replacement, content)
    
    if new_content != content:
        with open(path, 'w') as f:
            f.write(new_content)
        print(f"Fixed responsiveness for {path}")

# Walk through the directory
for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file == 'page.tsx':
            fix_file(os.path.join(root, file))
