import { createClient } from '@supabase/supabase-js';
import config from '../config';
import { logError, logInfo } from '../common';

// Create Supabase client
export const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_KEY
);

// Create client with anon key for client-side operations
export const supabaseAnon = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_ANON_KEY
);

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      logError(error, 'Database connection test failed');
      return false;
    }

    logInfo('Database connection test successful');
    return true;
  } catch (error) {
    logError(error as Error, 'Database connection test failed');
    return false;
  }
};

// Database service class for common operations
export class DatabaseService {
  // Get user by ID
  async getUserById(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  // Get user by email
  async getUserByEmail(email: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;
    return data;
  }

  // Create user
  async createUser(userData: any) {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update user
  async updateUser(userId: string, updates: any) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get dialogues for user
  async getUserDialogues(userId: string, options: any = {}) {
    let query = supabase
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
    if (error) throw error;
    return data;
  }

  // Get videos for user
  async getUserVideos(userId: string, options: any = {}) {
    let query = supabase
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
    if (error) throw error;
    return data;
  }

  // Get active templates
  async getActiveTemplates(category?: string) {
    let query = supabase
      .from('templates')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
}

export const dbService = new DatabaseService(); 
