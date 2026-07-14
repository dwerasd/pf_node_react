import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 상대 경로로 설정 (중요!)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // 상대 경로로 자산 생성
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    // JSX 변환 설정
    jsx: 'automatic',
  },
  server: {
    port: 8080,        // 원하는 포트로 변경
    open: false,        // 자동으로 브라우저 열기
    host: true,        // 네트워크 접근 허용 (0.0.0.0)
    watch: {
      // 추가로 감시할 파일/폴더
      ignored: ['!**/node_modules/.vite/**'],
      usePolling: true,  // Docker나 WSL에서 필요한 경우
      interval: 500      // 폴링 간격 (ms)
    }
  }
})
