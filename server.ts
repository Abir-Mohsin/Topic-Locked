import express from 'express';
import path from 'path';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = 3000;

// Initialize Gemini client with user-agent for telemetry
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    })
  : null;

// Setup upload directory
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + originalName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Helper to decode form parameters without corrupting already valid UTF-8 strings (such as Bengali / Unicode text)
const safeDecodeField = (val: string | undefined): string => {
  if (!val) return '';
  for (let i = 0; i < val.length; i++) {
    if (val.charCodeAt(i) > 255) {
      return val; // It already contains non-latin-1 characters (like Bengali), so it is already decoded
    }
  }
  try {
    return Buffer.from(val, 'latin1').toString('utf8');
  } catch (e) {
    return val;
  }
};

// Parse JSON bodies for other potential API routes
app.use(express.json());

// API Route for file upload
app.post('/api/submit-assignment', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ error: "File upload failed: " + err.message });
    }
    
    try {
      let { studentName, studentEmail, studentBatch, topicTitle, topicId, message, targetAdminEmail } = req.body;
      studentName = safeDecodeField(studentName);
      studentBatch = safeDecodeField(studentBatch);
      topicTitle = safeDecodeField(topicTitle);
      message = safeDecodeField(message);
      targetAdminEmail = safeDecodeField(targetAdminEmail);
      
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const parsedOriginalName = safeDecodeField(file.originalname);

      // Use target admin email from request, fallback to env
      const adminEmail = targetAdminEmail || process.env.ADMIN_EMAIL || 'admin@example.com'; 
      const smtpEmail = process.env.SMTP_EMAIL;
      const smtpPass = process.env.SMTP_PASSWORD;

    if (smtpEmail && smtpPass) {
      const transporter = nodemailer.createTransport({
        service: 'gmail', 
        auth: {
          user: smtpEmail,
          pass: smtpPass
        }
      });

      const mailOptions = {
        from: smtpEmail,
        to: adminEmail,
        subject: `[Assignment Submission] ${topicTitle} - ${studentName}`,
        html: `
          <h2>New Assignment Submission</h2>
          <p><strong>Student:</strong> ${studentName} (${studentEmail})</p>
          <p><strong>Batch:</strong> ${studentBatch || 'N/A'}</p>
          <p><strong>Topic:</strong> ${topicTitle} (ID: ${topicId})</p>
          ${message ? `<p><strong>Message:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>` : ''}
          <p>Please find the assignment file attached.</p>
        `,
        attachments: [
          {
            filename: parsedOriginalName,
            path: file.path
          }
        ]
      };

      await transporter.sendMail(mailOptions);
      console.log(`Successfully sent email for topic: ${topicTitle}`);
    } else {
      console.log('--- EMAIL SIMULATION (SMTP missing in .env) ---');
      console.log(`To: ${adminEmail}`);
      console.log(`Subject: [Assignment Submission] ${topicTitle} - ${studentName}`);
      console.log(`File Attached: ${parsedOriginalName}`);
      console.log('------------------------------------------------');
    }

    // Optional: Clean up file after sending
    // fs.unlinkSync(file.path);
    
    // Using express version 4 compatible response
    res.json({ success: true, message: 'Assignment submitted successfully.' });
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ error: 'Failed to process submission' });
  }
  });
});

// API Route for sending grading notification email
app.post('/api/grade-assignment', async (req, res) => {
  try {
    const { studentEmail, studentName, topicTitle, grade, gradeOutOf, gradeMessage } = req.body;

    if (!studentEmail) {
      return res.status(400).json({ error: 'Student email is required.' });
    }

    const smtpEmail = process.env.SMTP_EMAIL;
    const smtpPass = process.env.SMTP_PASSWORD;

    if (smtpEmail && smtpPass) {
      const transporter = nodemailer.createTransport({
        service: 'gmail', 
        auth: {
          user: smtpEmail,
          pass: smtpPass
        }
      });

      const mailOptions = {
        from: smtpEmail,
        to: studentEmail,
        subject: `[Topic Evaluation] Your Grade for "${topicTitle}"`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <h2 style="color: #0d9488; font-size: 20px; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">Research Assignment Evaluated / ফলাফল প্রকাশ</h2>
            <p>Dear <strong>${studentName || 'Student'}</strong>,</p>
            <p>Your assignment submission for the topic <strong>"${topicTitle}"</strong> has been reviewed and graded by the teacher.</p>
            
            <div style="background-color: #fef3c7; border: 1px solid #fde68a; padding: 18px; border-radius: 12px; margin: 20px 0;">
              <p style="margin: 0; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #b45309;">Grading Decision</p>
              <h3 style="margin: 8px 0 0 0; font-size: 32px; font-weight: 900; color: #78350f; display: inline-block;">${grade}</h3>
              <span style="font-size: 14px; font-weight: bold; color: #92400e;"> / out of ${gradeOutOf}</span>
              
              ${gradeMessage ? `
                <div style="margin-top: 12px; background-color: #ffffff; border: 1px solid #fef3c7; padding: 12px; border-radius: 8px; font-style: italic; font-size: 13px; color: #4b5563;">
                  "${gradeMessage}"
                </div>
              ` : ''}
            </div>
            
            <p style="font-size: 13px; color: #64748b;">You can also check the evaluation breakdown directly on your Student Dashboard in the system.</p>
            <p style="margin-top: 24px; font-size: 13px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 15px;">Best regards,<br/>Academic Supervisor & Admin Panel</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`Successfully sent grade evaluation email to: ${studentEmail}`);
    } else {
      console.log('--- GRADE EMAIL SIMULATION (SMTP missing in .env) ---');
      console.log(`To: ${studentEmail}`);
      console.log(`Subject: [Topic Evaluation] Your Grade for "${topicTitle}"`);
      console.log(`Grade: ${grade} / ${gradeOutOf}`);
      console.log(`Message: ${gradeMessage || 'None'}`);
      console.log('------------------------------------------------------');
    }

    res.json({ success: true, message: 'Grading notification email triggered.' });
  } catch (error: any) {
    console.error('Grading notification error:', error);
    res.status(500).json({ error: 'Failed to process grading notification: ' + error.message });
  }
});

// API Route for AI-assisted topic list generation
app.post('/api/generate-topics', async (req, res) => {
  try {
    const { prompt, count, subject } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required. অনুগ্রহ করে প্রম্পট লিখুন।' });
    }
    
    const requestedCount = Math.min(Math.max(parseInt(count) || 5, 1), 10);
    const resolvedSubject = subject || 'General';

    if (!ai) {
      console.warn("GEMINI_API_KEY is not set. Simulating fallback data...");
      const simulatedTopics = Array.from({ length: requestedCount }).map((_, i) => ({
        title: `AI generated: ${resolvedSubject} Research Area ${i + 1}`,
        description: `এটি একটি ট্রায়াল ডেসক্রিপশন। Gemini API কী সেট করা না থাকলে এটি স্বয়ংক্রিয়ভাবে প্রদান করা হয়। বিস্তারিত গবেষণা করুন এবং প্রবন্ধ তৈরি করুন: "${prompt}" - অংশ ${i + 1}।`,
        subject: resolvedSubject
      }));
      return res.json({ topics: simulatedTopics });
    }

    const systemInstruction = `You are an academic curriculum designer and research advisor. Your task is to generate unique, high-quality, practical research/assignment topic suggestions based on the user's prompt.
For each topic, provide:
1. title: A strong, professional academic title (do NOT include any prefix serial numbers like "1." or "Topic:").
2. description: A clear, structured, detailed description of what the project/research task entails (written in Bengali or English depending on the prompt's language, default to Bengali if prompt is in Bengali). Include bulleted guidelines if helpful.
3. subject: A specific category/discipline of study (e.g., Computer Science, Hadith Studies, Islamic Jurisprudence, Biochemistry).

Ensure that all text generated is engaging, academically sound, polite, and directly helpful. Response must strictly follow the requested JSON schema.`;

    const userPrompt = `Generate exactly ${requestedCount} unique, high-quality academic research topics under the general theme or subject code of "${resolvedSubject}" based on this user instruction: "${prompt}".`;

    // Try multiple model fallbacks in case of transient 503 or overload issues
    const modelsToTry = [
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.5-pro"
    ];
    let lastError: any = null;
    let responseText = "";

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const modelName of modelsToTry) {
      // Retry 3 times per model
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Attempting to generate topics using model: ${modelName} (Attempt ${attempt}/3)`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: userPrompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                required: ["topics"],
                properties: {
                  topics: {
                    type: Type.ARRAY,
                    description: "List of generated assignment topics",
                    items: {
                      type: Type.OBJECT,
                      required: ["title", "description", "subject"],
                      properties: {
                        title: {
                          type: Type.STRING,
                          description: "Captivating and clear academic assignment title"
                        },
                        description: {
                          type: Type.STRING,
                          description: "Details and instructions of what students need to complete."
                        },
                        subject: {
                          type: Type.STRING,
                          description: "The main category or discipline (e.g. Science, Hadith, Algebra)."
                        }
                      }
                    }
                  }
                }
              }
            }
          });

          if (response.text) {
            responseText = response.text;
            console.log(`Success with model: ${modelName}`);
            break; // Exit retry loop on successful generation
          }
        } catch (err: any) {
          console.error(`Error with model ${modelName} (Attempt ${attempt}/3):`, err.message || err);
          lastError = err;
          if (attempt < 3 && err?.status !== "NOT_FOUND") { // Don't retry if model does not exist
            await sleep(2000 * attempt); // wait 2s, then 4s
            continue;
          }
        }
      }
      
      if (responseText) {
        break; // Exit model selection loop!
      }
    }

    if (!responseText) {
      throw lastError || new Error("All candidate Gemini models failed to generate content.");
    }

    const parsedData = JSON.parse(responseText.trim());
    return res.json({ topics: parsedData.topics || [] });

  } catch (error: any) {
    console.error("AI Topic generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate topics with AI" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
