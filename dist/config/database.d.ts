declare let db: any;
declare let dbType: 'sqlite' | 'postgres';
declare let usePostgres: boolean;
export declare const dbHelpers: {
    exec(sql: string): Promise<void>;
    query<T = any>(sql: string, params?: any[]): Promise<T | null>;
    queryAll<T = any>(sql: string, params?: any[]): Promise<T[]>;
    run(sql: string, params?: any[]): Promise<{
        lastInsertRowid: number | null;
        changes: number;
    }>;
};
export declare function initializeDatabase(): Promise<void>;
export { db, dbType, usePostgres };
export default dbHelpers;
//# sourceMappingURL=database.d.ts.map