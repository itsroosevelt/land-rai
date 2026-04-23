import os

def resolve_file(filepath):
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

files = [
    "src/app/api/whatsapp/send/route.ts",
    "src/app/api/whatsapp/webhook/route.ts",
    "src/app/layout.tsx",
    "src/app/nucleo/[entityId]/cmo/page.tsx",
    "src/app/nucleo/[entityId]/coo/kamban/components/ConversationModal.tsx",
    "src/app/nucleo/[entityId]/coo/omnichannel/components/ChatArea.tsx",
    "src/app/nucleo/[entityId]/coo/omnichannel/components/ChatList.tsx",
    "src/app/nucleo/[entityId]/coo/omnichannel/components/InboxSidebar.tsx",
    "src/app/nucleo/[entityId]/coo/whatsapp/components/ConversationModal/hooks/useCardSubscription.ts",
    "src/app/nucleo/[entityId]/coo/whatsapp/components/ConversationModal/hooks/useMessageSender.ts",
    "src/app/nucleo/[entityId]/coo/whatsapp/components/ConversationModal/tabs/ProfileTab/PropertyValue.tsx",
    "src/app/nucleo/[entityId]/coo/whatsapp/components/ConversationModal/tabs/ProfileTab/index.tsx",
    "src/app/nucleo/[entityId]/coo/whatsapp/components/ConversationModal/types.ts",
    "src/app/nucleo/[entityId]/cto/automation/chatbots/[id]/page.tsx",
    "src/app/nucleo/[entityId]/cto/automation/chatbots/page.tsx",
    "src/app/nucleo/[entityId]/cto/integrations/components/whatsapp_cloud_api/WhatsAppCloudAPIModal.tsx",
    "src/app/nucleo/[entityId]/cto/integrations/page.tsx",
    "src/app/nucleo/[entityId]/cto/page.tsx",
    "src/app/nucleo/[entityId]/layout.tsx",
    "src/components/ChatbotCanvas.tsx",
    "src/components/CsoAutomationContent.tsx",
    "src/lib/firebase-admin.ts",
    "src/lib/sendProviders.ts"
]

for file in files:
    try:
        resolve_file(file)
        os.system(f"git add {file}")
        print(f"Resolved {file}")
    except Exception as e:
        print(f"Error on {file}: {e}")

