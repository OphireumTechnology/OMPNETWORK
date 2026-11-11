import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));

// Initialize Google GenAI client if GEMINI_API_KEY is available and not a placeholder
const apiKey = process.env.GEMINI_API_KEY || '';
const isRealApiKey = Boolean(apiKey && !apiKey.includes('MY_GEMINI_API_KEY') && apiKey.length > 10);
const ai = isRealApiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// =========================================================================
// API ENDPOINTS
// =========================================================================

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    platform: 'OPHIREUM NETWORK Voice & AI Gateway',
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(apiKey),
  });
});

// Voice Session Configuration
app.post('/api/voice/session', (req: Request, res: Response) => {
  const { language = 'en-US' } = req.body || {};
  const sessionId = `opm-voice-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  
  res.json({
    sessionId,
    status: 'ready',
    preferredModel: 'gemini-3.8-flash',
    preferredTtsModel: 'gemini-3.8-flash-lite-tts',
    language,
    sampleRate: 24000,
    serverGeminiAvailable: Boolean(ai),
    disclaimer: 'OPHIREUM AI Solutions Consultant voice session initialized. Audio is processed for real-time consultation and not permanently stored.',
  });
});

// Process conversational voice turn with Gemini
app.post('/api/voice/process', async (req: Request, res: Response) => {
  const { 
    userMessage, 
    language = 'en-US',
    conversationHistory = [], 
    client = {}, 
    requirements = {} 
  } = req.body || {};

  if (!userMessage || typeof userMessage !== 'string') {
    return res.status(400).json({ error: 'userMessage is required' });
  }

  const isFilipino = language.startsWith('fil') || language.startsWith('tl') || /filipino|tagalog/i.test(language);

  // System instruction for the voice solutions consultant
  const systemInstruction = `You are the official OPHIREUM AI Solutions Consultant for OPHIREUM MULTIMEDIA PRODUCTION located at KMC | One West Aeropark, Clark Freeport Zone, Mabalacat City, Pampanga, Philippines.
Registered DTI Business Name: OPHIREUM MULTIMEDIA PRODUCTION (Registration No. 7567003). Founder & CEO: Dhenze Languisan (mobile: +63 917 966 8814).

Primary Disciplines:
1. Multimedia & Cinema Production (4K/8K, Post-Production, Color Grading, Virtual Production)
2. AI Solutions & Automation (Custom Models, Agent Workforce, Workflow Automation)
3. Enterprise Software & Cloud Platforms (React 19, TypeScript, PostgreSQL, Supabase, Cloud Architecture)
4. Website & Digital Platform Building
5. Broadcast & Low-Latency Streaming
6. Digital Platforms & Interactive 3D

Tone & Voice Personality:
- Professional, consultative, articulate, executive-grade, confident, approachable.
- When speaking in English, use crisp, clear executive diction.
- When the user speaks in Filipino/Tagalog or ${isFilipino ? 'Filipino mode is active' : 'requested'}, speak natural, respectful Filipino (with professional English technical terms).
- IMPORTANT FOR VOICE: Keep spoken answers CONCISE and conversational (2 to 4 sentences maximum). Do NOT output markdown tables, asterisks, bullet points, or raw JSON, as this will be read aloud.
- Guide the conversation proactively: Ask targeted questions about their business goals, project scope, target timeline, or offer to schedule a consultation appointment with CEO Dhenze Languisan or the engineering team.
- If the client asks to book an appointment, offer available consultation times (Monday to Friday, 9:00 AM to 5:00 PM PST) and ask for their preferred time zone and meeting method (Video Conference, In-Person at Clark Freeport Zone, or Direct Phone).`;

  try {
    if (ai) {
      // Build history contents if provided
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
      
      // Include last 6 turns of conversation for context
      const recentHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-6) : [];
      for (const turn of recentHistory) {
        if (turn.sender === 'user' && turn.text) {
          contents.push({ role: 'user', parts: [{ text: turn.text }] });
        } else if (turn.sender === 'ai' && turn.text) {
          contents.push({ role: 'model', parts: [{ text: turn.text }] });
        }
      }

      contents.push({ role: 'user', parts: [{ text: userMessage }] });

      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout')), 6000)
      );

      const geminiPromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: contents as any,
        config: {
          systemInstruction,
        },
      });

      const response: any = await Promise.race([geminiPromise, timeoutPromise]);
      const replyText = response && response.text ? response.text.trim() : '';

      // Analyze intent for booking or brief
      const isBookingIntent = /schedule|appointment|book|calendar|slot|meeting/i.test(userMessage);
      const isBriefIntent = /brief|proposal|scope|specification|quote/i.test(userMessage);
      const isHumanEscalation = /speak to (a )?human|call (the )?ceo|dhenze|founder|phone number/i.test(userMessage);

      return res.json({
        replyText: replyText || "I understand your project requirements. Would you like me to architect a preliminary brief or reserve a consultation slot for you?",
        detectedIntent: {
          isBookingIntent,
          isBriefIntent,
          isHumanEscalation,
        },
        language,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Rule-based fallback if GEMINI_API_KEY is not configured
      let replyText = `Understood. At OPHIREUM MULTIMEDIA PRODUCTION, our engineering team in Clark Freeport Zone specializes in delivering enterprise digital platforms and cinema-grade productions.`;
      
      if (/deliver|app|mobile|logistics|ecommerce|store/i.test(userMessage)) {
        replyText = isFilipino
          ? "Maaari tayong mag-develop ng kumpletong platform na may customer ordering, dispatch operations, at real-time GPS tracking. Ilang merchants at riders po ang plano ninyong suportahan sa simula?"
          : "We can engineer a scalable platform covering client ordering, merchant management, automated dispatch, and real-time delivery tracking. Approximately how many merchants and riders do you plan to support initially?";
      } else if (/schedule|appointment|book|meeting/i.test(userMessage)) {
        replyText = isFilipino
          ? "Ikinagagalak po naming mag-schedule ng consultation. May available slots tayo mula Lunes hanggang Biyernes sa Clark Freeport Zone o via Google Meet. Anong oras po ang pinakamainam para sa inyo?"
          : "I would be pleased to schedule an executive consultation. We have availability Monday through Friday for video conference or in-person at our Clark Freeport Zone suite. What day and time works best for you?";
      } else if (/ai|automation|agent/i.test(userMessage)) {
        replyText = isFilipino
          ? "Ang aming AI solutions architecture ay gumagamit ng server-side Google GenAI pipelines na may RLS security at enterprise role management. Nais po ba ninyong suriin ang customized project brief?"
          : "Our AI solutions architecture employs server-side GenAI pipelines with strict role-based access control and high-throughput data processing. Would you like to review an architectural brief?";
      }

      return res.json({
        replyText,
        detectedIntent: {
          isBookingIntent: /schedule|appointment|book|meeting/i.test(userMessage),
          isBriefIntent: /brief|proposal|scope/i.test(userMessage),
          isHumanEscalation: /human|ceo|dhenze|call/i.test(userMessage),
        },
        language,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.warn('Gemini API call bypassed or timed out, returning consultative fallback:', error?.message || error);
    
    // Fallback response generator
    let fallbackReply = isFilipino
      ? "Naintindihan ko po ang inyong pangangailangan. Nais po ba ninyong mag-schedule tayo ng consultation kasama ang aming technical team sa Clark Freeport Zone o via Google Meet?"
      : "I understand your project objective. We can architect a custom platform tailored to your operational specifications. Would you like to schedule an executive consultation or review a structured brief?";

    if (/deliver|app|mobile|logistics|ecommerce|store/i.test(userMessage)) {
      fallbackReply = isFilipino
        ? "Maaari tayong mag-develop ng enterprise platform na may customer ordering, dispatch management, at real-time GPS tracking. Ilang merchants at riders po ang plano ninyong suportahan sa simula?"
        : "We can engineer a scalable delivery platform with customer ordering, merchant management, automated dispatch, and real-time delivery tracking. Approximately how many merchants and riders do you plan to support initially?";
    } else if (/schedule|appointment|book|meeting/i.test(userMessage)) {
      fallbackReply = isFilipino
        ? "Ikinagagalak po naming mag-schedule ng consultation. May available slots tayo mula Lunes hanggang Biyernes sa Clark Freeport Zone o via Google Meet. Anong oras po ang pinakamainam para sa inyo?"
        : "I would be pleased to schedule an executive consultation. We have availability Monday through Friday for video conference or in-person at our Clark Freeport Zone suite. What day and time works best for you?";
    }

    return res.json({
      replyText: fallbackReply,
      detectedIntent: {
        isBookingIntent: /schedule|appointment|book|meeting/i.test(userMessage),
        isBriefIntent: /brief|proposal|scope/i.test(userMessage),
        isHumanEscalation: /human|ceo|dhenze|call/i.test(userMessage),
      },
      language,
      timestamp: new Date().toISOString(),
      provider: 'OPHIREUM Consultative Voice Engine',
    });
  }
});

// Audio transcription endpoint (using gemini-3.5-transcribe or gemini-3.8-flash)
app.post('/api/voice/transcribe', async (req: Request, res: Response) => {
  const { audioBase64, mimeType = 'audio/webm' } = req.body || {};

  if (!audioBase64) {
    return res.status(400).json({ error: 'audioBase64 is required' });
  }

  if (!ai) {
    return res.json({
      transcript: '',
      notice: 'Server-side Gemini transcription not configured with API key. Client-side speech recognition is active.',
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Accurately transcribe the spoken speech in this audio clip. Return ONLY the transcribed text without quotes or explanations.',
            },
          ],
        },
      ],
    });

    const transcript = response.text ? response.text.trim() : '';
    res.json({ transcript });
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Transcription failed', details: error?.message });
  }
});

// =========================================================================
// DEV / PROD SERVER BOOTSTRAP
// =========================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Mount Vite middleware in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OPHIREUM NETWORK] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[OPHIREUM NETWORK] Gemini Voice Engine: ${apiKey ? 'ONLINE' : 'FALLBACK_MODE'}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
});
