import { pool } from '../config/database';

export interface FileRecord {
  id?: number;
  uuid: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type?: string;
  upload_ip?: string;
  user_id?: number;
  created_at?: Date;
}

export class FileModel {
  // 파일 정보 저장
  static async create(fileData: Omit<FileRecord, 'id' | 'created_at'>): Promise<FileRecord> {
    const [result] = await pool.execute<any>(
      `INSERT INTO files (uuid, original_name, file_path, file_size, mime_type, upload_ip, user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fileData.uuid,
        fileData.original_name,
        fileData.file_path,
        fileData.file_size,
        fileData.mime_type,
        fileData.upload_ip,
        fileData.user_id
      ]
    );

    return {
      id: result.insertId,
      ...fileData
    };
  }

  // UUID로 파일 찾기
  static async findByUuid(uuid: string): Promise<FileRecord | null> {
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM files WHERE uuid = ?',
      [uuid]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  // 모든 파일 조회 (관리자용)
  static async findAll(limit: number = 100, offset: number = 0): Promise<FileRecord[]> {
    const [rows] = await pool.execute<any[]>(
      `SELECT f.*, u.username 
       FROM files f 
       LEFT JOIN users u ON f.user_id = u.id 
       ORDER BY f.created_at DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return rows;
  }

  // 사용자별 파일 조회
  static async findByUserId(userId: number): Promise<FileRecord[]> {
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    return rows;
  }

  // 파일 삭제
  static async deleteByUuid(uuid: string): Promise<boolean> {
    const [result] = await pool.execute<any>(
      'DELETE FROM files WHERE uuid = ?',
      [uuid]
    );

    return result.affectedRows > 0;
  }
}
