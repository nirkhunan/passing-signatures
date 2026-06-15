import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Fully client-side build. Data is served as static JSON from /public/data.
// For GitHub Pages project sites the app lives at /<repo>/, so the build base
// must match the repo name. Dev stays at '/'. (BASE_URL flows into data paths.)
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/passing-signatures/' : '/',
}))
