
'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import WhatsappIcon from '@/components/icons/WhatsappIcon';
import { Trash2, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import {
  MessageCircle,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Twitter,
  Globe2,
  FileSpreadsheet, Mail, Send
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { countryData } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from 'sonner';

const Card = ({ card, groupId, onClick, cardColor = 'bg-neutral-800', contacts = [], isCompact }: any) => {
  const { currentUser, activeEntity } = useAuth();
  const getTenantPath = () => {
    if (!currentUser?.uid || !activeEntity) return '';
    return `users/${currentUser.uid}/entities/${activeEntity}`;
  };
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: 'CARD', card: { ...card, groupId } },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleOpenDeleteDialog = (e) => {
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeleteConfirmation('');
  };

  const handleDeleteCard = async () => {
    const confirmation = deleteConfirmation.trim().toLowerCase();
    if (confirmation === 'delete' || confirmation === 'borrar') {
      try {
        const tenantPath = getTenantPath();
        if (!tenantPath) {
          toast.error("Error: No se pudo determinar la entidad actual.");
          return;
        }

        toast.loading("Eliminando tarjeta...", { id: 'delete-card' });

        // 1. Direct Deletion Attempt
        const directCardRef = doc(db, `${tenantPath}/kanban-groups/${groupId}/cards/${card.id}`);
        await deleteDoc(directCardRef);

        // 2. Brute Force Search (Safety Net)
        // If the card was moved or mapped incorrectly, we look everywhere for its ID or clean phone
        const { getDocs, collection } = await import('firebase/firestore');
        const groupsSnap = await getDocs(collection(db, `${tenantPath}/kanban-groups`));

        const deletePromises: Promise<any>[] = [];
        const cleanPhone = card.contactNumberClean || card.contactNumber?.replace(/\D/g, '');

        for (const groupDoc of groupsSnap.docs) {
          const cardsRef = collection(db, `${tenantPath}/kanban-groups/${groupDoc.id}/cards`);
          const cardsSnap = await getDocs(cardsRef);

          cardsSnap.docs.forEach(cDoc => {
            const data = cDoc.data();
            const cPhone = data.contactNumberClean || data.contactNumber?.replace(/\D/g, '');

            // Delete if ID matches OR if phone matches (if user wants to "eliminar todo" for that contact)
            if (cDoc.id === card.id || (cleanPhone && cPhone === cleanPhone)) {
              console.log(`[Card] 🗑️ Deleting card ${cDoc.id} from group ${groupDoc.id}`);
              deletePromises.push(deleteDoc(cDoc.ref));
            }
          });
        }

        await Promise.all(deletePromises);

        // 3. Clear Contact References (Data Integrity)
        const telegramId = card.telegramChatId || (card.platform_ids?.telegram);
        if (card.crmId || card.contactId || cleanPhone || telegramId) {
          try {
            const contactsRef = collection(db, `${tenantPath}/contacts`);
            let contactDocId = card.crmId || card.contactId;

            if (!contactDocId && cleanPhone) {
              const { query, where, getDocs } = await import('firebase/firestore');
              const q = query(contactsRef, where('phone', '==', `+${cleanPhone}`));
              const snap = await getDocs(q);
              if (!snap.empty) contactDocId = snap.docs[0].id;
            }

            if (!contactDocId && telegramId) {
              const { query, where, getDocs } = await import('firebase/firestore');
              const q = query(contactsRef, where('telegramChatId', '==', String(telegramId)));
              const snap = await getDocs(q);
              if (!snap.empty) contactDocId = snap.docs[0].id;
              else if (typeof telegramId === 'string' && telegramId.startsWith('tg_')) contactDocId = telegramId;
              else contactDocId = `tg_${telegramId}`;
            }

            if (contactDocId) {
              // FULL CASCADE DELETE FROM KANBAN
              await deleteDoc(doc(db, `${tenantPath}/contacts/${contactDocId}`));
              console.log(`[Card] 🗑️ Full Cascade: Deleted contact ${contactDocId}`);
              
              // Purge main chat history
              const chatRef = doc(db, `${tenantPath}/chats/${contactDocId}`);
              await deleteDoc(chatRef).catch(() => {});
              
              if (card.metaSenderId) {
                const metaChatRef = doc(db, `${tenantPath}/chats/${card.metaSenderId}`);
                await deleteDoc(metaChatRef).catch(() => {});
                
                // NEW: Purge message deduplication history to allow immediate restart
                try {
                  const { collection, getDocs, where, query } = await import('firebase/firestore');
                  const dedupRef = collection(db, `${tenantPath}/processed_messages`);
                  const q = query(dedupRef, where('senderId', '==', card.metaSenderId));
                  const snap = await getDocs(q);
                  const batch = snap.docs.map(d => deleteDoc(d.ref));
                  await Promise.all(batch);
                } catch (e) { console.error("Dedup purge failed:", e); }
              }
              
              if (telegramId) {
                const tgChatRef = doc(db, `${tenantPath}/chats/${telegramId}`);
                await deleteDoc(tgChatRef).catch(() => {});
              }
              
              // Also purge specific chat archive for this card
              const cardChatRef = doc(db, `${tenantPath}/chats/${card.id}`);
              await deleteDoc(cardChatRef).catch(() => {});
              console.log(`[Card] 💬 Chat history purged.`);
            }
          } catch (err) {
            console.error("[Card] Error unlinking contact:", err);
          }
        }

        toast.success("Tarjeta eliminada de todas las bandejas", { id: 'delete-card' });
        handleCloseDeleteDialog();
      } catch (error) {
        console.error("Error deleting card: ", error);
        toast.error("Error al eliminar la tarjeta", { id: 'delete-card' });
      }
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
    const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });

    return `${day} ${month} ${time}`;
  };

  const getCountryInfo = (phoneNumber) => {
    if (!phoneNumber) return { flag: '🏳️', code: 'N/A' };
    const number = phoneNumber.replace('+', '');
    const codes = Object.keys(countryData).sort((a, b) => b.length - a.length);
    for (const code of codes) {
      if (number.startsWith(code)) {
        const data = countryData[code];
        return typeof data === 'string' ? { flag: data, code: 'N/A' } : data;
      }
    }
    return { flag: '🏳️', code: 'N/A' };
  };

  const { flag, code } = getCountryInfo(card.contactNumber);

  const isGenericMetaName = (value: any) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return true;
    return normalized === 'usuario meta' || normalized === 'usuario' || normalized === 'instagram user';
  };

  const resolveCardChannel = () => {
    const c = String(card.channel || card.source || card.primary_channel || '').toLowerCase();
    if (c.includes('instagram')) return 'instagram';
    if (c.includes('messenger') || c.includes('facebook')) return 'messenger';
    if (c.includes('web')) return 'web';
    if (c.includes('telegram')) return 'telegram';
    if (c.includes('x') || c.includes('twitter')) return 'x';
    if (c.includes('tiktok')) return 'tiktok';
    if (c.includes('gmail')) return 'gmail';
    if (c.includes('whatsapp') || c === 'manual') return 'whatsapp';
    if (card.platform_ids?.instagram) return 'instagram';
    if (card.platform_ids?.messenger || card.metaSenderId) return 'messenger';
    if (card.platform_ids?.telegram) return 'telegram';
    if (card.platform_ids?.whatsapp || card.contactNumber) return 'whatsapp';
    if (card.platform === 'gmail' || card.metadata?.platform === 'gmail') return 'gmail';
    return 'whatsapp';
  };

  const resolveDisplayName = () => {
    const contactId = (card as any).contactId || (card as any).crmId;
    let linkedContact: any = null;

    if (contactId) linkedContact = (contacts as any[]).find(c => c.id === contactId);
    if (!linkedContact && card.metaSenderId) {
      linkedContact = (contacts as any[]).find(c => c.metaSenderId === card.metaSenderId);
    }
    if (!linkedContact && card.contactNumber) {
      const normalizedCardPhone = card.contactNumber.replace(/\D/g, '');
      if (normalizedCardPhone) {
        linkedContact = (contacts as any[]).find(c => (c.phone || '').replace(/\D/g, '') === normalizedCardPhone);
      }
    }

    const linkedName = linkedContact?.name || `${linkedContact?.firstName || ''} ${linkedContact?.lastName || ''}`.trim();
    if (linkedName && !isGenericMetaName(linkedName)) return linkedName;
    if (card.contactName && !isGenericMetaName(card.contactName)) return card.contactName;
    if (linkedName) return linkedName;
    return card.contactName || 'Unknown';
  };

  const getChannelColor = (channel = '') => {
    const c = (channel || '').toLowerCase();
    if (c.includes('instagram')) return 'border-pink-500';
    if (c.includes('messenger') || c.includes('facebook')) return 'border-blue-600';
    if (c.includes('web')) return 'border-cyan-400';
    if (c.includes('telegram')) return 'border-sky-500';
    if (c.includes('x') || c.includes('twitter')) return 'border-neutral-400';
    if (c.includes('tiktok')) return 'border-pink-400';
    return 'border-emerald-500';
  };

  const resolvedChannel = resolveCardChannel();
  const channelColorClass = getChannelColor(resolvedChannel);

  return (
    <TooltipProvider>
      <div
        ref={setNodeRef}
        style={style}
        data-card-id={card.id}
        onClick={onClick}
        {...attributes}
        {...listeners}
        className={cn(
          "group relative p-3 rounded-xl border border-white/5 transition-all duration-200 select-none cursor-pointer mb-2 shadow-sm",
          cardColor || "bg-[#181818]/50",
          "hover:bg-white/5 hover:border-white/10"
        )}
      >
        <div className="flex items-center justify-between min-w-0">
          <h3 className="font-semibold text-[13px] text-white/90 truncate leading-tight tracking-tight flex items-center gap-1.5">
            {(() => {
              if (resolvedChannel === 'gmail') return <Mail size={12} className="text-red-500" />;
              if (resolvedChannel === 'instagram') return <Instagram size={12} className="text-pink-500" />;
              if (resolvedChannel === 'messenger') return <Facebook size={12} className="text-blue-600" />;
              if (resolvedChannel === 'web') return <Globe2 size={12} className="text-cyan-400" />;
              if (resolvedChannel === 'telegram') return <Send size={12} className="text-sky-500" />;
              return <WhatsappIcon className="w-3 h-3 text-emerald-500 fill-current" />;
            })()}
            {resolveDisplayName()}
          </h3>

          <div className="flex items-center gap-2">
            {card.unreadCount > 0 && (
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            )}

            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); handleOpenDeleteDialog(e); }}
                className="h-6 w-6 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-full"
              >
                <Trash2 size={12} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-neutral-900 border-neutral-700 text-white">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Escribe 'delete' o 'borrar' para confirmar la eliminación.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="bg-neutral-800 border-neutral-600 focus:ring-blue-500"
              placeholder="delete / borrar..."
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDeleteDialog}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCard}
              disabled={
                deleteConfirmation.trim().toLowerCase() !== 'delete' &&
                deleteConfirmation.trim().toLowerCase() !== 'borrar'
              }
            >
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default Card;


