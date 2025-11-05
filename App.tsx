import React, { useState, useRef, useEffect } from 'react';
import { transcribeAudio, textToSpeech, TTSConfig } from './services/geminiService';
import { blobToBase64, decode, decodePcmAudioData } from './utils/audioUtils';
import Button from './components/Button';
import Card from './components/Card';
import Spinner from './components/Spinner';
import MicrophoneIcon from './components/icons/MicrophoneIcon';
import StopIcon from './components/icons/StopIcon';
import SpeakerIcon from './components/icons/SpeakerIcon';
import TrashIcon from './components/icons/TrashIcon';
import UploadIcon from './components/icons/UploadIcon';
import SaveIcon from './components/icons/SaveIcon';
import LoadIcon from './components/icons/LoadIcon';
import PlusIcon from './components/icons/PlusIcon';
import AutoResizeTextarea from './components/AutoResizeTextarea';


const PREBUILT_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
const LOCAL_STORAGE_KEY = 'geminiAudioSession';

interface ConversationTurn {
  id: number;
  speakerId: 1 | 2;
  text: string;
}

const initialConversationTurn: ConversationTurn[] = [{ id: Date.now(), speakerId: 1, text: '' }];

const App: React.FC = () => {
  // --- STATE MANAGEMENT ---

  // Speech-to-Text State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');

  // Text-to-Speech State
  const [ttsMode, setTtsMode] = useState<'single' | 'multi'>('single');
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Single Speaker State
  const [singleSpeakerText, setSingleSpeakerText] = useState('');
  const [singleSpeakerVoice, setSingleSpeakerVoice] = useState('Kore');
  
  // Multi-Speaker (Podcast) State
  const [speaker1Name, setSpeaker1Name] = useState('يوسف');
  const [speaker1Voice, setSpeaker1Voice] = useState('Kore');
  const [speaker2Name, setSpeaker2Name] = useState('جنى');
  const [speaker2Voice, setSpeaker2Voice] = useState('Puck');
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>(initialConversationTurn);

  // Custom Voice State
  const [isRecordingCustomVoice, setIsRecordingCustomVoice] = useState(false);
  const [customVoice, setCustomVoice] = useState<Blob | null>(null);
  const [customVoiceFileName, setCustomVoiceFileName] = useState<string | null>(null);
  const [showCustomVoiceWarning, setShowCustomVoiceWarning] = useState(false);

  // Session State
  const [hasSavedSession, setHasSavedSession] = useState(false);


  // General State
  const [error, setError] = useState<string | null>(null);

  // --- REFS ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const customVoiceRecorderRef = useRef<MediaRecorder | null>(null);
  const customVoiceChunksRef = useRef<Blob[]>([]);

  // --- LIFECYCLE HOOKS ---
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    // Check for saved session on mount
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    setHasSavedSession(!!savedData);

    return () => {
      audioContextRef.current?.close();
      audioSourceRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    const isCustomSelected = (ttsMode === 'single' && singleSpeakerVoice === 'custom') ||
                             (ttsMode === 'multi' && (speaker1Voice === 'custom' || speaker2Voice === 'custom'));
    setShowCustomVoiceWarning(isCustomSelected);
  }, [ttsMode, singleSpeakerVoice, speaker1Voice, speaker2Voice]);


  // --- HANDLERS: SPEECH-TO-TEXT ---
  const handleStartRecording = async () => {
    setError(null);
    setTranscribedText('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        try {
          const base64Audio = await blobToBase64(audioBlob);
          const transcription = await transcribeAudio(base64Audio, audioBlob.type);
          setTranscribedText(transcription);
          setSingleSpeakerText(transcription);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'حدث خطأ غير معروف أثناء النسخ.');
        } finally {
          setIsTranscribing(false);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      setError('تعذر بدء التسجيل. يرجى منح أذونات الميكروفون.');
    }
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  // --- HANDLERS: TEXT-TO-SPEECH ---
  const handleGenerateSpeech = async () => {
    setError(null);
    setGeneratedAudio(null);
    setIsGeneratingSpeech(true);

    try {
      let config: TTSConfig;
      let textToGenerate: string;

      if (ttsMode === 'single') {
        if (!singleSpeakerText.trim()) {
          setError('الرجاء إدخال نص للمتحدث الفردي.');
          setIsGeneratingSpeech(false);
          return;
        }
        config = {
          mode: 'single',
          voiceName: singleSpeakerVoice === 'custom' ? 'Kore' : singleSpeakerVoice,
        };
        textToGenerate = singleSpeakerText;
      } else {
        const validTurns = conversationTurns.filter(turn => turn.text.trim() !== '');
        if (validTurns.length === 0) {
          setError('الرجاء إدخال بعض النصوص للمحادثة.');
          setIsGeneratingSpeech(false);
          return;
        }
        
        config = {
          mode: 'multi',
          speakers: [
            { speaker: speaker1Name, voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker1Voice === 'custom' ? 'Kore' : speaker1Voice } } },
            { speaker: speaker2Name, voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker2Voice === 'custom' ? 'Puck' : speaker2Voice } } }
          ]
        };
        textToGenerate = conversationTurns.map(turn => {
          const speakerName = turn.speakerId === 1 ? speaker1Name : speaker2Name;
          return `${speakerName}: ${turn.text}`;
        }).join('\n');
      }
      
      const audioB64 = await textToSpeech(textToGenerate, config);
      setGeneratedAudio(audioB64);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير معروف أثناء توليد الكلام.');
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const handlePlayAudio = async () => {
    if (!generatedAudio || !audioContextRef.current) return;
  
    if (isPlaying && audioSourceRef.current) {
        audioSourceRef.current.stop();
        setIsPlaying(false);
        return;
    }

    try {
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

      setIsPlaying(true);
      const audioBytes = decode(generatedAudio);
      const audioBuffer = await decodePcmAudioData(audioBytes, audioContextRef.current, 24000, 1);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        setIsPlaying(false);
        audioSourceRef.current = null;
      };
      source.start();
      audioSourceRef.current = source;
    } catch (err) {
      setError('فشل تشغيل الصوت.');
      setIsPlaying(false);
    }
  };
  
  // --- HANDLERS: PODCAST MODE ---

  const handleAddTurn = () => {
    const lastTurn = conversationTurns[conversationTurns.length - 1];
    const newSpeakerId = lastTurn?.speakerId === 1 ? 2 : 1;
    setConversationTurns(prev => [...prev, { id: Date.now(), speakerId: newSpeakerId, text: '' }]);
  };

  const handleRemoveTurn = (id: number) => {
    setConversationTurns(prev => prev.filter(turn => turn.id !== id));
  };

  const handleTurnTextChange = (id: number, text: string) => {
    setConversationTurns(prev => prev.map(turn => turn.id === id ? { ...turn, text } : turn));
  };
  
  // --- HANDLERS: CUSTOM VOICE ---

  const handleRecordCustomVoice = async () => {
    if (isRecordingCustomVoice) {
      customVoiceRecorderRef.current?.stop();
      setIsRecordingCustomVoice(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      customVoiceRecorderRef.current = new MediaRecorder(stream);
      customVoiceChunksRef.current = [];

      customVoiceRecorderRef.current.ondataavailable = (e) => customVoiceChunksRef.current.push(e.data);
      customVoiceRecorderRef.current.onstop = () => {
        const blob = new Blob(customVoiceChunksRef.current, { type: 'audio/webm' });
        setCustomVoice(blob);
        setCustomVoiceFileName(null); // Clear filename when a new recording is made
        stream.getTracks().forEach(track => track.stop());
      };
      
      customVoiceRecorderRef.current.start();
      setIsRecordingCustomVoice(true);
    } catch (err) {
      setError('تعذر بدء التسجيل. يرجى منح أذونات الميكروفون.');
    }
  };

  const handleCustomVoiceUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCustomVoice(file);
      setCustomVoiceFileName(file.name);
      setError(null);
    }
  };

  // --- HANDLERS: SESSION MANAGEMENT ---
  const handleSaveSession = () => {
    const sessionData = {
      ttsMode,
      singleSpeakerText,
      singleSpeakerVoice,
      speaker1Name,
      speaker1Voice,
      speaker2Name,
      speaker2Voice,
      conversationTurns,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessionData));
    setHasSavedSession(true);
  };
  
  const handleLoadSession = () => {
    try {
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedData) {
        const sessionData = JSON.parse(savedData);
        setTtsMode(sessionData.ttsMode || 'single');
        setSingleSpeakerText(sessionData.singleSpeakerText || '');
        setSingleSpeakerVoice(sessionData.singleSpeakerVoice || 'Kore');
        setSpeaker1Name(sessionData.speaker1Name || 'يوسف');
        setSpeaker1Voice(sessionData.speaker1Voice || 'Kore');
        setSpeaker2Name(sessionData.speaker2Name || 'جنى');
        setSpeaker2Voice(sessionData.speaker2Voice || 'Puck');
        setConversationTurns(sessionData.conversationTurns || initialConversationTurn);
      }
    } catch (e) {
      setError("فشل تحميل بيانات الجلسة. قد تكون تالفة.");
    }
  };

  const handleClearSession = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setHasSavedSession(false);
    // Reset state to defaults
    setTtsMode('single');
    setSingleSpeakerText('');
    setSingleSpeakerVoice('Kore');
    setSpeaker1Name('يوسف');
    setSpeaker1Voice('Kore');
    setSpeaker2Name('جنى');
    setSpeaker2Voice('Puck');
    setConversationTurns(initialConversationTurn);
  };
  
  // --- RENDER METHODS ---

  const VoiceSelector: React.FC<{
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    id: string;
  }> = ({ value, onChange, id }) => (
    <select id={id} value={value} onChange={onChange} className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition">
      {PREBUILT_VOICES.map(voice => <option key={voice} value={voice}>{voice}</option>)}
      {customVoice && <option value="custom">صوتي (مخصص)</option>}
    </select>
  );

  return (
    <div className="bg-[#111827] text-white min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-5xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
            مجموعة أدوات Gemini الصوتية
          </h1>
          <p className="text-gray-400 mt-4 text-lg">
            مجموعة قوية لنسخ الصوت وتحويل النص إلى كلام طبيعي.
          </p>
        </header>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg" role="alert">
            <strong className="font-bold">خطأ: </strong>
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <h2 className="text-2xl font-semibold mb-4 text-gray-200">تحويل الكلام إلى نص</h2>
              <div className="flex flex-col items-center gap-4">
                <Button onClick={isRecording ? handleStopRecording : handleStartRecording} className="w-full text-lg">
                  {isRecording ? <><StopIcon className="w-5 h-5" /> إيقاف التسجيل</> : <><MicrophoneIcon className="w-5 h-5" /> بدء التسجيل</>}
                </Button>
                <div className="w-full h-48 bg-gray-900/50 rounded-lg p-4 border border-gray-700 overflow-y-auto">
                  {isTranscribing ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <Spinner /> <span className="mr-2">جارٍ النسخ...</span>
                    </div>
                  ) : (
                    <p className="text-gray-300 whitespace-pre-wrap">{transcribedText || 'ستظهر النسخة المكتوبة هنا...'}</p>
                  )}
                </div>
              </div>
            </Card>
            <Card>
              <h2 className="text-2xl font-semibold mb-4 text-gray-200">إضافة صوت مخصص</h2>
              <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <Button onClick={handleRecordCustomVoice} variant="secondary" className="w-full">
                          {isRecordingCustomVoice ? <><StopIcon className="w-5 h-5" /> إيقاف</> : <><MicrophoneIcon className="w-5 h-5" /> تسجيل</>}
                      </Button>
                      <Button as="label" variant="secondary" className="w-full cursor-pointer">
                          <UploadIcon className="w-5 h-5" /> رفع
                          <input type="file" accept="audio/*" onChange={handleCustomVoiceUpload} className="hidden" />
                      </Button>
                  </div>
                  {customVoice && (
                    <div className="text-center text-green-400 bg-green-900/50 p-2 rounded-lg text-sm">
                      {customVoiceFileName 
                          ? <p>الملف المحمل: <span className="font-mono">{customVoiceFileName}</span></p> 
                          : <p>العينة المسجلة جاهزة.</p>
                      }
                    </div>
                  )}
                  <p className="text-sm text-gray-500 text-center">سجل أو ارفع صوتًا لاستخدامه كخيار في مولد تحويل النص إلى كلام.</p>
              </div>
            </Card>
        </div>
          
        <Card className="flex flex-col">
            <h2 className="text-2xl font-semibold text-gray-200">تحويل النص إلى كلام</h2>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-4 mb-6">
                <div className="flex bg-gray-900/50 p-1 rounded-lg border border-gray-700">
                    <button onClick={() => setTtsMode('single')} className={`px-4 py-2 text-sm font-medium rounded-md transition ${ttsMode === 'single' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>متحدث واحد</button>
                    <button onClick={() => setTtsMode('multi')} className={`px-4 py-2 text-sm font-medium rounded-md transition ${ttsMode === 'multi' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>وضع البودكاست</button>
                </div>

                <fieldset className="border border-gray-700 rounded-lg p-2 w-full sm:w-auto">
                    <legend className="text-xs font-semibold text-gray-400 px-1">الجلسة</legend>
                    <div className="flex gap-2">
                        <Button onClick={handleSaveSession} variant="secondary" className="flex-1 text-xs py-2"><SaveIcon className="w-4 h-4" /> حفظ</Button>
                        <Button onClick={handleLoadSession} variant="secondary" className="flex-1 text-xs py-2" disabled={!hasSavedSession}><LoadIcon className="w-4 h-4" /> تحميل</Button>
                        <Button onClick={handleClearSession} variant="secondary" className="flex-1 text-xs py-2" disabled={!hasSavedSession}><TrashIcon className="w-4 h-4" /> مسح</Button>
                    </div>
                </fieldset>
            </div>
            
            {showCustomVoiceWarning && (
              <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 px-4 py-2 rounded-lg mb-4 text-sm">
                <strong>ملاحظة:</strong> الصوت المخصص هو عرض توضيحي للواجهة. واجهة برمجة التطبيقات لا تدعم الأصوات المخصصة بعد، لذا سيتم استخدام صوت افتراضي للإنشاء.
              </div>
            )}

            <div className="flex-grow">
              {ttsMode === 'single' ? (
                // --- SINGLE SPEAKER UI ---
                <div className="space-y-4">
                  <div>
                    <label htmlFor="single-voice" className="block text-sm font-medium text-gray-400 mb-1">الصوت</label>
                    <VoiceSelector id="single-voice" value={singleSpeakerVoice} onChange={(e) => setSingleSpeakerVoice(e.target.value)} />
                  </div>
                  <AutoResizeTextarea
                      value={singleSpeakerText}
                      onChange={(e) => setSingleSpeakerText(e.target.value)}
                      placeholder="أدخل النص لتوليد الكلام..."
                      className="w-full min-h-[12rem] bg-gray-900/50 rounded-lg p-4 border border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none transition"
                  />
                </div>
              ) : (
                // --- MULTI-SPEAKER (PODCAST) UI ---
                <div className="space-y-6">
                  <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-gray-700 rounded-lg p-4">
                    <legend className="text-sm font-semibold text-gray-400 px-1">إعدادات المتحدث</legend>
                    <div className="space-y-2">
                      <label htmlFor="speaker1-name" className="block text-sm font-medium text-gray-400">المتحدث 1</label>
                      <input type="text" id="speaker1-name" value={speaker1Name} onChange={(e) => setSpeaker1Name(e.target.value)} className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"/>
                      <VoiceSelector id="speaker1-voice" value={speaker1Voice} onChange={(e) => setSpeaker1Voice(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="speaker2-name" className="block text-sm font-medium text-gray-400">المتحدث 2</label>
                      <input type="text" id="speaker2-name" value={speaker2Name} onChange={(e) => setSpeaker2Name(e.target.value)} className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"/>
                      <VoiceSelector id="speaker2-voice" value={speaker2Voice} onChange={(e) => setSpeaker2Voice(e.target.value)} />
                    </div>
                  </fieldset>

                  <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pl-2 -ml-2">
                    {conversationTurns.map((turn, index) => (
                      <div 
                        key={turn.id} 
                        className={`flex items-start gap-2.5 max-w-[90%] w-fit ${turn.speakerId === 2 ? 'self-start flex-row-reverse' : 'self-end'}`}
                      >
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${turn.speakerId === 1 ? 'bg-gray-600' : 'bg-indigo-600'}`}>
                          {turn.speakerId === 1 ? speaker1Name.charAt(0) : speaker2Name.charAt(0)}
                        </div>
                        <div className={`relative w-full p-3 rounded-lg ${turn.speakerId === 1 ? 'bg-gray-700 rounded-br-none' : 'bg-indigo-800/80 rounded-bl-none'}`}>
                           <AutoResizeTextarea
                            value={turn.text}
                            onChange={(e) => handleTurnTextChange(turn.id, e.target.value)}
                            placeholder={`السطر ${index + 1}...`}
                            className="w-full bg-transparent focus:outline-none resize-none text-white placeholder-gray-400"
                            rows={1}
                          />
                        </div>
                         {conversationTurns.length > 1 && (
                            <button onClick={() => handleRemoveTurn(turn.id)} className="text-gray-500 hover:text-red-500 self-center transition-colors">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleAddTurn} variant="secondary" className="w-full"><PlusIcon className="w-5 h-5"/> إضافة دور</Button>
                </div>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-4 mt-auto pt-6">
              <Button onClick={handleGenerateSpeech} disabled={isGeneratingSpeech} className="flex-grow text-lg">
                {isGeneratingSpeech ? <Spinner /> : <SpeakerIcon className="w-5 h-5" />}
                {isGeneratingSpeech ? 'جارٍ الإنشاء...' : 'إنشاء الكلام'}
              </Button>
              {generatedAudio && (
                <Button onClick={handlePlayAudio} variant="secondary" className="flex-grow text-lg">
                  {isPlaying ? 'إيقاف' : 'تشغيل الصوت'}
                </Button>
              )}
            </div>
          </Card>
      </div>
    </div>
  );
};

export default App;