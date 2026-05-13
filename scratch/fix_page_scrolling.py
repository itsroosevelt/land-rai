import os

files_to_fix = [
    '/home/julio_romero/roosevelt/src/app/nucleo/[entityId]/cto/automation/chatbots/page.tsx',
    '/home/julio_romero/roosevelt/src/app/nucleo/[entityId]/cto/meet-agents/page.tsx',
    '/home/julio_romero/roosevelt/src/app/nucleo/[entityId]/cto/voice-center/page.tsx',
    '/home/julio_romero/roosevelt/src/app/nucleo/[entityId]/cto/orchestrator/page.tsx',
    '/home/julio_romero/roosevelt/src/app/nucleo/[entityId]/cfo/revenue/page.tsx'
]

for path in files_to_fix:
    if not os.path.exists(path):
        continue
    
    with open(path, 'r') as f:
        content = f.read()
    
    # Add overflow-y-auto to the first or second div that has min-h-screen or flex-1
    # For many of these, it's the div with className="flex-1 flex flex-col... overflow-hidden"
    new_content = content.replace('overflow-hidden', 'overflow-y-auto')
    
    # Also ensure the root div has overflow-y-auto if it's the one with min-h-screen
    if 'min-h-screen' in new_content and 'overflow-y-auto' not in new_content:
        new_content = new_content.replace('min-h-screen', 'min-h-screen overflow-y-auto')

    with open(path, 'w') as f:
        f.write(new_content)
    print(f"Fixed scrolling for {path}")
