-- Create processed_messages table for SMS duplicate prevention
CREATE TABLE IF NOT EXISTS processed_messages (
    id BIGSERIAL PRIMARY KEY,
    message_id TEXT UNIQUE NOT NULL,
    phone_number TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_processed_messages_message_id ON processed_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_processed_messages_phone_number ON processed_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_processed_messages_processed_at ON processed_messages(processed_at DESC);

-- Add comments for documentation
COMMENT ON TABLE processed_messages IS 'Tracks processed SMS messages to prevent duplicate processing';
COMMENT ON COLUMN processed_messages.message_id IS 'Unique message ID from Telnyx to prevent duplicates';
COMMENT ON COLUMN processed_messages.phone_number IS 'Phone number that sent the message';
COMMENT ON COLUMN processed_messages.processed_at IS 'Timestamp when message was processed';
COMMENT ON COLUMN processed_messages.created_at IS 'Timestamp when record was created in database'; 