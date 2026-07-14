import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FileModel } from '../models/File';
import { UserModel } from '../models/User';
import fs from 'fs';

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
 * 모든 파일 목록 조회 (관리자용)
 * 페이징 처리 포함
 */
export const getAllFiles = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const files = await FileModel.findAll(limit, offset);
    
    return res.json({
      files,
      pagination: {
        page,
        limit,
        total: files.length
      }
    });
  } catch (error: unknown) {
    console.error('파일 목록 조회 오류:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: '서버 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
};

/**
 * 모든 사용자 목록 조회 (관리자용)
 */
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const users = await UserModel.findAll();
    return res.json({ users });
  } catch (error: unknown) {
    console.error('사용자 목록 조회 오류:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: '서버 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
};

/**
 * 파일 삭제 (관리자용)
 * UUID 파라미터 타입 검증 포함
 */
export const deleteFile = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    // UUID 파라미터 검증 - string | undefined 타입 오류 해결
    const uuid = req.params.uuid;
    if (!uuid || typeof uuid !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid UUID',
        message: '유효하지 않은 UUID입니다' 
      });
    }

    // 파일 정보 조회
    const fileRecord = await FileModel.findByUuid(uuid);
    if (!fileRecord) {
      return res.status(404).json({ 
        error: 'File not found',
        message: '파일을 찾을 수 없습니다' 
      });
    }

    // 물리적 파일 삭제
    if (fs.existsSync(fileRecord.file_path)) {
      try {
        fs.unlinkSync(fileRecord.file_path);
      } catch (fsError: unknown) {
        console.warn('물리적 파일 삭제 실패:', getErrorMessage(fsError));
        // 파일 시스템 오류가 있어도 DB에서는 삭제 계속 진행
      }
    }

    // 데이터베이스에서 파일 정보 삭제
    const deleted = await FileModel.deleteByUuid(uuid);
    if (!deleted) {
      return res.status(500).json({
        error: 'Delete failed',
        message: '파일 삭제 중 오류가 발생했습니다'
      });
    }

    return res.json({ 
      message: '파일이 성공적으로 삭제되었습니다',
      uuid: uuid
    });

  } catch (error: unknown) {
    console.error('파일 삭제 오류:', error);
    return res.status(500).json({ 
      error: 'Delete error',
      message: '파일 삭제 중 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
};

/**
 * 시스템 정보 조회 (관리자용)
 * 업로드 폴더 크기 및 파일 개수 계산
 */
export const getSystemInfo = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    // 업로드 폴더 정보 계산
    const uploadsDir = 'uploads';
    let totalSize = 0;
    let fileCount = 0;

    if (fs.existsSync(uploadsDir)) {
      try {
        const files = fs.readdirSync(uploadsDir);
        fileCount = files.length;
        
        for (const file of files) {
          const filePath = `${uploadsDir}/${file}`;
          if (fs.existsSync(filePath)) {
            try {
              const stats = fs.statSync(filePath);
              totalSize += stats.size;
            } catch (statError: unknown) {
              console.warn(`파일 ${filePath} 상태 조회 실패:`, getErrorMessage(statError));
              // 개별 파일 오류는 무시하고 계속 진행
            }
          }
        }
      } catch (readError: unknown) {
        console.warn('업로드 폴더 읽기 실패:', getErrorMessage(readError));
        // 폴더 읽기 실패 시 기본값 사용
      }
    }

    return res.json({
      system: {
        uploadPath: uploadsDir,
        totalFiles: fileCount,
        totalSize: totalSize,
        totalSizeFormatted: `${(totalSize / (1024 * 1024)).toFixed(2)} MB`,
        serverUptime: process.uptime(),
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage()
      }
    });

  } catch (error: unknown) {
    console.error('시스템 정보 조회 오류:', error);
    return res.status(500).json({ 
      error: 'System info error',
      message: '서버 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
};
