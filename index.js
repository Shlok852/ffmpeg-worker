require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');
const cloudinary = require('cloudinary').v2;

const app = express();
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.diiqlfwsk,
  api_key: process.env.931479174868983,
  api_secret: process.env.mtUb5say9w-6KDgAbLjbgHr75Uo
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

    const videoPath = "./video.mp4";
    const audioPath = "./audio.wav";

    // 1. Download video
    const video = await axios({ url: input_url, method: "GET", responseType: "stream" });
    await new Promise(resolve => {
      const w = fs.createWriteStream(videoPath);
      video.data.pipe(w);
      w.on("close", resolve);
    });

    // 2. Run FFmpeg command to extract audio
    await new Promise((resolve, reject) => {
      exec(`ffmpeg -y -i ${videoPath} -vn -acodec pcm_s16le -ar 16000 -ac 1 ${audioPath}`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 3. Upload extracted audio to Cloudinary
    const upload = await cloudinary.uploader.upload(audioPath, {
      resource_type: "video",
      folder: "audio-extracted"
    });

    return res.json({
      status: "ok",
      audio_url: upload.secure_url,
      job_id
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log("Worker running on port", process.env.PORT);
});
