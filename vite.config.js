import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from '@tailwindcss/vite';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/**
 * Vite plugin: strip CSS `@layer` wrappers from the output.
 *
 * Works around a WebKit bug in the Tauri WKWebView where `padding` and `margin`
 * properties declared inside any `@layer` block are silently ignored.
 * Removing the layer wrappers makes Tailwind utilities fall back to normal
 * cascade order + specificity, which works correctly.
 */
function stripCssLayers() {
  return {
    name: 'strip-css-layers',
    enforce: /** @type {const} */ ('post'),
    transform(/** @type {string} */ code, /** @type {string} */ id) {
      // Only process CSS-like files
      if (!/\.css($|\?)/.test(id) && !/[&?]lang\.css/.test(id)) return;
      if (!code.includes('@layer')) return;

      let out = '';
      let i = 0;
      const len = code.length;

      while (i < len) {
        // Quick check before doing a substring comparison
        if (code.charCodeAt(i) === 64 /* @ */ && code.substring(i, i + 7) === '@layer ') {
          let j = i + 7;
          // Advance past the layer name(s)
          while (j < len && code[j] !== ';' && code[j] !== '{') j++;

          if (j < len && code[j] === ';') {
            // Layer declaration  →  @layer theme, base, …;   — drop it
            i = j + 1;
            continue;
          }

          if (j < len && code[j] === '{') {
            // Layer block  →  unwrap the content between { }
            j++; // skip opening brace
            let depth = 1;
            const start = j;
            while (j < len && depth > 0) {
              const ch = code[j];
              if (ch === '{') depth++;
              else if (ch === '}') depth--;
              j++;
            }
            // Content is [start … j-1)  (j-1 is the closing brace)
            out += code.substring(start, j - 1);
            i = j;
            continue;
          }
        }

        out += code[i];
        i++;
      }

      return out;
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [tailwindcss(), sveltekit(), stripCssLayers()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    fs: {
      allow: ['src', 'packages', '.svelte-kit', 'node_modules'],
    },
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
