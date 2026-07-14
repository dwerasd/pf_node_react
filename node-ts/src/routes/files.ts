import { Router } from 'express';
import { upload } from '../utils/upload';
import { optionalAuth, authenticateToken } from '../middleware/auth';
import { uploadFile, downloadFile, getFileInfo, getAllowedFormats } from '../controllers/fileController';

const router = Router();

// GET /api/files/formats - 허용된 파일 형식 정보 (새로 추가)
router.get('/formats', getAllowedFormats);

// POST /api/files/upload - 압축 파일 업로드 (로그인 선택)
router.post('/upload', optionalAuth, upload.single('file'), uploadFile);

// GET /api/files/download/:uuid - 파일 다운로드
//router.get('/download/:uuid', downloadFile);

// GET /api/files/info/:uuid - 파일 정보 조회
router.get('/info/:uuid', getFileInfo);

// 기본 내보내기
export default router;
