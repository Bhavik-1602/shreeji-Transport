-- ==============================================================================
-- 0004_add_payment_breakdown_to_trips.sql
-- Run this query in Supabase SQL Editor to add received_amount (Ketlu Aavyu)
-- and balance_amount (Ketlu Baki) columns to the trips table.
-- ==============================================================================

alter table trips add column if not exists received_amount numeric(12,2) default 0;
alter table trips add column if not exists balance_amount numeric(12,2) default 0;

-- Backfill existing rows based on payment_status:
update trips set
  received_amount = case
    when payment_status = 'received' then coalesce(total_freight, 0)
    else 0
  end,
  balance_amount = case
    when payment_status = 'received' then 0
    else coalesce(total_freight, 0)
  end
where received_amount is null;
