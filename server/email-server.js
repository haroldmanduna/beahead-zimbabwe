import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';

const app = express();
app.use(cors());
app.use(express.json());

const GMAIL_USER = process.env.GMAIL_USER || 'haroldmanduna4@gmail.com';
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD || 'soehpwzjyvnbkjyi';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'BeAhead Email Service Live', gmail: GMAIL_USER });
});

app.post('/send-email', async (req, res) => {
  try {
    const { to, subject, html } = req.body;
    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing to, subject, html' });
    }

    const info = await transporter.sendMail({
      from: `BeAhead <${GMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html
    });

    console.log('Email sent:', info.messageId, 'to', to);
    res.json({ success: true, messageId: info.messageId, to });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`BeAhead Email Service running on port ${PORT}, Gmail: ${GMAIL_USER}`);
});
