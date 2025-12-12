
import React, { useState, useEffect } from 'react';
import { UserInput, AgeGroup, Gender } from '../types';
import { Sparkles, BookOpen, Star, Heart, Palette, ChevronDown, ChevronUp, Info, Clock, AlertCircle, Ticket, MessageCircle } from 'lucide-react';

interface BookFormProps {
  onSubmit: (data: UserInput) => void;
  isSubmitting: boolean;
  remainingQuota: number;
  nextResetTime: number | null;
  onApplyPromo: (code: string) => { success: boolean, message: string };
}

const CATEGORIES = ["Uzay Macerası", "Büyülü Orman", "Dinozorlar Dünyası", "Deniz Altı", "Süper Kahramanlar", "Prensesler & Şövalyeler"];
const MORALS = ["Paylaşmak Güzeldir", "Cesaret", "Dürüstlük", "Doğa Sevgisi", "Arkadaşlık", "Uyku Vakti"];

const BookForm: React.FC<BookFormProps> = ({ onSubmit, isSubmitting, remainingQuota, nextResetTime, onApplyPromo }) => {
  const [formData, setFormData] = useState<UserInput>({
    childName: '',
    age: AgeGroup.Toddler,
    gender: Gender.Girl,
    hairColor: '',
    eyeColor: '',
    category: CATEGORIES[0],
    moral: MORALS[0]
  });
  const [customCategory, setCustomCategory] = useState('');
  const [customMoral, setCustomMoral] = useState('');
  const [isCustomCat, setIsCustomCat] = useState(false);
  const [isCustomMoral, setIsCustomMoral] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Promo Code State
  const [promoCode, setPromoCode] = useState('');
  const [promoMessage, setPromoMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [isPromoUsed, setIsPromoUsed] = useState(false);

  useEffect(() => {
    if (!nextResetTime) {
      setTimeLeft('');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = nextResetTime - now;

      if (diff <= 0) {
        setTimeLeft('00:00:00');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const h = hours.toString().padStart(2, '0');
      const m = minutes.toString().padStart(2, '0');
      const s = seconds.toString().padStart(2, '0');

      setTimeLeft(`${h}:${m}:${s}`);
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);

    // Check if promo is already used locally to disable input immediately
    if (localStorage.getItem('masal_promo_used')) {
        setIsPromoUsed(true);
    }

    return () => clearInterval(interval);
  }, [nextResetTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (remainingQuota <= 0) return;

    const finalData = {
      ...formData,
      category: isCustomCat ? customCategory : formData.category,
      moral: isCustomMoral ? customMoral : formData.moral
    };
    if (!finalData.childName) return;
    onSubmit(finalData);
  };

  const handlePromoSubmit = () => {
      if (!promoCode) return;
      const result = onApplyPromo(promoCode);
      if (result.success) {
          setPromoMessage({ type: 'success', text: result.message });
          setPromoCode('');
          setIsPromoUsed(true);
      } else {
          setPromoMessage({ type: 'error', text: result.message });
      }
      
      // Clear message after 3 seconds
      setTimeout(() => {
        if (result.success) setPromoMessage(null);
      }, 5000);
  };

  const isQuotaFull = remainingQuota <= 0;

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
        
      {/* Introduction & Rules Card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-indigo-100 shadow-lg">
        <div className="flex items-start gap-3">
            <div className="bg-indigo-100 p-2 rounded-full">
                <Info className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1">
                <h2 className="text-lg font-bold text-indigo-900">Hoş Geldiniz!</h2>
                <p className="text-indigo-700 font-bold text-sm mt-2 mb-2">
                    Ankara Çocuk Etkinlikler İnstagram sayfamız takipçilerine özeldir.
                </p>
                <p className="text-slate-600 text-sm mt-1">
                    Masal Atölyesi'nde çocuğunuza özel sihirli hikayeler oluşturabilirsiniz. 
                    Adil kullanım için bazı kurallarımız vardır:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600 list-disc list-inside marker:text-indigo-400">
                    <li>Her kullanıcının <strong>6 saatte bir yenilenen 1 masal</strong> oluşturma hakkı vardır.</li>
                    <li>Oluşturulan masalları PDF olarak indirebilirsiniz.</li>
                </ul>
                
                <div className="mt-4 flex flex-wrap items-center gap-4">
                    <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 font-bold ${isQuotaFull ? 'bg-red-50 border-red-200 text-red-600' : 'bg-green-50 border-green-200 text-green-700'}`}>
                        <BookOpen className="w-4 h-4" />
                        Kalan Hakkınız: {remainingQuota} / 1
                    </div>
                    {nextResetTime && timeLeft && (
                        <div className="px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 text-slate-500 text-xs font-medium font-mono">
                            <Clock className="w-3 h-3" />
                            Yenilenmeye Kalan: {timeLeft}
                        </div>
                    )}
                </div>

                {/* Promo Code Section */}
                <div className="mt-4 pt-4 border-t border-indigo-50">
                    <div className="flex items-center gap-2 mb-2">
                        <Ticket className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-bold text-purple-700">Promosyon Kodu</span>
                    </div>

                    {!isPromoUsed && (
                        <div className="mb-3 bg-green-50 p-3 rounded-xl border border-green-100">
                            <p className="text-xs text-green-800 mb-2 leading-relaxed">
                                🎁 <strong>+1 Ek Hak</strong> veren promosyon kodunu, WhatsApp grubumuza katılarak <strong>sabit mesaj</strong> kısmından alabilirsiniz.
                            </p>
                            <a 
                                href="https://chat.whatsapp.com/JJFgs0neRkLCtm0OAHzOeK" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold py-2 rounded-lg transition-colors shadow-sm"
                            >
                                <MessageCircle className="w-4 h-4" />
                                WhatsApp Grubuna Katıl
                            </a>
                        </div>
                    )}

                    {isPromoUsed ? (
                         <div className="text-xs font-medium text-green-600 bg-green-50 px-3 py-2 rounded-lg inline-block border border-green-200">
                             ✨ Ekstra hak tanımlandı!
                         </div>
                    ) : (
                        <div className="flex gap-2 max-w-sm">
                            <input 
                                type="text" 
                                placeholder="Kodu buraya girin..." 
                                value={promoCode}
                                onChange={(e) => setPromoCode(e.target.value)}
                                className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200"
                            />
                            <button 
                                type="button"
                                onClick={handlePromoSubmit}
                                className="px-3 py-1.5 bg-purple-500 text-white text-sm font-bold rounded-lg hover:bg-purple-600 transition"
                            >
                                Kullan
                            </button>
                        </div>
                    )}
                    {promoMessage && (
                        <p className={`text-xs mt-2 font-bold ${promoMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                            {promoMessage.text}
                        </p>
                    )}
                </div>
            </div>
        </div>
      </div>

      <div className={`bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-indigo-100 transition-opacity duration-300 ${isQuotaFull ? 'opacity-50 pointer-events-none grayscale-[0.5]' : 'opacity-100'}`}>
        <div className="bg-indigo-500 p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className="absolute top-2 left-4 text-4xl">✨</div>
                <div className="absolute bottom-4 right-10 text-5xl">🚀</div>
                <div className="absolute top-10 right-20 text-3xl">🏰</div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white handwritten flex items-center justify-center gap-3">
            <BookOpen className="w-8 h-8" />
            Masal Atölyesi
            </h1>
            <p className="text-indigo-100 mt-2">Çocuğunuz için sihirli bir hikaye oluşturun.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 relative">
            
            {isQuotaFull && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-[2px]">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl border-2 border-red-100 text-center max-w-xs">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                        <h3 className="text-xl font-bold text-slate-800">Haklarınız Doldu</h3>
                        <p className="text-slate-500 mt-2 text-sm">
                            Yeni masallar oluşturmak için lütfen bekleyin veya yukarıdan kod girin.
                        </p>
                        <p className="text-2xl font-bold text-indigo-600 mt-4 font-mono">
                           {timeLeft}
                        </p>
                    </div>
                </div>
            )}

            {/* Child Name */}
            <div>
            <label className="block text-slate-700 font-bold mb-2 ml-1">Çocuğun İsmi</label>
            <input
                type="text"
                required
                value={formData.childName}
                onChange={(e) => setFormData({...formData, childName: e.target.value})}
                placeholder="Örn: Ayşe, Can..."
                disabled={isQuotaFull}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition outline-none text-lg"
            />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Age */}
            <div>
                <label className="block text-slate-700 font-bold mb-2 ml-1">Yaş Grubu</label>
                <div className="grid grid-cols-3 gap-2">
                {Object.values(AgeGroup).map((age) => (
                    <button
                    key={age}
                    type="button"
                    disabled={isQuotaFull}
                    onClick={() => setFormData({...formData, age})}
                    className={`py-2 rounded-lg border-2 font-bold transition ${formData.age === age ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                    >
                    {age}
                    </button>
                ))}
                </div>
            </div>

            {/* Gender */}
            <div>
                <label className="block text-slate-700 font-bold mb-2 ml-1">Cinsiyet</label>
                <div className="grid grid-cols-3 gap-2">
                {Object.values(Gender).map((g) => (
                    <button
                    key={g}
                    type="button"
                    disabled={isQuotaFull}
                    onClick={() => setFormData({...formData, gender: g})}
                    className={`py-2 rounded-lg border-2 font-bold text-sm transition ${formData.gender === g ? 'bg-pink-500 border-pink-500 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-pink-300'}`}
                    >
                    {g}
                    </button>
                ))}
                </div>
            </div>
            </div>
            
            {/* Advanced Customization Toggle */}
            <div className="border-t border-slate-100 pt-4">
                <button 
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    disabled={isQuotaFull}
                    className="flex items-center gap-2 text-indigo-600 font-bold text-sm hover:text-indigo-800 transition mx-auto"
                >
                    <Palette className="w-4 h-4" />
                    Karakter Görünümünü Özelleştir {showAdvanced ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                </button>
                
                {showAdvanced && (
                    <div className="grid grid-cols-2 gap-4 mt-4 animate-fade-in bg-indigo-50 p-4 rounded-xl">
                        <div>
                            <label className="block text-slate-700 text-sm font-bold mb-1">Saç Rengi</label>
                            <input 
                                type="text" 
                                disabled={isQuotaFull}
                                placeholder="Örn: Sarı, Kıvırcık Kahve"
                                value={formData.hairColor}
                                onChange={(e) => setFormData({...formData, hairColor: e.target.value})}
                                className="w-full px-3 py-2 rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-700 text-sm font-bold mb-1">Göz Rengi</label>
                            <input 
                                type="text" 
                                disabled={isQuotaFull}
                                placeholder="Örn: Mavi, Yeşil, Ela"
                                value={formData.eyeColor}
                                onChange={(e) => setFormData({...formData, eyeColor: e.target.value})}
                                className="w-full px-3 py-2 rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Category */}
            <div>
            <label className="block text-slate-700 font-bold mb-2 ml-1 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" /> Masal Konusu
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                {CATEGORIES.map((cat) => (
                <button
                    key={cat}
                    type="button"
                    disabled={isQuotaFull}
                    onClick={() => { setIsCustomCat(false); setFormData({...formData, category: cat}); }}
                    className={`p-2 text-sm rounded-lg border transition text-left truncate ${!isCustomCat && formData.category === cat ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                >
                    {cat}
                </button>
                ))}
                <button
                type="button"
                disabled={isQuotaFull}
                onClick={() => setIsCustomCat(true)}
                className={`p-2 text-sm rounded-lg border transition text-center font-bold ${isCustomCat ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                >
                Diğer...
                </button>
            </div>
            {isCustomCat && (
                <input
                type="text"
                disabled={isQuotaFull}
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Kendi konunuzu yazın..."
                className="w-full px-3 py-2 rounded-lg border border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                />
            )}
            </div>

            {/* Moral */}
            <div>
            <label className="block text-slate-700 font-bold mb-2 ml-1 flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" /> Öğüt / Tema
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                {MORALS.map((m) => (
                <button
                    key={m}
                    type="button"
                    disabled={isQuotaFull}
                    onClick={() => { setIsCustomMoral(false); setFormData({...formData, moral: m}); }}
                    className={`p-2 text-sm rounded-lg border transition text-left truncate ${!isCustomMoral && formData.moral === m ? 'bg-red-100 border-red-400 text-red-800' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                >
                    {m}
                </button>
                ))}
                <button
                type="button"
                disabled={isQuotaFull}
                onClick={() => setIsCustomMoral(true)}
                className={`p-2 text-sm rounded-lg border transition text-center font-bold ${isCustomMoral ? 'bg-red-100 border-red-400 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                >
                Diğer...
                </button>
            </div>
            {isCustomMoral && (
                <input
                type="text"
                disabled={isQuotaFull}
                value={customMoral}
                onChange={(e) => setCustomMoral(e.target.value)}
                placeholder="Kendi öğüdünüzü yazın..."
                className="w-full px-3 py-2 rounded-lg border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
            )}
            </div>

            <button
            type="submit"
            disabled={isSubmitting || isQuotaFull}
            className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-xl font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
            {isSubmitting ? (
                <span>Sihir Yapılıyor...</span>
            ) : (
                <>
                <Sparkles className="w-6 h-6" />
                Masalı Oluştur
                </>
            )}
            </button>
        </form>
      </div>
    </div>
  );
};

export default BookForm;
