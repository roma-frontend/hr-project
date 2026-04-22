-- =====================================================
-- HR Platform - Chat Module Migration
-- Day 2: Chat Conversations, Messages, Members, Calls
-- =====================================================

-- Chat Conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    type chat_type NOT NULL,
    name VARCHAR(255),
    description TEXT,
    avatar_url TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    last_message_at BIGINT,
    last_message_text TEXT,
    last_message_senderid UUID REFERENCES users(id),
    dm_key VARCHAR(255) UNIQUE,
    is_pinned BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    deleted_by UUID REFERENCES users(id),
    deleted_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_chat_conv_org ON chat_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_org_last ON chat_conversations(organization_id, last_message_at);
CREATE INDEX IF NOT EXISTS idx_chat_conv_org_not_deleted ON chat_conversations(organization_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_chat_conv_org_pinned ON chat_conversations(organization_id, is_pinned);
CREATE INDEX IF NOT EXISTS idx_chat_conv_org_archived ON chat_conversations(organization_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_chat_conv_dm_key ON chat_conversations(dm_key);
CREATE INDEX IF NOT EXISTS idx_chat_conv_creator ON chat_conversations(created_by);

-- Chat Members
CREATE TABLE IF NOT EXISTS chat_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversationid UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    userid UUID NOT NULL REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    role chat_member_role NOT NULL DEFAULT 'member',
    unread_count INTEGER NOT NULL DEFAULT 0,
    last_read_at BIGINT,
    last_read_messageid UUID REFERENCES chat_messages(id),
    is_muted BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at BIGINT,
    is_archived BOOLEAN DEFAULT false,
    joined_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_chat_members_conversation ON chat_members(conversationid);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(userid);
CREATE INDEX IF NOT EXISTS idx_chat_members_org ON chat_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_conv_user ON chat_members(conversationid, userid);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversationid UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    senderid UUID NOT NULL REFERENCES users(id),
    type message_type NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    attachments JSONB,
    reply_toid UUID REFERENCES chat_messages(id),
    reply_to_content TEXT,
    reply_to_sender_name VARCHAR(255),
    reactions JSONB DEFAULT '{}',
    mentioned_userids UUID[],
    read_by JSONB DEFAULT '[]',
    poll JSONB,
    thread_count INTEGER DEFAULT 0,
    thread_last_at BIGINT,
    scheduled_for BIGINT,
    is_sent BOOLEAN DEFAULT true,
    link_preview JSONB,
    parent_messageid UUID REFERENCES chat_messages(id),
    is_edited BOOLEAN DEFAULT false,
    edited_at BIGINT,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at BIGINT,
    deleted_for_users UUID[],
    is_pinned BOOLEAN DEFAULT false,
    pinned_by UUID REFERENCES users(id),
    pinned_at BIGINT,
    call_duration BIGINT,
    call_type call_type,
    call_status call_status,
    is_service_broadcast BOOLEAN DEFAULT false,
    broadcast_title VARCHAR(255),
    broadcast_icon VARCHAR(50),
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_conversation ON chat_messages(conversationid);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv_created ON chat_messages(conversationid, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_msg_org ON chat_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_sender ON chat_messages(senderid);
CREATE INDEX IF NOT EXISTS idx_chat_msg_pinned ON chat_messages(conversationid, is_pinned);

-- Chat Saved Messages
CREATE TABLE IF NOT EXISTS chat_saved_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    userid UUID NOT NULL REFERENCES users(id),
    messageid UUID NOT NULL REFERENCES chat_messages(id),
    conversationid UUID NOT NULL REFERENCES chat_conversations(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    saved_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_chat_saved_user ON chat_saved_messages(userid);
CREATE INDEX IF NOT EXISTS idx_chat_saved_user_conv ON chat_saved_messages(userid, conversationid);
CREATE INDEX IF NOT EXISTS idx_chat_saved_user_org ON chat_saved_messages(userid, organization_id);

-- Chat Typing Indicators
CREATE TABLE IF NOT EXISTS chat_typing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversationid UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    userid UUID NOT NULL REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_chat_typing_conversation ON chat_typing(conversationid);
CREATE INDEX IF NOT EXISTS idx_chat_typing_conv_user ON chat_typing(conversationid, userid);

-- Chat Calls
CREATE TABLE IF NOT EXISTS chat_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversationid UUID NOT NULL REFERENCES chat_conversations(id),
    organization_id UUID REFERENCES organizations(id),
    initiatorid UUID NOT NULL REFERENCES users(id),
    type call_type NOT NULL,
    status call_status NOT NULL DEFAULT 'ringing',
    participants JSONB NOT NULL,
    started_at BIGINT,
    ended_at BIGINT,
    duration BIGINT,
    created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_chat_calls_conversation ON chat_calls(conversationid);
CREATE INDEX IF NOT EXISTS idx_chat_calls_org ON chat_calls(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_calls_initiator ON chat_calls(initiatorid);
CREATE INDEX IF NOT EXISTS idx_chat_calls_status ON chat_calls(status);

-- =====================================================
-- RLS POLICIES FOR CHAT
-- =====================================================

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_saved_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_typing ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_calls ENABLE ROW LEVEL SECURITY;

-- Chat conversation policies
DO $$ BEGIN
CREATE POLICY "Users can view conversations they are members of" ON chat_conversations
    FOR SELECT USING (
        id IN (SELECT conversationid FROM chat_members WHERE userid = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can create conversations" ON chat_conversations
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can update conversations they own or admin" ON chat_conversations
    FOR UPDATE USING (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Chat member policies
DO $$ BEGIN
CREATE POLICY "Users can view members of their conversations" ON chat_members
    FOR SELECT USING (
        conversationid IN (SELECT conversationid FROM chat_members WHERE userid = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can join conversations" ON chat_members
    FOR INSERT WITH CHECK (userid = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can leave conversations" ON chat_members
    FOR DELETE USING (userid = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Chat message policies
DO $$ BEGIN
CREATE POLICY "Users can view messages in their conversations" ON chat_messages
    FOR SELECT USING (
        conversationid IN (SELECT conversationid FROM chat_members WHERE userid = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can send messages to their conversations" ON chat_messages
    FOR INSERT WITH CHECK (
        senderid = auth.uid()
        AND conversationid IN (SELECT conversationid FROM chat_members WHERE userid = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can edit their own messages" ON chat_messages
    FOR UPDATE USING (senderid = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can delete their own messages" ON chat_messages
    FOR DELETE USING (
        senderid = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Chat typing policies
DO $$ BEGIN
CREATE POLICY "Users can view typing in their conversations" ON chat_typing
    FOR SELECT USING (
        conversationid IN (SELECT conversationid FROM chat_members WHERE userid = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can insert typing status" ON chat_typing
    FOR INSERT WITH CHECK (userid = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can update their typing status" ON chat_typing
    FOR UPDATE USING (userid = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can delete their typing status" ON chat_typing
    FOR DELETE USING (userid = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Chat call policies
DO $$ BEGIN
CREATE POLICY "Users can view calls in their conversations" ON chat_calls
    FOR SELECT USING (
        conversationid IN (SELECT conversationid FROM chat_members WHERE userid = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can initiate calls" ON chat_calls
    FOR INSERT WITH CHECK (initiatorid = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can update calls they initiated" ON chat_calls
    FOR UPDATE USING (initiatorid = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Chat saved messages policies
DO $$ BEGIN
CREATE POLICY "Users can view their own saved messages" ON chat_saved_messages
    FOR SELECT USING (userid = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can save messages" ON chat_saved_messages
    FOR INSERT WITH CHECK (userid = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Users can unsave messages" ON chat_saved_messages
    FOR DELETE USING (userid = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =====================================================
-- TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update last_message_at and last_message_text on new message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations
    SET last_message_at = NEW.created_at,
        last_message_text = LEFT(NEW.content, 100),
        last_message_senderid = NEW.senderid,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
    WHERE id = NEW.conversationid;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON chat_messages;
CREATE TRIGGER update_conversation_last_message_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- Auto-increment unread count for members when new message arrives
CREATE OR REPLACE FUNCTION increment_unread_counts()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_members
    SET unread_count = unread_count + 1
    WHERE conversationid = NEW.conversationid
      AND userid != NEW.senderid
      AND is_muted = false;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS increment_unread_counts_trigger ON chat_messages;
CREATE TRIGGER increment_unread_counts_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION increment_unread_counts();

-- Auto-clear typing indicators after message is sent
CREATE OR REPLACE FUNCTION clear_typing_indicators()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM chat_typing WHERE conversationid = NEW.conversationid;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS clear_typing_indicators_trigger ON chat_messages;
CREATE TRIGGER clear_typing_indicators_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION clear_typing_indicators();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE chat_conversations IS 'Chat conversations (DMs and groups)';
COMMENT ON TABLE chat_members IS 'Conversation membership tracking';
COMMENT ON TABLE chat_messages IS 'All chat messages with rich metadata';
COMMENT ON TABLE chat_saved_messages IS 'User-saved/bookmarked messages';
COMMENT ON TABLE chat_typing IS 'Real-time typing indicators';
COMMENT ON TABLE chat_calls IS 'Voice/video call records';
