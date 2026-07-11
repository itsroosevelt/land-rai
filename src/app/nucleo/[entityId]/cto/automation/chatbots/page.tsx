'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Loader2, Power, Trash2, MessageCircle, Check, Link2, Settings2, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, doc, deleteDoc, runTransaction } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { isBotActiveValue, toggleBotForNumber } from './utils';
import {
  subscribeSlotConnections,
  saveSlotConnection,
  disconnectSlot,
  SLOTS,
  type NumberSlot,
  type SlotConnections,
  type WhatsAppNumberConnection,
} from '@/lib/whatsapp/numbers';

interface Bot {
  id: string;
  name: string;
  isActive: boolean;
  numberId?: string;
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 0 5.414 0 12.05c0 2.123.551 4.197 1.597 6.03l-1.602 5.8 5.883-1.543a11.86 11.86 0 005.815 1.526h.005c6.634 0 12.048-5.414 12.048-12.05 0-3.213-1.252-6.234-3.525-8.508z" />
  </svg>
);

// Legacy bots (no numberId) belong to the "general" tab.
const botSlot = (bot: Bot): NumberSlot => {
  const v = (bot.numberId || '').trim();
  if (v === 'support' || v === 'broadcast') return v;
  return 'general';
};

const emptyConnections = (): SlotConnections => ({
  general: { connected: false },
  support: { connected: false },
  broadcast: { connected: false },
});

const ChatbotsPage = () => {
  const router = useRouter();
  const { currentUser, activeEntity } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingBots, setUpdatingBots] = useState<string[]>([]);
  const [botToDelete, setBotToDelete] = useState<Bot | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const [connections, setConnections] = useState<SlotConnections>(emptyConnections());
  const [activeSlot, setActiveSlot] = useState<NumberSlot>('general');
  const [connectSlot, setConnectSlot] = useState<NumberSlot | null>(null);

  const tenantPath = currentUser?.uid && activeEntity
    ? `users/${currentUser.uid}/entities/${activeEntity}`
    : '';

  useEffect(() => {
    if (!currentUser || !activeEntity) return;
    const botsCollection = collection(db, 'users', currentUser.uid, 'entities', activeEntity, 'chatbots');
    const unsubscribe = onSnapshot(
      botsCollection,
      (querySnapshot) => {
        setBots(querySnapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || 'Unnamed Bot',
          isActive: isBotActiveValue(d.data().isActive),
          numberId: d.data().numberId || undefined,
        } as Bot)));
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching bots:', error);
        toast.error('No se pudieron cargar los bots.');
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser, activeEntity]);

  useEffect(() => {
    if (!tenantPath) return;
    const unsub = subscribeSlotConnections(tenantPath, setConnections);
    return () => unsub();
  }, [tenantPath]);

  const activeConnection = connections[activeSlot];

  const botsForActiveSlot = useMemo(
    () => bots.filter((b) => botSlot(b) === activeSlot),
    [bots, activeSlot]
  );

  const activeCountForSlot = (slot: NumberSlot) =>
    bots.filter((b) => botSlot(b) === slot && b.isActive).length;

  const handleCreateNewBot = async () => {
    if (!currentUser || !activeEntity) return;
    if (!activeConnection.connected) {
      toast.error('Primero conecta un número a esta pestaña.');
      setConnectSlot(activeSlot);
      return;
    }
    setIsLoading(true);
    try {
      const counterRef = doc(db, 'users', currentUser.uid, 'entities', activeEntity, 'system_metadata', 'chatbot_counter');
      const newBotId = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const currentCount = counterDoc.exists() ? (counterDoc.data().count || 0) : 0;
        const nextCount = currentCount + 1;
        transaction.set(counterRef, { count: nextCount }, { merge: true });
        const formattedId = String(nextCount).padStart(8, '0');
        const botRef = doc(db, 'users', currentUser.uid, 'entities', activeEntity, 'chatbots', formattedId);
        transaction.set(botRef, {
          id: formattedId,
          name: 'New WhatsApp Bot',
          isActive: false,
          channel: 'whatsapp',
          botType: 'dm',
          targetPlatforms: ['whatsapp'],
          numberId: activeSlot,
          createdAt: new Date(),
          flow: {
            nodes: [{ id: '1', type: 'startNode', position: { x: 250, y: 5 }, data: { label: 'Start' } }],
            edges: [],
          },
        });
        return formattedId;
      });
      router.push(`/nucleo/${activeEntity}/cto/automation/chatbots/${newBotId}`);
    } catch (error) {
      console.error('Error creating bot:', error);
      toast.error('No se pudo crear el chatbot.');
      setIsLoading(false);
    }
  };

  const handleToggleBotStatus = async (bot: Bot) => {
    if (!currentUser || !activeEntity) return;
    setUpdatingBots((prev) => [...prev, bot.id]);
    try {
      const newStatus = !bot.isActive;
      await toggleBotForNumber({
        db,
        userId: currentUser.uid,
        entityId: activeEntity,
        botId: bot.id,
        numberId: botSlot(bot),
        activate: newStatus,
      });
      toast.success(`Bot "${bot.name}" ${newStatus ? 'activado' : 'desactivado'}.`);
    } catch (error) {
      console.error('Error updating bot status:', error);
      toast.error('No se pudo actualizar el estado del bot.');
    } finally {
      setUpdatingBots((prev) => prev.filter((id) => id !== bot.id));
    }
  };

  const confirmDelete = async () => {
    if (!botToDelete || deleteConfirmation !== 'delete') return;
    try {
      await deleteDoc(doc(db, 'users', currentUser!.uid, 'entities', activeEntity!, 'chatbots', botToDelete.id));
      toast.success(`Bot "${botToDelete.name}" eliminado.`);
      setBotToDelete(null);
    } catch (error) {
      console.error('Error deleting bot:', error);
      toast.error('Error al eliminar el bot.');
    }
  };

  const activeSlotDef = SLOTS.find((s) => s.id === activeSlot)!;

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-y-auto">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="px-5 md:px-8 py-4 flex items-center gap-4 flex-wrap">
          <button
            onClick={() => router.push(`/nucleo/${activeEntity}/cto/automation`)}
            className="text-2xl leading-none text-neutral-500 hover:text-white transition-colors font-light -mt-1"
            aria-label="Volver"
          >
            &lt;
          </button>

          <h1 className="text-xl md:text-2xl font-normal tracking-tight text-white">WhatsApp Bots</h1>

          {/* Fixed tabs */}
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {SLOTS.map((slot) => {
              const conn = connections[slot.id];
              const isActive = slot.id === activeSlot;
              const activeCount = activeCountForSlot(slot.id);
              return (
                <button
                  key={slot.id}
                  onClick={() => setActiveSlot(slot.id)}
                  className={`group flex items-center gap-2 pl-3 pr-3 py-1.5 rounded-full border text-xs transition-all ${
                    isActive
                      ? 'border-white/25 bg-white/[0.06] text-white'
                      : 'border-white/5 text-neutral-500 hover:text-white hover:border-white/15'
                  }`}
                >
                  <WhatsAppIcon className={`w-3.5 h-3.5 ${conn.connected ? 'text-[#25D366]' : isActive ? 'text-neutral-400' : 'text-neutral-700'}`} />
                  <span className="font-normal tracking-tight">{slot.label}</span>
                  {conn.connected ? (
                    activeCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full border border-neutral-600" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleCreateNewBot}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 bg-transparent text-white text-xs font-normal tracking-tight hover:bg-white/5 hover:border-white/30 transition-all"
          >
            <Plus className="w-4 h-4" /> Crear Bot
          </button>
        </div>
      </header>

      <main className="px-5 md:px-8 py-8">
        {/* Slot header + connection status */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-normal tracking-tight text-white mb-1">{activeSlotDef.label}</h2>
            <p className="text-xs text-neutral-500 font-normal">{activeSlotDef.description}</p>
          </div>

          {/* Number connection pill */}
          {activeConnection.connected ? (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white/8 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#25D366]" />
                <span className="text-sm text-white font-normal tracking-tight">
                  {activeConnection.displayPhoneNumber || activeConnection.phoneNumberId}
                </span>
              </div>
              <button
                onClick={() => setConnectSlot(activeSlot)}
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
              >
                <Settings2 className="w-3 h-3" /> Editar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConnectSlot(activeSlot)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/5 text-[#25D366] text-xs font-normal tracking-tight hover:bg-[#25D366]/10 transition-all"
            >
              <Link2 className="w-4 h-4" /> Conectar número a {activeSlotDef.label}
            </button>
          )}
        </div>

        {/* Bots grid */}
        {isLoading ? (
          <div className="flex flex-col justify-center items-center mt-32 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-neutral-500" />
            <p className="text-neutral-500 text-[10px] font-normal uppercase tracking-widest">Cargando...</p>
          </div>
        ) : !activeConnection.connected ? (
          <div className="text-center py-20 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
            <Link2 size={32} className="text-neutral-700 mx-auto mb-4" />
            <h3 className="text-sm font-normal tracking-tight text-white mb-2">Sin número conectado</h3>
            <p className="text-neutral-600 text-[11px] mb-6 font-normal max-w-sm mx-auto">
              Conecta un número de WhatsApp a la pestaña <b className="text-neutral-400">{activeSlotDef.label}</b> para crear y activar bots aquí.
            </p>
            <button
              onClick={() => setConnectSlot(activeSlot)}
              className="inline-flex items-center gap-1.5 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/10 font-normal px-6 py-2 rounded-full h-9 text-[11px] transition-all"
            >
              <Link2 className="w-3.5 h-3.5" /> Conectar número
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {botsForActiveSlot.length > 0 ? (
              botsForActiveSlot.map((bot) => (
                <div
                  key={bot.id}
                  className="bg-white/[0.02] border border-white/8 rounded-2xl hover:border-white/20 transition-all duration-300 flex flex-col group relative backdrop-blur-sm"
                >
                  <div onClick={() => router.push(`/nucleo/${activeEntity}/cto/automation/chatbots/${bot.id}`)} className="p-5 cursor-pointer flex-grow">
                    <div className="flex items-center justify-between mb-4">
                      <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 text-[10px] uppercase font-normal tracking-wider rounded-full ${bot.isActive ? 'bg-green-500/15 text-green-300' : 'bg-white/5 text-neutral-500'}`}>
                          {bot.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                        <button
                          className="h-6 w-6 flex items-center justify-center text-neutral-600 hover:text-red-400 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setBotToDelete(bot); setDeleteConfirmation(''); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-lg font-normal tracking-tight text-white truncate mb-1.5 leading-tight">{bot.name}</h3>
                    <p className="text-[10px] text-neutral-600 font-mono break-all leading-tight tracking-tight">{bot.id}</p>
                  </div>
                  <div className="px-5 py-4 border-t border-white/5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleBotStatus(bot); }}
                      disabled={updatingBots.includes(bot.id)}
                      className={`w-full h-9 rounded-full font-normal text-[10px] uppercase tracking-widest transition-all flex items-center justify-center border ${bot.isActive ? 'border-red-500/30 text-red-300 hover:bg-red-500/10' : 'border-green-500/30 text-green-300 hover:bg-green-500/10'}`}
                    >
                      {updatingBots.includes(bot.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Power className="mr-2 h-3.5 w-3.5" />
                          {bot.isActive ? 'Desactivar' : 'Activar'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-20 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
                <MessageCircle size={32} className="text-neutral-700 mx-auto mb-4" />
                <h3 className="text-sm font-normal tracking-tight text-white mb-2">Sin bots en {activeSlotDef.label}</h3>
                <p className="text-neutral-600 text-[11px] mb-6 font-normal">Crea un flujo para esta pestaña.</p>
                <button
                  onClick={handleCreateNewBot}
                  className="inline-flex items-center gap-1.5 border border-white/15 hover:bg-white/5 font-normal px-6 py-2 rounded-full h-9 text-[11px] transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Crear ahora
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete Dialog */}
      <Dialog open={!!botToDelete} onOpenChange={(open) => !open && setBotToDelete(null)}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 text-white sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-normal tracking-tight">Eliminar Chatbot</DialogTitle>
            <DialogDescription className="text-neutral-400 text-xs">
              Confirma escribiendo <span className="text-white font-bold italic">"delete"</span> para eliminar <span className="text-white font-bold">"{botToDelete?.name}"</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="bg-white/5 border-white/10 text-white rounded-xl py-5 px-4 text-sm font-mono text-center tracking-widest"
              placeholder="delete"
              autoComplete="off"
            />
          </div>
          <DialogFooter className="flex gap-3">
            <button onClick={() => setBotToDelete(null)} className="flex-1 h-11 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-normal">
              Cancelar
            </button>
            <button disabled={deleteConfirmation !== 'delete'} onClick={confirmDelete} className="flex-1 h-11 border border-red-500/30 text-red-300 hover:bg-red-500/10 rounded-xl font-normal text-xs disabled:opacity-40">
              Eliminar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect number dialog */}
      <ConnectNumberDialog
        open={!!connectSlot}
        slot={connectSlot}
        connection={connectSlot ? connections[connectSlot] : null}
        tenantPath={tenantPath}
        onClose={() => setConnectSlot(null)}
      />
    </div>
  );
};

// --- Connect / edit a number for a slot ---
function ConnectNumberDialog({
  open,
  slot,
  connection,
  tenantPath,
  onClose,
}: {
  open: boolean;
  slot: NumberSlot | null;
  connection: WhatsAppNumberConnection | null;
  tenantPath: string;
  onClose: () => void;
}) {
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && connection) {
      setPhoneNumberId(connection.phoneNumberId || '');
      setWabaId(connection.wabaId || '');
      setAccessToken(connection.accessToken || '');
      setDisplayPhoneNumber(connection.displayPhoneNumber || '');
    } else if (open) {
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      setDisplayPhoneNumber('');
    }
  }, [open, connection]);

  const slotDef = SLOTS.find((s) => s.id === slot);

  const handleSave = async () => {
    if (!tenantPath || !slot) return;
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      toast.error('Necesitas Phone Number ID y Access Token.');
      return;
    }
    setSaving(true);
    try {
      await saveSlotConnection(tenantPath, slot, {
        phoneNumberId,
        wabaId,
        accessToken,
        displayPhoneNumber,
      });
      toast.success(`Número conectado a ${slotDef?.label}.`);
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!tenantPath || !slot) return;
    setSaving(true);
    try {
      await disconnectSlot(tenantPath, slot);
      toast.success('Número desconectado.');
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'No se pudo desconectar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 text-white sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-normal tracking-tight">
            Conectar número · {slotDef?.label}
          </DialogTitle>
          <DialogDescription className="text-neutral-400 text-xs">
            Ingresa las credenciales de WhatsApp Cloud API para este número. Cada pestaña maneja su propio número y su propio bot activo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-normal">Phone Number ID</label>
              <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value.replace(/[^0-9]/g, ''))} placeholder="6768377..." className="bg-white/5 border-white/10 text-white rounded-xl text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-normal">Número visible</label>
              <Input value={displayPhoneNumber} onChange={(e) => setDisplayPhoneNumber(e.target.value)} placeholder="+1 385 ..." className="bg-white/5 border-white/10 text-white rounded-xl text-xs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-normal">WABA ID</label>
            <Input value={wabaId} onChange={(e) => setWabaId(e.target.value.replace(/[^0-9]/g, ''))} placeholder="2530479..." className="bg-white/5 border-white/10 text-white rounded-xl text-xs font-mono" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-normal">Access Token</label>
            <textarea value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAA..." className="w-full h-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white font-mono resize-none outline-none focus:border-white/25" />
          </div>
        </div>

        <DialogFooter className="flex gap-3">
          {connection?.connected && (
            <button onClick={handleDisconnect} disabled={saving} className="h-11 px-4 border border-red-500/30 text-red-300 hover:bg-red-500/10 rounded-xl text-xs font-normal disabled:opacity-40">
              Desconectar
            </button>
          )}
          <button onClick={onClose} className="flex-1 h-11 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-normal">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 h-11 border border-white/20 text-white hover:bg-white/10 rounded-xl font-normal text-xs disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Guardar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ChatbotsPage;
