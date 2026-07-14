export interface ZmqMessage {
  type: string;
  data: any;
  timestamp: number;
  source: 'admin' | 'system' | 'cpp_client';
}

export interface UserUpdateMessage extends ZmqMessage {
  type: 'user_update' | 'user_create' | 'user_delete';
  data: {
    userId: number;
    username: string;
    role?: 'user' | 'admin';
    action: 'create' | 'update' | 'delete';
  };
}

export interface SystemMessage extends ZmqMessage {
  type: 'system_config' | 'server_restart' | 'maintenance';
  data: {
    action: string;
    parameters?: Record<string, any>;
  };
}

export interface ZmqClientInfo {
  clientId: string;
  connectedAt: Date;
  lastPing: Date;
  address: string;
}
