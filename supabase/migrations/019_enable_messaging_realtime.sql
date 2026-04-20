-- ============================================================================
-- 019_enable_messaging_realtime.sql
-- Add direct_messages and notifications to the supabase_realtime publication
-- so the Thread + NotificationBell subscriptions actually receive events.
-- Without this, postgres_changes subscriptions succeed but no broadcasts fire.
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
