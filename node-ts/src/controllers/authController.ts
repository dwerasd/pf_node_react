import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';

/**
 * 에러 객체를 안전하게 처리하는 유틸리티 함수
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
 * 에러가 특정 타입인지 확인하는 타입 가드
 */
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * 회원가입 처리
 * 입력값 검증 및 중복 사용자 확인 포함
 */
export const register = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { username, password } = req.body;

    // 입력값 검증
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: '사용자명과 비밀번호가 필요합니다' 
      });
    }

    // 사용자명 길이 검증
    if (typeof username !== 'string' || username.length < 3 || username.length > 50) {
      return res.status(400).json({
        error: 'Invalid username',
        message: '사용자명은 3자 이상 50자 이하의 문자열이어야 합니다'
      });
    }

    // 비밀번호 길이 검증
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        error: 'Invalid password',
        message: '비밀번호는 6자 이상의 문자열이어야 합니다'
      });
    }

    // 중복 사용자 확인
    const existingUser = await UserModel.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ 
        error: 'User already exists',
        message: '이미 존재하는 사용자명입니다' 
      });
    }

    // 사용자 생성
    const user = await UserModel.create(username, password);
    
    return res.status(201).json({
      message: '회원가입이 완료되었습니다',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        created_at: user.created_at
      }
    });

  } catch (error: unknown) {
    console.error('회원가입 오류:', error);
    
    // 에러 타입별 처리
    if (isError(error)) {
      // 데이터베이스 관련 에러 처리
      if (error.message.includes('Duplicate entry')) {
        return res.status(400).json({
          error: 'Username already taken',
          message: '이미 사용 중인 사용자명입니다'
        });
      }
    }

    return res.status(500).json({ 
      error: 'Registration failed',
      message: '서버 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
};

/**
 * 로그인 처리
 * JWT 토큰 생성 및 사용자 인증
 */
export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { username, password } = req.body;

    // 입력값 검증
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Missing credentials',
        message: '사용자명과 비밀번호가 필요합니다' 
      });
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Invalid input type',
        message: '사용자명과 비밀번호는 문자열이어야 합니다'
      });
    }

    // 사용자 찾기
    const user = await UserModel.findByUsername(username);
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: '잘못된 사용자명 또는 비밀번호입니다' 
      });
    }

    // 비밀번호 확인
    const isValidPassword = await UserModel.verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: '잘못된 사용자명 또는 비밀번호입니다' 
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

    // JWT 토큰 생성
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    return res.json({
      message: '로그인 성공',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        created_at: user.created_at
      }
    });

  } catch (error: unknown) {
    console.error('로그인 오류:', error);
    
    return res.status(500).json({ 
      error: 'Login failed',
      message: '서버 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
};

/**
 * 토큰 검증
 * 현재 토큰의 유효성 검사 및 사용자 정보 반환
 */
export const verifyToken = async (req: Request, res: Response): Promise<Response> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
        message: '토큰이 제공되지 않았습니다'
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: '서버 설정 오류가 발생했습니다'
      });
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    const user = await UserModel.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: '유효하지 않은 토큰입니다'
      });
    }

    return res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        created_at: user.created_at
      }
    });

  } catch (error: unknown) {
    if (isError(error)) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: '토큰이 만료되었습니다'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Invalid token',
          message: '유효하지 않은 토큰입니다'
        });
      }
    }

    console.error('토큰 검증 오류:', error);
    return res.status(500).json({
      error: 'Token verification failed',
      message: '토큰 검증 중 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
};
