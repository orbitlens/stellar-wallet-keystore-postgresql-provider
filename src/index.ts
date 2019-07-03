import { Client } from 'pg'

interface EncryptedKeysData {
    encrypterName: string
    salt: string
    keysBlob: string
    creationTime: number
    modifiedTime: number
}

interface ConnectionOptions {
    connectionString: string
}

export default class PgStorage {

    constructor(options: ConnectionOptions) {
        if (!options || !options.connectionString)
            throw new Error('Connection string is null or undefined')
        this.client = new Client({ connectionString: options.connectionString })
    }

    private client: Client
    private isConnected: boolean = false

    private rowToKeyData(row: any) {
        return <EncryptedKeysData>{
            encrypterName: row.encrypter_name,
            salt: row.salt,
            keysBlob: (row.encrypted_keys_data || '').toString(),
            creationTime: row.created_at,
            modifiedTime: row.modified_at || row.created_at
        }
    }

    async connect() {
        await this.client.connect()

        const checkTableExistsQuery = `SELECT EXISTS(
            SELECT 1
            FROM   information_schema.tables 
            WHERE table_name = 'encrypted_keys'
        )`

        const result = await this.client.query(checkTableExistsQuery)
        if (result.rows[0].exists.toString() !== 'true') {
            const createTableQuery = `CREATE TABLE public.encrypted_keys (
                user_id text NOT NULL PRIMARY KEY,
                encrypted_keys_data bytea NOT NULL,
                salt text NOT NULL,
                encrypter_name text NOT NULL,
                created_at timestamp with time zone NOT NULL DEFAULT NOW(),
                modified_at timestamp with time zone
            )`
            await this.client.query(createTableQuery)
        }

        this.isConnected = true
    }

    /* 
     * Close connection.
     **/
    async close() {
        if (this.isConnected) {
            await this.client.end()
            this.isConnected = false
        }
    }



    async getKeyData(userId: string) {

        const q = `
            SELECT encrypted_keys_data, salt, encrypter_name, created_at, modified_at
            FROM encrypted_keys
            WHERE user_id = $1
        `

        const result = await this.client.query(q, [userId])

        if (result.rowCount < 1)
            throw new Error('Data not found')

        return this.rowToKeyData(result.rows[0])
    }

    async addKeyData(keyData: EncryptedKeysData, userId: string) {

        const q = `
            INSERT INTO encrypted_keys (user_id, encrypted_keys_data, salt, encrypter_name)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id) DO UPDATE SET encrypted_keys_data = excluded.encrypted_keys_data, salt = excluded.salt, encrypter_name = excluded.encrypter_name, modified_at = NOW()
            RETURNING encrypted_keys_data, salt, encrypter_name, created_at, modified_at
        `

        const values = [
            userId,
            keyData.keysBlob,
            keyData.salt,
            keyData.encrypterName
        ]

        const result = await this.client.query(q, values)

        return this.rowToKeyData(result.rows[0])
    }

    async updateKeyData(keyData: EncryptedKeysData, userId: string) {
        return await this.addKeyData(keyData, userId)
    }

    async removeKeyData(userId: string) {
        const q = `
            DELETE FROM encrypted_keys
            WHERE user_id = $1
        `
        await this.client.query(q, [userId])
    }

    async isDataExist(userId: string) {
        const q = `
            SELECT EXISTS(
                SELECT 1 FROM encrypted_keys 
                WHERE user_id = '${userId}'
            )
        `
        const result = await this.client.query(q)
        return result.rows[0].exists.toString() === 'true'
    }
}