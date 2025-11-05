import { GoogleGenAI, Modality } from "@google/genai";

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("لم يتم العثور على API_KEY في متغيرات البيئة.");
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: "انسخ الصوت التالي:" },
          { inlineData: { data: base64Audio, mimeType } },
        ],
      },
    });
    return response.text;
  } catch (error) {
    console.error("خطأ أثناء النسخ:", error);
    throw new Error("فشل نسخ الصوت. يرجى مراجعة وحدة التحكم للحصول على التفاصيل.");
  }
};


interface SingleSpeakerConfig {
    mode: 'single';
    voiceName: string;
}

interface MultiSpeakerConfig {
    mode: 'multi';
    speakers: Array<{
        speaker: string;
        voiceConfig: {
            prebuiltVoiceConfig: { voiceName: string };
        };
    }>;
}

export type TTSConfig = SingleSpeakerConfig | MultiSpeakerConfig;


export const textToSpeech = async (text: string, config: TTSConfig): Promise<string> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("لم يتم العثور على API_KEY في متغيرات البيئة.");
    const ai = new GoogleGenAI({ apiKey });
  
    let speechConfig;
    let prompt;

    if (config.mode === 'single') {
        speechConfig = {
            voiceConfig: {
                prebuiltVoiceConfig: { voiceName: config.voiceName },
            },
        };
        prompt = `قل بصوت واضح وودود: ${text}`;
    } else {
        if (config.speakers.length !== 2) {
            throw new Error("وضع المتحدثين المتعددين يتطلب متحدثين اثنين بالضبط.");
        }
        speechConfig = {
            multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: config.speakers,
            }
        };
        prompt = `قم بتحويل المحادثة التالية إلى كلام بين ${config.speakers[0].speaker} و ${config.speakers[1].speaker}:\n${text}`;
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig,
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("لم يتم استلام أي بيانات صوتية من واجهة برمجة تطبيقات تحويل النص إلى كلام.");
        }
        return base64Audio;
    } catch (error) {
        console.error("خطأ أثناء تحويل النص إلى كلام:", error);
        throw new Error("فشل توليد الكلام. يرجى مراجعة وحدة التحكم للحصول على التفاصيل.");
    }
};