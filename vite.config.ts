import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { handleCustomPackRequest } from './server/gemini-custom-pack.js';
import { handleQuestionAudioRequest } from './server/elevenlabs-question-audio.js';
import { handleSpecialQuipRequest } from './server/gemini-special-quip.js';
import { handlePolymarketEventsRequest } from './server/polymarket-events.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: '/',
    plugins: [
      react(),
      {
        name: 'elevenlabs-question-audio-dev-route',
        configureServer(server) {
          server.middlewares.use('/api/elevenlabs-question-audio', async (req, res, next) => {
            if (req.method !== 'POST') {
              next();
              return;
            }

            try {
              const body = await new Promise<string>((resolve, reject) => {
                let rawBody = '';

                req.on('data', chunk => {
                  rawBody += chunk;
                });

                req.on('end', () => resolve(rawBody));
                req.on('error', reject);
              });

              const response = await handleQuestionAudioRequest({
                method: req.method,
                body,
                apiKey: env.ELEVENLABS_API_KEY,
                voiceId: env.ELEVENLABS_VOICE_ID,
              });

              res.statusCode = response.status;
              Object.entries(response.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
              });
              res.end(response.body);
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: error instanceof Error ? error.message : 'Failed to generate question narration',
              }));
            }
          });

          server.middlewares.use('/api/gemini-special-quip', async (req, res, next) => {
            if (req.method !== 'POST') {
              next();
              return;
            }

            try {
              const body = await new Promise<string>((resolve, reject) => {
                let rawBody = '';

                req.on('data', chunk => {
                  rawBody += chunk;
                });

                req.on('end', () => resolve(rawBody));
                req.on('error', reject);
              });

              const response = await handleSpecialQuipRequest({
                method: req.method,
                body,
                apiKey: env.GEMINI_API_KEY,
              });

              res.statusCode = response.status;
              Object.entries(response.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
              });
              res.end(response.body);
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: error instanceof Error ? error.message : 'Failed to generate special quip',
              }));
            }
          });

          server.middlewares.use('/api/gemini-custom-pack', async (req, res, next) => {
            if (req.method !== 'POST') {
              next();
              return;
            }

            try {
              const body = await new Promise<string>((resolve, reject) => {
                let rawBody = '';

                req.on('data', chunk => {
                  rawBody += chunk;
                });

                req.on('end', () => resolve(rawBody));
                req.on('error', reject);
              });

              const response = await handleCustomPackRequest({
                method: req.method,
                body,
                apiKey: env.GEMINI_API_KEY,
              });

              res.statusCode = response.status;
              Object.entries(response.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
              });
              res.end(response.body);
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: error instanceof Error ? error.message : 'Failed to generate custom pack',
              }));
            }
          });

          server.middlewares.use('/api/polymarket-events', async (req, res, next) => {
            if (req.method !== 'GET') {
              next();
              return;
            }

            try {
              const requestUrl = new URL(req.url ?? '', 'http://localhost');
              const response = await handlePolymarketEventsRequest({
                method: req.method,
                query: Object.fromEntries(requestUrl.searchParams.entries()),
              });

              res.statusCode = response.status;
              Object.entries(response.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
              });
              res.end(response.body);
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: error instanceof Error ? error.message : 'Failed to fetch Polymarket events',
              }));
            }
          });
        },
      },
    ],
    envPrefix: ['VITE_', 'SUPABASE_'],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './client/src'),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
  };
});
