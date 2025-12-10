require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');
const cloudinary = require('cloudinary').v2;

const app = express();
app.use(express.json());

// Use environment variable NAMES here — values live in Render environment variables
cloudinary.config({
  cloud_name: process.env.diiqlfwsk,
  api_key: process.env.931479174868983,
  api_secret: process.env.mtUb5say9w-6KDgAbLjbgHr75Uo,
  secure: true,
});

function auth(req, res, next) {
  if (req.headers.authorization !== `Bearer ${process.env.WORKER_KEY}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.post("/extract-audio", auth, async (req, res) => {
  try {
    const { input_url, job_id } = req.body;

    if (!input_url) return res.status(400).json({ error: "input_url required" });

    const id = job_id || `job-${Date.now()}`;
    const workDir = `/tmp/${id}`;
    fs.mkdirSync(workDir, { recursive: true });

    const videoPath = `${workDir}/input_video.mp4`;
    const audioPath = `${workDir}/audio.wav`;

    // 1. Download video
    const video = await axios({ url: input_url, method: "GET", responseType: "stream", timeout: 120000 });
    await new Promise((resolve, reject) => {
      const w = fs.createWriteStream(videoPath);
      video.data.pipe(w);
      w.on("close", resolve);
      w.on("error", reject);
    });

    // 2. Run FFmpeg command to extract audio (16kHz mono WAV)
    await new Promise((resolve, reject) => {
      const cmd = `ffmpeg -y -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`;
      exec(cmd, { timeout: 120000 }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // 3. Upload extracted audio to Cloudinary
    let audioUrl = null;
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      const upload = await cloudinary.uploader.upload(audioPath, {
        resource_type: "auto",
        folder: `ffmpeg-worker/${id}`,
        public_id: 'audio'
      });
      audioUrl = upload.secure_url;
    } else {
      audioUrl = `file://${audioPath}`;
    }

    // Optionally callback n8n (if provided)
    if (req.body.callback_url) {
      axios.post(req.body.callback_url, { status: 'ok', audio_url: audioUrl, job_id: id }).catch(() => {});
    }

    res.json({ status: "ok", audio_url: audioUrl, job_id: id });
  } catch (e) {
    console.error('worker error', e);
    res.status(500).json({ error: e.message });
  } finally {
    // cleanup could be implemented if needed
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("Worker running on port", PORT);
});
