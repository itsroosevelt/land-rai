// src/app/cso/automation/chatbots/[id]/page.tsx
'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ChatbotCanvas from '@/components/ChatbotCanvas';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Cloud, Check, Save, Facebook, Instagram, Send, Mail, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPrimaryPlatform, normalizeTargetPlatforms, updateExclusiveBotPlatform } from '../utils';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 0 5.414 0 12.05c0 2.123.551 4.197 1.597 6.03l-1.602 5.8 5.883-1.543a11.86 11.86 0 005.815 1.526h.005c6.634 0 12.048-5.414 12.048-12.05 0-3.213-1.252-6.234-3.525-8.508z" />
  </svg>
);

const PLATFORMS_MAP: Record<string, any> = {
  whatsapp: { icon: WhatsAppIcon, color: 'text-[#25D366]' },
  messenger: { icon: Facebook, color: 'text-[#0084FF]' },
  instagram: { icon: Instagram, color: 'text-[#E1306C]' },
  telegram: { icon: Send, color: 'text-[#0088cc]' },
  x_twitter: { icon: Twitter, color: 'text-white' },
  gmail: { icon: Mail, color: 'text-[#EA4335]' }
};

function FlowPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [chatbotName, setChatbotName] = useState('Cargando...');
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([]);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);
    const params = useParams();
    const router = useRouter();
    const { currentUser, activeEntity } = useAuth();
    const chatbotId = params.id as string;
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const saveData = useCallback(async (currentNodes: Node[], currentEdges: Edge[], name: string) => {
    if (!chatbotId || !currentUser || !activeEntity) return;

    setSaveStatus('saving');
    try {
      const chatbotRef = doc(db, 'users', currentUser.uid, 'entities', activeEntity, 'chatbots', chatbotId);
      const edgesToSave = currentEdges.map(({ selected, ...edge }) => edge);

      await setDoc(chatbotRef, {
        name: name,
        flow: {
          nodes: currentNodes,
          edges: edgesToSave,
        }
      }, { merge: true });

      await fetch('/api/kanban/sync-bot-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          entityId: activeEntity,
          botId: chatbotId,
          relocateCards: true,
        }),
      }).catch((err) => console.warn('[Chatbot] Kanban sync after save failed:', err));

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error("Error al guardar:", error);
      setSaveStatus('error');
    }
  }, [chatbotId]);

  useEffect(() => {
    const fetchChatbotData = async () => {
      if (!chatbotId || !currentUser || !activeEntity) {
        setIsLoading(false);
        setChatbotName('ID de chatbot no encontrado');
        return;
      }

      setIsLoading(true);
      const docRef = doc(db, 'users', currentUser.uid, 'entities', activeEntity, 'chatbots', chatbotId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setChatbotName(data.name || 'Mi Chatbot');
        setTargetPlatforms(normalizeTargetPlatforms(data.targetPlatforms));

        const flowData = data.flow || {};
        const savedNodes = flowData.nodes || [];
        const savedEdges = (flowData.edges || []).map(({ animated, style, ...edge }: any) => ({
          ...edge,
          type: 'custom',
        }));

        setNodes(Array.isArray(savedNodes) ? savedNodes : []);
        setEdges(Array.isArray(savedEdges) ? savedEdges : []);

      } else {
        console.log('No se encontró el documento, creando un chatbot de inicio.');
        setChatbotName('Nuevo Chatbot');
        const startNodes = [{ id: '1', type: 'startNode', position: { x: 250, y: 5 }, data: { label: 'Inicio' } }];
        setNodes(startNodes);
        setEdges([]);
        saveData(startNodes, [], 'Nuevo Chatbot');
      }
      setIsLoading(false);
    };

    fetchChatbotData();
  }, [chatbotId, saveData, currentUser, activeEntity]);

  useEffect(() => {
    if (!chatbotId || !currentUser || !activeEntity) return;

    const docRef = doc(db, 'users', currentUser.uid, 'entities', activeEntity, 'chatbots', chatbotId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      setTargetPlatforms(normalizeTargetPlatforms(data.targetPlatforms));
      if (typeof data.name === 'string') {
        setChatbotName((prev) => prev === data.name ? prev : data.name);
      }
    });

    return () => unsubscribe();
  }, [chatbotId, currentUser, activeEntity]);

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

  const handleTogglePlatform = async (platformId: string) => {
    if (!currentUser || !activeEntity || !chatbotId) return;
    
    try {
      const currentPlatform = getPrimaryPlatform(targetPlatforms);
      const isRemoving = currentPlatform === platformId;
      const botSnap = await getDoc(doc(db, 'users', currentUser.uid, 'entities', activeEntity, 'chatbots', chatbotId));
      const isActive = botSnap.exists() ? (botSnap.data().isActive === true || botSnap.data().isActive === 'true') : false;

      await updateExclusiveBotPlatform({
        db,
        userId: currentUser.uid,
        entityId: activeEntity,
        botId: chatbotId,
        platformId: isRemoving ? null : platformId,
        activate: isRemoving ? false : isActive
      });
      
      toast.success(`${platformId.toUpperCase()} ${!isRemoving ? 'vinculado' : 'removido'}`);
    } catch (error) {
      console.error('Error updating platform:', error);
      toast.error('No se pudo actualizar la plataforma.');
    }
  };

  // Efecto de Auto-guardado (Triggered by nodes/edges/name changes)
  useEffect(() => {
    if (isLoading) return;
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(() => {
      // Solo guardar si hay contenido
      if (nodes.length > 0 || edges.length > 0) {
        saveData(nodes, edges, chatbotName);
      }
    }, 1500);

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [nodes, edges, chatbotName, saveData, isLoading]);

  const onNodesChange: OnNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [setNodes]);
  const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [setEdges]);
  const onConnect: OnConnect = useCallback((connection) => setEdges((eds) => addEdge({ ...connection, type: 'custom' }, eds)), [setEdges]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-900 text-white">
        <Loader2 className="w-12 h-12 animate-spin text-neutral-500" />
        <p className="ml-4 text-lg">Cargando chatbot...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col min-h-screen overflow-y-auto md:h-screen md:overflow-hidden bg-neutral-900 text-white">
      <style jsx global>{`
        html, body {
          overflow: hidden !important;
          height: 100% !important;
          width: 100% !important;
          position: fixed;
        }
      `}</style>
      
      {/* HEADER BAR */}
      <div className="h-14 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-4 z-20 shrink-0">

        {/* Izquierda: Volver y Nombre */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (activeEntity) {
                router.push(`/nucleo/${activeEntity}/cto/automation/chatbots`);
              }
            }}
            className="text-neutral-400 hover:text-white hover:bg-neutral-800"
            title="Volver a mis bots"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex items-center group">
            <Input
              value={chatbotName}
              onChange={(e) => setChatbotName(e.target.value)}
              className="bg-transparent border-transparent hover:border-neutral-700 focus:border-neutral-600 focus:bg-neutral-900 text-lg font-normal tracking-tight text-white w-[300px] h-9 px-2 transition-all"
              placeholder="Nombre del Chatbot"
            />
            <span className="opacity-0 group-hover:opacity-100 text-neutral-600 text-[10px] ml-2 transition-opacity uppercase tracking-wider font-normal">
              Editar
            </span>
          </div>
        </div>

        {/* Derecha: Plataformas y Estado de Guardado */}
        <div className="flex items-center gap-6">
          {/* Platform Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-all hover:bg-white/10 ${
                    targetPlatforms.length > 0 
                    ? 'bg-white/5 border-white/5' 
                    : 'bg-red-500/5 border-red-500/10'
                }`}>
                    <span className={`text-[10px] font-normal uppercase tracking-tight ${
                        targetPlatforms.length > 0 ? 'text-neutral-500' : 'text-red-400/80'
                    }`}>
                        {targetPlatforms.length > 0 ? 'Canales' : 'Desconectado'}
                    </span>
                    <div className="flex items-center gap-1">
                        {targetPlatforms.length > 0 ? (
                            (() => {
                                const currentPlatform = getPrimaryPlatform(targetPlatforms);
                                const p = currentPlatform ? PLATFORMS_MAP[currentPlatform] : null;
                                if (!p || !currentPlatform) return null;
                                return <p.icon key={currentPlatform} className={`w-3.5 h-3.5 ${p.color}`} />;
                            })()
                        ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        )}
                    </div>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-neutral-900 border-neutral-800 rounded-xl p-1.5 shadow-2xl z-[100] min-w-[180px]">
                <div className="px-3 py-2 border-b border-white/5 mb-1.5">
                    <p className="text-[9px] font-normal text-neutral-500 uppercase tracking-widest">Gestionar Conexión</p>
                </div>
                {Object.keys(PLATFORMS_MAP).filter(pId => connectedPlatforms.includes(pId)).map((pId) => {
                    const p = PLATFORMS_MAP[pId];
                    const isCurrent = getPrimaryPlatform(targetPlatforms) === pId;
                    return (
                        <DropdownMenuItem
                            key={pId}
                            onClick={() => handleTogglePlatform(pId)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                                isCurrent ? 'bg-white/5 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            <p.icon className={`w-4 h-4 ${p.color}`} />
                            <span className="text-xs font-normal tracking-tight">{pId.toUpperCase()}</span>
                            {isCurrent && (
                                <div className="ml-auto flex items-center gap-1">
                                    <div className="w-1 h-1 rounded-full bg-green-500" />
                                    <span className="text-[8px] text-green-500 font-normal">VINCULADO</span>
                                </div>
                            )}
                        </DropdownMenuItem>
                    );
                })}
                {connectedPlatforms.length === 0 && (
                    <div className="px-4 py-6 text-center">
                        <p className="text-[10px] text-neutral-500 leading-relaxed">No tienes integraciones conectadas en este tenant.</p>
                    </div>
                )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-3">
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-2 text-neutral-400 text-sm animate-pulse">
                <Cloud className="w-4 h-4" />
                <span>Guardando...</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-2 text-green-500 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <Check className="w-4 h-4" />
                <span>Guardado</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <Save className="w-4 h-4" />
                <span>Error al guardar</span>
              </div>
            )}
            {saveStatus === 'idle' && (
              <div className="flex items-center gap-2 text-neutral-600 text-sm">
                <Cloud className="w-4 h-4" />
                <span>Al día</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CANVAS AREA */}
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

export default FlowPage;
