import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { build as viteBuild } from 'vite';

// Build inject.js separately as IIFE (self-contained, no imports)
async function buildInjectScript() {
  await viteBuild({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/inject/index.ts'),
        name: 'ReactDebuggerInject',
        formats: ['iife'],
        fileName: () => 'inject.js',
      },
      rollupOptions: {
        output: {
          // Ensure everything is inlined - no external chunks
          inlineDynamicImports: true,
        },
      },
      minify: false,
      sourcemap: false,
    },
  });
}

// Build content.js separately as IIFE
async function buildContentScript() {
  await viteBuild({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/content/index.ts'),
        name: 'ReactDebuggerContent',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
      minify: false,
      sourcemap: false,
    },
  });
}

// Build background.js separately as IIFE
async function buildBackgroundScript() {
  await viteBuild({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/background/index.ts'),
        name: 'ReactDebuggerBackground',
        formats: ['iife'],
        fileName: () => 'background.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
      minify: false,
      sourcemap: false,
    },
  });
}

function copyAssetsAndFixPaths() {
  return {
    name: 'copy-assets-fix-paths',
    async closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const publicDir = resolve(__dirname, 'public');
      
      // Copy manifest.json
      copyFileSync(
        resolve(publicDir, 'manifest.json'),
        resolve(distDir, 'manifest.json')
      );
      
      // Copy icons
      if (!existsSync(resolve(distDir, 'icons'))) {
        mkdirSync(resolve(distDir, 'icons'), { recursive: true });
      }
      
      const iconSizes = ['16', '48', '128'];
      for (const size of iconSizes) {
        const iconPath = resolve(publicDir, `icons/icon${size}.png`);
        if (existsSync(iconPath)) {
          copyFileSync(iconPath, resolve(distDir, `icons/icon${size}.png`));
        }
      }
      
      // Copy popup files
      const popupHtml = resolve(publicDir, 'popup.html');
      const popupJs = resolve(publicDir, 'popup.js');
      if (existsSync(popupHtml)) {
        copyFileSync(popupHtml, resolve(distDir, 'popup.html'));
      }
      if (existsSync(popupJs)) {
        copyFileSync(popupJs, resolve(distDir, 'popup.js'));
      }
      
      // Fix HTML paths and move to dist root
      const srcDir = resolve(distDir, 'src');
      if (existsSync(srcDir)) {
        const devtoolsHtml = resolve(srcDir, 'devtools/devtools.html');
        const panelHtml = resolve(srcDir, 'panel/panel.html');
        
        if (existsSync(devtoolsHtml)) {
          let content = readFileSync(devtoolsHtml, 'utf-8');
          content = content.replace(/\.\.\/\.\.\//g, './');
          writeFileSync(resolve(distDir, 'devtools.html'), content);
        }
        if (existsSync(panelHtml)) {
          let content = readFileSync(panelHtml, 'utf-8');
          content = content.replace(/\.\.\/\.\.\//g, './');
          writeFileSync(resolve(distDir, 'panel.html'), content);
        }
        
        rmSync(srcDir, { recursive: true, force: true });
      }
      
      // Build standalone scripts AFTER main build
      console.log('[React Debugger] Building standalone inject.js...');
      await buildInjectScript();
      console.log('[React Debugger] Building standalone content.js...');
      await buildContentScript();
      console.log('[React Debugger] Building standalone background.js...');
      await buildBackgroundScript();
      
      // Clean up chunks folder if empty or only has unused chunks
      const chunksDir = resolve(distDir, 'chunks');
      if (existsSync(chunksDir)) {
        rmSync(chunksDir, { recursive: true, force: true });
      }
      
      console.log('[React Debugger] Build complete!');
    }
  };
}

export default defineConfig({
  plugins: [react(), copyAssetsAndFixPaths()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Disable modulepreload polyfill - Chrome extensions don't need it
    // and it causes issues when chunks are cleaned up
    modulePreload: false,
    rollupOptions: {
      input: {
        devtools: resolve(__dirname, 'src/devtools/devtools.html'),
        panel: resolve(__dirname, 'src/panel/panel.html'),
      },
      output: {
        format: 'es',
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'devtools') return 'devtools.js';
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'styles/[name][extname]';
          }
          return 'assets/[name][extname]';
        },
      },
    },
    minify: false,
    sourcemap: false,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
});
