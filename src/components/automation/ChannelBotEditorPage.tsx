'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { ArrowLeft, Check, Cloud, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import ChatbotCanvas from '@/components/ChatbotCanvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { BotChannelConfig } from '@/lib/automation/channels';
import { normalizeTargetPlatforms } from '@/lib/automation/botActivation';

interface ChannelBotEditorPageProps {
  channel: BotChannelConfig;
  botId: string;
}

export function ChannelBotEditorPage({ channel, botId }: ChannelBotEditorPageProps) {
  const router = useRouter();
  const { currentUser, activeEntity } = useAuth();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [chatbotName, setChatbotName] = useState('Cargando...');
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([channel.enginePlatform]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const Icon = channel.Icon;
  const listHref = channel.listHref(activeEntity || '');

  const botDocRef = () =>
    doc(db, 'users', currentUser!.uid, 'entities', activeEntity!, channel.collection, botId);

  const saveData = useCallback(
    async (currentNodes: Node[], currentEdges: Edge[], name: string) => {
      if (!botId || !currentUser || !activeEntity) return;
      setSaveStatus('saving');
      try {
        const edgesToSave = currentEdges.map(({ selected, ...edge }) => ({ ...edge, type: 'custom' }));
        await setDoc(
          botDocRef(),
          {
            name,
            channel: channel.slug,
            botType: channel.botType,
            targetPlatforms: [channel.enginePlatform],
            flow: { nodes: currentNodes, edges: edgesToSave },
          },
          { merge: true }
        );
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (error) {
        console.error('Error al guardar:', error);
        setSaveStatus('error');
      }
    },
    [botId, currentUser, activeEntity, channel]
  );

  useEffect(() => {
    const load = async () => {
      if (!botId || !currentUser || !activeEntity) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const snap = await getDoc(botDocRef());
      if (snap.exists()) {
        const data = snap.data();
        setChatbotName(data.name || `Bot ${channel.shortTitle}`);
        setTargetPlatforms(normalizeTargetPlatforms(data.targetPlatforms) || [channel.enginePlatform]);
        const flowData = data.flow || {};
        setNodes(Array.isArray(flowData.nodes) ? flowData.nodes : []);
        setEdges(
          (flowData.edges || []).map(({ animated, style, ...edge }: any) => ({ ...edge, type: 'custom' }))
        );
      } else {
        setChatbotName(`Nuevo bot ${channel.shortTitle}`);
        const startNodes = [{ id: '1', type: 'startNode', position: { x: 250, y: 5 }, data: { label: 'Inicio' } }];
        setNodes(startNodes);
        setEdges([]);
        await saveData(startNodes, [], `Nuevo bot ${channel.shortTitle}`);
      }
      setIsLoading(false);
    };
    load();
  }, [botId, currentUser, activeEntity, channel.slug]);

  useEffect(() => {
    if (!botId || !currentUser || !activeEntity) return;
    const unsubscribe = onSnapshot(botDocRef(), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setTargetPlatforms(normalizeTargetPlatforms(data.targetPlatforms) || [channel.enginePlatform]);
      if (typeof data.name === 'string') setChatbotName((prev) => (prev === data.name ? prev : data.name));
    });
    return () => unsubscribe();
  }, [botId, currentUser, activeEntity, channel.collection]);

  useEffect(() => {
    if (isLoading) return;
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      if (nodes.length > 0 || edges.length > 0) saveData(nodes, edges, chatbotName);
    }, 1500);
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [nodes, edges, chatbotName, saveData, isLoading]);

  const onNodesChange: OnNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({ ...connection, type: 'custom' }, eds)),
    []
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-900 text-white">
        <Loader2 className="w-12 h-12 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-neutral-900 text-white">
      <div className="h-14 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-4 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => activeEntity && router.push(listHref)}
            className="text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className={`p-1.5 rounded-lg ${channel.activeBg}`}>
            <Icon className={`w-4 h-4 ${channel.iconColor}`} />
          </div>
          <Input
            value={chatbotName}
            onChange={(e) => setChatbotName(e.target.value)}
            className="bg-transparent border-transparent text-lg font-medium text-white w-[280px] h-9"
          />
          <span className="text-[10px] text-neutral-500 uppercase tracking-widest">{channel.shortTitle}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {saveStatus === 'saving' && (
            <span className="text-neutral-400 flex items-center gap-2"><Cloud className="w-4 h-4" /> Guardando...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-green-500 flex items-center gap-2"><Check className="w-4 h-4" /> Guardado</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-500 flex items-center gap-2"><Save className="w-4 h-4" /> Error</span>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 relative w-full">
        <ChatbotCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          setNodes={setNodes}
          setEdges={setEdges}
          targetPlatforms={targetPlatforms}
        />
      </div>
    </div>
  );
}
