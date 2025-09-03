require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
// Gemini SDK
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// Serve static files (CSS, JS, images)
app.use(express.static(__dirname));

// Root route -> serve index.html
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Example JSON route
app.get('/predict', (_req, res) => {
	res.json({ ok: true, route: '/predict', message: 'Example prediction endpoint', model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
});

// Proxy: IP-based geolocation (server-side to avoid client CORS issues)
app.get('/api/ip', async (_req, res) => {
	try {
		const resp = await fetch('https://ipapi.co/json/');
		if (!resp.ok) return res.status(502).json({ error: 'ipapi failed' });
		const data = await resp.json();
		res.json({
			latitude: data.latitude,
			longitude: data.longitude,
			city: data.city,
			region: data.region,
			country: data.country_name
		});
	} catch (e) {
		console.error('IP proxy error:', e);
		res.status(500).json({ error: 'ip proxy error' });
	}
});

// Proxy: Reverse geocoding via Nominatim with proper headers
app.get('/api/reverse-geocode', async (req, res) => {
	try {
		const { lat, lon } = req.query || {};
		if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
		const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
		const resp = await fetch(url, {
			headers: {
				'User-Agent': 'KisanMitra/1.0 (contact: support@kisanmitra.example)'
			}
		});
		if (!resp.ok) return res.status(502).json({ error: 'nominatim failed' });
		const data = await resp.json();
		res.json(data);
	} catch (e) {
		console.error('Reverse geocode proxy error:', e);
		res.status(500).json({ error: 'reverse geocode proxy error' });
	}
});

// Chat endpoint
app.post('/chat', async (req, res) => {
	try {
		const {
			message,
			language = 'en',
			location = '',
			state = '',
			district = '',
			soilType = '',
			history = []
		} = req.body || {};

		if (!message || typeof message !== 'string') {
			return res.status(400).json({ error: 'message is required' });
		}

		// Use Gemini only (as requested)
		const geminiKey = process.env.GEMINI_API_KEY;
		if (!geminiKey) {
			return res.status(500).json({ error: 'GEMINI_API_KEY must be set on server' });
		}
		const genAI = new GoogleGenerativeAI(geminiKey);
		const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
		const model = genAI.getGenerativeModel({ model: modelName });

		const systemPrompt = `You are Kisan Mitra, a helpful, accurate, and safety-first agricultural advisor for Indian small and marginal farmers.
Respond in the user's preferred language (ISO code): ${language}. Keep answers concise, practical, and actionable.
DO NOT ask the user questions. If information is missing, make safe, reasonable assumptions and state them briefly, then provide a direct, step-by-step recommendation tailored to the context.
Use the provided context (if available):
- Location: ${location} (State: ${state}, District: ${district})
- Soil type: ${soilType}
Provide: crop selection advice, integrated pest management, fertilizer and soil health guidance, weather-aware tips, and market-aware considerations when relevant.
NEVER fabricate regulations or chemical dosages; prefer integrated pest management and safe, locally appropriate practices. Avoid medical or veterinary advice.`;

		// Build conversation contents with short memory
		const limitedHistory = Array.isArray(history) ? history.slice(-10) : [];
		const contents = [];
		contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
		for (const turn of limitedHistory) {
			const role = turn.role === 'assistant' ? 'model' : 'user';
			const text = typeof turn.content === 'string' ? turn.content : '';
			if (text) contents.push({ role, parts: [{ text }] });
		}
		contents.push({ role: 'user', parts: [{ text: message }] });

		const result = await model.generateContent({
			contents,
			generationConfig: { temperature: 0.2, maxOutputTokens: 700 }
		});
		const content = (typeof result?.response?.text === 'function') ? result.response.text() : 'Sorry, I could not generate a response.';
		res.json({ reply: content });
	} catch (err) {
		console.error('Gemini error:', err);
		res.status(500).json({ error: 'Failed to get response from assistant' });
	}
});

// Do not call app.listen() in serverless/Vercel. Export the app instead.
module.exports = app;


