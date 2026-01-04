
import React, { useState, useRef, useEffect } from 'react';
import { PageFormat, PageSettings, FORMAT_DIMENSIONS, FONTS, PREDEFINED_TEMPLATES, SavedProject, DocumentTemplate, PageNumbering } from './types';
import { refineDocumentContent, generateFootnotes, extractTextFromImage, formatDocumentStructure } from './geminiService';

const App: React.FC = () => {
  const [settings, setSettings] = useState<PageSettings>(PREDEFINED_TEMPLATES[0].settings);
  const [content, setContent] = useState<string>(PREDEFINED_TEMPLATES[0].initialContent);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'templates' | 'projects'>('settings');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFastModeMenu, setShowFastModeMenu] = useState(false);
  
  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fastModeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('docustyle_projects');
    if (stored) {
      try {
        setSavedProjects(JSON.parse(stored));
      } catch (e) {
        console.error("Errore nel caricamento progetti", e);
      }
    }
  }, []);

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

  // Camera logic
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
        setIsAiLoading(true);
        
        const extractedText = await extractTextFromImage(base64, 'image/jpeg');
        const structured = await formatDocumentStructure(extractedText);
        setContent(prev => prev + structured);
        setIsAiLoading(false);
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

  const refineWithAi = async () => {
    setIsAiLoading(true);
    const result = await refineDocumentContent(content, "Rendi il testo più professionale e scorrevole seguendo regole di videoscrittura istituzionale");
    setContent(result);
    setIsAiLoading(false);
  };

  const autoLayoutAi = async () => {
    setIsAiLoading(true);
    const result = await formatDocumentStructure(content);
    setContent(result);
    setIsAiLoading(false);
  };

  const addAiFootnotes = async () => {
    setIsAiLoading(true);
    const footnotes = await generateFootnotes(content);
    const footnotesHtml = `
      <div class="ai-footnote no-print">
        <strong>Suggerimenti Professionali AI</strong>
        ${footnotes.split('\n').filter(f => f.trim()).map(f => `• ${f.trim()}`).join('<br/>')}
      </div>
    `;
    setContent(prev => prev + footnotesHtml);
    setIsAiLoading(false);
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

  const exportAsHtml = () => {
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: ${settings.fontFamily}; 
            line-height: ${settings.lineHeight}; 
            padding: ${settings.margins.top}mm ${settings.margins.right}mm ${settings.margins.bottom}mm ${settings.margins.left}mm;
            font-size: ${settings.fontSizeBody}pt;
            text-align: justify;
          }
          h1 { font-size: ${settings.fontSizeH1}pt; margin-bottom: 0.5em; }
          h2 { font-size: ${settings.fontSizeH2}pt; margin-bottom: 0.4em; }
          p { 
            margin-bottom: ${settings.paragraphSpacing}px; 
            text-indent: ${settings.firstLineIndent}mm;
          }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `;
    downloadFile(fullHtml, "documento.html", "text/html");
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

  const updatePageNumbering = (key: keyof PageNumbering, value: any) => {
    setSettings(s => ({
      ...s,
      pageNumbering: { ...s.pageNumbering, [key]: value }
    }));
  };

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
            <div className="absolute top-4 left-4 text-white text-xs font-bold uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full">
              Acquisizione Testo AI
            </div>
          </div>
          <p className="text-white/60 text-sm mt-4 italic">Inquadra il testo e scatta una foto per acquisirlo e impaginarlo</p>
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
            {/* Fast Mode Selector */}
            <div className="relative" ref={fastModeRef}>
              <button 
                onClick={() => setShowFastModeMenu(!showFastModeMenu)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition text-sm font-bold shadow-md active:scale-95"
              >
                <i className="fas fa-bolt text-yellow-400"></i>
                <span className="hidden md:inline">Modalità Veloce</span>
                <i className={`fas fa-chevron-down text-[10px] transition-transform ${showFastModeMenu ? 'rotate-180' : ''}`}></i>
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
                      <span className="text-[9px] text-gray-400 mt-0.5 pl-7">{t.description}</span>
                    </button>
                  ))}
                  <div className="p-3 bg-gray-50 mt-1 flex gap-2">
                    <i className="fas fa-info-circle text-indigo-400 text-xs mt-0.5"></i>
                    <p className="text-[10px] text-gray-500 italic">Applica istantaneamente i valori di margini, font e interlinea al testo corrente.</p>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={openCamera}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition text-sm font-semibold border border-green-100"
            >
              <i className="fas fa-camera"></i>
              <span className="hidden md:inline">Scansiona Foto</span>
            </button>

            <button 
              onClick={autoLayoutAi}
              disabled={isAiLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-md hover:from-indigo-700 hover:to-violet-700 transition disabled:opacity-50 text-sm font-bold shadow-lg shadow-indigo-100 flex items-center gap-2 active:scale-95"
            >
              <i className={`fas ${isAiLoading ? 'fa-spinner fa-spin' : 'fa-magic'}`}></i>
              <span>Auto-Layout AI</span>
            </button>
            
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition text-sm font-semibold border border-slate-200 shadow-sm"
            >
              <i className="fas fa-print"></i>
              <span className="hidden md:inline">Stampa</span>
            </button>

            <div className="relative" ref={exportMenuRef}>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition text-sm font-semibold shadow-sm"
              >
                <i className="fas fa-file-export"></i>
                <span className="hidden md:inline">Esporta</span>
                <i className={`fas fa-chevron-down text-[10px] transition-transform ${showExportMenu ? 'rotate-180' : ''}`}></i>
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-[100] py-1 animate-fadeIn">
                  <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-50 mb-1">Formati File</div>
                  <ExportOption icon="fa-file-pdf" label="Scarica PDF (via Stampa)" onClick={handlePrint} />
                  <ExportOption icon="fa-file-word" label="Microsoft Word (.doc)" onClick={exportAsDoc} />
                  <ExportOption icon="fa-file-alt" label="Testo Semplice (.txt)" onClick={exportAsTxt} />
                  <ExportOption icon="fa-code" label="Sorgente Web (.html)" onClick={exportAsHtml} />
                </div>
              )}
            </div>

            <button 
              onClick={saveCurrentProject}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 rounded-md hover:bg-indigo-50 transition text-sm font-semibold shadow-sm"
            >
              <i className="fas fa-save"></i>
              <span className="hidden md:inline">Salva</span>
            </button>
          </div>
        </div>

        <div className="bg-gray-50 border-b border-gray-200 p-2 overflow-x-auto flex justify-center">
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex bg-white rounded border border-gray-200 p-1 shadow-sm">
              <ToolbarButton icon="bold" onClick={() => formatDoc('bold')} />
              <ToolbarButton icon="italic" onClick={() => formatDoc('italic')} />
              <ToolbarButton icon="underline" onClick={() => formatDoc('underline')} />
            </div>
            <div className="flex bg-white rounded border border-gray-200 p-1 shadow-sm">
              <ToolbarButton icon="heading" onClick={() => formatDoc('formatBlock', 'h1')} label="1" />
              <ToolbarButton icon="heading" onClick={() => formatDoc('formatBlock', 'h2')} label="2" />
              <ToolbarButton icon="paragraph" onClick={() => formatDoc('formatBlock', 'p')} />
            </div>
            <div className="flex bg-white rounded border border-gray-200 p-1 shadow-sm">
              <ToolbarButton icon="align-left" onClick={() => formatDoc('justifyLeft')} />
              <ToolbarButton icon="align-center" onClick={() => formatDoc('justifyCenter')} />
              <ToolbarButton icon="align-justify" onClick={() => formatDoc('justifyFull')} />
            </div>
            <div className="flex bg-white rounded border border-gray-200 p-1 shadow-sm">
              <ToolbarButton icon="print" onClick={handlePrint} />
            </div>
            <button 
              onClick={refineWithAi}
              className="px-3 py-1 text-[10px] font-bold uppercase text-indigo-600 hover:bg-indigo-50 rounded transition flex items-center gap-1"
            >
              <i className="fas fa-wand-sparkles"></i> Perfeziona AI
            </button>
            <button onClick={addAiFootnotes} className="px-3 py-1 text-[10px] font-bold uppercase text-indigo-600 hover:bg-indigo-50 rounded transition">
              <i className="fas fa-plus mr-1"></i> Footnote AI
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden bg-gray-100">
        <nav className="w-16 md:w-20 bg-slate-900 flex flex-col items-center py-6 gap-6 no-print flex-shrink-0">
          <NavIcon icon="fa-sliders-h" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Layout" />
          <NavIcon icon="fa-layer-group" active={activeTab === 'templates'} onClick={() => setActiveTab('templates')} label="Modelli" />
          <NavIcon icon="fa-folder-open" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} label="Progetti" />
        </nav>

        <aside className="w-64 md:w-80 bg-white border-r border-gray-200 overflow-y-auto no-print flex-shrink-0 shadow-lg z-10">
          <div className="p-6">
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

                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Orientamento</h3>
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    <button
                      onClick={() => setSettings(s => ({ ...s, orientation: 'portrait' }))}
                      className={`px-3 py-2 rounded text-[10px] border font-bold transition flex flex-col items-center gap-1 ${settings.orientation === 'portrait' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <i className="fas fa-file-alt"></i>
                      Verticale
                    </button>
                    <button
                      onClick={() => setSettings(s => ({ ...s, orientation: 'landscape' }))}
                      className={`px-3 py-2 rounded text-[10px] border font-bold transition flex flex-col items-center gap-1 ${settings.orientation === 'landscape' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <i className="fas fa-file-alt rotate-90"></i>
                      Orizzontale
                    </button>
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
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Numerazione Pagine</h3>
                  <div className="bg-indigo-50 p-4 rounded-xl space-y-4 border border-indigo-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-900 uppercase">Abilita Numeri</label>
                      <button 
                        onClick={() => updatePageNumbering('enabled', !settings.pageNumbering.enabled)}
                        className={`w-10 h-5 rounded-full transition relative ${settings.pageNumbering.enabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.pageNumbering.enabled ? 'right-1' : 'left-1'}`}></div>
                      </button>
                    </div>
                    
                    {settings.pageNumbering.enabled && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-indigo-400 uppercase mb-1 block">Inizia da</label>
                            <input 
                              type="number" 
                              value={settings.pageNumbering.startPage} 
                              onChange={e => updatePageNumbering('startPage', parseInt(e.target.value))}
                              className="w-full border border-indigo-200 rounded px-2 py-1 text-xs outline-none" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-indigo-400 uppercase mb-1 block">Fine (opz.)</label>
                            <input 
                              type="number" 
                              placeholder="Fine"
                              value={settings.pageNumbering.endPage || ''} 
                              onChange={e => updatePageNumbering('endPage', e.target.value ? parseInt(e.target.value) : null)}
                              className="w-full border border-indigo-200 rounded px-2 py-1 text-xs outline-none" 
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-indigo-400 uppercase mb-1 block">Posizionamento</label>
                          <select 
                            value={settings.pageNumbering.position} 
                            onChange={e => updatePageNumbering('position', e.target.value)}
                            className="w-full border border-indigo-200 rounded px-2 py-1 text-[10px] font-bold uppercase outline-none"
                          >
                            <option value="top-left">In alto a SX</option>
                            <option value="top-center">In alto al centro</option>
                            <option value="top-right">In alto a DX</option>
                            <option value="bottom-left">In basso a SX</option>
                            <option value="bottom-center">In basso al centro</option>
                            <option value="bottom-right">In basso a DX</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Tipografia Professionale</h3>
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

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase flex justify-between mb-2">
                        <span>Rientro prima riga (mm)</span>
                        <span className="text-indigo-600">{settings.firstLineIndent}mm</span>
                      </label>
                      <input type="range" min="0" max="30" step="0.5" value={settings.firstLineIndent} onChange={e => setSettings(s => ({ ...s, firstLineIndent: parseFloat(e.target.value) }))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase flex justify-between mb-2">
                        <span>Spazio dopo paragrafi (px)</span>
                        <span className="text-indigo-600">{settings.paragraphSpacing}px</span>
                      </label>
                      <input type="range" min="0" max="40" step="1" value={settings.paragraphSpacing} onChange={e => setSettings(s => ({ ...s, paragraphSpacing: parseInt(e.target.value) }))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'templates' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Modelli di Documento</h3>
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
                    <p className="text-[10px] text-gray-500 leading-relaxed italic">{t.description}</p>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Archivio Personale</h3>
                {savedProjects.length === 0 ? (
                  <div className="text-center py-12">
                    <i className="fas fa-folder-open text-3xl text-gray-200 mb-2"></i>
                    <p className="text-[10px] text-gray-400 italic uppercase">Nessun progetto</p>
                  </div>
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
                          {new Date(p.timestamp).toLocaleDateString()} • {p.settings.format}
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
          {/* Loading Overlay */}
          {isAiLoading && (
            <div className="fixed inset-0 z-[300] bg-white/60 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-indigo-100">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-center">
                  <p className="text-indigo-900 font-bold text-lg">Impaginazione Intelligente</p>
                  <p className="text-indigo-400 text-xs animate-pulse">Gemini sta analizzando la struttura del testo...</p>
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
            {/* Page Number Placeholder */}
            {settings.pageNumbering.enabled && (
              <div className="absolute top-2 right-2 no-print text-[9px] text-indigo-300 font-bold uppercase tracking-widest border border-indigo-100 px-2 py-0.5 rounded">
                Numerazione Attiva
              </div>
            )}

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
                text-indent: 0 !important;
              }
              .editor-content h2 {
                font-size: ${settings.fontSizeH2}pt !important;
                margin-bottom: ${settings.paragraphSpacing}px !important;
                text-indent: 0 !important;
              }
              .editor-content p:has(br) { text-indent: 0 !important; }
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(5px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .animate-fadeIn { animation: fadeIn 0.3s ease-out; }

              @media print {
                @page {
                  size: ${settings.format} ${settings.orientation};
                  margin: 0;
                }
                
                body { 
                  counter-reset: page ${settings.pageNumbering.startPage - 1};
                }

                .print-page {
                  position: relative;
                  width: ${width} !important;
                  height: auto !important;
                  min-height: ${height} !important;
                  box-shadow: none !important;
                  padding: ${settings.margins.top}mm ${settings.margins.right}mm ${settings.margins.bottom}mm ${settings.margins.left}mm !important;
                  overflow: visible !important;
                }

                ${settings.pageNumbering.enabled ? `
                .print-page::after {
                  content: "Pagina " counter(page);
                  counter-increment: page;
                  position: fixed;
                  font-size: 10pt;
                  color: #666;
                  pointer-events: none;
                  
                  ${settings.pageNumbering.position.includes('top') ? 'top: 15mm;' : 'bottom: 15mm;'}
                  ${settings.pageNumbering.position.includes('left') ? 'left: 20mm;' : settings.pageNumbering.position.includes('right') ? 'right: 20mm;' : 'left: 50%; transform: translateX(-50%);'}
                }
                ` : ''}
              }
            `}} />
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 p-2 text-[10px] text-gray-400 flex justify-between px-6 no-print flex-shrink-0 font-bold uppercase tracking-tighter shadow-inner">
        <div className="flex gap-4">
          <span>FORMATO: <b className="text-indigo-600">{settings.format} ({settings.orientation})</b></span>
          <span>INTERLINEA: <b className="text-indigo-600">{settings.lineHeight}</b></span>
          <span>CORPO: <b className="text-indigo-600">{settings.fontSizeBody}pt</b></span>
          {settings.pageNumbering.enabled && <span>PAGINE: <b className="text-indigo-600">ATTIVO ({settings.pageNumbering.startPage}+)</b></span>}
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><i className="fas fa-magic text-violet-500"></i> Auto-Layout Attivo</span>
          <span className="flex items-center gap-1"><i className="fas fa-print text-indigo-500"></i> Stampa Pronta</span>
        </div>
      </footer>
    </div>
  );
};

const ToolbarButton: React.FC<{ icon: string; onClick: () => void; label?: string }> = ({ icon, onClick, label }) => (
  <button onClick={onClick} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-gray-600 transition active:scale-90">
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
