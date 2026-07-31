import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built site works from any path. GitHub Pages serves a
// project site from /<repo>/, not from the domain root.
export default defineConfig({
  base: './',
  plugins: [react()],
})
