import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { initDatabase } from './config/database';
import authRoutes from './routes/auth';
import fileRoutes from './routes/files';
import adminRoutes from './routes/admin';
import { zmqBridge } from './zeromq/zmq';
import stockAnalysisRouter from './routes/stockAnalysis';

// 환경변수 로드 - 가장 먼저 실행되어야 함
dotenv.config();

const app = express();
const PORT = process.env.PORT || 80;

// =============================================================================
// 보안 미들웨어 설정 - 다른 미들웨어보다 먼저 적용되어야 함
// =============================================================================

// 0. Trust Proxy 설정 - 리버스 프록시 뒤에서 실행될 때 필요
// express-rate-limit가 X-Forwarded-For 헤더를 올바르게 처리하도록 함
app.set('trust proxy', 1);

// 1. Helmet - HTTP 보안 헤더 설정
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      upgradeInsecureRequests: null
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
  hsts: false
}));

// 2. Rate Limiting - IP별 요청 제한
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분 윈도우
  max: 1000, // IP당 최대 1000회 요청
  message: {
    error: 'Too many requests from this IP',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 3. 인증 관련 엔드포인트에 더 엄격한 Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 5, // 15분 내 최대 5회 로그인 시도
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many login attempts, please try again later',
    retryAfter: '15 minutes'
  }
});

// 4. 파일 업로드에 대한 Rate Limiting
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 10, // 1분에 최대 10개 파일 업로드
  message: {
    error: 'Too many file uploads, please slow down',
    retryAfter: '1 minute'
  }
});

// 전역 Rate Limiter 적용
app.use(generalLimiter);

// =============================================================================
// 기본 미들웨어 설정
// =============================================================================

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// uploads 디렉토리 생성 - 서버 시작 시 필요
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// =============================================================================
// ZMQ Bridge 미들웨어 - 관리자 요청에 ZMQ 브릿지 인스턴스 제공
// =============================================================================
app.use('/api/admin', (req: Request, res: Response, next: NextFunction) => {
  (req as any).zmqBridge = zmqBridge;
  next();
});

// =============================================================================
// 라우트 설정 - Rate Limiter를 각 라우트에 적용
// =============================================================================
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/files', uploadLimiter, fileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', stockAnalysisRouter);

// =============================================================================
// ZMQ 서버 상태 API 엔드포인트 추가
// =============================================================================
app.get('/api/zmq/status', (req: Request, res: Response) => {
  try {
    const clients = zmqBridge.getConnectedClients();
    const status = {
      server_running: zmqBridge.isServerRunning(),
      connected_clients: zmqBridge.getClientCount(),
      clients: clients.map(client => ({
        id: client.clientId,
        address: client.address,
        connected_at: client.connectedAt,
        last_ping: client.lastPing,
        uptime_seconds: Math.floor((new Date().getTime() - client.connectedAt.getTime()) / 1000)
      }))
    };
    
    res.json(status);
  } catch (error) {
    console.error('ZMQ 상태 조회 오류:', error);
    res.status(500).json({ error: 'ZMQ status query failed' });
  }
});

// ZMQ 서버 테스트 메시지 전송 (개발용)
app.post('/api/zmq/test', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { message, type = 'test' } = req.body;
    
    const testMessage = {
      type,
      data: { message: message || 'Test message from web server' },
      timestamp: Date.now(),
      source: 'admin' as const
    };

    const sentCount = await zmqBridge.broadcast(testMessage);
    
    return res.json({ 
      success: true, 
      sent_to_clients: sentCount,
      message: testMessage
    });
  } catch (error) {
    console.error('ZMQ 테스트 메시지 전송 오류:', error);
    return res.status(500).json({ error: 'Test message send failed' });
  }
});

// =============================================================================
// Solid 정적 파일 서빙
// =============================================================================
const staticPath = path.join(__dirname, '../../solid-ts/dist');

app.use(express.static(staticPath, {
  setHeaders: (res, filePath) => {
    res.removeHeader('Strict-Transport-Security');
    
    if (filePath.includes('.css') || filePath.includes('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    } else if (filePath.includes('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
    
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// =============================================================================
// 기본 라우트 - 보안을 고려한 정보 노출 제한
// =============================================================================

// 로그 출력 제어 함수
function shouldShowDebugInfo(): boolean {
  const env = process.env.NODE_ENV;
  return env === 'development' && process.env.QUIET !== 'true';
}

function shouldShowBasicInfo(): boolean {
  const env = process.env.NODE_ENV;
  return env !== 'production' && process.env.QUIET !== 'true';
}

function isProductionLike(): boolean {
  const env = process.env.NODE_ENV;
  return env === 'production';
}

// 메인 엔드포인트
app.get('/', (req: Request, res: Response) => {
  if (!isProductionLike()) {
    res.json({ 
      message: 'temp Server API', 
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      endpoints: {
        auth: '/api/auth',
        files: '/api/files',
        admin: '/api/admin',
        zmq: '/api/zmq/status'
      },
      docs: '/docs',
      zmq_server: {
        running: zmqBridge.isServerRunning(),
        connected_clients: zmqBridge.getClientCount()
      }
    });
  } else {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString()
    });
  }
});

// API 문서 엔드포인트
app.get('/docs', (req: Request, res: Response) => {
  if (!isProductionLike()) {
    res.json({
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        verify: 'GET /api/auth/verify'
      },
      files: {
        upload: 'POST /api/files/upload (multipart/form-data)',
        download: 'GET /api/files/download/:uuid',
        info: 'GET /api/files/info/:uuid'
      },
      admin: {
        files: 'GET /api/admin/files',
        users: 'GET /api/admin/users',
        system: 'GET /api/admin/system',
        delete: 'DELETE /api/admin/files/:uuid',
        zmq_status: 'GET /api/admin/zmq/status'
      },
      zmq: {
        status: 'GET /api/zmq/status',
        test: 'POST /api/zmq/test (dev only)'
      }
    });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// SPA용 catch-all 라우트
app.get('*', async (req, res): Promise<void> => {
  const indexPath = path.join(__dirname, '../../solid-ts/dist/index.html');
  
  try {
    const data = await fsPromises.readFile(indexPath, 'utf8');
    
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('host');
    
    let modifiedHtml = data;
    
    modifiedHtml = modifiedHtml.replace(
      /https:\/\/rolex\.iptime\.org\//g, 
      `${protocol}://${host}/`
    );
    
    modifiedHtml = modifiedHtml.replace(
      /src="\/assets\//g,
      `src="${protocol}://${host}/assets/`
    );
    
    modifiedHtml = modifiedHtml.replace(
      /href="\/assets\//g,
      `href="${protocol}://${host}/assets/`
    );
    
    res.setHeader('Content-Type', 'text/html');
    res.send(modifiedHtml);
    
  } catch (err) {
    console.error('[SPA] index.html 읽기 실패:', err);
    res.status(500).send('index.html 읽기 실패');
  }
});

// =============================================================================
// 에러 핸들링 미들웨어
// =============================================================================

// 404 핸들러
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found on this server.'
  });
});

// 전역 에러 핸들러
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Global error handler:', error);

  if (res.headersSent) {
    return next(error);
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      message: '파일 크기가 500MB를 초과했습니다'
    });
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      error: 'Too many files',
      message: '한 번에 1개 파일만 업로드 가능합니다'
    });
  }

  if (error.code === 'DANGEROUS_FILE_TYPE') {
    return res.status(400).json({
      error: 'Dangerous file type',
      message: '위험한 파일 형식입니다. 압축 파일만 업로드 가능합니다'
    });
  }

  if (error.code === 'INVALID_EXTENSION') {
    return res.status(400).json({
      error: 'Invalid extension',
      message: '압축 파일 확장자만 허용됩니다 (.zip, .7z, .rar 등)'
    });
  }

  if (error.code === 'INVALID_MIME_TYPE') {
    return res.status(400).json({
      error: 'Invalid MIME type',
      message: '압축 파일 MIME 타입이 아닙니다'
    });
  }

  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'The provided token is invalid'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      message: 'The token has expired'
    });
  }

  if (error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'File type not allowed'
    });
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
    return res.status(503).json({
      error: 'Database unavailable',
      message: 'Database connection failed'
    });
  }

  const statusCode = error.statusCode || error.status || 500;
  const message = process.env.NODE_ENV === 'development' 
    ? error.message || 'Something went wrong'
    : 'Internal server error';

  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      name: error.name 
    })
  });
});

// =============================================================================
// 서버 시작
// =============================================================================

async function startServer(): Promise<void> {
  let server: http.Server | undefined;

  try {
    // 1. 데이터베이스 초기화
    await initDatabase();
    
    if (shouldShowBasicInfo()) {
      console.log('✅ 데이터베이스 연결 성공');
    }

    // 2. ZMQ 서버 시작
    await zmqBridge.start();
    
    if (shouldShowBasicInfo()) {
      console.log('🔌 ZMQ 브릿지 서버 시작 성공');
    }

    // 3. HTTP 서버 시작
    server = http.createServer(app).listen(PORT, () => {
      if (shouldShowBasicInfo()) {
        console.log(`🚀 HTTP 서버가 http://localhost:${PORT} 에서 실행중입니다`);
        console.log(`📊 관리자 페이지: http://localhost:${PORT}/admin`);
        console.log(`🔧 환경: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔌 ZMQ 서버: ${process.env.ZMQ_PORT || 5000}번 포트`);
        if (shouldShowDebugInfo()) {
          console.log(`📚 API 문서: http://localhost:${PORT}/docs`);
          console.log(`🔍 ZMQ 상태: http://localhost:${PORT}/api/zmq/status`);
        }
      } else {
        console.log(`HTTP Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
      }
    });

    // HTTPS 인증서 체크
    const sslPath = path.join(__dirname, '../ssl');
    if (fs.existsSync(path.join(sslPath, 'server.key')) && 
        fs.existsSync(path.join(sslPath, 'server.crt'))) {
      
      const httpsOptions = {
        key: fs.readFileSync(path.join(sslPath, 'server.key')),
        cert: fs.readFileSync(path.join(sslPath, 'server.crt'))
      };
      
      https.createServer(httpsOptions, app).listen(443, () => {
        console.log(`🔒 HTTPS 서버: https://rolex.iptime.org`);
      });
    }

    // Graceful shutdown 처리
    const gracefulShutdown = async (signal: string): Promise<void> => {
      try {
        if (shouldShowBasicInfo()) {
          console.log(`${signal} 신호를 받았습니다. 서버를 종료합니다...`);
        }
        
        // ZMQ 서버 먼저 종료
        await zmqBridge.stop();
        if (shouldShowBasicInfo()) {
          console.log('🔌 ZMQ 서버 종료 완료');
        }

        // HTTP 서버 종료
        if (server) {
          await new Promise<void>((resolve, reject) => {
            server!.close((err) => {
              if (err) {
                console.error('서버 종료 중 오류 발생:', err);
                reject(err);
                return;
              }
              if (shouldShowBasicInfo()) {
                console.log('서버가 정상적으로 종료되었습니다.');
              }
              resolve();
            });
          });
        }

        process.exit(0);
      } catch (error) {
        console.error('Graceful shutdown 오류:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', async () => {
      await gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', async () => {
      await gracefulShutdown('SIGINT');
    });

  } catch (error: unknown) {
    console.error('❌ 서버 시작 실패:', error);
    
    // ZMQ 서버 정리
    try {
      await zmqBridge.stop();
    } catch (zmqError) {
      console.error('ZMQ 서버 정리 중 오류:', zmqError);
    }
    
    process.exit(1);
  }
}

// 처리되지 않은 Promise 거부 처리
process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// 처리되지 않은 예외 처리
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// 서버 시작
startServer();

export default app;
export { zmqBridge };
