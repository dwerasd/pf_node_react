// // 완전한 다중 클라이언트 지원 ZMQ 서버
// import * as zmq from 'zeromq';

// export class MultiClientZmqBridge {
//   private routerSocket: zmq.Router | null = null;
//   private pubSocket: zmq.Publisher | null = null;
//   private clients: Map<string, { id: Buffer, lastSeen: Date }> = new Map();

//   public async start(): Promise<void> {
//     // ROUTER: 각 클라이언트 식별 가능, 개별 응답 가능
//     this.routerSocket = new zmq.Router();
//     await this.routerSocket.bind(`tcp://*:${6000}`);

//     // PUB: 모든 클라이언트에 브로드캐스트
//     this.pubSocket = new zmq.Publisher();
//     await this.pubSocket.bind(`tcp://*:${6001}`);

//     console.log('🔌 다중 클라이언트 ZMQ 서버 시작');
//     this.startRouterLoop();
//   }

//   private async startRouterLoop(): Promise<void> {
//     if (!this.routerSocket) return;

//     for await (const [clientId, , message] of this.routerSocket) {
//       // 클라이언트 등록
//       const clientIdStr = clientId.toString('hex');
//       this.clients.set(clientIdStr, {
//         id: clientId,
//         lastSeen: new Date()
//       });

//       console.log(`📨 클라이언트 ${clientIdStr}로부터 메시지 수신`);
      
//       // 메시지 처리
//       await this.handleClientMessage(clientId, message);
//     }
//   }

//   private async handleClientMessage(clientId: Buffer, message: Buffer): Promise<void> {
//     try {
//       const messageStr = message.toString('utf8');
//       const parsedMessage = JSON.parse(messageStr);

//       console.log('메시지 처리:', parsedMessage);

//       // 개별 클라이언트에 응답
//       const response = {
//         type: 'ack',
//         data: { status: 'received' },
//         timestamp: Date.now()
//       };

//       if (this.routerSocket) {
//         await this.routerSocket.send([
//           clientId,           // 클라이언트 식별자
//           Buffer.alloc(0),    // 구분자
//           JSON.stringify(response)
//         ]);
//       }

//     } catch (error) {
//       console.error('메시지 처리 오류:', error);
//     }
//   }

//   // 모든 클라이언트에 브로드캐스트
//   public async broadcastToAll(message: any): Promise<void> {
//     if (!this.pubSocket) return;

//     const messageStr = JSON.stringify(message);
//     await this.pubSocket.send(['broadcast', messageStr]);
//     console.log(`📡 ${this.clients.size}개 클라이언트에 브로드캐스트`);
//   }

//   // 특정 클라이언트에만 전송
//   public async sendToClient(clientIdStr: string, message: any): Promise<boolean> {
//     const client = this.clients.get(clientIdStr);
//     if (!client || !this.routerSocket) return false;

//     try {
//       await this.routerSocket.send([
//         client.id,
//         Buffer.alloc(0),
//         JSON.stringify(message)
//       ]);
//       return true;
//     } catch (error) {
//       console.error('개별 전송 실패:', error);
//       return false;
//     }
//   }

//   public getConnectedClientCount(): number {
//     return this.clients.size;
//   }

//   public getClientList(): string[] {
//     return Array.from(this.clients.keys());
//   }
// }
