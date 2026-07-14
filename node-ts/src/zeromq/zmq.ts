import * as zmq from 'zeromq';
import { ZmqMessage, UserUpdateMessage, SystemMessage, ZmqClientInfo } from './types';
import { NodeCrypt } from '../crypto/NodeCrypt';

export class ZmqBridge {
    private repSocket: zmq.Reply | null = null;
    private pushSocket: zmq.Push | null = null;
    private isRunning: boolean = false;
    private port: number;
    private connectedClients: Set<string> = new Set();
    private clientsInfo: Map<string, ZmqClientInfo> = new Map();

    // 암호화 인스턴스
    private crypt: NodeCrypt;
    private encryptionEnabled: boolean = true;

    constructor(port: number = 5000, encryptionKey: string = 'default_zmq_key_2025') {
        this.port = port;
        this.crypt = new NodeCrypt();

        if (!this.crypt.init(encryptionKey))
             {
            console.error('❌ ZMQ 암호화 초기화 실패');
            this.encryptionEnabled = false;
        }
        else
        {
            console.log('🔒 ZMQ 암호화 초기화 완료');
            // 암호화 테스트 실행
            if (!this.crypt.test()) {
                console.error('❌ ZMQ 암호화 테스트 실패');
                this.encryptionEnabled = false;
            }
        }
    }

    /**
     * ZeroMQ 서버 시작
     */
    public async start(): Promise<void> {
        try {
            this.repSocket = new zmq.Reply();
            await this.repSocket.bind(`tcp://*:${this.port}`);

            this.pushSocket = new zmq.Push();
            await this.pushSocket.bind(`tcp://*:${this.port + 1}`);

            this.isRunning = true;
            console.log(`🔌 ZeroMQ 서버가 ${this.port}번 포트에서 대기 중`);
            console.log(`📡 REP 소켓: tcp://*:${this.port}`);
            console.log(`📤 PUSH 소켓: tcp://*:${this.port + 1}`);
            console.log(`🔐 암호화 모드: ${this.encryptionEnabled ? '활성화' : '비활성화'}`);

            this.startMessageLoop();
        } catch (error) {
            console.error('ZeroMQ 서버 시작 실패:', error);
            throw error;
        }
    }

    /**
     * 메시지 처리 루프
     */
    private async startMessageLoop(): Promise<void> {
        if (!this.repSocket) return;

        //console.log('ZMQ 메시지 루프 시작됨');

        try {
            for await (const msgParts of this.repSocket) {
                const message = msgParts[0];
                if (message && Buffer.isBuffer(message)) {
                    await this.handleMessage(message);
                } else {
                    console.warn('유효하지 않은 메시지:', typeof message);
                    await this.sendErrorResponse('Invalid message format');
                }
            }
        } catch (error) {
            if (this.isRunning) {
                console.error('ZeroMQ 메시지 루프 오류:', error);
            }
        }
    }

    /**
     * 메시지 처리 (암호화/평문 자동 감지)
     */
    private async handleMessage(buffer: Buffer): Promise<void> {
        try {
            const messageStr = buffer.toString('utf8');
            let parsedMessage: ZmqMessage;
            let isEncrypted = false;

            //console.log('원본 메시지 수신, 길이:', messageStr.length);
            //console.log('메시지 preview:', messageStr.substring(0, 50));

            // 암호화된 메시지인지 확인 (Hex 문자열)
            if (this.encryptionEnabled && this.isHexString(messageStr)) {
                try {
                    //console.log('암호화된 메시지로 감지, 복호화 시도');
                    const decryptedMessage = this.crypt.decryptString(messageStr);
                    if (decryptedMessage) {
                        //console.log('복호화 성공, 길이:', decryptedMessage.length);
                        //console.log('복호화된 내용:', decryptedMessage.substring(0, 100));
                        parsedMessage = JSON.parse(decryptedMessage);
                        isEncrypted = true;
                        //console.log('🔓 암호화된 메시지 복호화 성공');
                    } else {
                        throw new Error('복호화 결과가 비어있음');
                    }
                } catch (decryptError) {
                    console.error('복호화 실패, 평문으로 시도:', decryptError);
                    parsedMessage = JSON.parse(messageStr);
                    isEncrypted = false;
                }
            } else {
                // 평문 메시지
                //console.log('평문 메시지로 감지');
                parsedMessage = JSON.parse(messageStr);
                isEncrypted = false;
                //console.log('📨 평문 메시지 수신');
            }

            // 메시지 타입별 처리 (암호화 상태 전달)
            await this.processMessage(parsedMessage, isEncrypted);

            // 응답 전송
            await this.sendResponse(parsedMessage, isEncrypted);

        } catch (error) {
            console.error('메시지 처리 오류:', error);
            console.error('문제가 된 메시지:', buffer.toString('utf8').substring(0, 200));
            await this.sendErrorResponse('Message processing failed');
        }
    }

    /**
     * 메시지 타입별 처리
     */
    private async processMessage(message: ZmqMessage, wasEncrypted: boolean = false): Promise<void> {
        switch (message.type) {
            case 'client_info':
                this.updateClientInfo(message);
                console.log('👤 클라이언트 정보 업데이트');
                break;

            case 'ping':
                await this.handlePingMessage(message, wasEncrypted);
                break;

            case 'connection_test':
                console.log('🔗 연결 테스트 메시지 수신');
                break;

            case 'status_report':
                console.log('📊 상태 리포트 수신:', message.data);
                break;

            default:
                console.log('📨 알 수 없는 메시지 타입:', message.type);
        }

        console.log('📨 C++로부터 메시지:', message);
    }

    /**
     * 응답 전송
     */
    private async sendResponse(originalMessage: ZmqMessage, wasEncrypted: boolean): Promise<void> {
        const response = {
            type: 'ack',
            data: {
                status: 'received',
                timestamp: Date.now(),
                messageType: originalMessage.type
            },
            timestamp: Date.now(),
            source: 'system' as const
        };

        if (!this.repSocket) return;

        try {
            const responseJson = JSON.stringify(response);

            if (this.encryptionEnabled && wasEncrypted) {
                // 요청이 암호화되어 있으면 응답도 암호화
                const encryptedResponse = this.crypt.encryptString(responseJson);
                if (encryptedResponse) {
                    await this.repSocket.send(encryptedResponse);
                    console.log('🔒 암호화된 응답 전송 완료');
                } else {
                    await this.repSocket.send(responseJson);
                    console.log('📤 평문 응답 전송 완료 (암호화 실패)');
                }
            } else {
                // 평문 응답
                await this.repSocket.send(responseJson);
                console.log('📤 평문 응답 전송 완료');
            }
        } catch (error) {
            console.error('응답 전송 실패:', error);
        }
    }

    /**
     * 에러 응답 전송
     */
    private async sendErrorResponse(errorMessage: string): Promise<void> {
        if (!this.repSocket) return;

        const errorResponse = {
            type: 'error',
            data: { message: errorMessage },
            timestamp: Date.now(),
            source: 'system' as const
        };

        try {
            await this.repSocket.send(JSON.stringify(errorResponse));
            console.log('❌ 에러 응답 전송:', errorMessage);
        } catch (error) {
            console.error('에러 응답 전송 실패:', error);
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
     * ping 메시지 처리 및 pong 응답 - 수정된 버전
     */
    private async handlePingMessage(message: ZmqMessage, wasEncrypted: boolean): Promise<void> {
        const clientId = message.data?.clientId;

        // 클라이언트 정보 업데이트
        if (clientId && this.clientsInfo.has(clientId)) {
            const client = this.clientsInfo.get(clientId)!;
            client.lastPing = new Date();
            console.log('💓 Ping 수신:', clientId);
        }

        // pong 응답 전송 (PUSH 소켓으로)
        if (this.pushSocket) {
            const pongMessage: ZmqMessage = {
                type: 'pong',
                data: {
                    clientId: clientId,
                    timestamp: Date.now(),
                    serverTime: new Date().toISOString()
                },
                timestamp: Date.now(),
                source: 'system'
            };

            try {
                const pongJson = JSON.stringify(pongMessage);
                console.log('Pong JSON 생성:', pongJson);

                if (this.encryptionEnabled && wasEncrypted) {
                    // ping이 암호화되어 있었으면 pong도 암호화
                    const encryptedPong = this.crypt.encryptString(pongJson);
                    if (encryptedPong) {
                        await this.pushSocket.send(encryptedPong);
                        console.log('🔒 암호화된 pong 응답 전송, 길이:', encryptedPong.length);
                        console.log('암호화된 pong preview:', encryptedPong.substring(0, 50));
                    } else {
                        console.error('Pong 암호화 실패, 평문으로 전송');
                        await this.pushSocket.send(pongJson);
                        console.log('📤 평문 pong 응답 전송 (암호화 실패)');
                    }
                } else {
                    // 평문 pong
                    await this.pushSocket.send(pongJson);
                    console.log('📤 평문 pong 응답 전송');
                }
            } catch (error) {
                console.error('Pong 응답 전송 실패:', error);
            }
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

            if (this.encryptionEnabled) {
                const encryptedMessage = this.crypt.encryptString(messageStr);
                if (encryptedMessage) {
                    await this.pushSocket.send(encryptedMessage);
                    console.log('🔒 암호화된 메시지 전송 완료:', message.type);
                } else {
                    await this.pushSocket.send(messageStr);
                    console.log('📤 평문 메시지 전송 완료 (암호화 실패):', message.type);
                }
            } else {
                await this.pushSocket.send(messageStr);
                console.log('📤 평문 메시지 전송 완료:', message.type);
            }

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
     * Hex 문자열인지 확인
     */
    private isHexString(str: string): boolean {
        return /^[0-9A-Fa-f]+$/.test(str) && str.length % 2 === 0 && str.length > 32;
    }

    /**
     * 암호화 모드 토글
     */
    public setEncryptionEnabled(enabled: boolean): void {
        this.encryptionEnabled = enabled;
        console.log(`🔐 암호화 모드: ${enabled ? '활성화' : '비활성화'}`);
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

            this.crypt.destroy();

            console.log('🔌 ZeroMQ 서버가 종료되었습니다');
        } catch (error) {
            console.error('ZeroMQ 서버 종료 중 오류:', error);
        }
    }
}

// 환경 변수에서 암호화 키 읽어옴
export const zmqBridge = new ZmqBridge(
    parseInt(process.env.ZMQ_PORT || '5000'),
    process.env.ZMQ_ENCRYPT_KEY || 'my_secure_zmq_key_2025'
);
