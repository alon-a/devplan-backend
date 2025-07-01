"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupVideoSharingTables = setupVideoSharingTables;
const supabase_1 = require("../database/supabase");
const common_1 = require("@devplan/common");
async function setupVideoSharingTables() {
    try {
        (0, common_1.logInfo)('Setting up video sharing and analytics tables...');
        // Create video_shares table
        const { error: videoSharesError } = await supabase_1.supabase.rpc('exec_sql', {
            sql: `
        CREATE TABLE IF NOT EXISTS video_shares (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          share_token TEXT UNIQUE NOT NULL,
          share_type TEXT NOT NULL CHECK (share_type IN ('link', 'social_media')),
          platform TEXT,
          share_url TEXT,
          expires_at TIMESTAMP WITH TIME ZONE,
          access_control JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_video_shares_video_id ON video_shares(video_id);
        CREATE INDEX IF NOT EXISTS idx_video_shares_user_id ON video_shares(user_id);
        CREATE INDEX IF NOT EXISTS idx_video_shares_token ON video_shares(share_token);
        CREATE INDEX IF NOT EXISTS idx_video_shares_expires_at ON video_shares(expires_at);

        -- Create trigger to update updated_at
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';

        DROP TRIGGER IF EXISTS update_video_shares_updated_at ON video_shares;
        CREATE TRIGGER update_video_shares_updated_at
          BEFORE UPDATE ON video_shares
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `
        });
        if (videoSharesError) {
            throw videoSharesError;
        }
        // Create analytics_events table
        const { error: analyticsEventsError } = await supabase_1.supabase.rpc('exec_sql', {
            sql: `
        CREATE TABLE IF NOT EXISTS analytics_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type TEXT NOT NULL,
          event_data JSONB NOT NULL DEFAULT '{}',
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
        CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
      `
        });
        if (analyticsEventsError) {
            throw analyticsEventsError;
        }
        // Create analytics function for admin dashboard
        const { error: analyticsFunctionError } = await supabase_1.supabase.rpc('exec_sql', {
            sql: `
        CREATE OR REPLACE FUNCTION get_video_analytics(date_filter TEXT DEFAULT '')
        RETURNS JSONB AS $$
        DECLARE
          result JSONB;
          date_condition TEXT;
        BEGIN
          -- Build date condition
          IF date_filter != '' THEN
            date_condition := ' AND ' || date_filter;
          ELSE
            date_condition := '';
          END IF;

          -- Get aggregated analytics
          WITH analytics AS (
            SELECT
              COUNT(DISTINCT d.id) as total_dialogues,
              COUNT(DISTINCT CASE WHEN d.analysis_status = 'completed' THEN d.id END) as analyzed_dialogues,
              COUNT(DISTINCT v.id) as total_videos,
              COUNT(DISTINCT CASE WHEN v.status = 'completed' THEN v.id END) as completed_videos,
              COUNT(DISTINCT vs.id) as total_shares,
              COUNT(DISTINCT CASE WHEN vs.share_type = 'social_media' THEN vs.id END) as social_shares,
              COUNT(DISTINCT CASE WHEN vs.share_type = 'link' THEN vs.id END) as link_shares,
              COUNT(DISTINCT ae.id) as total_events,
              AVG(CASE WHEN v.duration > 0 THEN v.duration END) as avg_video_duration,
              COUNT(DISTINCT CASE WHEN v.metadata->>'template_selection'->>'fallback_used' = 'true' THEN v.id END) as template_fallbacks
            FROM users u
            LEFT JOIN dialogues d ON d.user_id = u.id
            LEFT JOIN videos v ON v.dialogue_id = d.id
            LEFT JOIN video_shares vs ON vs.video_id = v.id
            LEFT JOIN analytics_events ae ON ae.user_id = u.id
            WHERE u.id IS NOT NULL
          )
          SELECT to_jsonb(analytics.*) INTO result FROM analytics;

          RETURN result;
        END;
        $$ LANGUAGE plpgsql;
      `
        });
        if (analyticsFunctionError) {
            throw analyticsFunctionError;
        }
        // Add provider column to videos table if it doesn't exist
        const { error: addProviderColumnError } = await supabase_1.supabase.rpc('exec_sql', {
            sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'videos' AND column_name = 'provider'
          ) THEN
            ALTER TABLE videos ADD COLUMN provider TEXT;
          END IF;
        END $$;
      `
        });
        if (addProviderColumnError) {
            throw addProviderColumnError;
        }
        // Add error_message column to videos table if it doesn't exist
        const { error: addErrorMessageColumnError } = await supabase_1.supabase.rpc('exec_sql', {
            sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'videos' AND column_name = 'error_message'
          ) THEN
            ALTER TABLE videos ADD COLUMN error_message TEXT;
          END IF;
        END $$;
      `
        });
        if (addErrorMessageColumnError) {
            throw addErrorMessageColumnError;
        }
        (0, common_1.logInfo)('Video sharing and analytics tables setup completed successfully');
    }
    catch (error) {
        (0, common_1.logError)(error, 'Failed to setup video sharing tables');
        throw error;
    }
}
// Run setup if called directly
if (require.main === module) {
    setupVideoSharingTables()
        .then(() => {
        console.log('✅ Video sharing tables setup completed');
        process.exit(0);
    })
        .catch((error) => {
        console.error('❌ Video sharing tables setup failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=setup-video-sharing-tables.js.map