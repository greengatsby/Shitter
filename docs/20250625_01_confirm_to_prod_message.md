# CONFIRM_TO_PROD Message Handling Implementation

**Date:** December 25, 2025  
**Scope:** SMS webhook integration with Claude Code SDK for deployment approval workflow

## Problem Statement

When Claude Code SDK completes code changes and includes `[CONFIRM_TO_PROD]` in its response, SMS users were receiving:
- Verbose, technical messages with git workflow details
- Mixed content including `[READY_TO_PROCEED]` and intermediate steps
- No clear call-to-action for deployment approval
- Missing development preview links

## Solution Overview

Implemented a two-part system to provide clean, actionable approval prompts via SMS:

### 1. Claude Code Route Modifications (`/api/claude-code/route.ts`)

**Content Replacement Logic:**
- Detects `[CONFIRM_TO_PROD]` marker in assistant messages and result events
- Replaces entire message content with standardized approval prompt
- Includes dev preview URL for immediate testing

**Fixed Approval Message:**
```
Changes Applied Successfully! Approve these changes to be applied to main by including the word "approved" in your answer.

Dev view: https://calculator-steer-by-wire-test-git-dev-dane-myers-projects.vercel.app/
```

**Smart Approval Detection System:**
- Enhanced system prompt with intelligent approval recognition
- Accepts various approval phrases: "approved", "yes", "go ahead", "deploy", etc.
- Handles casual responses: "yeah go ahead", "looks good", "ship it"
- Automatic production deployment upon approval detection

### 2. SMS Webhook Enhancements (`/api/sms/webhook/route.ts`)

**Message Processing Improvements:**
- Added logic to detect approval prompt and use only that message
- Prevents combining early `[READY_TO_PROCEED]` messages with final approval
- Comprehensive SSE event debugging for troubleshooting

**SMS Length Handling:**
- Implemented smart truncation with 800-character limit
- Added 40302 error code handling (message too large)
- Fallback to generic "check app" message for oversized responses

## Database Infrastructure

Created supporting tables for message management:

**1. `processed_messages` Table:**
```sql
CREATE TABLE processed_messages (
    id BIGSERIAL PRIMARY KEY,
    message_id TEXT UNIQUE NOT NULL,
    phone_number TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Prevents duplicate message processing
- Tracks SMS message IDs from Telnyx

**2. `test_conversations` Table:**
```sql
CREATE TABLE test_conversations (
    id BIGSERIAL PRIMARY KEY,
    message_id TEXT UNIQUE NOT NULL,
    from_number TEXT NOT NULL,
    to_number TEXT,
    message_text TEXT,
    has_media BOOLEAN DEFAULT FALSE,
    media_data JSONB,
    received_at TIMESTAMPTZ,
    full_payload JSONB
);
```
- Stores test SMS conversations for debugging
- Supports media attachments and full webhook payloads

## Technical Implementation Details

### Event Flow
1. **Code Changes** → Claude commits to dev branch
2. **[CONFIRM_TO_PROD] Generated** → Claude Code route replaces content
3. **SMS Processing** → Webhook detects approval prompt
4. **User Response** → Smart approval detection triggers production deployment

### Debug Features Added
- Comprehensive SSE event logging in SMS webhook
- Content replacement tracking in Claude Code route
- Message flow visibility for troubleshooting

### Git Workflow Integration
- Automatic dev branch commits and pushes
- Production deployment on approval
- Branch verification and conflict handling

## Testing Infrastructure

**SMS Test Interface:**
- Frontend for sending test messages
- Real-time received message display (5-second refresh)
- Endpoint: `/api/sms/test/conversation`

**Webhook Testing:**
- Direct Telnyx integration testing
- Duplicate message prevention verification
- Media attachment support

## Current Status

✅ **Completed:**
- Content replacement logic in both assistant and result events
- Smart approval detection system
- SMS message truncation and error handling
- Database infrastructure for message tracking
- Comprehensive debugging and logging

🔄 **In Progress:**
- Fine-tuning message flow detection in SMS webhook
- Optimizing approval message delivery timing

## Next Steps

1. **Verify Message Flow:** Ensure final approval messages reach SMS users consistently
2. **Production Testing:** Test full workflow with real deployment scenarios
3. **Error Handling:** Add fallback mechanisms for edge cases
4. **Performance Optimization:** Reduce latency in message processing pipeline

## Key Files Modified

- `src/app/api/claude-code/route.ts` - Content replacement and approval detection
- `src/app/api/sms/webhook/route.ts` - SMS processing and message handling
- `src/app/api/sms/test/conversation/route.ts` - Test webhook endpoint
- `src/app/sms-test/page.tsx` - Test interface frontend
- `database/processed_messages_table.sql` - Duplicate prevention table
- `database/test_conversations_table.sql` - Test conversation storage
