import { Router } from 'express';
import { register, login, verifyToken } from '../controllers/authController';

const router = Router();

// POST /api/auth/register - 회원가입
router.post('/register', register);

// POST /api/auth/login - 로그인
router.post('/login', login);

// GET /api/auth/verify - 토큰 검증 (추가)
router.get('/verify', verifyToken);

// 기본 내보내기 - 필수!
export default router;
