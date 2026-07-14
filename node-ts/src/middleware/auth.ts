import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';

// Express Request 타입을 확장하여 user 속성 추가
export interface AuthRequest extends Request {
  user?: any;
}

/**
 * 에러 메시지 추출 유틸리티
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * JWT 토큰 검증 미들웨어
 * Authorization 헤더의 Bearer 토큰을 검증하고 사용자 정보를 req.user에 추가
 */
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<Response | void> => {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN" 형식

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        message: 'Authorization header with Bearer token is required'
      });
    }

    // JWT 시크릿 키 확인
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET 환경변수가 설정되지 않았습니다');
      return res.status(500).json({
        error: 'Server configuration error',
        message: '서버 설정 오류가 발생했습니다'
      });
    }

    // JWT 토큰 검증
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // 사용자 정보 조회
    const user = await UserModel.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'User associated with token not found'
      });
    }

    // 사용자 정보를 request 객체에 추가
    req.user = user;
    next(); // void 반환

  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Please login again'
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ 
        error: 'Invalid token',
        message: 'Token is malformed or invalid'
      });
    }

    // 기타 에러
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: 'Internal server error during authentication',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
};

/**
 * 관리자 권한 확인 미들웨어
 * authenticateToken 미들웨어 다음에 사용해야 함
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): Response | void => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'User information not found in request'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'This endpoint requires administrator privileges'
    });
  }

  next(); // void 반환
};

/**
 * 선택적 인증 미들웨어
 * 토큰이 있으면 인증하고, 없어도 계속 진행
 * 로그인하지 않은 사용자도 접근할 수 있는 엔드포인트에 사용
 */
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret) {
          const decoded = jwt.verify(token, jwtSecret) as any;
          const user = await UserModel.findById(decoded.userId);
          
          if (user) {
            req.user = user;
          }
        }
      } catch (error: unknown) {
        // 토큰이 유효하지 않아도 에러를 발생시키지 않고 계속 진행
        console.log('Optional auth failed, continuing without user context:', getErrorMessage(error));
      }
    }

    next(); // 항상 void 반환
  } catch (error: unknown) {
    // 예상치 못한 에러가 발생해도 계속 진행
    console.error('Unexpected error in optionalAuth:', error);
    next(); // void 반환
  }
};
