import { pool } from '../config/database';
import bcrypt from 'bcryptjs';

export interface User {
  id?: number;
  username: string;
  password: string;
  role: 'user' | 'admin';
  created_at?: Date;
}

export class UserModel {
  // 사용자 생성
  static async create(username: string, password: string, role: 'user' | 'admin' = 'user'): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await pool.execute<any>(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );

    return {
      id: result.insertId,
      username,
      password: hashedPassword,
      role
    };
  }

  // 사용자명으로 찾기
  static async findByUsername(username: string): Promise<User | null> {
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  // ID로 찾기
  static async findById(id: number): Promise<User | null> {
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  // 비밀번호 확인
  static async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // 모든 사용자 조회 (관리자용)
  static async findAll(): Promise<User[]> {
    const [rows] = await pool.execute<any[]>(
      'SELECT id, username, role, created_at FROM users'
    );

    return rows;
  }
}
