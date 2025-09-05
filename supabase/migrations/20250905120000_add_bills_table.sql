-- Create bills table for storing user bills
create extension if not exists pgcrypto;

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  beneficiary text not null,
  amount numeric(12,2) not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','paid')),
  category text,
  payment_method text,
  paid_at date,
  barcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.bills enable row level security;

-- Policies: users can only access their own rows
create policy if not exists "Users can view their own bills"
  on public.bills for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert their own bills"
  on public.bills for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update their own bills"
  on public.bills for update
  using (auth.uid() = user_id);

create policy if not exists "Users can delete their own bills"
  on public.bills for delete
  using (auth.uid() = user_id);

-- Trigger to keep updated_at current
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger if not exists update_bills_updated_at
before update on public.bills
for each row execute procedure public.update_updated_at_column();

-- Helpful indexes
create index if not exists bills_user_id_idx on public.bills(user_id);
create index if not exists bills_user_due_date_idx on public.bills(user_id, due_date);