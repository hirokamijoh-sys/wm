/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Shield, 
  Download, 
  Type, 
  Settings, 
  CheckCircle2, 
  AlertCircle,
  X,
  Layers,
  Eye,
  EyeOff,
  RefreshCw,
  Lock,
  Scale,
  FileText,
  Check
} from 'lucide-react';
import { cn } from './lib/utils';
import confetti from 'canvas-confetti';

interface WatermarkSettings {
  opacity: number;
  size: number;
  rotation: number;
  color: string;
  position: 'center' | 'tile' | 'bottom-right' | 'bottom-left';
  addNoAiTag: boolean;
}

const TAG_OPTIONS = [
  { id: 'no-ai', label: 'AI学習禁止', text: '© DO NOT TRAIN / AI学習禁止' },
  { id: 'no-repost', label: '無断転載禁止', text: '© NO REPOST / 無断転載禁止' },
  { id: 'arbitration', label: '裁定制度対策', text: '著作権法第67条（裁定制度）に基づく利用は承諾しません。\n利用をご希望の際は、必ず事前にご連絡ください。' },
];

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [customText, setCustomText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const [settings, setSettings] = useState<WatermarkSettings>({
    opacity: 0.5,
    size: 40,
    rotation: 0,
    color: '#000000',
    position: 'tile',
    addNoAiTag: false
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive final text parts from tags and custom input
  const getFinalTextParts = () => {
    const activeTags = TAG_OPTIONS.filter(tag => selectedTags.includes(tag.id)).map(tag => tag.text);
    const parts = [...activeTags];
    if (customText.trim()) parts.push(customText.trim());
    
    // Split any parts that contain literal newlines
    return parts.flatMap(p => p.split('\n'));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target?.result as string);
      setShowPreview(false); // Start with original image as suggested by user
    };
    reader.readAsDataURL(file);
  };

  const drawWatermark = () => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    // Use crossOrigin only for non-data URLs to avoid issues with local files
    if (!image.startsWith('data:')) {
      img.crossOrigin = "anonymous";
    }
    
    img.onload = () => {
      // Use a small timeout to ensure the DOM is fully ready and the canvas is mounted
      setTimeout(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        
        // Set dimensions (this also resets the context state)
        canvas.width = img.width;
        canvas.height = img.height;

        // Ensure context state is clean
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.filter = 'none';
        ctx.globalCompositeOperation = 'source-over';

        // Draw the base image
        ctx.drawImage(img, 0, 0);

        const textParts = getFinalTextParts();
        
        if (textParts.length > 0) {
          // Set styles for watermark
          ctx.globalAlpha = settings.opacity;
          ctx.fillStyle = settings.color;
          
          const fontSize = (settings.size / 1000) * canvas.width;
          const lineHeight = fontSize * 1.6; 
          ctx.font = `bold ${fontSize}px "Inter", "Hiragino Sans", sans-serif`;
          ctx.textBaseline = 'middle';

          // Add text shadow for better contrast on varied backgrounds
          ctx.shadowColor = settings.color === '#ffffff' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)';
          ctx.shadowBlur = fontSize / 3;

          const drawTextBlock = (x: number, y: number, align: CanvasTextAlign = 'center') => {
            ctx.save();
            ctx.textAlign = align;
            ctx.translate(x, y);
            ctx.rotate((settings.rotation * Math.PI) / 180);
            
            textParts.forEach((line, index) => {
              const offset = (index - (textParts.length - 1) / 2) * lineHeight;
              ctx.fillText(line, 0, offset);
            });
            
            ctx.restore();
          };

          if (settings.position === 'center') {
            drawTextBlock(canvas.width / 2, canvas.height / 2);
          } else if (settings.position === 'bottom-right') {
            const padding = canvas.width * 0.05;
            ctx.save();
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.translate(canvas.width - padding, canvas.height - padding);
            ctx.rotate((Math.min(0, settings.rotation) * Math.PI) / 180); 
            
            textParts.forEach((line, index) => {
              const offset = (textParts.length - 1 - index) * lineHeight;
              ctx.fillText(line, 0, -offset);
            });
            ctx.restore();
          } else if (settings.position === 'bottom-left') {
            const padding = canvas.width * 0.05;
            ctx.save();
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.translate(padding, canvas.height - padding);
            ctx.rotate((Math.max(0, settings.rotation) * Math.PI) / 180); 
            
            textParts.forEach((line, index) => {
              const offset = (textParts.length - 1 - index) * lineHeight;
              ctx.fillText(line, 0, -offset);
            });
            ctx.restore();
          } else if (settings.position === 'tile') {
            // Measure text to calculate safe spacing
            const metrics = textParts.map(line => ctx.measureText(line));
            const maxWidth = Math.max(...metrics.map(m => m.width), 100);
            const totalHeight = textParts.length * lineHeight;
            
            // More compact spacing to prevent overlap but not be too sparse
            const stepX = Math.max(canvas.width * 0.3, maxWidth * 1.3);
            const stepY = Math.max(canvas.height * 0.3, totalHeight * 2.0);
            
            for (let x = stepX / 4; x < canvas.width + stepX; x += stepX) {
              for (let y = stepY / 4; y < canvas.height + stepY; y += stepY) {
                drawTextBlock(x, y);
              }
            }
          }
        }

        if (settings.addNoAiTag) {
          ctx.globalAlpha = 0.015;
          for (let i = 0; i < 300; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#000' : '#fff';
            ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
          }
        }
      }, 50);
    };
    
    img.onerror = () => {
      console.error("Failed to load image for canvas");
    };
    
    img.src = image;
  };

  React.useLayoutEffect(() => {
    if (image) {
      drawWatermark();
    }
  }, [image, settings, selectedTags, customText, showPreview]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    
    setIsProcessing(true);
    setTimeout(() => {
      const link = document.createElement('a');
      link.download = `protected_${fileName}`;
      link.href = canvasRef.current!.toDataURL('image/png');
      link.click();
      setIsProcessing(false);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0ea5e9', '#6366f1', '#a855f7']
      });
    }, 800);
  };

  const toggleTag = (id: string) => {
    setSelectedTags(prev => {
      const isSelecting = !prev.includes(id);
      if (isSelecting) setShowPreview(true);
      
      // If selecting 'no-ai', also enable the invisible protection
      if (id === 'no-ai' && isSelecting) {
        setSettings(s => ({ ...s, addNoAiTag: true }));
      }
      
      return isSelecting ? [...prev, id] : prev.filter(t => t !== id);
    });
  };

  const reset = () => {
    setImage(null);
    setFileName('');
    setCustomText('');
    setSelectedTags([]);
    setSettings(prev => ({ ...prev, addNoAiTag: false }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const forceRedraw = () => {
    if (image) {
      drawWatermark();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between glass sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-600/20">
            <Shield className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight gradient-text">CreatorShield</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">AI & Copyright Protection</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {image && (
            <button
              onClick={handleDownload}
              disabled={isProcessing}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 text-sm"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>保存</span>
            </button>
          )}
        </div>
      </header>

      <main className={cn(
        "flex-1 overflow-y-auto lg:overflow-hidden bg-slate-50/30",
        image && "grid grid-cols-1 lg:grid-cols-[1fr_384px]"
      )}>
        {/* Canvas Area */}
        <section className={cn(
          "flex flex-col items-center relative order-1",
          !image ? "justify-center p-6 md:p-12 min-h-[60vh]" : "p-6 md:p-8"
        )}>
          <AnimatePresence mode="wait">
            {!image ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-2xl"
              >
                <label className="group relative block w-full aspect-video rounded-[2.5rem] border-2 border-dashed border-slate-200 hover:border-sky-400 bg-white hover:bg-sky-50/30 transition-all cursor-pointer overflow-hidden card-shadow">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-sky-600 group-hover:text-white transition-all duration-500 text-sky-600 shadow-sm">
                      <Upload className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">Protect your artwork</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto font-medium leading-relaxed">
                      画像をドラッグ＆ドロップ、またはクリックして選択してください。
                    </p>
                  </div>
                </label>
                
                <div className="mt-8 grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-2 text-sky-600 border border-slate-100">
                      <Lock className="w-6 h-6" />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Local Only</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-2 text-indigo-600 border border-slate-100">
                      <Scale className="w-6 h-6" />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Legal Ready</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-2 text-emerald-600 border border-slate-100">
                      <Shield className="w-6 h-6" />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">AI Protected</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-5xl flex flex-col items-center justify-start gap-4"
              >
                <div className="relative group w-full flex items-center justify-center">
                  <div className="relative w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200 border border-slate-200 bg-white p-3 flex items-center justify-center min-h-[400px]">
                    {/* Preview Badge */}
                    <div className="absolute top-6 left-6 z-10 flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-full shadow-sm border border-slate-100 pointer-events-none">
                      <div className={cn("w-2 h-2 rounded-full animate-pulse", showPreview ? "bg-sky-500" : "bg-slate-400")} />
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                        {showPreview ? "Live Preview" : "Original Image"}
                      </span>
                    </div>

                    <canvas
                      ref={canvasRef}
                      className={cn(
                        "w-full h-auto max-h-[85vh] object-contain rounded-2xl transition-opacity duration-300 border border-slate-100 bg-slate-50/50",
                        !showPreview && "opacity-0"
                      )}
                    />
                    {!showPreview && (
                      <div className="absolute inset-2 flex items-center justify-center bg-slate-50 rounded-2xl">
                        <img src={image} className="w-full h-full object-contain rounded-2xl" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    
                    <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                      <button
                        onClick={forceRedraw}
                        className="p-3 bg-white/90 backdrop-blur-md rounded-xl text-sky-600 shadow-xl hover:bg-white transition-all border border-slate-200"
                        title="再描画"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="p-3 bg-white/90 backdrop-blur-md rounded-xl text-slate-700 shadow-xl hover:bg-white transition-all border border-slate-200"
                        title={showPreview ? "Show Original" : "Show Protected"}
                      >
                        {showPreview ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={reset}
                        className="p-3 bg-white/90 backdrop-blur-md rounded-xl text-red-500 shadow-xl hover:bg-red-50 transition-all border border-slate-200"
                        title="Remove Image"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <p className="text-[13px] text-slate-400 font-bold flex items-center gap-2 tracking-widest">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    画像はブラウザ内で処理されます • サーバーへは送信されません
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Sidebar Controls */}
        <AnimatePresence>
          {image && (
            <motion.aside 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="w-full lg:w-96 lg:border-l border-slate-100 p-8 overflow-y-auto bg-white lg:bg-slate-50/30 order-2 lg:row-span-2"
            >
              <div className="space-y-10">
                <section>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <Type className="w-4 h-4" /> Watermark Content
                  </h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Presets (Multiple Select)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {TAG_OPTIONS.map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            className={cn(
                              "flex items-center justify-between px-4 py-3 text-[11px] font-bold rounded-xl border transition-all shadow-sm text-left min-h-[56px]",
                              selectedTags.includes(tag.id)
                                ? "bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-100"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                            )}
                          >
                            <span>{tag.label}</span>
                            {selectedTags.includes(tag.id) && <Check className="w-4 h-4 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">著作権者明示</label>
                      <input
                        type="text"
                        value={customText}
                        onChange={(e) => {
                          setCustomText(e.target.value);
                          if (e.target.value.trim() !== '') setShowPreview(true);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all shadow-sm"
                        placeholder="著作権者名等"
                      />
                    </div>
                  </div>
                </section>

                <section className="pt-8 border-t border-slate-100">
                  <div className="p-5 bg-sky-50 rounded-[2rem] border border-sky-100 shadow-sm">
                    <label className="flex items-center gap-4 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={settings.addNoAiTag}
                          onChange={(e) => {
                            setSettings({ ...settings, addNoAiTag: e.target.checked });
                            if (e.target.checked) setShowPreview(true);
                          }}
                          className="sr-only"
                        />
                        <div className={cn(
                          "w-12 h-6 rounded-full transition-colors",
                          settings.addNoAiTag ? "bg-sky-600" : "bg-slate-300"
                        )} />
                        <div className={cn(
                          "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                          settings.addNoAiTag ? "translate-x-6" : "translate-x-0"
                        )} />
                      </div>
                      <span className="text-sm font-bold text-sky-900">
                        AI-Resistant Processing
                      </span>
                    </label>
                    <p className="mt-3 text-[11px] text-sky-700/70 leading-relaxed font-medium">
                      画像に微細なノイズを混入させ、AIによる特徴抽出を困難にします。また、メタデータに学習拒否タグを付与する準備を行います。
                    </p>
                  </div>
                </section>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Appearance & Position Controls (Order 3 - below sidebar on mobile, below canvas on desktop) */}
        <AnimatePresence>
          {image && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="order-3 p-6 md:p-8 bg-slate-50/50"
            >
              <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 pb-12">
                <section className="space-y-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Appearance
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-3">
                        <label className="text-xs font-bold text-slate-600">Opacity</label>
                        <span className="text-xs text-sky-600 font-mono font-bold">{Math.round(settings.opacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={settings.opacity}
                        onChange={(e) => setSettings({ ...settings, opacity: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-3">
                        <label className="text-xs font-bold text-slate-600">Size</label>
                        <span className="text-xs text-sky-600 font-mono font-bold">{settings.size}px</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="200"
                        value={settings.size}
                        onChange={(e) => setSettings({ ...settings, size: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-3">Color</label>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => setSettings({...settings, color: '#000000'})}
                            className={cn("w-8 h-8 rounded-full bg-black border-2 transition-all", settings.color === '#000000' ? "border-sky-500 scale-110" : "border-transparent")}
                          />
                          <button 
                            onClick={() => setSettings({...settings, color: '#ffffff'})}
                            className={cn("w-8 h-8 rounded-full bg-white border-2 transition-all", settings.color === '#ffffff' ? "border-sky-500 scale-110" : "border-slate-200")}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-3">Rotation</label>
                        <input
                          type="number"
                          value={settings.rotation}
                          onChange={(e) => setSettings({ ...settings, rotation: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-sky-500 shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <Layers className="w-4 h-4" /> Position
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    {(['tile', 'center', 'bottom-right', 'bottom-left'] as const).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => setSettings({ ...settings, position: pos })}
                        className={cn(
                          "px-2 py-3 rounded-xl text-[10px] font-bold border transition-all shadow-sm",
                          settings.position === pos 
                            ? "bg-sky-600 text-white border-sky-600" 
                            : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                        )}
                      >
                        {pos.replace('-', ' ').toUpperCase()}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <footer className="bg-white border-t border-slate-100 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center text-white shadow-md">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-lg font-black text-slate-900 tracking-tighter">CreatorShield</span>
          </div>
          
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setShowPolicy(true)}
              className="text-xs font-bold text-slate-400 hover:text-sky-600 transition-colors uppercase tracking-widest"
            >
              Privacy Policy
            </button>
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              © 2024 CreatorShield
            </p>
          </div>
        </div>
      </footer>

      {/* Privacy Policy Modal */}
      <AnimatePresence>
        {showPolicy && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPolicy(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-10 md:p-14">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-sky-100 rounded-2xl flex items-center justify-center text-sky-600 shadow-sm">
                      <FileText className="w-7 h-7" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Privacy & Protection Policy</h2>
                  </div>
                  <button 
                    onClick={() => setShowPolicy(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-7 h-7 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-8 text-slate-600 leading-relaxed overflow-y-auto max-h-[55vh] pr-6 custom-scrollbar">
                  <section>
                    <h3 className="text-base font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-3">
                      <Lock className="w-5 h-5 text-sky-500" /> 1. ローカル処理の保証
                    </h3>
                    <p className="text-sm font-medium">
                      本ツールで選択された画像は、すべてお客様のブラウザ内（デバイス上）で処理されます。画像データが外部サーバーに送信されたり、AIの学習データとして収集されることは一切ありません。
                    </p>
                  </section>

                  <section>
                    <h3 className="text-base font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-3">
                      <Shield className="w-5 h-5 text-indigo-500" /> 2. AI学習への対策
                    </h3>
                    <p className="text-sm font-medium">
                      「AI-Resistant Processing」機能は、画像に不可視に近いノイズを付与することで、AIによる特徴抽出の精度を下げ、無断学習の質を低下させることを目的としています。
                    </p>
                  </section>

                  <section>
                    <h3 className="text-base font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-3">
                      <Scale className="w-5 h-5 text-emerald-500" /> 3. 著作権法と裁定制度への対応
                    </h3>
                    <p className="text-sm font-medium">
                      著作権法第67条（裁定制度）において、「権利者不明」とみなされることを防ぐため、画像内に明確な権利者情報を記載することを推奨しています。本ツールは、法的保護を受けるための意思表示（裁定制度対策）を支援します。
                    </p>
                  </section>

                  <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <p className="text-xs font-bold text-slate-500 italic leading-relaxed">
                      ※本ツールは技術的・視覚的な保護を目的としており、法的な完全性を保証するものではありません。重要な作品の保護については、専門家への相談を併せてご検討ください。
                    </p>
                  </div>
                </div>

                <div className="mt-12">
                  <button 
                    onClick={() => setShowPolicy(false)}
                    className="w-full py-5 bg-slate-900 text-white text-lg font-bold rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-[0.98]"
                  >
                    了解しました
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SEO & Info Section */}
      <section className="px-8 py-16 bg-slate-50/30 border-t border-slate-100">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-sky-600" /> AI学習から作品を守る
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              CreatorShieldは、イラストレーターや写真家の大切な作品を無断AI学習から守るための無料ツールです。画像に「AI学習禁止」や「無断転載禁止」の透かし（ウォーターマーク）を簡単に入れることができます。
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" /> プライバシーと安全性
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              アップロードされた画像はすべてブラウザ内で処理され、サーバーに送信されることはありません。オフラインでも動作し、あなたのプライバシーを完全に保護します。
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-600" /> 著作権法への対応
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              著作権法第67条（裁定制度）における「権利者不明」扱いを防ぐため、明確な権利者情報を画像に埋め込むことが重要です。CreatorShieldは、法的な意思表示を強力にサポートします。
            </p>
          </div>
        </div>

        {/* AdSense Placeholder (Moved to bottom for better UX) */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="w-full h-32 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col items-center justify-center p-6 text-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                <span className="text-[8px] font-bold text-slate-400">AD</span>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Advertisement</p>
                <p className="text-[10px] text-slate-400">ここにGoogle AdSenseの広告が表示されます。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-8 border-t border-slate-100 flex flex-col items-center gap-6 text-[11px] text-slate-400 font-bold tracking-widest">
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> SYSTEM SECURE</span>
          <span>ENGINE: CANVAS_V3.0_LIGHT</span>
          <button onClick={() => setShowPolicy(true)} className="hover:text-sky-600 transition-colors">PRIVACY & TERMS</button>
          <span>© 2026 CREATORSHIELD SUITE</span>
        </div>
      </footer>
    </div>
  );
}
