import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built site works from any path. GitHub Pages serves a
// project site from /<repo>/, not from the domain root.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    // Stamped into the bundle so the Manage screen can show which build is
    // running — the installed app caches, so "did my change land?" needs an answer.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
