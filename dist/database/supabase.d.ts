export declare const supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", any>;
export declare const supabaseAnon: import("@supabase/supabase-js").SupabaseClient<any, "public", any>;
export declare const testConnection: () => Promise<boolean>;
export declare class DatabaseService {
    getUserById(userId: string): Promise<any>;
    getUserByEmail(email: string): Promise<any>;
    createUser(userData: any): Promise<any>;
    updateUser(userId: string, updates: any): Promise<any>;
    getUserDialogues(userId: string, options?: any): Promise<any[]>;
    getUserVideos(userId: string, options?: any): Promise<any[]>;
    getActiveTemplates(category?: string): Promise<any[]>;
}
export declare const dbService: DatabaseService;
//# sourceMappingURL=supabase.d.ts.map