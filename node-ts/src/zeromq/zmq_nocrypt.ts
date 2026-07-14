import * as zmq from 'zeromq';
import { ZmqMessage, UserUpdateMessage, SystemMessage, ZmqClientInfo } from './types';

export class ZmqBridge {
  private repSocket: zmq.Reply | null = null;
  private pushSocket: zmq.Push | null = null;
  private isRunning: boolean = false;
  private port: number;
  private connectedClients: Set<string> = new Set();
  private clientsInfo: Map<string, ZmqClientInfo> = new Map();

  constructor(port: number = 5000) {
    this.port = port;
  }

  /**
   * ZeroMQ 서버 시작
   */
  public async start(): Promise<void> {
    try {
      // REP 소켓 (C++로부터 메시지 수신)
      this.repSocket = new zmq.Reply();
      await this.repSocket.bind(`tcp://*:${this.port}`);

      // PUSH 소켓 (C++로 메시지 전송)
      this.pushSocket = new zmq.Push();
      await this.pushSocket.bind(`tcp://*:${this.port + 1}`);

      this.isRunning = true;
      console.log(`🔌 ZeroMQ 서버가 ${this.port}번 포트에서 대기 중`);

      // 메시지 처리 루프 시작
      this.startMessageLoop();
    } catch (error) {
      console.error('ZeroMQ 서버 시작 실패:', error);
      throw error;
    }
  }

  /**
   * 메시지 처리 루프 - undefined 처리 수정
   */
  private async startMessageLoop(): Promise<void> {
    if (!this.repSocket) return;

    try {
      for await (const msgParts of this.repSocket) {
        // msgParts는 배열이므로 첫 번째 요소 확인
        const message = msgParts[0];
        if (message && Buffer.isBuffer(message)) {
          await this.handleMessage(message);
        } else {
          console.warn('수신된 메시지가 유효하지 않습니다:', typeof message);
          
          // 유효하지 않은 메시지에도 응답 필요 (REP 소켓 특성)
          if (this.repSocket) {
            const errorResponse = {
              type: 'error',
              data: { message: 'Invalid message format' },
              timestamp: Date.now(),
              source: 'system' as const
            };
            await this.repSocket.send(JSON.stringify(errorResponse));
          }
        }
      }
    } catch (error) {
      if (this.isRunning) {
        console.error('ZeroMQ 메시지 루프 오류:', error);
      }
    }
  }

  /**
   * C++로부터 받은 메시지 처리
   */
  private async handleMessage(buffer: Buffer): Promise<void> {
    try {
      const messageStr = buffer.toString('utf8');
      const parsedMessage: ZmqMessage = JSON.parse(messageStr);

      // 클라이언트 정보 업데이트
      if (parsedMessage.type === 'client_info') {
        this.updateClientInfo(parsedMessage);
      }

      // ping 메시지 처리
      if (parsedMessage.type === 'ping') {
        this.updateClientPing(parsedMessage);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('📨 C++로부터 메시지:', parsedMessage);
      }

      // 응답 전송 (REP 소켓 특성상 반드시 응답 필요)
      const response = {
        type: 'ack',
        data: { 
          status: 'received', 
          timestamp: Date.now(),
          messageType: parsedMessage.type
        },
        timestamp: Date.now(),
        source: 'system' as const
      };

      if (this.repSocket) {
        await this.repSocket.send(JSON.stringify(response));
      }

    } catch (error) {
      console.error('메시지 처리 오류:', error);
      
      // 에러 응답 (REP 소켓은 반드시 응답해야 함)
      if (this.repSocket) {
        const errorResponse = {
          type: 'error',
          data: { 
            message: 'Message processing failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          timestamp: Date.now(),
          source: 'system' as const
        };
        
        try {
          await this.repSocket.send(JSON.stringify(errorResponse));
        } catch (sendError) {
          console.error('에러 응답 전송 실패:', sendError);
        }
      }
    }
  }

  /**
   * 클라이언트 정보 업데이트
   */
  private updateClientInfo(message: ZmqMessage): void {
    const clientId = message.data?.clientId || `client_${Date.now()}`;
    this.connectedClients.add(clientId);
    
    this.clientsInfo.set(clientId, {
      clientId,
      connectedAt: new Date(message.data?.connectedAt || Date.now()),
      lastPing: new Date(),
      address: message.data?.address || 'unknown'
    });
  }

  /**
   * 클라이언트 ping 업데이트
   */
  private updateClientPing(message: ZmqMessage): void {
    const clientId = message.data?.clientId;
    if (clientId && this.clientsInfo.has(clientId)) {
      const client = this.clientsInfo.get(clientId)!;
      client.lastPing = new Date();
    }
  }

  /**
   * C++로 메시지 전송
   */
  public async sendToClient(message: ZmqMessage): Promise<boolean> {
    if (!this.pushSocket || !this.isRunning) {
      console.warn('ZMQ PUSH 소켓이 사용 불가능합니다');
      return false;
    }

    try {
      const messageStr = JSON.stringify(message);
      await this.pushSocket.send(messageStr);
      return true;
    } catch (error) {
      console.error('C++로 메시지 전송 실패:', error);
      return false;
    }
  }

  /**
   * 모든 클라이언트에게 브로드캐스트
   */
  public async broadcast(message: ZmqMessage): Promise<number> {
    const success = await this.sendToClient(message);
    return success ? this.connectedClients.size : 0;
  }

  /**
   * 사용자 정보 변경을 C++ 서버에 알림
   */
  public async notifyUserUpdate(userId: number, username: string, action: 'create' | 'update' | 'delete', role?: 'user' | 'admin'): Promise<void> {
    const messageData = {
      userId,
      username,
      action
    } as any;

    if (role !== undefined) {
      messageData.role = role;
    }

    const message: UserUpdateMessage = {
      type: `user_${action}` as any,
      data: messageData,
      timestamp: Date.now(),
      source: 'admin'
    };

    const success = await this.sendToClient(message);
    if (process.env.NODE_ENV !== 'production' && success) {
      console.log(`👤 사용자 ${action} 알림을 C++ 클라이언트에 전송: ${username}`);
    }
  }

  /**
   * 시스템 설정 변경을 C++ 서버에 알림
   */
  public async notifySystemChange(action: string, parameters?: Record<string, any>): Promise<void> {
    const messageData = {
      action
    } as any;

    if (parameters !== undefined) {
      messageData.parameters = parameters;
    }

    const message: SystemMessage = {
      type: 'system_config',
      data: messageData,
      timestamp: Date.now(),
      source: 'system'
    };

    const success = await this.sendToClient(message);
    if (process.env.NODE_ENV !== 'production' && success) {
      console.log(`⚙️ 시스템 변경 알림을 C++ 클라이언트에 전송: ${action}`);
    }
  }

  /**
   * 연결된 클라이언트 정보 반환
   */
  public getConnectedClients(): ZmqClientInfo[] {
    // 5분 이상 ping이 없는 클라이언트 정리
    const timeout = 5 * 60 * 1000; // 5분
    const now = new Date();
    
    this.clientsInfo.forEach((client, clientId) => {
      if (now.getTime() - client.lastPing.getTime() > timeout) {
        this.clientsInfo.delete(clientId);
        this.connectedClients.delete(clientId);
      }
    });

    return Array.from(this.clientsInfo.values());
  }

  /**
   * ZeroMQ 서버 실행 상태 반환
   */
  public isServerRunning(): boolean {
    return this.isRunning && this.repSocket !== null && this.pushSocket !== null;
  }

  /**
   * 연결된 클라이언트 수 반환
   */
  public getClientCount(): number {
    return this.connectedClients.size;
  }

  /**
   * ZeroMQ 서버 종료
   */
  public async stop(): Promise<void> {
    this.isRunning = false;
    
    try {
      if (this.repSocket) {
        this.repSocket.close();
        this.repSocket = null;
      }
      
      if (this.pushSocket) {
        this.pushSocket.close();
        this.pushSocket = null;
      }
      
      this.connectedClients.clear();
      this.clientsInfo.clear();
      
      console.log('🔌 ZeroMQ 서버가 종료되었습니다');
    } catch (error) {
      console.error('ZeroMQ 서버 종료 중 오류:', error);
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const zmqBridge = new ZmqBridge(parseInt(process.env.ZMQ_PORT || '5000'));
