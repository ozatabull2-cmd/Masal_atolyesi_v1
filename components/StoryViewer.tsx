
import React, { useState, useRef, useEffect } from 'react';
import { StoryData } from '../types';
import { ArrowLeft, ArrowRight, RefreshCcw, BookOpen, Download, Volume2, VolumeX, Loader2, Play, Pause, Instagram, RotateCcw, Star, MessageSquare, Music } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { decodeAudioData, decodeBase64, audioBufferToWav } from '../services/geminiService';

interface StoryViewerProps {
  story: StoryData;
  onReset: () => void;
}

const StoryViewer: React.FC<StoryViewerProps> = ({ story, onReset }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isDownloadingAudio, setIsDownloadingAudio] = useState(false);
  
  // Feedback State
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const totalPages = story.pages.length + 1; // Cover + Story Pages

  // Audio Context Ref
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Touch handling for swipe
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
        handleNext();
    } else if (isRightSwipe) {
        handlePrev();
    }
  };

  // Initialize Audio Context on Mount/User Interaction
  useEffect(() => {
    const initAudio = () => {
         if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        }
    };
    // We try to init immediately, but it might be suspended until interaction
    initAudio();
    
    // If suspended, resume on first click
    const resumeAudio = async () => {
        if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
        }
    };
    window.addEventListener('click', resumeAudio, { once: true });
    window.addEventListener('touchstart', resumeAudio, { once: true });

    return () => {
        stopAudio();
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
    };
  }, []);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch(e) { /* ignore */ }
      audioSourceRef.current = null;
    }
    setIsAudioPlaying(false);
  };

  const playAudio = async (base64Data: string | undefined) => {
    stopAudio(); // Ensure previous audio is stopped
    
    if (!base64Data) return;

    setAudioLoading(true);
    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        }
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        const buffer = await decodeAudioData(
          decodeBase64(base64Data),
          audioContextRef.current,
          24000,
          1
        );
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsAudioPlaying(false);
        
        audioSourceRef.current = source;
        source.start(0);
        setIsAudioPlaying(true);
    } catch (error) {
        console.error("Failed to play audio", error);
    } finally {
        setAudioLoading(false);
    }
  };

  const toggleAudio = () => {
      if (isAudioPlaying) {
          stopAudio();
      } else {
          // Re-play current page audio
          if (currentPage > 0 && currentPage <= story.pages.length) {
             const pageData = story.pages[currentPage - 1];
             if (pageData.audioBase64) {
                 playAudio(pageData.audioBase64);
             }
          }
      }
  };

  // Auto-play effect when changing pages
  useEffect(() => {
    stopAudio(); // Stop previous page audio immediately

    if (currentPage > 0 && currentPage <= story.pages.length) {
        const pageData = story.pages[currentPage - 1];
        if (pageData.audioBase64) {
            // Small delay to ensure transition feels smooth and context is ready
            const timer = setTimeout(() => {
                playAudio(pageData.audioBase64);
            }, 500);
            return () => clearTimeout(timer);
        }
    }
  }, [currentPage, story.pages]);


  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(c => c + 1);
  };

  const handlePrev = () => {
    if (currentPage > 0) setCurrentPage(c => c - 1);
  };

  const handleRestart = () => {
    setCurrentPage(0);
  }

  const handleFeedbackSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setFeedbackSent(true);
      // In a real app, you would send this data to a backend
      console.log({ rating, comment });
  }

  // PDF Generation Helper
  const downloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        // Turkish char map for basic ASCII support in default PDF fonts
        const normalizeText = (str: string) => {
            return str.replace(/ğ/g, "g").replace(/Ğ/g, "G")
                      .replace(/ü/g, "u").replace(/Ü/g, "U")
                      .replace(/ş/g, "s").replace(/Ş/g, "S")
                      .replace(/ı/g, "i").replace(/İ/g, "I")
                      .replace(/ö/g, "o").replace(/Ö/g, "O")
                      .replace(/ç/g, "c").replace(/Ç/g, "C");
        };

        // Cover Page
        if (story.coverImageUrl) {
            doc.addImage(story.coverImageUrl, 'PNG', 20, 40, 170, 170);
        }
        doc.setFontSize(24);
        doc.text(normalizeText(story.title), 105, 230, { align: 'center', maxWidth: 170 });
        doc.setFontSize(12);
        doc.text(normalizeText(story.summary), 105, 250, { align: 'center', maxWidth: 150 });
        
        // Story Pages
        story.pages.forEach((page, index) => {
            doc.addPage();
            // Image
            if (page.imageUrl) {
                doc.addImage(page.imageUrl, 'PNG', 20, 20, 170, 150);
            }
            
            // Text (Bottom half)
            doc.setFontSize(14);
            const splitText = doc.splitTextToSize(normalizeText(page.text), 170);
            doc.text(splitText, 20, 190);
            
            // Footer
            doc.setFontSize(10);
            doc.text(`Sayfa ${page.pageNumber}`, 105, 280, { align: 'center' });
        });

        doc.save(`${story.title.replace(/\s+/g, '_')}_Masal.pdf`);

    } catch (e) {
        console.error("PDF Error", e);
        alert("PDF oluşturulurken bir hata oluştu.");
    } finally {
        setIsGeneratingPDF(false);
    }
  };

  // Audio Download Helper
  const downloadAudio = async () => {
    setIsDownloadingAudio(true);
    try {
      // Use a temporary context or logic, but for now reverting to simple implementation
      // NOTE: This simple implementation might interrupt playback as it uses CPU resources,
      // but we are reverting to the "previous version" state.
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});

      // 1. Collect and decode all audio chunks
      const audioBuffers: AudioBuffer[] = [];
      for (const page of story.pages) {
        if (page.audioBase64) {
          const buffer = await decodeAudioData(
            decodeBase64(page.audioBase64),
            ctx,
            24000,
            1
          );
          audioBuffers.push(buffer);
        }
      }

      if (audioBuffers.length === 0) {
        alert("İndirilecek ses bulunamadı.");
        return;
      }

      // 2. Calculate total length
      const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.length, 0);
      
      // 3. Create merged buffer
      const mergedBuffer = ctx.createBuffer(
        1, 
        totalLength, 
        audioBuffers[0].sampleRate
      );
      const channelData = mergedBuffer.getChannelData(0);

      let offset = 0;
      for (const buf of audioBuffers) {
        channelData.set(buf.getChannelData(0), offset);
        offset += buf.length;
      }

      // 4. Convert to WAV Blob
      const wavBlob = audioBufferToWav(mergedBuffer);

      // 5. Trigger Download
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${story.title.replace(/\s+/g, '_')}_Sesli_Masal.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      ctx.close();

    } catch (e) {
      console.error("Audio Download Error", e);
      alert("Ses dosyası oluşturulurken bir hata oluştu.");
    } finally {
      setIsDownloadingAudio(false);
    }
  };

  // Reusable Watermark Component
  const Watermark = () => (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30 flex items-center gap-1.5 pointer-events-none select-none opacity-90">
        <Instagram className="w-4 h-4 text-white drop-shadow-md" strokeWidth={2.5} />
        <span className="text-xs sm:text-sm font-bold text-white drop-shadow-md font-sans tracking-wider">
        @ankaracocuketkinlikler
        </span>
    </div>
  );

  // Render Cover
  if (currentPage === 0) {
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-[600px] animate-fade-in w-full"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      >
        <div className="relative w-full max-w-md aspect-[3/4] bg-gradient-to-br from-indigo-600 to-purple-700 rounded-r-3xl rounded-l-lg shadow-2xl border-l-8 border-indigo-900 flex flex-col items-center justify-start pt-8 text-center text-white transform transition hover:scale-[1.01] overflow-hidden">
           
           {/* Cover Image Background or Embedded */}
           {story.coverImageUrl && (
               <div className="absolute inset-0 opacity-40 pointer-events-none">
                   <img src={story.coverImageUrl} className="w-full h-full object-cover" alt="Cover Background" />
                   <div className="absolute inset-0 bg-gradient-to-t from-indigo-900 via-indigo-900/60 to-transparent"></div>
               </div>
           )}

           <div className="relative z-10 px-6 w-full h-full flex flex-col items-center justify-center">
                <BookOpen className="w-12 h-12 text-yellow-300 mx-auto mb-4 drop-shadow-lg" />
                <h1 className="text-4xl md:text-5xl font-bold handwritten leading-tight text-yellow-100 mb-4 drop-shadow-md">
                {story.title}
                </h1>
                <div className="w-24 h-1 bg-yellow-400/80 mx-auto rounded-full mb-6"></div>

                <p className="text-indigo-100 text-lg italic font-medium px-2 drop-shadow-sm mb-8">
                "{story.summary}"
                </p>
                
                {story.coverImageUrl && (
                    <div className="w-32 h-32 rounded-full border-4 border-white/30 shadow-lg overflow-hidden mb-8">
                        <img src={story.coverImageUrl} className="w-full h-full object-cover" alt="Cover Circle" />
                    </div>
                )}

                <div className="mt-auto mb-12 text-sm font-bold text-yellow-200/80 uppercase tracking-widest">
                Özel Basım Masal Kitabı
                </div>
           </div>

           {/* Watermark on Cover */}
           <Watermark />

           {/* Book Texture Overlay */}
           <div className="absolute inset-0 bg-black opacity-10 pointer-events-none rounded-r-3xl rounded-l-lg z-20"></div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl px-4">
             <button 
                onClick={handleNext}
                className="col-span-1 sm:col-span-2 bg-white text-indigo-600 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-50 transition flex items-center justify-center gap-2"
              >
                Kitabı Aç <ArrowRight className="w-5 h-5" />
              </button>

              <button 
                onClick={downloadPDF}
                disabled={isGeneratingPDF}
                className="bg-indigo-500 border border-indigo-400 text-white px-4 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-600 transition flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {isGeneratingPDF ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                PDF İndir
              </button>
              
              <button 
                onClick={downloadAudio}
                disabled={isDownloadingAudio}
                className="bg-pink-500 border border-pink-400 text-white px-4 py-3 rounded-full font-bold shadow-lg hover:bg-pink-600 transition flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {isDownloadingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Music className="w-5 h-5" />}
                Ses İndir
              </button>

              <button 
                onClick={onReset}
                className="col-span-1 sm:col-span-2 bg-yellow-400 text-indigo-900 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-yellow-300 transition flex items-center justify-center gap-2"
              >
                <RefreshCcw className="w-5 h-5" /> Yeni Masal Yaz
              </button>
        </div>
      </div>
    );
  }

  // Render Back Cover
  if (currentPage === totalPages) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[600px] animate-fade-in w-full"
             onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
          <div className="relative w-full max-w-md min-h-[500px] bg-indigo-900 rounded-l-3xl rounded-r-lg shadow-2xl border-r-8 border-indigo-950 flex flex-col items-center justify-center p-8 text-center text-white overflow-hidden">
            <h2 className="text-3xl font-bold handwritten mb-2 text-yellow-100">SON</h2>
            <p className="text-indigo-200 mb-6">Okuduğunuz için teşekkürler!</p>
            
            <div className="space-y-4 w-full px-4 relative z-10 mb-8">
                {/* Feedback Form */}
                {!feedbackSent ? (
                    <form onSubmit={handleFeedbackSubmit} className="bg-white/10 backdrop-blur-sm p-4 rounded-xl mb-4 border border-white/20">
                        <h3 className="text-sm font-bold text-indigo-100 mb-2 flex items-center justify-center gap-2">
                            <MessageSquare className="w-4 h-4" /> Masalı beğendiniz mi?
                        </h3>
                        <div className="flex justify-center gap-2 mb-3">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <button 
                                    key={s} 
                                    type="button" 
                                    onClick={() => setRating(s)}
                                    className="focus:outline-none transition-transform hover:scale-110"
                                >
                                    <Star 
                                        className={`w-6 h-6 ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'}`} 
                                    />
                                </button>
                            ))}
                        </div>
                        <textarea 
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Görüşlerinizi yazın..."
                            className="w-full bg-black/20 text-white text-sm p-2 rounded-lg border border-white/10 placeholder-indigo-300/50 resize-none h-16 mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                        <button 
                            type="submit" 
                            disabled={rating === 0}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg transition disabled:opacity-50"
                        >
                            Gönder
                        </button>
                    </form>
                ) : (
                    <div className="bg-green-500/20 backdrop-blur-sm p-4 rounded-xl mb-4 border border-green-500/30 animate-fade-in">
                        <p className="text-green-100 font-bold text-sm">Geri bildiriminiz için teşekkürler! ✨</p>
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                    onClick={handleRestart}
                    className="flex-1 bg-indigo-600 text-white px-2 py-3 rounded-xl font-bold hover:bg-indigo-500 transition flex flex-col items-center justify-center gap-1 shadow-lg border border-indigo-400 text-xs sm:text-sm"
                    >
                    <RotateCcw className="w-5 h-5" /> En Başa Dön
                    </button>

                    <button
                    onClick={downloadPDF}
                    disabled={isGeneratingPDF}
                    className="flex-1 bg-white text-indigo-900 px-2 py-3 rounded-xl font-bold hover:bg-indigo-50 transition flex flex-col items-center justify-center gap-1 shadow-lg text-xs sm:text-sm"
                    >
                    {isGeneratingPDF ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    PDF İndir
                    </button>

                    <button
                    onClick={downloadAudio}
                    disabled={isDownloadingAudio}
                    className="flex-1 bg-pink-500 text-white px-2 py-3 rounded-xl font-bold hover:bg-pink-400 transition flex flex-col items-center justify-center gap-1 shadow-lg text-xs sm:text-sm"
                    >
                    {isDownloadingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Music className="w-5 h-5" />}
                    Ses İndir
                    </button>
                </div>

                <button
                onClick={onReset}
                className="w-full bg-yellow-400 text-indigo-900 px-6 py-3 rounded-xl font-bold hover:bg-yellow-300 transition flex items-center justify-center gap-2 shadow-lg mt-2"
                >
                <RefreshCcw className="w-5 h-5" /> Yeni Masal Yaz
                </button>
            </div>

            {/* Watermark on Back Cover */}
            <Watermark />
          </div>
          <button 
            onClick={handlePrev}
            className="mt-8 text-slate-500 font-bold hover:text-indigo-600 flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" /> Geri Dön
          </button>
        </div>
    );
  }

  // Render Story Page
  const pageData = story.pages[currentPage - 1];
  const hasAudio = !!pageData.audioBase64;

  return (
    <div 
        className="w-full max-w-5xl mx-auto animate-fade-in"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
    >
      {/* Pagination & Controls Header */}
      <div className="flex justify-between items-center mb-4 px-4">
        <button onClick={handlePrev} className="p-2 hover:bg-slate-200 rounded-full text-slate-600 transition">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-bold text-slate-400 text-sm uppercase tracking-wider">
          Sayfa {currentPage} / {story.pages.length}
        </span>
        <button onClick={handleNext} className="p-2 hover:bg-slate-200 rounded-full text-indigo-600 transition">
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>

      {/* Book Spread Layout */}
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-slate-200">
        
        {/* Left Page (Image) */}
        <div className="w-full md:w-1/2 bg-slate-100 relative overflow-hidden flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 min-h-[300px] md:min-h-auto group">
            {pageData.imageUrl ? (
                <img 
                    src={pageData.imageUrl} 
                    alt={`Sayfa ${currentPage} ilüstrasyonu`} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
            ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                    <div className="animate-pulse bg-slate-200 w-32 h-32 rounded-full mb-4"></div>
                    <p>Resim Yükleniyor...</p>
                </div>
            )}
             
             {/* Watermark on Story Page (On the image to avoid overlapping text on mobile) */}
             <Watermark />

             {/* Paper Texture Overlay */}
             <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")'}}></div>
        </div>

        {/* Right Page (Text) */}
        <div className="w-full md:w-1/2 flex flex-col relative bg-[#fffdf5]">
            {/* Audio Toolbar - Positioned at the top of the text container, separate from text */}
            <div className="w-full px-6 py-4 flex items-center justify-end border-b border-slate-100">
                {hasAudio && (
                    <button 
                        onClick={toggleAudio}
                        disabled={audioLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all shadow-sm ${
                            isAudioPlaying 
                            ? 'bg-indigo-100 text-indigo-600' 
                            : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                        }`}
                    >
                        {audioLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isAudioPlaying ? (
                            <>
                                <Pause className="w-4 h-4 fill-current" />
                                Durdur
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4 fill-current" />
                                Oku
                            </>
                        )}
                    </button>
                )}
            </div>

            <div className="flex-1 p-8 md:p-12 flex flex-col justify-center">
                <div className="prose prose-lg md:prose-xl text-slate-800 font-medium leading-relaxed handwritten">
                    <p className="text-xl md:text-2xl text-justify">
                        {pageData.text}
                    </p>
                </div>
                
                <div className="mt-8 flex justify-center">
                    <div className="w-16 h-1 bg-indigo-100 rounded-full"></div>
                </div>

                 {/* Page Number Footer */}
                 <div className="mt-auto pt-6 text-right text-slate-300 font-serif font-bold text-lg">
                     {currentPage}
                 </div>
            </div>
             
             {/* Paper Texture Overlay */}
             <div className="absolute inset-0 opacity-30 pointer-events-none" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")'}}></div>
        </div>

      </div>
    </div>
  );
};

export default StoryViewer;
