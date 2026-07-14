import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FileModel } from '../models/File';
import { validateArchiveHeader } from '../utils/upload'; // 추가 import
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

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
 * 파일 업로드 처리 (압축 파일 전용)
 * 추가 시그니처 검증 포함
 */
export const uploadFile = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    // 파일 존재 여부 확인
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: '압축 파일을 업로드해주세요' 
      });
    }

    // UUID 생성 및 클라이언트 IP 추출
    const fileUuid = uuidv4();
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    
    // 추가 보안 검증: 파일 헤더 시그니처 확인
    const headerValidation = validateArchiveHeader(req.file.path);
    
    // 시그니처 검증 결과 로깅 (보안 감사용)
    console.log(`File header validation for ${req.file.originalname}:`, {
      isValid: headerValidation.isValid,
      detectedType: headerValidation.detectedType,
      uploadedBy: req.user?.username || 'anonymous',
      clientIP: clientIP
    });
    
    // 시그니처 검증 실패 시 (선택적 - 엄격한 보안 원할 때 주석 해제)
    /*
    if (!headerValidation.isValid) {
      // 업로드된 파일 삭제
      fs.unlinkSync(req.file.path);
      
      return res.status(400).json({
        error: 'Invalid archive file',
        message: '올바른 압축 파일이 아닙니다. 파일 시그니처를 확인해주세요.'
      });
    }
    */
    
    // 파일 정보를 데이터베이스에 저장
    const fileRecord = await FileModel.create({
      uuid: fileUuid,
      original_name: req.file.originalname,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      upload_ip: clientIP,
      user_id: req.user?.id || null
    });

    return res.status(201).json({
      message: '압축 파일이 성공적으로 업로드되었습니다',
      file: {
        uuid: fileUuid,
        original_name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        detected_archive_type: headerValidation.detectedType,
        download_url: `/api/files/download/${fileUuid}`,
        info_url: `/api/files/info/${fileUuid}`,
        uploaded_by: req.user?.username || 'anonymous'
      },
      security: {
        header_validated: headerValidation.isValid,
        client_ip: clientIP
      }
    });

  } catch (error: unknown) {
    console.error('압축 파일 업로드 오류:', error);
    
    // 업로드 실패 시 임시 파일 정리
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError: unknown) {
        console.warn('임시 파일 정리 실패:', getErrorMessage(cleanupError));
      }
    }

    // 멀터 에러 처리
    if (error instanceof Error) {
      // 커스텀 에러 코드별 처리
      if ((error as any).code === 'DANGEROUS_FILE_TYPE') {
        return res.status(400).json({
          error: 'Dangerous file type',
          message: '위험한 파일 형식입니다. 압축 파일만 업로드 가능합니다.',
          details: error.message
        });
      }
      
      if ((error as any).code === 'INVALID_EXTENSION') {
        return res.status(400).json({
          error: 'Invalid file extension',
          message: '허용되지 않는 파일 확장자입니다. 압축 파일(.zip, .7z, .rar 등)만 업로드 가능합니다.',
          details: error.message
        });
      }
      
      if ((error as any).code === 'INVALID_MIME_TYPE') {
        return res.status(400).json({
          error: 'Invalid MIME type',
          message: '올바르지 않은 파일 형식입니다. 압축 파일만 업로드 가능합니다.',
          details: error.message
        });
      }
      
      if ((error as any).code === 'INVALID_FILENAME') {
        return res.status(400).json({
          error: 'Invalid filename',
          message: '올바르지 않은 파일명입니다. 경로 문자(/, \\, ..)는 사용할 수 없습니다.',
          details: error.message
        });
      }
      
      if ((error as any).code === 'FILENAME_TOO_LONG') {
        return res.status(400).json({
          error: 'Filename too long',
          message: '파일명이 너무 깁니다. 255자 이하로 제한됩니다.',
          details: error.message
        });
      }
    }

    return res.status(500).json({ 
      error: 'Upload failed',
      message: '압축 파일 업로드 중 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
};

/**
 * 파일 다운로드 처리 (기존과 동일하지만 로깅 추가)
 */
export const downloadFile = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const uuid = req.params.uuid;
    if (!uuid || typeof uuid !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid UUID',
        message: '유효하지 않은 UUID입니다' 
      });
    }

    const fileRecord = await FileModel.findByUuid(uuid);
    if (!fileRecord) {
      return res.status(404).json({ 
        error: 'File not found',
        message: '파일을 찾을 수 없습니다' 
      });
    }

    if (!fs.existsSync(fileRecord.file_path)) {
      return res.status(404).json({ 
        error: 'File not found on disk',
        message: '파일이 서버에 존재하지 않습니다' 
      });
    }

    try {
      const stats = fs.statSync(fileRecord.file_path);
      
      // 다운로드 로깅 (보안 감사용)
      console.log(`Archive download: ${fileRecord.original_name} by ${req.user?.username || 'anonymous'} from ${req.ip}`);
      
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileRecord.original_name)}"`);
      res.setHeader('Content-Type', fileRecord.mime_type || 'application/octet-stream');
      res.setHeader('Content-Length', stats.size.toString());
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-File-Type', 'compressed-archive'); // 추가 헤더
      
      const fileStream = fs.createReadStream(fileRecord.file_path);
      
      fileStream.on('error', (streamError: Error) => {
        console.error('파일 스트리밍 오류:', streamError);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Stream error',
            message: '파일 읽기 중 오류가 발생했습니다'
          });
        }
      });

      fileStream.pipe(res);
      return;

    } catch (fsError: unknown) {
      console.error('파일 시스템 오류:', fsError);
      return res.status(500).json({
        error: 'File system error',
        message: '파일 접근 중 오류가 발생했습니다'
      });
    }

  } catch (error: unknown) {
    console.error('파일 다운로드 오류:', error);
    return res.status(500).json({ 
      error: 'Download failed',
      message: '파일 다운로드 중 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
};

/**
 * 파일 정보 조회 (압축 파일 정보 포함)
 */
export const getFileInfo = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const uuid = req.params.uuid;
    if (!uuid || typeof uuid !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid UUID',
        message: '유효하지 않은 UUID입니다' 
      });
    }

    const fileRecord = await FileModel.findByUuid(uuid);
    if (!fileRecord) {
      return res.status(404).json({ 
        error: 'File not found',
        message: '파일을 찾을 수 없습니다' 
      });
    }

    const fileExists = fs.existsSync(fileRecord.file_path);
    
    // 파일이 존재하면 압축 파일 헤더 정보도 함께 제공
    let archiveInfo = null;
    if (fileExists) {
      const headerValidation = validateArchiveHeader(fileRecord.file_path);
      archiveInfo = {
        header_valid: headerValidation.isValid,
        detected_type: headerValidation.detectedType
      };
    }

    return res.json({
      uuid: fileRecord.uuid,
      original_name: fileRecord.original_name,
      size: fileRecord.file_size,
      size_formatted: `${(fileRecord.file_size / (1024 * 1024)).toFixed(2)} MB`,
      type: fileRecord.mime_type,
      uploaded_at: fileRecord.created_at,
      upload_ip: fileRecord.upload_ip,
      file_exists: fileExists,
      download_url: `/api/files/download/${uuid}`,
      archive_info: archiveInfo, // 압축 파일 정보 추가
      file_category: 'compressed-archive' // 카테고리 명시
    });

  } catch (error: unknown) {
    console.error('파일 정보 조회 오류:', error);
    return res.status(500).json({ 
      error: 'Info retrieval failed',
      message: '서버 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
};

/**
 * 허용된 파일 형식 정보 API (새로 추가)
 */
export const getAllowedFormats = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { getAllowedFormats } = await import('../utils/upload');
    const formats = getAllowedFormats();
    
    return res.json({
      message: '압축 파일 업로드만 허용됩니다',
      allowed_formats: {
        extensions: formats.extensions,
        mime_types: formats.mimeTypes,
        split_archive_patterns: formats.splitPatterns
      },
      upload_limits: {
        max_file_size: '500MB',
        max_files_per_request: 1
      },
      security_features: [
        '실행 파일 확장자 블랙리스트 검사',
        '파일 시그니처 검증 (선택적)',
        '경로 순회 공격 방지',
        '파일명 길이 제한 (255자)'
      ]
    });
  } catch (error: unknown) {
    console.error('허용 형식 조회 오류:', error);
    return res.status(500).json({
      error: 'Failed to get allowed formats',
      message: '서버 오류가 발생했습니다'
    });
  }
};
