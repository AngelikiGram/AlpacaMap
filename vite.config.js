import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const ollamaTarget = env.VITE_OLLAMA_ENDPOINT || 'http://localhost:11434'

  return {
    base: './',
    plugins: [react()],
    server: {
      proxy: {
        '/ollama-proxy': {
          target: ollamaTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ollama-proxy/, ''),
        },
        '/reddit-proxy': {
          target: 'https://api.reddit.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/reddit-proxy/, ''),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
          },
        },
        '/old-reddit-proxy': {
          target: 'https://old.reddit.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/old-reddit-proxy/, ''),
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TravelPlanner/1.0)',
            'Accept': 'application/json',
            'Accept-Encoding': 'identity',
          },
        },
        '/pullpush-proxy': {
          target: 'https://api.pullpush.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/pullpush-proxy/, ''),
          headers: {
            'User-Agent': 'TravelKnowledgeExtractor/1.0',
            'Accept': 'application/json',
            'Accept-Encoding': 'identity',
          },
        },
        '/ddg-proxy': {
          target: 'https://html.duckduckgo.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ddg-proxy/, ''),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        },
        '/wikitravel-proxy': {
          target: 'https://wikitravel.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/wikitravel-proxy/, ''),
          headers: {
            'User-Agent': 'TravelKnowledgeExtractor/1.0 (educational tool)',
          },
        },
        '/stackexchange-proxy': {
          target: 'https://api.stackexchange.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/stackexchange-proxy/, ''),
          headers: { 'Accept-Encoding': 'identity', 'Accept': 'application/json' },
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              // Force identity encoding so Node can read the response without decompression issues
              delete proxyRes.headers['content-encoding'];
            });
          },
        },
        '/wikivoyage-proxy': {
          target: 'https://en.wikivoyage.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/wikivoyage-proxy/, ''),
          headers: {
            'User-Agent': 'TravelKnowledgeExtractor/1.0 (educational tool)',
          },
        },
        '/wikipedia-proxy': {
          target: 'https://en.wikipedia.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/wikipedia-proxy/, ''),
          headers: {
            'User-Agent': 'TravelKnowledgeExtractor/1.0 (educational tool)',
          },
        },
        '/overpass-proxy': {
          target: 'https://overpass-api.de',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/overpass-proxy/, ''),
          headers: {
            'User-Agent': 'TravelKnowledgeExtractor/1.0 (educational tool)',
            'Accept': 'application/json',
          },
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    },
  }
})
