import os
import re

base_dir = '/home/julio_romero/roosevelt/src/app/nucleo/[entityId]'
departments = ['board', 'cdo', 'ceo', 'cfo', 'chro', 'ciso', 'clo', 'cmo', 'coo', 'cpo', 'cso', 'cto']

for dept in departments:
    path = os.path.join(base_dir, dept, 'layout.tsx')
    if not os.path.exists(path):
        continue
    
    with open(path, 'r') as f:
        content = f.read()
    
    # Remove h-screen overflow-hidden from <main>
    content = re.sub(
        r'<main className="w-full h-screen overflow-hidden">',
        '<main className="w-full min-h-screen">',
        content
    )
    
    with open(path, 'w') as f:
        f.write(content)
    print(f"Fixed layout for {dept}")
