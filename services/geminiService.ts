
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { UserInput, StoryData, AgeGroup } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Helper to map age to word count constraints
const getConstraintsForAge = (age: AgeGroup): string => {
  switch (age) {
    case AgeGroup.Toddler:
      return "Çok kısa cümleler, basit kelimeler, bol tekrar, somut kavramlar. Sayfa başına Maksimum 40-50 kelime.";
    case AgeGroup.Child:
      return "Biraz daha karmaşık cümleler, hafif macera, sebep-sonuç ilişkileri. Sayfa başına Maksimum 80-100 kelime.";
    case AgeGroup.PreTeen:
      return "Gelişmiş kelime hazinesi, detaylı betimlemeler, güçlü kurgu. Sayfa başına Maksimum 150 kelime.";
    default:
      return "Basit ve anlaşılır dil.";
  }
};

export const generateStoryText = async (input: UserInput): Promise<StoryData> => {
  const { childName, age, gender, category, moral, hairColor, eyeColor } = input;

  const ageConstraints = getConstraintsForAge(age);
  
  // Define character appearance string if provided
  let characterAppearance = "";
  if (hairColor || eyeColor) {
      const hair = hairColor ? `${hairColor} hair` : "";
      const eye = eyeColor ? `${eyeColor} eyes` : "";
      characterAppearance = `Character physical appearance: ${hair} ${eye}.`;
  }

  const prompt = `
    Sen profesyonel bir çocuk kitabı yazarı ve sanat yönetmenisin.
    Aşağıdaki bilgilerle bir çocuk masalı oluştur:
    
    - Kahraman Adı: ${childName}
    - Yaş Grubu: ${age}
    - Cinsiyet: ${gender}
    - Kategori/Tema: ${category}
    - Öğüt/Konu: ${moral}
    - Fiziksel Özellikler: ${hairColor ? 'Saç: ' + hairColor : ''} ${eyeColor ? 'Göz: ' + eyeColor : ''}

    KURALLAR:
    1. Hikaye dili TÜRKÇE olmalıdır.
    2. Dil ve anlatım şu yaş grubu kuralına uymalıdır: ${ageConstraints}
    3. Asla korku, şiddet veya kötü örnek içermemelidir.
    4. Çıktı tam olarak 5 sayfa olmalıdır.
    5. Her sayfa için bir "imagePrompt" (Görsel İstemi) yazılmalıdır. 
    6. Ayrıca kitap kapağı için "coverImagePrompt" yazılmalıdır.
    7. imagePrompt İNGİLİZCE olmalı, sahneyi detaylı betimlemeli ve stil olarak "Whimsical digital illustration, soft colors, Pixar style 3D render" belirtilmelidir.
    8. ÖNEMLİ: "imagePrompt" içinde karakterin fiziksel özelliklerini (${characterAppearance || `a ${age} year old ${gender}`}) HER SEFERİNDE tutarlı bir şekilde belirt.

    JSON FORMATINDA yanıt ver.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Hikayenin başlığı" },
          summary: { type: Type.STRING, description: "Hikayenin 2 cümlelik özeti" },
          coverImagePrompt: { type: Type.STRING, description: "Kitap kapağı için görsel istemi" },
          pages: {
            type: Type.ARRAY,
            description: "Hikayenin sayfaları (toplam 5 adet)",
            items: {
              type: Type.OBJECT,
              properties: {
                pageNumber: { type: Type.INTEGER },
                text: { type: Type.STRING, description: "Sayfanın Türkçe metni" },
                imagePrompt: { type: Type.STRING, description: "Sayfanın İngilizce görsel istemi (prompt)" }
              },
              required: ["pageNumber", "text", "imagePrompt"]
            }
          }
        },
        required: ["title", "summary", "coverImagePrompt", "pages"]
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text) as StoryData;
  }
  throw new Error("Masal oluşturulamadı.");
};

export const generateIllustration = async (prompt: string): Promise<string> => {
  try {
    // Using Nano Banana for fast generation
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1", 
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found");
  } catch (error) {
    console.error("Image generation error:", error);
    return `https://picsum.photos/512/512?blur=2&random=${Math.random()}`;
  }
};

// Audio Utils
export const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

export const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const generateSpeech = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Kore' has a nice storytelling tone
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");
    
    return base64Audio;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};

// Convert AudioBuffer to WAV Blob
export const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferOut = new ArrayBuffer(length);
  const view = new DataView(bufferOut);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write RIFF chunk descriptor
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // write fmt sub-chunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this function)

  // write data sub-chunk
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferOut], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
};
