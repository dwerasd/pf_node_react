import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { getAllFiles, deleteFile, getSystemInfo } from '../controllers/adminController';
import { pool } from '../config/database';
import { ZmqBridge } from '../zeromq/zmq';

const router = Router();

// 타입 확장 - Express Request에 zmqBridge 속성 추가
interface AdminRequest extends Request {
  zmqBridge?: ZmqBridge;
}

// 모든 관리자 라우트는 인증과 관리자 권한 필요
router.use(authenticateToken, requireAdmin);

// GET /api/admin/files - 모든 파일 목록
router.get('/files', getAllFiles);

// DELETE /api/admin/files/:uuid - 파일 삭제
router.delete('/files/:uuid', deleteFile);

// GET /api/admin/system - 시스템 정보
router.get('/system', getSystemInfo);

// GET /api/admin/users - 사용자 목록 조회
router.get('/users', async (req: AdminRequest, res: Response): Promise<Response> => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'
    );
    return res.json({ users: rows });
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    return res.status(500).json({ error: '사용자 목록 조회 실패' });
  }
});

// PUT /api/admin/users/:id - 사용자 정보 수정 (ZMQ 알림 포함)
router.put('/users/:id', async (req: AdminRequest, res: Response): Promise<Response> => {
  const userIdParam = req.params.id;
  
  if (!userIdParam) {
    return res.status(400).json({ error: '사용자 ID가 필요합니다' });
  }
  
  const userId = parseInt(userIdParam);
  const { username, role } = req.body;

  if (!username || !role) {
    return res.status(400).json({ error: 'username과 role이 필요합니다' });
  }

  if (role !== 'user' && role !== 'admin') {
    return res.status(400).json({ error: 'role은 user 또는 admin이어야 합니다' });
  }

  try {
    const [existingUsers]: any = await pool.execute(
      'SELECT username FROM users WHERE id = ?',
      [userId]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }

    const oldUsername = existingUsers[0].username;

    await pool.execute(
      'UPDATE users SET username = ?, role = ? WHERE id = ?',
      [username, role, userId]
    );

    // ZMQ 서버에 알림
    if (req.zmqBridge) {
      await req.zmqBridge.notifyUserUpdate(userId, username, 'update', role);
    }

    return res.json({ 
      success: true, 
      message: '사용자 정보가 업데이트되었습니다',
      old_username: oldUsername,
      new_username: username,
      role: role
    });
  } catch (error) {
    console.error('사용자 정보 수정 오류:', error);
    return res.status(500).json({ error: '사용자 정보 수정 실패' });
  }
});

// DELETE /api/admin/users/:id - 사용자 삭제 (ZMQ 알림 포함)
router.delete('/users/:id', async (req: AdminRequest, res: Response): Promise<Response> => {
  const userIdParam = req.params.id;
  
  if (!userIdParam) {
    return res.status(400).json({ error: '사용자 ID가 필요합니다' });
  }
  
  const userId = parseInt(userIdParam);

  try {
    const [users]: any = await pool.execute(
      'SELECT username FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }

    const username = users[0].username;

    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    // ZMQ 서버에 알림
    if (req.zmqBridge) {
      await req.zmqBridge.notifyUserUpdate(userId, username, 'delete');
    }

    return res.json({ 
      success: true, 
      message: '사용자가 삭제되었습니다',
      deleted_user: username
    });
  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    return res.status(500).json({ error: '사용자 삭제 실패' });
  }
});

// POST /api/admin/users - 새 사용자 생성 (ZMQ 알림 포함)
router.post('/users', async (req: AdminRequest, res: Response): Promise<Response> => {
  const { username, password, role = 'user' } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username과 password가 필요합니다' });
  }

  if (role !== 'user' && role !== 'admin') {
    return res.status(400).json({ error: 'role은 user 또는 admin이어야 합니다' });
  }

  try {
    const [existingUsers]: any = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: '이미 존재하는 사용자명입니다' });
    }

    const [result]: any = await pool.execute(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, password, role]
    );

    const newUserId = result.insertId;

    // ZMQ 서버에 알림
    if (req.zmqBridge) {
      await req.zmqBridge.notifyUserUpdate(newUserId, username, 'create', role);
    }

    return res.status(201).json({ 
      success: true, 
      message: '새 사용자가 생성되었습니다',
      user: {
        id: newUserId,
        username: username,
        role: role
      }
    });
  } catch (error) {
    console.error('사용자 생성 오류:', error);
    return res.status(500).json({ error: '사용자 생성 실패' });
  }
});

// POST /api/admin/system/config - 시스템 설정 변경 (ZMQ 알림 포함)
router.post('/system/config', async (req: AdminRequest, res: Response): Promise<Response> => {
  const { action, parameters } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'action이 필요합니다' });
  }

  try {
    console.log('시스템 설정 변경 요청:', { action, parameters });

    // ZMQ 서버에 알림
    if (req.zmqBridge) {
      await req.zmqBridge.notifySystemChange(action, parameters);
    }

    return res.json({ 
      success: true, 
      message: '시스템 설정이 변경되었습니다',
      action: action,
      parameters: parameters || {}
    });
  } catch (error) {
    console.error('시스템 설정 변경 오류:', error);
    return res.status(500).json({ error: '시스템 설정 변경 실패' });
  }
});

// GET /api/admin/zmq/status - ZMQ 서버 상태 조회
router.get('/zmq/status', async (req: AdminRequest, res: Response): Promise<Response> => {
  try {
    if (!req.zmqBridge) {
      return res.status(503).json({ error: 'ZMQ 브릿지가 사용할 수 없습니다' });
    }

    const clients = req.zmqBridge.getConnectedClients();
    const status = {
      server_running: req.zmqBridge.isServerRunning(),
      connected_clients: req.zmqBridge.getClientCount(),
      clients: clients.map(client => ({
        id: client.clientId,
        address: client.address,
        connected_at: client.connectedAt,
        last_ping: client.lastPing,
        uptime_seconds: Math.floor((new Date().getTime() - client.connectedAt.getTime()) / 1000)
      }))
    };
    
    return res.json(status);
  } catch (error) {
    console.error('ZMQ 상태 조회 오류:', error);
    return res.status(500).json({ error: 'ZMQ 상태 조회 실패' });
  }
});

export default router;
