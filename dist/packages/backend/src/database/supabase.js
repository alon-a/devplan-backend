"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbService = exports.DatabaseService = exports.testConnection = exports.supabaseAnon = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = __importDefault(require("../config"));
const common_1 = require("@devplan/common");
// Create Supabase client
exports.supabase = (0, supabase_js_1.createClient)(config_1.default.SUPABASE_URL, config_1.default.SUPABASE_SERVICE_KEY);
// Create client with anon key for client-side operations
exports.supabaseAnon = (0, supabase_js_1.createClient)(config_1.default.SUPABASE_URL, config_1.default.SUPABASE_ANON_KEY);
// Test database connection
const testConnection = async () => {
    try {
        const { data, error } = await exports.supabase
            .from('users')
            .select('count')
            .limit(1);
        if (error) {
            (0, common_1.logError)(error, 'Database connection test failed');
            return false;
        }
        (0, common_1.logInfo)('Database connection test successful');
        return true;
    }
    catch (error) {
        (0, common_1.logError)(error, 'Database connection test failed');
        return false;
    }
};
exports.testConnection = testConnection;
// Database service class for common operations
class DatabaseService {
    // Get user by ID
    async getUserById(userId) {
        const { data, error } = await exports.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        if (error)
            throw error;
        return data;
    }
    // Get user by email
    async getUserByEmail(email) {
        const { data, error } = await exports.supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        if (error)
            throw error;
        return data;
    }
    // Create user
    async createUser(userData) {
        const { data, error } = await exports.supabase
            .from('users')
            .insert(userData)
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    // Update user
    async updateUser(userId, updates) {
        const { data, error } = await exports.supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    // Get dialogues for user
    async getUserDialogues(userId, options = {}) {
        let query = exports.supabase
            .from('dialogues')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (options.status) {
            query = query.eq('status', options.status);
        }
        if (options.limit) {
            query = query.limit(options.limit);
        }
        const { data, error } = await query;
        if (error)
            throw error;
        return data;
    }
    // Get videos for user
    async getUserVideos(userId, options = {}) {
        let query = exports.supabase
            .from('videos')
            .select(`
        *,
        dialogue: dialogues(title, content),
        template: templates(name, category)
      `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (options.status) {
            query = query.eq('status', options.status);
        }
        if (options.limit) {
            query = query.limit(options.limit);
        }
        const { data, error } = await query;
        if (error)
            throw error;
        return data;
    }
    // Get active templates
    async getActiveTemplates(category) {
        let query = exports.supabase
            .from('templates')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true });
        if (category) {
            query = query.eq('category', category);
        }
        const { data, error } = await query;
        if (error)
            throw error;
        return data;
    }
}
exports.DatabaseService = DatabaseService;
exports.dbService = new DatabaseService();
//# sourceMappingURL=supabase.js.map