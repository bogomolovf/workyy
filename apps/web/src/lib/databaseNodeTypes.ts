export type DatabaseNodePayload = {
  connectionName: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string; // Only used while editing; not persisted in payload
  ssl: boolean;
  connectionId?: string; // ID of server-side connection record
  secretId?: string; // Secret ID holding the password
  status?: 'idle' | 'connected' | 'error';
  lastTestedAt?: string; // ISO timestamp
};

