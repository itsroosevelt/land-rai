'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, deleteDoc, doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { ArrowLeft, Loader2, Plus, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { BotChannelConfig } from '@/lib/automation/channels';
import {
  getPrimaryPlatform,
  isBotActiveValue,
  normalizeTargetPlatforms,
  updateExclusiveBotForChannel,
} from '@/lib/automation/botActivation';

interface Bot {
  id: string;
  name: string;
  isActive: boolean;
  targetPlatforms?: string[];
}

interface ChannelBotsPageProps {
  channel: BotChannelConfig;
}

export function ChannelBotsPage({ channel }: ChannelBotsPageProps) {
  const router = useRouter();
  const { currentUser, activeEntity } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingBots, setUpdatingBots] = useState<string[]>([]);
  const [botToDelete, setBotToDelete] = useState<Bot | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [integrationConnected, setIntegrationConnected] = useState(false);

  const editorBase = `/nucleo/${activeEntity}/cto/automation/bots/${channel.slug}`;
  const Icon = channel.Icon;

  useEffect(() => {
    if (!currentUser || !activeEntity) return;

    const botsCollection = collection(
      db,
      'users',
      currentUser.uid,
      'entities',
      activeEntity,
      channel.collection
    );

    const unsubscribe = onSnapshot(
      botsCollection,
      (querySnapshot) => {
        const botsData = querySnapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              name: d.data().name || 'Unnamed Bot',
              isActive: isBotActiveValue(d.data().isActive),
              targetPlatforms: normalizeTargetPlatforms(d.data().targetPlatforms),
              ...d.data(),
            }) as Bot
        );
        setBots(botsData);
        setIsLoading(false);
      },
      () => {
        toast.error('No se pudieron cargar los bots.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, activeEntity, channel.collection]);

  useEffect(() => {
    if (!currentUser || !activeEntity || !channel.integrationId) {
      setIntegrationConnected(channel.webhookReady);
      return;
    }

    const integrationsRef = collection(db, 'users', currentUser.uid, 'entities', activeEntity, 'integrations');
    const unsubscribe = onSnapshot(integrationsRef, (snapshot) => {
      const connected = snapshot.docs.some((d) => {
        if (d.id === '_init') return false;
        if (d.id === 'whatsapp_internal' && channel.integrationId === 'whatsapp') {
          return d.data().status === 'Connected' || d.data().status === 'Internal';
        }
        return d.id === channel.integrationId && d.data().status === 'Connected';
      });
      setIntegrationConnected(connected);
    });

    return () => unsubscribe();
  }, [currentUser, activeEntity, channel.integrationId, channel.webhookReady]);

  const handleCreateNewBot = async () => {
    if (!currentUser || !activeEntity) return;
    setIsLoading(true);

    try {
      const counterKey = `counter_${channel.collection.replace(/-/g, '_')}`;
      const counterRef = doc(db, 'users', currentUser.uid, 'entities', activeEntity, 'system_metadata', counterKey);

      const newBotId = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const currentCount = counterDoc.exists() ? counterDoc.data()?.count || 0 : 0;
        const nextCount = currentCount + 1;
        transaction.set(counterRef, { count: nextCount }, { merge: true });
        const formattedId = String(nextCount).padStart(8, '0');

        const botRef = doc(db, 'users', currentUser.uid, 'entities', activeEntity, channel.collection, formattedId);
        transaction.set(botRef, {
          id: formattedId,
          name: `Nuevo bot ${channel.shortTitle}`,
          isActive: false,
          channel: channel.slug,
          botType: channel.botType,
          targetPlatforms: [channel.enginePlatform],
          createdAt: new Date(),
          flow: {
            nodes: [{ id: '1', type: 'startNode', position: { x: 250, y: 5 }, data: { label: 'Start' } }],
            edges: [],
          },
        });

        return formattedId;
      });

      router.push(`${editorBase}/${newBotId}`);
    } catch (error) {
      console.error('Error creating bot:', error);
      toast.error('No se pudo crear el bot.');
      setIsLoading(false);
    }
  };

  const handleToggleBotStatus = async (bot: Bot) => {
    if (!channel.webhookReady) {
      toast.error('Este canal aún no tiene webhook en producción. Puedes crear el flujo y activarlo cuando conectes la integración.');
      return;
    }

    if (!integrationConnected) {
      toast.error(`Conecta la integración de ${channel.shortTitle} en CTO → Integraciones.`);
      return;
    }

    setUpdatingBots((prev) => [...prev, bot.id]);
    try {
      const newStatus = !bot.isActive;
      await updateExclusiveBotForChannel({
        db,
        userId: currentUser!.uid,
        entityId: activeEntity!,
        botId: bot.id,
        botsCollection: channel.collection,
        platformId: channel.enginePlatform,
        activate: newStatus,
      });
      toast.success(`Bot "${bot.name}" ${newStatus ? 'activado' : 'desactivado'}.`);
    } catch (error) {
      toast.error('No se pudo actualizar el bot.');
    } finally {
      setUpdatingBots((prev) => prev.filter((id) => id !== bot.id));
    }
  };

  const confirmDelete = async () => {
    if (!botToDelete || deleteConfirmation !== 'delete' || !currentUser || !activeEntity) return;
    try {
      await deleteDoc(
        doc(db, 'users', currentUser.uid, 'entities', activeEntity, channel.collection, botToDelete.id)
      );
      toast.success(`Bot "${botToDelete.name}" eliminado.`);
      setBotToDelete(null);
    } catch {
      toast.error('Error al eliminar el bot.');
    }
  };

  const activeCount = bots.filter((b) => b.isActive).length;

  return (
    <div className="p-6 bg-neutral-900 text-white min-h-screen overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/nucleo/${activeEntity}/cto/automation`)}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className={`p-2 rounded-lg ${channel.activeBg} border ${channel.activeBorder}`}>
            <Icon className={`w-5 h-5 ${channel.iconColor}`} />
          </div>
          <div>
            <h1 className="text-xl font-medium tracking-tight">{channel.title}</h1>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
              Canal aislado · {activeCount} activo{activeCount !== 1 ? 's' : ''}
              {!channel.webhookReady && ' · Webhook próximamente'}
            </p>
          </div>
        </div>
        <Button
          onClick={handleCreateNewBot}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium h-8"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Crear bot
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col justify-center items-center mt-32 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {bots.length > 0 ? (
            bots.map((bot) => (
              <div
                key={bot.id}
                className="bg-neutral-800 border border-neutral-700 rounded-lg flex flex-col group"
              >
                <div
                  onClick={() => router.push(`${editorBase}/${bot.id}`)}
                  className="p-4 cursor-pointer flex-grow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-1.5 rounded-lg ${channel.activeBg}`}>
                      <Icon className={`w-5 h-5 ${channel.iconColor}`} />
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${
                        bot.isActive ? 'bg-green-500/20 text-green-300' : 'bg-neutral-600/50 text-neutral-400'
                      }`}
                    >
                      {bot.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <h2 className="text-sm font-medium truncate">{bot.name}</h2>
                  <p className="text-[10px] text-neutral-500 font-mono mt-1">{bot.id}</p>
                  <p className="text-[10px] text-neutral-600 mt-2">
                    {getPrimaryPlatform(bot.targetPlatforms) || channel.enginePlatform}
                  </p>
                </div>
                <div className="px-4 py-3 border-t border-neutral-700 flex gap-2">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleBotStatus(bot);
                    }}
                    disabled={updatingBots.includes(bot.id)}
                    className={`flex-1 text-[10px] uppercase font-bold h-8 ${
                      bot.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    <Power className="mr-1 h-3 w-3" />
                    {bot.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-neutral-500 hover:text-red-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBotToDelete(bot);
                      setDeleteConfirmation('');
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-20 bg-neutral-800 rounded-xl border border-dashed border-neutral-700">
              <Icon className={`w-10 h-10 mx-auto mb-4 ${channel.iconColor} opacity-40`} />
              <p className="text-sm text-neutral-400">No hay bots de {channel.shortTitle} todavía.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!botToDelete} onOpenChange={(open) => !open && setBotToDelete(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-700 text-white">
          <DialogHeader>
            <DialogTitle>Eliminar bot</DialogTitle>
            <DialogDescription className="text-neutral-400 text-xs">
              Escribe <strong>delete</strong> para eliminar &quot;{botToDelete?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            className="bg-neutral-800 border-neutral-700"
            placeholder="delete"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setBotToDelete(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmation !== 'delete'}
              onClick={confirmDelete}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
