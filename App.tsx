
import React, { useState, useRef, useEffect } from 'react';
import { PageFormat, PageSettings, FORMAT_DIMENSIONS, FONTS, PREDEFINED_TEMPLATES, SavedProject, DocumentTemplate } from './types';
import { refineDocumentContent, formatDocumentStructure, extractTextFromImage } from './geminiService';

// Dichiarazione globale sicura per gli strumenti AI Studio - Utilizza il tipo AIStudio previsto per evitare conflitti di ridichiarazione
declare global {
  interface Window {
    readonly aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [settings, setSettings] = useState<PageSettings>(PREDEFINED_TEMPLATES[0].settings);
  const [content, setContent] = useState<string>(PREDEFINED_TEMPLATES[0].initialContent);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'templates' | 'projects' | 'api-config'>('settings');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFastModeMenu, setShowFastModeMenu] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  
  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fastModeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkApiKeyStatus();
    const stored = localStorage.getItem('docustyle_projects');
    if (stored) {
      try {
        setSavedProjects(JSON.parse(stored));
      } catch (e) {
        console.error("Errore nel caricamento progetti", e);
      }
    }
  }, []);

  const checkApiKeyStatus = async () => {
    try {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        // Fallback se non siamo in ambiente AI Studio ma abbiamo process.env.API_KEY
        setHasApiKey(!!process.env.API_KEY);
      }
    } catch (e) {
      console.error("Errore verifica API Key", e);
      setHasApiKey(false);
    }
  };

  const handleOpenApiKeySelector = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      } catch (e) {
        console.error("Errore apertura selettore chiave", e);
      }
    } else {
      alert("Il selettore di chiavi API è disponibile solo nell'ambiente AI Studio.");
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
      if (fastModeRef.current && !fastModeRef.current.contains(event.target as Node)) {
        setShowFastModeMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAiCall = async (fn: () => Promise<any>) => {
    if (!hasApiKey && !process.env.API_KEY) {
      alert("Configura prima una Chiave API nelle Impostazioni.");
      setActiveTab('api-config');
      return;
    }
    setIsAiLoading(true);
    try {
      await fn();
    } catch (error: any) {
      console.error("AI Call Error:", error);
      if (error.message?.includes("Requested entity was not found") || error.message === "API_KEY_RESET") {
        setHasApiKey(false);
        alert("La chiave API non è più valida o è scaduta. Selezionala nuovamente.");
        setActiveTab('api-config');
      } else {
        alert("Si è verificato un errore durante la chiamata AI. Verifica la tua connessione e la validità della chiave.");
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const openCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Errore accesso camera:", err);
      alert("Impossibile accedere alla fotocamera.");
      setIsCameraOpen(false);
    }
  };

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        
        const imageData = canvasRef.current.toDataURL('image/jpeg');
        const base64 = imageData.split(',')[1];
        
        closeCamera();
        handleAiCall(async () => {
          const extractedText = await extractTextFromImage(base64, 'image/jpeg');
          const structured = await formatDocumentStructure(extractedText);
          setContent(prev => prev + structured);
        });
      }
    }
  };

  const saveCurrentProject = () => {
    const name = prompt("Inserisci un nome per questo progetto:");
    if (!name) return;

    const newProject: SavedProject = {
      id: Date.now().toString(),
      name,
      settings,
      content,
      timestamp: Date.now()
    };

    const updated = [newProject, ...savedProjects];
    setSavedProjects(updated);
    localStorage.setItem('docustyle_projects', JSON.stringify(updated));
    alert("Progetto salvato con successo!");
  };

  const loadProject = (project: SavedProject) => {
    if (confirm(`Vuoi caricare il progetto "${project.name}"? Le modifiche non salvate andranno perse.`)) {
      setSettings(project.settings);
      setContent(project.content);
      setActiveTab('settings');
    }
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Sei sicuro di voler eliminare questo progetto?")) {
      const updated = savedProjects.filter(p => p.id !== id);
      setSavedProjects(updated);
      localStorage.setItem('docustyle_projects', JSON.stringify(updated));
    }
  };

  const applyTemplate = (template: DocumentTemplate) => {
    if (confirm(`Applicare il modello "${template.name}"? Sovrascriverà le impostazioni correnti e il contenuto.`)) {
      setSettings(template.settings);
      setContent(template.initialContent);
      setActiveTab('settings');
      setShowFastModeMenu(false);
    }
  };

  const applyLayoutOnly = (template: DocumentTemplate) => {
    setSettings(template.settings);
    setShowFastModeMenu(false);
  };

  const formatDoc = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  };

  const refineWithAi = () => {
    handleAiCall(async () => {
      const result = await refineDocumentContent(content, "Rendi il testo più professionale e scorrevole seguendo regole di videoscrittura istituzionale");
      setContent(result);
    });
  };

  const autoLayoutAi = () => {
    handleAiCall(async () => {
      const result = await formatDocumentStructure(content);
      setContent(result);
    });
  };

  const handlePrint = () => {
    setShowExportMenu(false);
    window.print();
  };

  const downloadFile = (data: string, filename: string, type: string) => {
    const blob = new Blob([data], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const exportAsTxt = () => {
    const plainText = editorRef.current?.innerText || "";
    downloadFile(plainText, "documento.txt", "text/plain");
  };

  const exportAsDoc = () => {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Export DOC</title></head><body>`;
    const footer = `</body></html>`;
    const sourceHTML = header + content + footer;
    downloadFile(sourceHTML, "documento.doc", "application/msword");
  };

  const dims = FORMAT_DIMENSIONS[settings.format];
  const width = settings.orientation === 'portrait' ? dims.width : dims.height;
  const height = settings.orientation === 'portrait' ? dims.height : dims.width;

  return (
    <div className="min-h-screen flex flex-col h-screen overflow-hidden">
      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="relative max-w-lg w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl">
            <video ref={videoRef} autoPlay playsInline className="w-full aspect-video object-cover"></video>
            <canvas ref={canvasRef} className="hidden"></canvas>
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-6">
              <button onClick={closeCamera} className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition">
                <i className="fas fa-times text-xl"></i>
              </button>
              <button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white text-slate-900 flex items-center justify-center hover:scale-105 transition shadow-lg">
                <i className="fas fa-camera text-2xl"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 no-print flex-shrink-0 shadow-sm">
        <div className="max-w-full mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-100">
              <i className="fas fa-pen-nib text-xl"></i>
            </div>
            <h1 className="font-bold text-xl text-gray-800 hidden sm:block tracking-tight">DocuStyle <span className="text-indigo-600 font-light">Pro</span></h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative" ref={fastModeRef}>
              <button 
                onClick={() => setShowFastModeMenu(!showFastModeMenu)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition text-sm font-bold shadow-md active:scale-95"
              >
                <i className="fas fa-bolt text-yellow-400"></i>
                <span className="hidden md:inline">Modalità Veloce</span>
              </button>
              
              {showFastModeMenu && (
                <div className="absolute left-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-2xl z-[100] py-1 animate-fadeIn overflow-hidden">
                  <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-50 mb-1">Seleziona Profilo Logico</div>
                  {PREDEFINED_TEMPLATES.map(t => (
                    <button 
                      key={t.id}
                      onClick={() => applyLayoutOnly(t)}
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 flex flex-col transition"
                    >
                      <div className="flex items-center gap-3">
                        <i className={`fas ${t.icon} text-indigo-500 w-4 text-center`}></i>
                        <span className="font-bold text-gray-800 text-xs">{t.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={openCamera}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition text-sm font-semibold border border-green-100"
            >
              <i className="fas fa-camera"></i>
              <span className="hidden md:inline">Scansiona</span>
            </button>

            <button 
              onClick={autoLayoutAi}
              disabled={isAiLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-md hover:from-indigo-700 hover:to-violet-700 transition disabled:opacity-50 text-sm font-bold shadow-lg shadow-indigo-100"
            >
              <i className={`fas ${isAiLoading ? 'fa-spinner fa-spin' : 'fa-magic'}`}></i>
              <span>Auto-Layout AI</span>
            </button>
            
            <button onClick={handlePrint} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-sm font-semibold border border-slate-200 shadow-sm">
              <i className="fas fa-print"></i>
            </button>

            <div className="relative" ref={exportMenuRef}>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition text-sm font-semibold shadow-sm"
              >
                <i className="fas fa-file-export"></i>
                <span className="hidden md:inline">Esporta</span>
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-[100] py-1 animate-fadeIn">
                  <ExportOption icon="fa-file-pdf" label="Scarica PDF" onClick={handlePrint} />
                  <ExportOption icon="fa-file-word" label="Microsoft Word" onClick={exportAsDoc} />
                  <ExportOption icon="fa-file-alt" label="Testo (.txt)" onClick={exportAsTxt} />
                </div>
              )}
            </div>

            <button onClick={saveCurrentProject} className="p-2 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-200">
              <i className="fas fa-save"></i>
            </button>
          </div>
        </div>

        {/* TOOLBAR FORMATTAZIONE */}
        <div className="bg-gray-50 border-b border-gray-200 p-2 flex justify-center">
          <div className="flex items-center gap-4">
            <div className="flex bg-white rounded border border-gray-200 p-1 shadow-sm gap-0.5">
              <ToolbarButton icon="bold" onClick={() => formatDoc('bold')} />
              <ToolbarButton icon="italic" onClick={() => formatDoc('italic')} />
              <ToolbarButton icon="underline" onClick={() => formatDoc('underline')} />
              <div className="w-px h-6 bg-gray-200 mx-1"></div>
              <ToolbarButton icon="align-left" onClick={() => formatDoc('justifyLeft')} />
              <ToolbarButton icon="align-center" onClick={() => formatDoc('justifyCenter')} />
              <ToolbarButton icon="align-right" onClick={() => formatDoc('justifyRight')} />
              <ToolbarButton icon="align-justify" onClick={() => formatDoc('justifyFull')} />
            </div>

            <div className="flex bg-white rounded border border-gray-200 p-1 shadow-sm gap-0.5">
              <ToolbarButton icon="heading" onClick={() => formatDoc('formatBlock', 'h1')} label="1" />
              <ToolbarButton icon="heading" onClick={() => formatDoc('formatBlock', 'h2')} label="2" />
              <div className="w-px h-6 bg-gray-200 mx-1"></div>
              <ToolbarButton icon="list-ul" onClick={() => formatDoc('insertUnorderedList')} />
              <ToolbarButton icon="list-ol" onClick={() => formatDoc('insertOrderedList')} />
            </div>

            <div className="flex bg-white rounded border border-gray-200 p-1 shadow-sm gap-0.5">
              <ToolbarButton icon="eraser" onClick={() => formatDoc('removeFormat')} />
              <button 
                onClick={refineWithAi}
                className="px-3 py-1 text-[10px] font-bold uppercase text-indigo-600 hover:bg-indigo-50 rounded transition flex items-center gap-1.5"
                title="Perfeziona con AI"
              >
                <i className="fas fa-wand-sparkles"></i> Perfeziona AI
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden bg-gray-100">
        <nav className="w-16 md:w-20 bg-slate-900 flex flex-col items-center py-6 gap-6 no-print flex-shrink-0">
          <NavIcon icon="fa-sliders-h" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Layout" />
          <NavIcon icon="fa-layer-group" active={activeTab === 'templates'} onClick={() => setActiveTab('templates')} label="Modelli" />
          <NavIcon icon="fa-folder-open" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} label="Progetti" />
          <div className="mt-auto border-t border-slate-800 w-full pt-6 flex flex-col items-center gap-4">
            <NavIcon icon="fa-cog" active={activeTab === 'api-config'} onClick={() => setActiveTab('api-config')} label="API" />
          </div>
        </nav>

        <aside className="w-64 md:w-80 bg-white border-r border-gray-200 overflow-y-auto no-print flex-shrink-0 shadow-lg z-10">
          <div className="p-6">
            {activeTab === 'api-config' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Configurazione API</h3>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${hasApiKey ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}></div>
                    <span className="text-xs font-bold text-slate-700 uppercase">
                      Stato: {hasApiKey ? 'Connesso' : 'Non Configurato'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed italic">
                    Per utilizzare le funzioni di intelligenza artificiale è necessario collegare una Chiave API Gemini da un progetto Google Cloud.
                  </p>
                  <button 
                    onClick={handleOpenApiKeySelector}
                    className="w-full bg-indigo-600 text-white text-[10px] font-bold uppercase py-3 rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition active:scale-95"
                  >
                    {hasApiKey ? 'Cambia Chiave API' : 'Seleziona Chiave API'}
                  </button>
                  <a 
                    href="https://ai.google.dev/gemini-api/docs/billing" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block text-center text-[9px] text-indigo-500 underline uppercase font-bold"
                  >
                    Guida alla Fatturazione
                  </a>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-8 animate-fadeIn">
                <section>
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Pagina & Formato</h3>
                  <div className="grid grid-cols-3 gap-2 mb-6">
                    {Object.values(PageFormat).map(f => (
                      <button
                        key={f}
                        onClick={() => setSettings(s => ({ ...s, format: f }))}
                        className={`px-3 py-2 rounded text-[10px] border font-bold transition ${settings.format === f ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Margini (mm)</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {['top', 'bottom', 'left', 'right'].map((m) => (
                      <div key={m}>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">{m}</label>
                        <input 
                          type="number" 
                          value={settings.margins[m as keyof typeof settings.margins]} 
                          onChange={e => setSettings(s => ({ ...s, margins: { ...s.margins, [m]: parseInt(e.target.value) || 0 } }))} 
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500/20" 
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Tipografia</h3>
                  <div className="space-y-5">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Carattere</label>
                      <select 
                        value={settings.fontFamily} 
                        onChange={e => setSettings(s => ({ ...s, fontFamily: e.target.value }))}
                        className="w-full border border-gray-200 rounded px-2 py-2 text-xs bg-gray-50 focus:bg-white transition outline-none"
                      >
                        {FONTS.map(font => (
                          <option key={font.name} value={font.value}>{font.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Testo (pt)</label>
                        <input type="number" value={settings.fontSizeBody} onChange={e => setSettings(s => ({ ...s, fontSizeBody: parseInt(e.target.value) }))} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-gray-50" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Titolo 1 (pt)</label>
                        <input type="number" value={settings.fontSizeH1} onChange={e => setSettings(s => ({ ...s, fontSizeH1: parseInt(e.target.value) }))} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-gray-50" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase flex justify-between mb-2">
                        <span>Interlinea</span>
                        <span className="text-indigo-600">{settings.lineHeight}</span>
                      </label>
                      <input type="range" min="1" max="3" step="0.05" value={settings.lineHeight} onChange={e => setSettings(s => ({ ...s, lineHeight: parseFloat(e.target.value) }))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'templates' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Modelli</h3>
                {PREDEFINED_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-indigo-500 hover:shadow-md transition bg-white group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                        <i className={`fas ${t.icon} text-lg`}></i>
                      </div>
                      <span className="font-bold text-gray-800 text-xs">{t.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Progetti Salvati</h3>
                {savedProjects.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic text-center py-10 uppercase">Vuoto</p>
                ) : (
                  savedProjects.map(p => (
                    <div
                      key={p.id}
                      onClick={() => loadProject(p)}
                      className="w-full text-left p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center justify-between group"
                    >
                      <div className="overflow-hidden">
                        <div className="font-bold text-gray-800 text-xs truncate">{p.name}</div>
                        <div className="text-[9px] text-gray-400 uppercase mt-1">
                          {new Date(p.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                      <button 
                        onClick={(e) => deleteProject(p.id, e)}
                        className="p-2 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                      >
                        <i className="fas fa-trash-alt text-[10px]"></i>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 overflow-auto p-8 md:p-12 flex justify-center items-start paper-container bg-gray-200/50 scroll-smooth">
          {isAiLoading && (
            <div className="fixed inset-0 z-[300] bg-white/60 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-indigo-100">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-center">
                  <p className="text-indigo-900 font-bold text-lg">AI al lavoro...</p>
                </div>
              </div>
            </div>
          )}

          <div 
            className="bg-white paper-shadow relative transition-all duration-300 transform origin-top print-page"
            style={{
              width,
              minHeight: height,
              fontFamily: settings.fontFamily,
              lineHeight: settings.lineHeight,
              padding: `${settings.margins.top}mm ${settings.margins.right}mm ${settings.margins.bottom}mm ${settings.margins.left}mm`,
              fontSize: `${settings.fontSizeBody}pt`
            }}
          >
            <div
              ref={editorRef}
              className="editor-content w-full h-full text-gray-800 outline-none"
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setContent(e.currentTarget.innerHTML)}
              dangerouslySetInnerHTML={{ __html: content }}
              style={{ textAlign: 'justify' as any }}
            />
            
            <style dangerouslySetInnerHTML={{ __html: `
              .editor-content p {
                margin-bottom: ${settings.paragraphSpacing}px !important;
                text-indent: ${settings.firstLineIndent}mm;
              }
              .editor-content h1 {
                font-size: ${settings.fontSizeH1}pt !important;
                margin-bottom: ${settings.paragraphSpacing * 2}px !important;
              }
              .editor-content h2 {
                font-size: ${settings.fontSizeH2}pt !important;
                margin-bottom: ${settings.paragraphSpacing}px !important;
              }
            `}} />
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 p-2 text-[10px] text-gray-400 flex justify-between px-6 no-print flex-shrink-0 font-bold uppercase tracking-tighter shadow-inner">
        <div className="flex gap-4">
          <span>FORMATO: <b className="text-indigo-600">{settings.format}</b></span>
          <span>CORPO: <b className="text-indigo-600">{settings.fontSizeBody}pt</b></span>
          <span className="flex items-center gap-1">
            API: <b className={hasApiKey ? 'text-green-600' : 'text-red-600'}>{hasApiKey ? 'OK' : 'MANCANTE'}</b>
          </span>
        </div>
      </footer>
    </div>
  );
};

const ToolbarButton: React.FC<{ icon: string; onClick: () => void; label?: string }> = ({ icon, onClick, label }) => (
  <button onClick={onClick} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-gray-600 transition active:scale-90" title={label || icon}>
    <i className={`fas fa-${icon} text-xs`}></i>
    {label && <span className="text-[10px] font-bold ml-0.5">{label}</span>}
  </button>
);

const NavIcon: React.FC<{ icon: string; active: boolean; onClick: () => void; label: string }> = ({ icon, active, onClick, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 group w-full ${active ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'} transition`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${active ? 'bg-gray-800 shadow-inner' : 'group-hover:bg-gray-800'}`}>
      <i className={`fas ${icon} text-lg`}></i>
    </div>
    <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
  </button>
);

const ExportOption: React.FC<{ icon: string; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition">
    <i className={`fas ${icon} w-4 text-center`}></i>
    {label}
  </button>
);

export default App;
