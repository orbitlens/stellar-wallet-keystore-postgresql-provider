interface EncryptedKeysData {
    encrypterName: string;
    salt: string;
    keysBlob: string;
    creationTime: number;
    modifiedTime: number;
}
interface ConnectionOptions {
    connectionString: string;
}
export default class PgStorage {
    constructor(options: ConnectionOptions);
    private client;
    private isConnected;
    private rowToKeyData;
    connect(): Promise<void>;
    close(): Promise<void>;
    getKeyData(userId: string): Promise<EncryptedKeysData>;
    addKeyData(keyData: EncryptedKeysData, userId: string): Promise<EncryptedKeysData>;
    updateKeyData(keyData: EncryptedKeysData, userId: string): Promise<EncryptedKeysData>;
    removeKeyData(userId: string): Promise<void>;
    isDataExist(userId: string): Promise<boolean>;
}
export {};
