import express from 'express';
import path from 'path';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';

const app = express();
const PORT = 3000;

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
