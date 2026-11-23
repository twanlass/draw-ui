import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { feedbackPlugin } from './server/feedback-plugin'
import { jevPlugin } from './server/jev-plugin'

export default defineConfig(({ mode }) => {
  // Load all variables (no VITE_ prefix) for the dev server only. None of
  // them reach the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), jevPlugin(env), feedbackPlugin(process.cwd())],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  }
})
