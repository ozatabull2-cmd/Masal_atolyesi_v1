import React, { useState, useEffect, useRef } from 'react';
import { Hourglass, BookOpen, Sparkles, Volume2, VolumeX, ChevronRight, ChevronLeft, RefreshCw, Download, Play, Pause } from 'lucide-react';

// --- TYPES ---
enum AppState {
  Input,
  GeneratingStory,
  GeneratingImages,
  Reading,
  Cooldown,
  Error
}

interface UserInput {
  childName: string;
  ageGroup: string;
  gender: string;
  theme: string;
  advice: string;
}

interface StoryPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
  imageUrl?: string;
  audioBase64?: string;
}

interface StoryData {
  title: string;
  coverImagePrompt: string;
  coverImageUrl?: string;
  pages: StoryPage[];
}

// --- CONFIGURATION ---
const QUOTA_LIMIT = 1; // 1 HAK
const RESET_PERIOD_MS = 6 * 60 * 60 * 1000; // 6 SAAT
const RESET_HOURS = RESET_PERIOD_MS / (1000 * 60 * 60); // Otomatik hesaplanan saat (Arayüz için)

// API ANAHTARI EKLENDİ
const API_KEY = "AIzaSyBtUNhknOLNleM0cxxIsX4nkFZotscmo74"; 

const STORAGE_KEY = 'masal_quota_v2'; 

const PROMO_CODES = [
  "ANKARA", "K7L2M9", "X4P8R3", "T9Y5W1", "B2H6S8", 
  "V3N7C4", "J8D5F2", "M6G9Z1", "R4K3L7", "S5T8P2", "Y1W9Q6"
];

// --- SERVICES (MOCKED / REAL IMPLEMENTATION) ---

// 1. Generate Story Text (Gemini Flash)
const generateStoryText = async (input: UserInput): Promise<StoryData> => {
  try {
    const prompt = `
      Sen profesyonel bir çocuk masalı yazarısın. Aşağıdaki özelliklere göre bir masal yaz:
      - Çocuğun İsmi: ${input.childName}
      - Yaş Grubu: ${input.ageGroup}
      - Cinsiyet: ${input.gender}
      - Konu: ${input.theme}
      - Ana Fikir/Öğüt: ${input.advice}

      Masal 4 sayfadan oluşmalı. Dil Türkçe olmalı.
      Çıktıyı SADECE geçerli bir JSON formatında ver. Başka hiçbir metin ekleme.
      
      JSON Şeması:
      {
        "title": "Masalın Başlığı",
        "coverImagePrompt": "Kapak resmi için İngilizce detaylı prompt",
        "pages": [
          {
            "pageNumber": 1,
            "text": "Sayfa 1 metni...",
            "imagePrompt": "Sayfa 1 için İngilizce detaylı resim promptu"
          },
          ...
        ]
      }
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Hikaye oluşturulamadı.");
    return JSON.parse(text);
  } catch (error) {
    console.error("Story Gen Error:", error);
    throw error;
  }
};

// 2. Generate Illustration (Imagen)
const generateIllustration = async (prompt: string): Promise<string> => {
  try {
    // Fallback prompt enhancements for better style
    const enhancedPrompt = `${prompt} . Children's book illustration style, warm colors, magical atmosphere, high quality, 4k resolution, soft lighting. No text.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: enhancedPrompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1" }
      })
    });

    const data = await response.json();
    const base64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!base64) throw new Error("Resim oluşturulamadı.");
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error("Image Gen Error:", error);
    return "https://via.placeholder.com/512?text=Resim+Oluşturulamadı";
  }
};

// 3. Generate Speech (Gemini TTS)
const generateSpeech = async (text: string): Promise<string> => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: text }] }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: "Kore" }
                    }
                }
            }
        })
    });

    const data = await response.json();
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) throw new Error("Ses oluşturulamadı.");
    return audioData; 
  } catch (error) {
      console.error("TTS Error:", error);
      return "";
  }
};

// --- COMPONENTS ---

// 1. Book Form Component
const BookForm: React.FC<{ 
  onSubmit: (input: UserInput) => void; 
  isSubmitting: boolean;
  remainingQuota: number;
  nextResetTime: number | null;
  onApplyPromo: (code: string) => { success: boolean, message: string };
}> = ({ onSubmit, isSubmitting, remainingQuota, nextResetTime, onApplyPromo }) => {
  const [formData, setFormData] = useState<UserInput>({
    childName: '',
    ageGroup: '3-5',
    gender: 'Kız',
    theme: 'Uzay Macerası',
    advice: 'Paylaşmak Güzeldir'
  });
  
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.childName.trim()) return;
    onSubmit(formData);
  };

  const handlePromoSubmit = () => {
      const result = onApplyPromo(promoCode);
      setPromoMessage({ text: result.message, type: result.success ? 'success' : 'error' });
      setPromoCode("");
  };

  const ageGroups = ['3-5', '6-8', '9+'];
  const genders = ['Kız', 'Erkek', 'Belirtmek İstemiyorum'];
  const themes = ['Uzay Macerası', 'Büyülü Orman', 'Dinozorlar Dünyası', 'Deniz Altı', 'Süper Kahramanlar', 'Prensesler & Şövalyeler', 'Diğer...'];
  const advices = ['Paylaşmak Güzeldir', 'Cesaret', 'Dürüstlük', 'Doğa Sevgisi', 'Arkadaşlık', 'Uyku Vakti', 'Diğer...'];

  return (
    <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in">
      {/* Header Info Box */}
      <div className="bg-indigo-50 p-6 border-b border-indigo-100">
        <div className="flex items-start gap-4">
            <div className="bg-indigo-100 p-2 rounded-full">
                <BookOpen className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-indigo-900">Hoş Geldiniz!</h2>
                <p className="text-sm text-indigo-700 mt-1 mb-2">
                    Ankara Çocuk Etkinlikler İnstagram sayfamız takipçilerine özeldir.
                </p>
                
                {/* DİNAMİK BİLGİLENDİRME ALANI */}
                <div className="bg-indigo-100/50 p-3 rounded-lg border border-indigo-200 text-sm text-indigo-800">
                    <p>Adil kullanım kuralları:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-xs sm:text-sm">
                        <li>
                           Her kullanıcının <strong>{RESET_HOURS} saatte bir yenilenen {QUOTA_LIMIT} masal</strong> oluşturma hakkı vardır.
                        </li>
                    </ul>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
                     <div className={`px-4 py-2 rounded-lg font-bold text-sm inline-flex items-center gap-2 ${remainingQuota > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        <BookOpen size={16}/>
                        Kalan Hakkınız: {remainingQuota} / {QUOTA_LIMIT}
                     </div>
                     {nextResetTime && remainingQuota < QUOTA_LIMIT && (
                         <div className="text-xs text-slate-500">
                             Yenilenme: {new Date(nextResetTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </div>
                     )}
                </div>
                
                {/* Promo Code Section */}
                <div className="mt-4 pt-4 border-t border-indigo-200/50">
                    <label className="text-xs font-bold text-indigo-400 uppercase tracking-wide mb-2 block">Promosyon Kodu</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            placeholder="Kodunuzu girin..."
                            className="flex-1 border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <button 
                            onClick={handlePromoSubmit}
                            disabled={!promoCode.trim()}
                            className="bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-600 disabled:opacity-50 transition-colors"
                        >
                            Kullan
                        </button>
                    </div>
                    {promoMessage && (
                        <p className={`text-xs mt-2 ${promoMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                            {promoMessage.text}
                        </p>
                    )}

                    {/* WhatsApp Promo Link - EKLENEN KISIM */}
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3">
                        <p className="text-xs text-green-800 mb-3 leading-relaxed">
                            <span className="font-bold">🎁 +1 Ek Hak Fırsatı:</span> Etkinlikler ve Fırsat Alışveriş Rehberi grubumuza katılarak sabit mesaj kısmından promosyon kodunuzu hemen alabilirsiniz.
                        </p>
                        <a 
                            href="https://chat.whatsapp.com/JJFgs0neRkLCtm0OAHzOeK" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#128C7E] text-white text-xs font-bold py-2.5 px-4 rounded-lg transition-colors shadow-sm"
                        >
                            <span>📱</span> WhatsApp Grubuna Katıl & Kodu Al
                        </a>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white text-center">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Sparkles className="w-8 h-8 text-yellow-300" />
          Masal Atölyesi
        </h1>
        <p className="text-indigo-100 mt-2">Çocuğunuz için sihirli bir hikaye oluşturun.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        {/* Form Fields (Same as before) */}
        <div>
          <label className="block text-slate-700 font-bold mb-2">Çocuğun İsmi</label>
          <input
            type="text"
            value={formData.childName}
            onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-lg focus:border-indigo-500 focus:ring-0 transition-colors"
            placeholder="Örn: Ayşe, Can..."
            required
          />
        </div>

        {/* Age & Gender Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <label className="block text-slate-700 font-bold mb-3">Yaş Grubu</label>
                <div className="flex gap-2">
                    {ageGroups.map(age => (
                        <button
                            key={age}
                            type="button"
                            onClick={() => setFormData({...formData, ageGroup: age})}
                            className={`flex-1 py-2 rounded-lg font-medium border-2 transition-all ${
                                formData.ageGroup === age 
                                ? 'bg-indigo-500 border-indigo-500 text-white' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                            }`}
                        >
                            {age}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <label className="block text-slate-700 font-bold mb-3">Cinsiyet</label>
                <div className="flex gap-2 flex-wrap">
                    {genders.map(g => (
                        <button
                            key={g}
                            type="button"
                            onClick={() => setFormData({...formData, gender: g})}
                            className={`px-4 py-2 rounded-lg font-medium border-2 transition-all ${
                                formData.gender === g
                                ? 'bg-pink-500 border-pink-500 text-white' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-pink-300'
                            }`}
                        >
                            {g}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* Theme Selection */}
        <div>
            <label className="block text-slate-700 font-bold mb-3 flex items-center gap-2">
                <Sparkles size={18} className="text-yellow-500"/> Masal Konusu
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {themes.map(theme => (
                    <button
                        key={theme}
                        type="button"
                        onClick={() => setFormData({...formData, theme: theme})}
                        className={`py-3 px-2 rounded-xl text-sm font-medium border transition-all ${
                            formData.theme === theme
                            ? 'bg-yellow-100 border-yellow-400 text-yellow-800 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {theme}
                    </button>
                ))}
            </div>
        </div>

        {/* Advice Selection */}
        <div>
            <label className="block text-slate-700 font-bold mb-3 flex items-center gap-2">
                <span className="text-red-500">❤️</span> Öğüt / Tema
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {advices.map(item => (
                    <button
                        key={item}
                        type="button"
                        onClick={() => setFormData({...formData, advice: item})}
                        className={`py-3 px-2 rounded-xl text-sm font-medium border transition-all ${
                            formData.advice === item
                            ? 'bg-red-50 border-red-300 text-red-800 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {item}
                    </button>
                ))}
            </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || remainingQuota <= 0}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xl font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
        >
          <Sparkles className="w-6 h-6 animate-pulse" />
          Masalı Oluştur
        </button>
      </form>
    </div>
  );
};

// 2. Loading Screen
const LoadingScreen: React.FC<{ status: 'story' | 'images', progress?: number }> = ({ status, progress = 0 }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-3xl shadow-xl p-12 text-center max-w-md mx-auto animate-fade-in">
            {status === 'story' ? (
                <>
                    <div className="w-24 h-24 mb-6 relative">
                        <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <BookOpen className="absolute inset-0 m-auto text-indigo-500 w-8 h-8 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Hikaye Yazılıyor...</h2>
                    <p className="text-slate-500">Sihirli kelimeler bir araya geliyor.</p>
                </>
            ) : (
                <>
                    <div className="w-full bg-slate-100 rounded-full h-4 mb-6 overflow-hidden">
                        <div 
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Resimler Çiziliyor...</h2>
                    <p className="text-slate-500">Karakterler canlanıyor ve seslendiriliyor.</p>
                    <p className="text-xs text-slate-400 mt-2 font-mono">{Math.round(progress)}%</p>
                </>
            )}
        </div>
    );
};

// 3. Audio Player
const AudioPlayer: React.FC<{ audioBase64?: string }> = ({ audioBase64 }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const getWavUrl = (base64: string) => {
         const binaryString = window.atob(base64);
         const len = binaryString.length;
         const bytes = new Uint8Array(len);
         for (let i = 0; i < len; i++) {
             bytes[i] = binaryString.charCodeAt(i);
         }
         
         const wavHeader = new ArrayBuffer(44);
         const view = new DataView(wavHeader);
         
         view.setUint32(0, 0x52494646, false); // "RIFF"
         view.setUint32(4, 36 + bytes.length, true);
         view.setUint32(8, 0x57415645, false); // "WAVE"
         view.setUint32(12, 0x666d7420, false); // "fmt "
         view.setUint32(16, 16, true);
         view.setUint16(20, 1, true);
         view.setUint16(22, 1, true); // Mono
         view.setUint32(24, 24000, true); 
         view.setUint32(28, 24000 * 2, true);
         view.setUint16(32, 2, true);
         view.setUint16(34, 16, true);
         view.setUint32(36, 0x64617461, false); // "data"
         view.setUint32(40, bytes.length, true);

         const blob = new Blob([view, bytes], { type: 'audio/wav' });
         return URL.createObjectURL(blob);
    };

    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        if (audioBase64) {
            const url = getWavUrl(audioBase64);
            setSrc(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [audioBase64]);

    const togglePlay = () => {
        if (!audioRef.current || !src) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    if (!audioBase64) return null;

    return (
        <div className="mt-4">
            <audio 
                ref={audioRef} 
                src={src || undefined} 
                onEnded={() => setIsPlaying(false)} 
                className="hidden"
            />
            <button 
                onClick={togglePlay}
                className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full hover:bg-indigo-200 transition-colors font-semibold"
            >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                {isPlaying ? "Durdur" : "Dinle"}
            </button>
        </div>
    );
};

// 4. Story Viewer
const StoryViewer: React.FC<{ story: StoryData; onReset: () => void }> = ({ story, onReset }) => {
    const [pageIndex, setPageIndex] = useState(-1); // -1 is Cover

    const currentPage = pageIndex === -1 ? null : story.pages[pageIndex];
    const isLastPage = pageIndex === story.pages.length - 1;

    const handleNext = () => {
        if (pageIndex < story.pages.length - 1) setPageIndex(pageIndex + 1);
    };

    const handlePrev = () => {
        if (pageIndex > -1) setPageIndex(pageIndex - 1);
    };

    return (
        <div className="w-full max-w-4xl mx-auto perspective-1000">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden min-h-[600px] relative flex flex-col md:flex-row">
                
                {/* Image Section */}
                <div className="w-full md:w-1/2 h-[300px] md:h-auto bg-slate-200 relative">
                     <img 
                        src={pageIndex === -1 ? story.coverImageUrl : currentPage?.imageUrl} 
                        alt="Story Illustration" 
                        className="w-full h-full object-cover"
                     />
                     <div className="absolute inset-0 flex items-center justify-between p-4 md:hidden pointer-events-none">
                        <button onClick={handlePrev} disabled={pageIndex === -1} className="p-2 bg-black/30 text-white rounded-full pointer-events-auto disabled:opacity-0">
                            <ChevronLeft />
                        </button>
                        <button onClick={handleNext} disabled={isLastPage} className="p-2 bg-black/30 text-white rounded-full pointer-events-auto disabled:opacity-0">
                            <ChevronRight />
                        </button>
                     </div>
                </div>

                {/* Text Section */}
                <div className="w-full md:w-1/2 p-8 flex flex-col justify-between bg-[#fffcf5]">
                    <div className="flex justify-between items-center mb-6">
                        <button onClick={onReset} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm">
                            <RefreshCw size={14}/> Yeni Masal
                        </button>
                        <div className="text-slate-400 text-sm font-mono">
                            {pageIndex === -1 ? "Kapak" : `${pageIndex + 1} / ${story.pages.length}`}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {pageIndex === -1 ? (
                            <div className="text-center mt-12">
                                <h1 className="text-4xl font-serif font-bold text-slate-800 mb-4 text-balance">{story.title}</h1>
                                <p className="text-slate-500 italic">Okumaya başlamak için ilerleyin...</p>
                            </div>
                        ) : (
                            <div className="animate-fade-in">
                                <p className="text-xl font-serif leading-relaxed text-slate-800 text-balance">
                                    {currentPage?.text}
                                </p>
                                <AudioPlayer audioBase64={currentPage?.audioBase64} />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
                         <button 
                            onClick={handlePrev} 
                            disabled={pageIndex === -1}
                            className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-bold"
                        >
                            <ChevronLeft size={20} /> Geri
                         </button>
                         
                         <button 
                            onClick={handleNext} 
                            disabled={isLastPage}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-full hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md font-bold"
                        >
                            {isLastPage ? "Son" : "İleri"} <ChevronRight size={20} />
                         </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 5. Cooldown View
const CooldownView: React.FC<{ target: number; onComplete: () => void }> = ({ target, onComplete }) => {
    const [secondsLeft, setSecondsLeft] = useState(Math.ceil((target - Date.now()) / 1000));

    useEffect(() => {
        const timer = setInterval(() => {
            const left = Math.ceil((target - Date.now()) / 1000);
            if (left <= 0) {
                clearInterval(timer);
                onComplete();
            } else {
                setSecondsLeft(left);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [target, onComplete]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-3xl shadow-xl p-8 text-center max-w-md mx-auto animate-fade-in">
            <div className="bg-indigo-100 p-6 rounded-full mb-6 animate-pulse">
                <Hourglass className="w-12 h-12 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Biraz Dinlenelim!</h2>
            <p className="text-slate-500 mb-8">
                Sihirli değneğimizin soğuması gerekiyor. Yeni bir masal oluşturmadan önce lütfen bekle.
            </p>
            <div className="text-6xl font-bold text-indigo-500 font-mono mb-4">
                {secondsLeft}
            </div>
            <p className="text-sm text-indigo-300 font-bold uppercase tracking-wider">Saniye Kaldı</p>
        </div>
    );
};

// --- MAIN APP ---

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.Input);
  const [storyData, setStoryData] = useState<StoryData | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Quota State
  const [remainingQuota, setRemainingQuota] = useState<number>(QUOTA_LIMIT);
  const [nextResetTime, setNextResetTime] = useState<number | null>(null);

  // Cooldown State
  const [cooldownTarget, setCooldownTarget] = useState<number | null>(null);

  useEffect(() => {
    checkQuota();
  }, []);

  const checkQuota = () => {
    // UPDATED: Using new STORAGE_KEY
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
        const { count, resetTime } = JSON.parse(storedData);
        const now = Date.now();

        if (resetTime && now > resetTime) {
            // Time expired, reset quota
            resetQuota();
        } else {
            setRemainingQuota(QUOTA_LIMIT - count);
            setNextResetTime(resetTime);
        }
    } else {
        // First time user (or after version reset)
        setRemainingQuota(QUOTA_LIMIT);
        setNextResetTime(null);
    }
  };

  const resetQuota = () => {
      const data = { count: 0, resetTime: null };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setRemainingQuota(QUOTA_LIMIT);
      setNextResetTime(null);
  };

  const decrementQuota = () => {
      const storedData = localStorage.getItem(STORAGE_KEY);
      let count = 0;
      let resetTime = nextResetTime;

      if (storedData) {
          const parsed = JSON.parse(storedData);
          count = parsed.count;
          resetTime = parsed.resetTime;
      }

      const newCount = count + 1;
      
      // If no reset time is set, set it now
      if (!resetTime && newCount > 0) {
          resetTime = Date.now() + RESET_PERIOD_MS;
      }

      const newData = { count: newCount, resetTime };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      
      setRemainingQuota(QUOTA_LIMIT - newCount);
      setNextResetTime(resetTime);
  };

  const handleApplyPromo = (code: string): { success: boolean, message: string } => {
    const normalizedCode = code.trim().toUpperCase();

    if (!PROMO_CODES.includes(normalizedCode)) {
        return { success: false, message: "Geçersiz promosyon kodu." };
    }

    if (localStorage.getItem('masal_promo_used_v2')) { // Also updated promo key
        return { success: false, message: "Bu cihazda daha önce promosyon kodu kullanıldı." };
    }

    const storedData = localStorage.getItem(STORAGE_KEY);
    let currentCount = 0;
    let resetTime = nextResetTime;

    if (storedData) {
        const parsed = JSON.parse(storedData);
        currentCount = parsed.count;
        resetTime = parsed.resetTime;
    }

    // Add extra right by reducing count
    const newCount = currentCount - 1;
    const newData = { count: newCount, resetTime };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    localStorage.setItem('masal_promo_used_v2', 'true');
    
    setRemainingQuota(QUOTA_LIMIT - newCount);
    
    return { success: true, message: "Tebrikler! +1 Masal hakkı eklendi." };
  };

  const handleFormSubmit = async (input: UserInput) => {
    if (remainingQuota <= 0) {
        setErrorMsg("Hakkınız dolmuştur. Lütfen sürenin dolmasını bekleyin veya promosyon kodu kullanın.");
        return;
    }

    setErrorMsg(null);
    setAppState(AppState.GeneratingStory);

    try {
      // 1. Generate Text Structure
      const generatedStory = await generateStoryText(input);
      
      // Decrement quota immediately
      decrementQuota();

      setCooldownTarget(Date.now() + 5000); 

      // 2. Start Image and Audio Generation Phase
      setAppState(AppState.GeneratingImages);
      setLoadingProgress(10); 

      const totalTasks = generatedStory.pages.length * 2 + 1; 
      let completedTasks = 0;

      const updateProgress = () => {
        completedTasks++;
        setLoadingProgress(10 + (completedTasks / totalTasks) * 90);
      };

      // Generate Cover Image
      const coverPromise = generateIllustration(`${generatedStory.coverImagePrompt}`)
        .then(url => {
            updateProgress();
            return url;
        })
        .catch(() => "https://via.placeholder.com/512?text=Kapak");

      // Generate Page Images and Audio
      const pagesPromise = Promise.all(
        generatedStory.pages.map(async (page) => {
            let imageUrl = "https://via.placeholder.com/512";
            let audioBase64 = "";

            // Image Task
            const imageTask = async () => {
                try {
                    imageUrl = await generateIllustration(page.imagePrompt);
                } catch (e) {
                    console.error(`Failed to generate image for page ${page.pageNumber}`, e);
                } finally {
                    updateProgress();
                }
            };

            // Audio Task
            const audioTask = async () => {
                try {
                   audioBase64 = await generateSpeech(page.text);
                } catch (e) {
                   console.error(`Failed to generate audio for page ${page.pageNumber}`, e);
                } finally {
                   updateProgress();
                }
            };

            await Promise.all([imageTask(), audioTask()]);

            return { ...page, imageUrl, audioBase64 };
        })
      );

      const [coverUrl, pagesWithAssets] = await Promise.all([coverPromise, pagesPromise]);

      setStoryData({ 
        ...generatedStory, 
        coverImageUrl: coverUrl, 
        pages: pagesWithAssets 
      });
      
      setAppState(AppState.Reading);

    } catch (err: any) {
      console.error(err);
      setErrorMsg("Üzgünüz, masalı oluştururken sihirli bir hata oluştu. Lütfen tekrar deneyin.");
      setAppState(AppState.Error);
    }
  };

  const resetApp = () => {
    if (cooldownTarget && Date.now() < cooldownTarget) {
        setAppState(AppState.Cooldown);
        return;
    }
    setStoryData(null);
    setAppState(AppState.Input);
    setLoadingProgress(0);
    setErrorMsg(null);
    checkQuota(); 
  };

  const renderContent = () => {
    switch (appState) {
      case AppState.Input:
        return (
            <BookForm 
                onSubmit={handleFormSubmit} 
                isSubmitting={false} 
                remainingQuota={remainingQuota}
                nextResetTime={nextResetTime}
                onApplyPromo={handleApplyPromo}
            />
        );
      
      case AppState.GeneratingStory:
        return <LoadingScreen status="story" />;

      case AppState.GeneratingImages:
        return <LoadingScreen status="images" progress={loadingProgress} />;

      case AppState.Reading:
        return storyData ? <StoryViewer story={storyData} onReset={resetApp} /> : null;
      
      case AppState.Cooldown:
        return cooldownTarget ? <CooldownView target={cooldownTarget} onComplete={() => setAppState(AppState.Input)} /> : null;

      case AppState.Error:
        return (
          <div className="text-center p-8 bg-white rounded-3xl shadow-xl max-w-lg animate-fade-in">
            <div className="text-5xl mb-4">😿</div>
            <h3 className="text-xl font-bold text-red-500 mb-2">Bir Hata Oluştu</h3>
            <p className="text-slate-600 mb-6">{errorMsg}</p>
            <button 
              onClick={resetApp}
              className="bg-indigo-500 text-white px-6 py-2 rounded-full font-bold hover:bg-indigo-600"
            >
              Tekrar Dene
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[90vh]">
        {renderContent()}
        
        {appState === AppState.Input && (
          <footer className="mt-12 text-center text-slate-400 text-sm">
            <p>Gemini AI tarafından güçlendirilmiştir. ✨</p>
          </footer>
        )}
      </div>
    </div>
  );
}

export default App;