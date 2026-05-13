import os
import re

base_dir = '/home/julio_romero/roosevelt/src/app/nucleo/[entityId]'
departments = ['board', 'cdo', 'ceo', 'cfo', 'chro', 'ciso', 'clo', 'cmo', 'coo', 'cpo', 'cso', 'cto']

header_titles = {
    'board': 'Board Governance',
    'cdo': 'Data Intelligence',
    'ceo': 'Executive Vision',
    'cfo': 'Financial Control',
    'chro': 'Human Capital',
    'ciso': 'Cyber Security',
    'clo': 'Legal & Compliance',
    'cmo': 'Marketing Hub',
    'coo': 'Operations Center',
    'cpo': 'Product Strategy',
    'cso': 'Growth & Strategy',
    'cto': 'Innovation Core'
}

for dept in departments:
    path = os.path.join(base_dir, dept, 'page.tsx')
    if not os.path.exists(path):
        print(f"Skipping {dept}, path not found")
        continue
    
    with open(path, 'r') as f:
        content = f.read()
    
    # 1. Add import if missing
    if 'import { MobileHeader }' not in content:
        content = re.sub(
            r'import { WindowNode } from \'@/components/shared/WindowNode\';',
            "import { WindowNode } from '@/components/shared/WindowNode';\nimport { MobileHeader } from '@/components/shared/MobileHeader';",
            content
        )
    
    # 2. Fix root div
    content = re.sub(
        r'<div className="w-full h-screen bg-\[#050505\] flex flex-col relative overflow-hidden" ref={reactFlowWrapper}>',
        '<div className="w-full min-h-screen bg-[#050505] flex flex-col relative overflow-y-auto" ref={reactFlowWrapper}>',
        content
    )
    
    # 3. Add MobileHeader if missing in JSX
    if '<MobileHeader' not in content:
        title = header_titles.get(dept, 'Dashboard')
        header_jsx = f"""            <MobileHeader 
                title="{title}"
                layers={{layers}}
                onLayerClick={{(layer) => {{
                    const isMobile = window.innerWidth < 768;
                    spawnWindow(layer, {{ 
                        x: isMobile ? 20 : 800, 
                        y: Math.max(0, (isMobile ? 400 : 100) + (Math.random() * 50 - 25)) 
                    }});
                }}}}
                onHomeClick={{() => router.push(`/nucleo/${{entityId}}`)}}
            />"""
        
        content = re.sub(
            r'<div className="w-full min-h-screen bg-\[#050505\] flex flex-col relative overflow-y-auto" ref={reactFlowWrapper}>',
            f'<div className="w-full min-h-screen bg-[#050505] flex flex-col relative overflow-y-auto" ref={{reactFlowWrapper}}>\n{header_jsx}',
            content
        )
    
    # 4. Fix React Flow container height
    content = re.sub(
        r'flex-1 w-full h-full relative z-0',
        'flex-1 w-full h-screen min-h-[600px] relative z-0',
        content
    )
    # Also catch if it's already h-screen but missing min-h
    if 'h-screen' in content and 'min-h-[600px]' not in content and 'flex-1 w-full h-screen relative z-0' in content:
        content = re.sub(
            r'flex-1 w-full h-screen relative z-0',
            'flex-1 w-full h-screen min-h-[600px] relative z-0',
            content
        )

    with open(path, 'w') as f:
        f.write(content)
    print(f"Updated {dept}")
