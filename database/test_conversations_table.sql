-- Create test_conversations table for storing SMS test messages
CREATE TABLE IF NOT EXISTS test_conversations (
    id BIGSERIAL PRIMARY KEY,
    message_id TEXT UNIQUE NOT NULL,
    from_number TEXT NOT NULL,
    to_number TEXT,
    message_text TEXT,
    has_media BOOLEAN DEFAULT FALSE,
    media_data JSONB,
    received_at TIMESTAMPTZ,
    full_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_test_conversations_message_id ON test_conversations(message_id);
CREATE INDEX IF NOT EXISTS idx_test_conversations_from_number ON test_conversations(from_number);
CREATE INDEX IF NOT EXISTS idx_test_conversations_created_at ON test_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_conversations_received_at ON test_conversations(received_at DESC);

-- Add comments for documentation
COMMENT ON TABLE test_conversations IS 'Stores SMS test messages received from Telnyx webhook for debugging and testing';
COMMENT ON COLUMN test_conversations.message_id IS 'Unique message ID from Telnyx';
COMMENT ON COLUMN test_conversations.from_number IS 'Phone number that sent the message';
COMMENT ON COLUMN test_conversations.to_number IS 'Phone number that received the message';
COMMENT ON COLUMN test_conversations.message_text IS 'The text content of the SMS message';
COMMENT ON COLUMN test_conversations.has_media IS 'Whether the message contains media attachments';
COMMENT ON COLUMN test_conversations.media_data IS 'JSON data of media attachments if any';
COMMENT ON COLUMN test_conversations.received_at IS 'Timestamp when Telnyx received the message';
COMMENT ON COLUMN test_conversations.full_payload IS 'Complete webhook payload from Telnyx for debugging';
COMMENT ON COLUMN test_conversations.created_at IS 'Timestamp when record was created in our database'; 