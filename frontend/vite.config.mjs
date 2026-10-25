import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'frontend',
  base: process.env.VITE_BASE_PATH?.trim() || '/',
  plugins: [react(), {
    name: 'public-page-metadata',
    transformIndexHtml(html, context) {
      const token = process.env.GOOGLE_SITE_VERIFICATION?.trim();
      if (token && !/^[A-Za-z0-9_-]{20,200}$/.test(token)) {
        throw new Error('GOOGLE_SITE_VERIFICATION 格式無效');
      }
      const canonical = process.env.VITE_CANONICAL_URL?.trim();
      if (canonical && !/^https:\/\/[^?#]+\/$/.test(canonical)) {
        throw new Error('VITE_CANONICAL_URL 必須是 HTTPS 網站根網址');
      }
      const ga4Id = process.env.VITE_GA4_ID?.trim();
      if (ga4Id && !/^G-[A-Z0-9]{6,20}$/.test(ga4Id)) throw new Error('VITE_GA4_ID 格式無效');
      const noindex = process.env.VITE_NOINDEX === 'true';
      const metadata = [
        token ? `<meta name="google-site-verification" content="${token}" />` : '',
        canonical ? `<link rel="canonical" href="${new URL(context.path.replace(/^\/+/, '').replace(/index\.html$/, ''), canonical)}" />` : '',
        noindex ? '<meta name="robots" content="noindex,follow" />' : '',
        ga4Id ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga4Id}');</script>` : '',
      ].filter(Boolean).join('\n  ');
      return metadata ? html.replace('</head>', `  ${metadata}\n  </head>`) : html;
    },
  }],
  build: {
    outDir: '../web/react-build',
    emptyOutDir: true,
    assetsDir: 'react-assets',
    rollupOptions: {
      input: {
        home: resolve('frontend/index.html'),
        ocean: resolve('frontend/explore/ocean/index.html'),
        fossils: resolve('frontend/explore/fossils/index.html'),
      },
    },
  },
});
