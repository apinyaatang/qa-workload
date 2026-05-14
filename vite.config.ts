import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'charts'
          if (id.includes('node_modules/xlsx'))     return 'xlsx'
          if (id.includes('node_modules/@supabase')) return 'supabase'
          if (id.includes('node_modules/papaparse')) return 'csv'
          if (id.includes('node_modules/lucide-react')) return 'icons'
          if (id.includes('node_modules/date-fns'))    return 'date'
          if (id.includes('node_modules/react-dom'))   return 'react-vendor'
          if (id.includes('node_modules/react'))       return 'react-vendor'
        },
      },
    },
  },
})
