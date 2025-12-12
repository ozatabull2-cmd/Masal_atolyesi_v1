
import React, { useState, useEffect } from 'react';
import { AppState, StoryData, UserInput } from './types';
import BookForm from './components/BookForm';
import StoryViewer from './components/StoryViewer';
import LoadingScreen from './components/LoadingScreen';
import { generateIllustration, generateStoryText, generateSpeech } from './services/geminiService';
import { Hourglass } from 'lucide-react';

const QUOTA_LIMIT = 1;
const RESET_PERIOD_MS = 6 * 60 * 60 * 1000; // 6 hours in ms

// List of valid promo codes (Existing + 10 Unpredictable)
const PROMO_CODES = [
  "ANKARA",   // Original
  "K7L2M9",   // New 1
  "X4P8R3",   // New 2
  "T9Y5W1",   // New 3
  "B2H6S8",   // New 4
  "V3N7C4",   // New 5
  "J8D5F2",   // New 6
  "M6G9Z1",   // New 7
  "R4K3L7",   // New 8
  "S5T8P2",   // New 9
  "Y1W9Q6"    // New 10
];

// Internal Cooldown Component
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
        }, 250);
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
    const storedData = localStorage.getItem('masal_quota');
    if (storedData) {
        const { count, resetTime } = JSON.parse(storedData);
        const now = Date.now();

        if (resetTime && now > resetTime) {
            // Time expired, reset quota
            resetQuota();
        } else {
            // Still within window
            // Note: count can be negative if promo code was used, ensuring > 2 remaining quota
            setRemainingQuota(QUOTA_LIMIT - count);
            setNextResetTime(resetTime);
        }
    } else {
        // First time user
        setRemainingQuota(QUOTA_LIMIT);
        setNextResetTime(null);
    }
  };

  const resetQuota = () => {
      const data = { count: 0, resetTime: null };
      localStorage.setItem('masal_quota', JSON.stringify(data));
      // Reset promo usage flag on full reset? 
      // Requirement says "one time use per person". So we do NOT reset the promo flag here.
      setRemainingQuota(QUOTA_LIMIT);
      setNextResetTime(null);
  };

  const decrementQuota = () => {
      const storedData = localStorage.getItem('masal_quota');
      let count = 0;
      let resetTime = nextResetTime;

      if (storedData) {
          const parsed = JSON.parse(storedData);
          count = parsed.count;
          resetTime = parsed.resetTime;
      }

      const newCount = count + 1;
      
      // If this is the first use in the cycle (and not just using up extra credit), set timer
      // If count was negative (extra credit), and becomes <= 0, we are still "before" the limit.
      // We set reset time only if we don't have one and we are using a "normal" credit.
      if (!resetTime && newCount > 0) {
          resetTime = Date.now() + RESET_PERIOD_MS;
      }

      const newData = { count: newCount, resetTime };
      localStorage.setItem('masal_quota', JSON.stringify(newData));
      
      setRemainingQuota(QUOTA_LIMIT - newCount);
      setNextResetTime(resetTime);
  };

  const handleApplyPromo = (code: string): { success: boolean, message: string } => {
    // Normalize input
    const normalizedCode = code.trim().toUpperCase();

    // Check if code is in the allowed list
    if (!PROMO_CODES.includes(normalizedCode)) {
        return { success: false, message: "Geçersiz promosyon kodu." };
    }

    if (localStorage.getItem('masal_promo_used')) {
        return { success: false, message: "Bu cihazda daha önce promosyon kodu kullanıldı." };
    }

    // Apply Promo
    const storedData = localStorage.getItem('masal_quota');
    let currentCount = 0;
    let resetTime = nextResetTime;

    if (storedData) {
        const parsed = JSON.parse(storedData);
        currentCount = parsed.count;
        resetTime = parsed.resetTime;
    }

    // Reduce count by 1 (Adding 1 credit)
    const newCount = currentCount - 1;
    const newData = { count: newCount, resetTime };
    
    localStorage.setItem('masal_quota', JSON.stringify(newData));
    localStorage.setItem('masal_promo_used', 'true');
    
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
      
      // Decrement quota
      decrementQuota();

      // Set Cooldown Target (60 seconds from now)
      setCooldownTarget(Date.now() + 60000);

      // 2. Start Image and Audio Generation Phase
      setAppState(AppState.GeneratingImages);
      setLoadingProgress(0);

      const totalTasks = generatedStory.pages.length * 2 + 1; // Pages * (Image + Audio) + Cover Image
      let completedTasks = 0;

      const updateProgress = () => {
        completedTasks++;
        setLoadingProgress((completedTasks / totalTasks) * 100);
      };

      // Generate Cover Image
      const coverPromise = generateIllustration(`${generatedStory.coverImagePrompt} . Cinematic lighting, highly detailed cover art, title space at top.`)
        .then(url => {
            updateProgress();
            return url;
        });

      // Generate Page Images and Audio
      const pagesPromise = Promise.all(
        generatedStory.pages.map(async (page) => {
            let imageUrl = page.imageUrl;
            let audioBase64 = page.audioBase64;

            // Image Task
            const imageTask = async () => {
                try {
                    const fullPrompt = `${page.imagePrompt} . High quality, children's book illustration, warm lighting, 4k, detailed.`;
                    imageUrl = await generateIllustration(fullPrompt);
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
    // Check for cooldown
    if (cooldownTarget && Date.now() < cooldownTarget) {
        setAppState(AppState.Cooldown);
        return;
    }

    setStoryData(null);
    setAppState(AppState.Input);
    setLoadingProgress(0);
    setErrorMsg(null);
    checkQuota(); // Re-check quota when returning to home
  };

  // Helper to render content based on state
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
          <div className="text-center p-8 bg-white rounded-3xl shadow-xl max-w-lg">
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-8">
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
