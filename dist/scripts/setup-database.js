"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("../database/supabase");
const common_1 = require("@devplan/common");
const createTables = async () => {
    try {
        (0, common_1.logInfo)('Starting database setup...');
        // Create users table
        const { error: usersError } = await supabase_1.supabase.rpc('exec_sql', {
            sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          avatar_url TEXT,
          preferences JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create index on email for faster lookups
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        
        -- Create updated_at trigger
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';
        
        DROP TRIGGER IF EXISTS update_users_updated_at ON users;
        CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `
        });
        if (usersError) {
            throw usersError;
        }
        // Create templates table
        const { error: templatesError } = await supabase_1.supabase.rpc('exec_sql', {
            sql: `
        CREATE TABLE IF NOT EXISTS templates (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          avatar_url TEXT NOT NULL,
          voice_id VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
        CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active);
        
        -- Create updated_at trigger
        DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
        CREATE TRIGGER update_templates_updated_at
          BEFORE UPDATE ON templates
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `
        });
        if (templatesError) {
            throw templatesError;
        }
        // Create dialogues table
        const { error: dialoguesError } = await supabase_1.supabase.rpc('exec_sql', {
            sql: `
        CREATE TABLE IF NOT EXISTS dialogues (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          transcript TEXT,
          audio_url TEXT,
          video_url TEXT,
          mood_analysis JSONB,
          analysis_status VARCHAR(50) DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
          language VARCHAR(20) DEFAULT 'unknown',
          analysis_metadata JSONB DEFAULT '{}',
          status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'analyzed', 'generated', 'completed')),
          template_id UUID REFERENCES templates(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_dialogues_user_id ON dialogues(user_id);
        CREATE INDEX IF NOT EXISTS idx_dialogues_status ON dialogues(status);
        CREATE INDEX IF NOT EXISTS idx_dialogues_analysis_status ON dialogues(analysis_status);
        CREATE INDEX IF NOT EXISTS idx_dialogues_language ON dialogues(language);
        CREATE INDEX IF NOT EXISTS idx_dialogues_created_at ON dialogues(created_at);
        
        -- Create updated_at trigger
        DROP TRIGGER IF EXISTS update_dialogues_updated_at ON dialogues;
        CREATE TRIGGER update_dialogues_updated_at
          BEFORE UPDATE ON dialogues
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `
        });
        if (dialoguesError) {
            throw dialoguesError;
        }
        // Create videos table
        const { error: videosError } = await supabase_1.supabase.rpc('exec_sql', {
            sql: `
        CREATE TABLE IF NOT EXISTS videos (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          dialogue_id UUID NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          template_id UUID NOT NULL REFERENCES templates(id),
          avatar_url TEXT NOT NULL,
          audio_url TEXT NOT NULL,
          video_url TEXT NOT NULL,
          duration INTEGER NOT NULL,
          status VARCHAR(50) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_videos_dialogue_id ON videos(dialogue_id);
        CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
        CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
        CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
      `
        });
        if (videosError) {
            throw videosError;
        }
        // Insert default templates
        const { error: insertTemplatesError } = await supabase_1.supabase.rpc('exec_sql', {
            sql: `
        INSERT INTO templates (name, description, avatar_url, voice_id, category) VALUES
        ('Therapist Sarah', 'Professional and empathetic therapist avatar', 'https://example.com/avatars/sarah.jpg', 'voice_sarah_001', 'professional'),
        ('Counselor Mike', 'Warm and supportive counselor avatar', 'https://example.com/avatars/mike.jpg', 'voice_mike_001', 'professional'),
        ('Life Coach Emma', 'Motivational life coach avatar', 'https://example.com/avatars/emma.jpg', 'voice_emma_001', 'motivational'),
        ('Meditation Guide Zen', 'Calming meditation guide avatar', 'https://example.com/avatars/zen.jpg', 'voice_zen_001', 'meditation')
        ON CONFLICT DO NOTHING;
      `
        });
        if (insertTemplatesError) {
            (0, common_1.logError)(insertTemplatesError, 'Failed to insert default templates');
        }
        (0, common_1.logInfo)('✅ Database setup completed successfully');
        // Test the connection
        const { data, error: testError } = await supabase_1.supabase.from('users').select('count').limit(1);
        if (testError) {
            throw testError;
        }
        (0, common_1.logInfo)('✅ Database connection test passed');
    }
    catch (error) {
        (0, common_1.logError)(error, 'Database setup failed');
        process.exit(1);
    }
};
// Run the setup
createTables();
//# sourceMappingURL=setup-database.js.map