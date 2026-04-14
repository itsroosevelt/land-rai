'use client';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Power, ArrowLeft, Trash2, MessageCircle, Facebook, Instagram, Send, Mail, Twitter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

interface Bot {
  id: string;
  name: string;
  isActive: boolean;
  targetPlatforms?: string[];
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 0 5.414 0 12.05c0 2.123.551 4.197 1.597 6.03l-1.602 5.8 5.883-1.543a11.86 11.86 0 005.815 1.526h.005c6.634 0 12.048-5.414 12.048-12.05 0-3.213-1.252-6.234-3.525-8.508z" />
  </svg>
);

const PLATFORMS = [
  { id: 'whatsapp', icon: WhatsAppIcon, color: 'text-[#25D366]', label: 'WA', activeBg: 'bg-[#25D366]/10', activeBorder: 'border-[#25D366]/30' },
  { id: 'messenger', icon: Facebook, color: 'text-[#0084FF]', label: 'FB', activeBg: 'bg-[#0084FF]/10', activeBorder: 'border-[#0084FF]/30' },
  { id: 'instagram', icon: Instagram, color: 'text-[#E1306C]', label: 'IG', activeBg: 'bg-[#E1306C]/10', activeBorder: 'border-[#E1306C]/30' },
  { id: 'telegram', icon: Send, color: 'text-[#0088cc]', label: 'TG', activeBg: 'bg-[#0088cc]/10', activeBorder: 'border-[#0088cc]/30' },
  { id: 'x_twitter', icon: Twitter, color: 'text-white', label: 'X', activeBg: 'bg-white/10', activeBorder: 'border-white/30' },
  { id: 'gmail', icon: Mail, color: 'text-[#EA4335]', label: 'GM', activeBg: 'bg-[#EA4335]/10', activeBorder: 'border-[#EA4335]/30' }
];

const ChatbotsPage = () => {
  const router = useRouter();
  const { currentUser, activeEntity } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingBots, setUpdatingBots] = useState<string[]>([]);
  const [botToDelete, setBotToDelete] = useState<Bot | null>(null);
  const [botToActivate, setBotToActivate] = useState<Bot | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'offline' | 'loading'>('loading');
  const [activeChannelsCount, setActiveChannelsCount] = useState(0);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser || !activeEntity) return;

    const botsCollection = collection(db, 'users', currentUser.uid, 'entities', activeEntity, 'chatbots');

    const unsubscribe = onSnapshot(
      botsCollection,
      (querySnapshot) => {
        const botsData = querySnapshot.docs.map(
          (doc) =>
          ({
            id: doc.id,
            name: doc.data().name || 'Bot sin nombre',
            isActive: doc.data().isActive === true || doc.data().isActive === 'true',
            targetPlatforms: doc.data().targetPlatforms || [],
            ...doc.data(),
          } as Bot)
        );
        setBots(botsData);
        
        // Count active chatbots
        const activeBotsCount = botsData.filter(bot => bot.isActive).length;
        setActiveChannelsCount(activeBotsCount);
        setConnectionStatus(activeBotsCount > 0 ? 'connected' : 'offline');
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching bots with snapshot: ', error);
        toast.error('No se pudieron cargar los bots.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, activeEntity]);

  // Fetch connected integrations to filter options
  useEffect(() => {
    if (!currentUser || !activeEntity) return;

    const integrationsRef = collection(db, 'users', currentUser.uid, 'entities', activeEntity, 'integrations');
    const unsubscribe = onSnapshot(integrationsRef, (snapshot) => {
      const connected = snapshot.docs
        .filter(d => d.id !== '_init' && d.data().status === 'Connected')
        .map(d => {
            if (d.id === 'whatsapp_internal') return 'whatsapp';
            return d.id;
        });
      setConnectedPlatforms(connected);
    });

    return () => unsubscribe();
  }, [currentUser, activeEntity]);

  const handleGoBack = () => {
    router.push(`/nucleo/${activeEntity}/cto/automation`);
  };

  const handleCreateNewBot = async () => {
    if (!currentUser || !activeEntity) return;
    setIsLoading(true);

    try {
        const counterRef = doc(db, 'users', currentUser.uid, 'entities', activeEntity, 'system_metadata', 'chatbot_counter');
        
        const newBotId = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let currentCount = 0;
            if (counterDoc.exists()) {
                currentCount = counterDoc.data().count || 0;
            }
            
            const nextCount = currentCount + 1;
            transaction.set(counterRef, { count: nextCount }, { merge: true });
            const formattedId = String(nextCount).padStart(8, '0');
            
            const botRef = doc(db, 'users', currentUser.uid, 'entities', activeEntity, 'chatbots', formattedId);
            transaction.set(botRef, {
                id: formattedId,
                name: 'Nuevo Chatbot',
                isActive: false,
                targetPlatforms: [],
                createdAt: new Date(),
                flow: {
                    nodes: [{ id: '1', type: 'startNode', position: { x: 250, y: 5 }, data: { label: 'Inicio' } }],
                    edges: []
                }
            });
            
            return formattedId;
        });

        router.push(`/nucleo/${activeEntity}/cto/automation/chatbots/${newBotId}`);
    } catch (error) {
        console.error("Error creating bot:", error);
        toast.error("No se pudo crear el chatbot.");
        setIsLoading(false);
    }
  };

  const handleBotClick = (botId: string) => {
    router.push(`/nucleo/${activeEntity}/cto/automation/chatbots/${botId}`);
  };

  const handleToggleBotStatus = async (bot: Bot) => {
    if (!bot.isActive && (!bot.targetPlatforms || bot.targetPlatforms.length === 0)) {
        setBotToActivate(bot);
        return;
    }

    setUpdatingBots((prev) => [...prev, bot.id]);
    try {
      const newStatus = !bot.isActive;
      const botRef = doc(db, 'users', currentUser!.uid, 'entities', activeEntity!, 'chatbots', bot.id);
      
      await updateDoc(botRef, { 
        isActive: newStatus,
        updatedAt: new Date()
      });
      
      toast.success(
        `Bot "${bot.name}" ${newStatus ? 'activado' : 'desactivado'}.`
      );
    } catch (error) {
      console.error('Error updating bot status:', error);
      toast.error('No se pudo actualizar el estado del bot.');
    } finally {
      setUpdatingBots((prev) => prev.filter((id) => id !== bot.id));
    }
  };

  const handleQuickAssignAndActivate = async (platformId: string) => {
    if (!botToActivate) return;
    const bot = botToActivate;
    setBotToActivate(null);
    setUpdatingBots((prev) => [...prev, bot.id]);

    try {
        const botRef = doc(db, 'users', currentUser!.uid, 'entities', activeEntity!, 'chatbots', bot.id);
        await updateDoc(botRef, {
            targetPlatforms: [platformId],
            isActive: true,
            updatedAt: new Date()
        });
        toast.success(`Bot "${bot.name}" asignado a ${platformId.toUpperCase()} y activado.`);
    } catch (error) {
        console.error('Error in quick activation:', error);
        toast.error('No se pudo activar el bot.');
    } finally {
        setUpdatingBots((prev) => prev.filter((id) => id !== bot.id));
    }
  };

  const handleTogglePlatform = async (bot: Bot, platformId: string) => {
    setUpdatingBots((prev) => [...prev, bot.id]);
    try {
      const currentPlatforms = bot.targetPlatforms || [];
      const isRemoving = currentPlatforms.includes(platformId);
      const newPlatforms = isRemoving
        ? currentPlatforms.filter(p => p !== platformId)
        : [...currentPlatforms, platformId];
      
      const botRef = doc(db, 'users', currentUser!.uid, 'entities', activeEntity!, 'chatbots', bot.id);
      await updateDoc(botRef, { 
        targetPlatforms: newPlatforms,
        updatedAt: new Date()
      });
      toast.success(`${platformId.toUpperCase()} ${!isRemoving ? 'asignada' : 'removida'} en "${bot.name}"`);
    } catch (error) {
      toast.error('No se pudo actualizar la plataforma.');
    } finally {
      setUpdatingBots((prev) => prev.filter((id) => id !== bot.id));
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, bot: Bot) => {
    e.stopPropagation();
    setBotToDelete(bot);
    setDeleteConfirmation('');
  };

  const confirmDelete = async () => {
    if (!botToDelete || deleteConfirmation !== 'delete') return;

    try {
      await deleteDoc(doc(db, 'users', currentUser!.uid, 'entities', activeEntity!, 'chatbots', botToDelete.id));
      toast.success(`Bot "${botToDelete.name}" eliminado correctamente.`);
      setBotToDelete(null);
    } catch (error) {
      console.error('Error deleting bot:', error);
      toast.error('Error al eliminar el bot.');
    }
  };

  return (
    <div className="p-6 bg-neutral-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={handleGoBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-medium tracking-tight">Mis Chatbots</h1>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
            connectionStatus === 'connected' 
              ? 'bg-green-500/10 border-green-500/20 text-green-400' 
              : connectionStatus === 'loading'
                ? 'bg-neutral-800 border-neutral-700 text-neutral-500'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className="text-[10px] uppercase tracking-wider font-bold">
              {connectionStatus === 'connected' ? `OMNICANAL: ${activeChannelsCount} ACTIVOS` : connectionStatus === 'loading' ? 'Verificando...' : 'SIN CONEXIÓN'}
            </span>
          </div>
        </div>
        <Button
          onClick={handleCreateNewBot}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg shadow-md transform transition-transform duration-200 hover:scale-105 h-8"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Crear Nuevo Bot
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col justify-center items-center mt-32 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Cargando...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {bots.length > 0 ? (
            bots.map((bot) => (
              <div
                key={bot.id}
                className="bg-neutral-800 border border-neutral-700 rounded-lg shadow-sm hover:shadow-blue-500/10 transition-all duration-300 flex flex-col group relative"
              >
                <div
                  onClick={() => handleBotClick(bot.id)}
                  className="p-4 cursor-pointer flex-grow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <button className={`p-1.5 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 outline-none ${
                                    bot.targetPlatforms && bot.targetPlatforms.length > 0 
                                    ? PLATFORMS.find(p => p.id === bot.targetPlatforms![0])?.activeBg || 'bg-neutral-700/50'
                                    : 'bg-neutral-700/50'
                                }`}>
                                    {bot.targetPlatforms && bot.targetPlatforms.length > 0 ? (
                                        (() => {
                                            const p = PLATFORMS.find(p => p.id === bot.targetPlatforms![0]);
                                            if (p) return <p.icon className={`w-5 h-5 ${p.color}`} />;
                                            return <MessageCircle className="w-5 h-5 text-blue-400" />;
                                        })()
                                    ) : (
                                        <MessageCircle className="w-5 h-5 text-blue-400" />
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-neutral-900 border-neutral-700 rounded-xl p-1.5 shadow-2xl z-[100] min-w-[160px]">
                                {PLATFORMS.filter(p => connectedPlatforms.includes(p.id)).map((p) => {
                                    const isCurrent = bot.targetPlatforms?.[0] === p.id;
                                    return (
                                        <DropdownMenuItem
                                            key={p.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleTogglePlatform(bot, p.id);
                                            }}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                                                isCurrent ? p.activeBg + ' text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                                            }`}
                                        >
                                            <p.icon className={`w-3.5 h-3.5 ${p.color}`} />
                                            <span className="text-[11px] font-bold uppercase tracking-wider">{p.id}</span>
                                            {isCurrent && <div className="ml-auto w-1 h-1 rounded-full bg-blue-500" />}
                                        </DropdownMenuItem>
                                    );
                                })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full ${bot.isActive
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-neutral-600/50 text-neutral-400'
                            }`}
                        >
                          {bot.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-neutral-500 hover:text-red-400 hover:bg-red-500/10"
                          onClick={(e) => handleDeleteClick(e, bot)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                  </div>
                  <h2 className="text-sm font-medium text-white truncate mb-1">
                    {bot.name}
                  </h2>
                  <p className="text-[10px] text-neutral-500 font-mono break-all leading-tight">
                    {bot.id}
                  </p>
                </div>

                <div className="px-6 py-4 bg-neutral-800/50 rounded-b-lg border-t border-neutral-700">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleBotStatus(bot);
                    }}
                    className={`w-full font-bold text-[10px] uppercase tracking-widest transition-colors duration-200 flex items-center justify-center ${bot.isActive
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    disabled={updatingBots.includes(bot.id)}
                  >
                    {updatingBots.includes(bot.id) ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Power className="mr-2 h-4 w-4" />
                        {bot.isActive ? 'Desactivar' : 'Activar'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-20 bg-neutral-800 rounded-xl border border-dashed border-neutral-700">
              <MessageCircle size={32} className="text-neutral-700 mx-auto mb-4" />
              <h3 className="text-sm font-bold text-white mb-2">Sin Chatbots</h3>
              <p className="text-neutral-600 text-[10px] mb-6">No tienes flujos configurados.</p>
              <Button onClick={handleCreateNewBot} className="bg-blue-600 hover:bg-blue-700 font-bold px-6 py-2 rounded-lg h-8 text-[10px]">
                Crear Ahora
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={!!botToDelete} onOpenChange={(open) => !open && setBotToDelete(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-700 text-white sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>Eliminar Chatbot</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Confirma escribiendo "delete" para eliminar <span className="text-white font-bold">{botToDelete?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white rounded-lg py-5 px-4 placeholder:text-neutral-800 text-sm font-mono"
                placeholder="delete"
                autoComplete="off"
              />
          </div>
          <DialogFooter className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setBotToDelete(null)}
              className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmation !== 'delete'}
              onClick={confirmDelete}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold"
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Activation Platform Selection */}
      <Dialog open={!!botToActivate} onOpenChange={(open) => !open && setBotToActivate(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-700 text-white max-w-sm rounded-xl p-8">
            <DialogHeader className="mb-4">
                <DialogTitle className="text-xl font-bold">Seleccionar Canal</DialogTitle>
                <DialogDescription className="text-neutral-400 text-xs">
                    Elige por qué canal responderá <span className="text-white font-bold">"{botToActivate?.name}"</span>
                </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3">
                {PLATFORMS.filter(p => connectedPlatforms.includes(p.id)).map((p) => (
                    <button
                        key={p.id}
                        onClick={() => handleQuickAssignAndActivate(p.id)}
                        className={`group flex items-center justify-between p-4 rounded-xl border border-neutral-700 hover:border-neutral-600 transition-all ${p.activeBg}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${p.activeBg} border ${p.activeBorder}`}>
                                <p.icon className={`w-5 h-5 ${p.color}`} />
                            </div>
                            <span className="font-bold text-sm">{p.id.toUpperCase()}</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="w-4 h-4 text-blue-400" />
                        </div>
                    </button>
                ))}
                {connectedPlatforms.length === 0 && (
                    <div className="py-8 text-center bg-neutral-800 rounded-xl border border-dashed border-neutral-700">
                        <p className="text-xs text-neutral-500 mb-4">No tienes integraciones conectadas para activar este bot.</p>
                        <Button 
                            variant="outline" 
                            className="text-[10px] font-bold rounded-xl h-8 border-blue-500/30 text-blue-400"
                            onClick={() => router.push(`/nucleo/${activeEntity}/cto/integrations`)}
                        >
                            Ir a Integraciones
                        </Button>
                    </div>
                )}
            </div>
            <DialogFooter className="mt-6">
                <Button 
                    variant="ghost" 
                    onClick={() => setBotToActivate(null)}
                    className="w-full bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white rounded-xl py-6"
                >
                    Cancelar
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatbotsPage;
