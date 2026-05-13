import os
import re

base_dir = '/home/julio_romero/roosevelt/src/app/nucleo/[entityId]'
departments = ['board', 'cdo', 'ceo', 'cfo', 'chro', 'ciso', 'clo', 'cmo', 'coo', 'cpo', 'cso', 'cto']

for dept in departments:
    path = os.path.join(base_dir, dept, 'page.tsx')
    if not os.path.exists(path):
        continue
    
    with open(path, 'r') as f:
        content = f.read()
    
    # 1. Force ReactFlow container to fill the viewport explicitly
    content = re.sub(
        r'className="flex-1 w-full h-screen min-h-\[600px\] relative z-0"',
        'className="flex-1 w-full h-screen md:h-[100vh] min-h-[600px] relative z-0"',
        content
    )
    
    # 2. Add fitView to ReactFlow to ensure nodes are visible
    if 'fitView' not in content:
        content = re.sub(
            r'proOptions={{ hideAttribution: true }}',
            'proOptions={{ hideAttribution: true }}\n                    fitView',
            content
        )
    
    with open(path, 'w') as f:
        f.write(content)
    print(f"Optimized {dept}")
