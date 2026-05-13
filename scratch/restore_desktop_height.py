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
    
    # Update root div to have md:h-screen and md:overflow-hidden
    content = re.sub(
        r'<div className="w-full min-h-screen bg-\[#050505\] flex flex-col relative([^"]*)" ref={reactFlowWrapper}>',
        r'<div className="w-full min-h-screen md:h-screen bg-[#050505] flex flex-col relative\1 overflow-y-auto md:overflow-hidden" ref={reactFlowWrapper}>',
        content
    )
    
    with open(path, 'w') as f:
        f.write(content)
    print(f"Updated {dept}")
