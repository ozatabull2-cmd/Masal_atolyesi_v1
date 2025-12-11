import React from 'react';
import { Wand2 } from 'lucide-react';

interface LoadingScreenProps {
  status: 'story' | 'images';
  progress?: number; // Optional progress text for images
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ status, progress }) => {
  return (
    <div className="w-full h-[600px] flex flex-col items-center justify-center bg-white/80 backdrop-blur-md rounded-3xl shadow-xl">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
        <Wand2 className="w-16 h-16 text-indigo-600 animate-spin-slow relative z-10" style={{ animationDuration: '3s' }} />
      </div>
      
      <h2 className="text-2xl font-bold text-slate-800 mb-2">
        {status === 'story' ? 'Masal Yazılıyor...' : 'Resimler Çiziliyor...'}
      </h2>
      
      <p className="text-slate-500 text-center max-w-xs animate-pulse">
        {status === 'story' 
          ? 'Hayal gücü motorları çalıştırılıyor. Kahramanımız hazırlanıyor.' 
          : `Ressamımız fırçasını konuşturuyor... ${progress ? `%${Math.round(progress)}` : ''}`
        }
      </p>

      {status === 'images' && progress !== undefined && (
        <div className="w-64 h-2 bg-slate-100 rounded-full mt-6 overflow-hidden">
            <div 
                className="h-full bg-indigo-500 transition-all duration-500 ease-out" 
                style={{ width: `${progress}%` }}
            ></div>
        </div>
      )}
    </div>
  );
};

export default LoadingScreen;