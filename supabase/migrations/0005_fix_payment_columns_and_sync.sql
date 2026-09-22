-- ==============================================================================
-- 0005_fix_payment_columns_and_sync.sql
-- Run this in Supabase SQL Editor:
-- 1. Ensures all columns exist on trips table (party_name, received_amount, etc.)
-- 2. Ensures all columns exist on payments table
-- 3. Safely backfills received_amount & balance_amount without any column errors
-- ==============================================================================

-- 1. Ensure all columns exist on trips table
alter table trips add column if not exists party_name text;
alter table trips add column if not exists is_return_leg boolean default false;
alter table trips add column if not exists return_leg_for uuid;
alter table trips add column if not exists total_freight numeric(12,2);
alter table trips add column if not exists received_amount numeric(12,2) default 0;
alter table trips add column if not exists balance_amount numeric(12,2) default 0;
alter table trips add column if not exists payment_status text default 'pending';

-- 2. Ensure payments table exists and has all columns
create table if not exists payments (
  id                uuid primary key default gen_random_uuid(),
  transport_id      uuid not null default 'a0000000-0000-0000-0000-000000000001',
  date              date not null default current_date,
  party_name        text,
  vehicle_no        text,
  trip_ref          text,
  freight_amount    numeric(12,2),
  received_amount   numeric(12,2) not null default 0,
  balance           numeric(12,2),
  payment_mode      text not null default 'bank_transfer',
  bank_account      text,
  transaction_ref   text,
  note              text,
  created_at        timestamptz not null default now()
);

alter table payments add column if not exists party_name text;
alter table payments add column if not exists vehicle_no text;
alter table payments add column if not exists trip_ref text;
alter table payments add column if not exists freight_amount numeric(12,2);
alter table payments add column if not exists received_amount numeric(12,2) default 0;
alter table payments add column if not exists balance numeric(12,2);
alter table payments add column if not exists payment_mode text default 'bank_transfer';
alter table payments add column if not exists bank_account text;
alter table payments add column if not exists transaction_ref text;
alter table payments add column if not exists note text;

-- 3. Backfill received_amount and balance_amount from the payments table
--    Uses to_jsonb to guarantee 0% column errors regardless of previous table state
update trips t
set
  received_amount = coalesce(
    (
      select sum(coalesce((to_jsonb(p)->>'received_amount')::numeric, 0))
      from payments p
      where (
        (to_jsonb(p)->>'trip_ref') = t.id::text
        or (
          (
            (to_jsonb(p)->>'trip_ref') = t.sr_number
            or replace(replace(lower(coalesce(to_jsonb(p)->>'trip_ref', '')), '-', ''), '/', '') = replace(replace(lower(t.sr_number), '-', ''), '/', '')
            or lower(coalesce(to_jsonb(p)->>'trip_ref', '')) like lower(t.sr_number) || '%'
          )
          and (
            (select count(*) from trips t2 where t2.sr_number = t.sr_number) = 1
            or (
              case
                when lower(coalesce(to_jsonb(p)->>'trip_ref', '') || ' ' || coalesce(to_jsonb(p)->>'note', '')) like '%return%'
                  then coalesce((to_jsonb(t)->>'is_return_leg')::boolean, false) = true
                when (to_jsonb(p)->>'party_name') is not null 
                 and (to_jsonb(t)->>'party_name') is not null
                 and length(trim(to_jsonb(p)->>'party_name')) > 0
                  then lower(trim(to_jsonb(p)->>'party_name')) = lower(trim(to_jsonb(t)->>'party_name'))
                else coalesce((to_jsonb(t)->>'is_return_leg')::boolean, false) = false
              end
            )
          )
        )
      )
    ),
    case when coalesce((to_jsonb(t)->>'payment_status'), '') = 'received' then coalesce((to_jsonb(t)->>'total_freight')::numeric, 0) else 0 end
  ),
  balance_amount = greatest(
    0,
    coalesce((to_jsonb(t)->>'total_freight')::numeric, 0) - coalesce(
      (
        select sum(coalesce((to_jsonb(p)->>'received_amount')::numeric, 0))
        from payments p
        where (
          (to_jsonb(p)->>'trip_ref') = t.id::text
          or (
            (
              (to_jsonb(p)->>'trip_ref') = t.sr_number
              or replace(replace(lower(coalesce(to_jsonb(p)->>'trip_ref', '')), '-', ''), '/', '') = replace(replace(lower(t.sr_number), '-', ''), '/', '')
              or lower(coalesce(to_jsonb(p)->>'trip_ref', '')) like lower(t.sr_number) || '%'
            )
            and (
              (select count(*) from trips t2 where t2.sr_number = t.sr_number) = 1
              or (
                case
                  when lower(coalesce(to_jsonb(p)->>'trip_ref', '') || ' ' || coalesce(to_jsonb(p)->>'note', '')) like '%return%'
                    then coalesce((to_jsonb(t)->>'is_return_leg')::boolean, false) = true
                  when (to_jsonb(p)->>'party_name') is not null 
                   and (to_jsonb(t)->>'party_name') is not null
                   and length(trim(to_jsonb(p)->>'party_name')) > 0
                    then lower(trim(to_jsonb(p)->>'party_name')) = lower(trim(to_jsonb(t)->>'party_name'))
                  else coalesce((to_jsonb(t)->>'is_return_leg')::boolean, false) = false
                end
              )
            )
          )
        )
      ),
      case when coalesce((to_jsonb(t)->>'payment_status'), '') = 'received' then coalesce((to_jsonb(t)->>'total_freight')::numeric, 0) else 0 end
    )
  ),
  payment_status = case
    when coalesce((to_jsonb(t)->>'total_freight')::numeric, 0) > 0 and coalesce(
      (
        select sum(coalesce((to_jsonb(p)->>'received_amount')::numeric, 0))
        from payments p
        where (
          (to_jsonb(p)->>'trip_ref') = t.id::text
          or (
            (
              (to_jsonb(p)->>'trip_ref') = t.sr_number
              or replace(replace(lower(coalesce(to_jsonb(p)->>'trip_ref', '')), '-', ''), '/', '') = replace(replace(lower(t.sr_number), '-', ''), '/', '')
              or lower(coalesce(to_jsonb(p)->>'trip_ref', '')) like lower(t.sr_number) || '%'
            )
            and (
              (select count(*) from trips t2 where t2.sr_number = t.sr_number) = 1
              or (
                case
                  when lower(coalesce(to_jsonb(p)->>'trip_ref', '') || ' ' || coalesce(to_jsonb(p)->>'note', '')) like '%return%'
                    then coalesce((to_jsonb(t)->>'is_return_leg')::boolean, false) = true
                  when (to_jsonb(p)->>'party_name') is not null 
                   and (to_jsonb(t)->>'party_name') is not null
                   and length(trim(to_jsonb(p)->>'party_name')) > 0
                    then lower(trim(to_jsonb(p)->>'party_name')) = lower(trim(to_jsonb(t)->>'party_name'))
                  else coalesce((to_jsonb(t)->>'is_return_leg')::boolean, false) = false
                end
              )
            )
          )
        )
      ),
      case when coalesce((to_jsonb(t)->>'payment_status'), '') = 'received' then coalesce((to_jsonb(t)->>'total_freight')::numeric, 0) else 0 end
    ) >= coalesce((to_jsonb(t)->>'total_freight')::numeric, 0) then 'received'
    when coalesce(
      (
        select sum(coalesce((to_jsonb(p)->>'received_amount')::numeric, 0))
        from payments p
        where (
          (to_jsonb(p)->>'trip_ref') = t.id::text
          or (
            (
              (to_jsonb(p)->>'trip_ref') = t.sr_number
              or replace(replace(lower(coalesce(to_jsonb(p)->>'trip_ref', '')), '-', ''), '/', '') = replace(replace(lower(t.sr_number), '-', ''), '/', '')
              or lower(coalesce(to_jsonb(p)->>'trip_ref', '')) like lower(t.sr_number) || '%'
            )
            and (
              (select count(*) from trips t2 where t2.sr_number = t.sr_number) = 1
              or (
                case
                  when lower(coalesce(to_jsonb(p)->>'trip_ref', '') || ' ' || coalesce(to_jsonb(p)->>'note', '')) like '%return%'
                    then coalesce((to_jsonb(t)->>'is_return_leg')::boolean, false) = true
                  when (to_jsonb(p)->>'party_name') is not null 
                   and (to_jsonb(t)->>'party_name') is not null
                   and length(trim(to_jsonb(p)->>'party_name')) > 0
                    then lower(trim(to_jsonb(p)->>'party_name')) = lower(trim(to_jsonb(t)->>'party_name'))
                  else coalesce((to_jsonb(t)->>'is_return_leg')::boolean, false) = false
                end
              )
            )
          )
        )
      ),
      0
    ) > 0 then 'partial'
    else coalesce((to_jsonb(t)->>'payment_status'), 'pending')
  end;
