import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'frontend',
  base: '/',
  plugins: [react(), {
    name: 'search-console-verification',
    transformIndexHtml(html) {
      const token = process.env.GOOGLE_SITE_VERIFICATION?.trim();
      if (!token) return html;
      if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) {
        throw new Error('GOOGLE_SITE_VERIFICATION 格式無效');
      }
      return html.replace('</head>', `  <meta name="google-site-verification" content="${token}" />\n  </head>`);
    },
  }],
  build: {
    outDir: '../web/react-build',
    emptyOutDir: true,
    assetsDir: 'react-assets',
  },
});
