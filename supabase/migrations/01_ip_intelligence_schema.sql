-- Create client_trackers table mapping unique token to user
create table if not exists public.client_trackers (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    site_url varchar(255),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create visitor_logs table storing resolved company hits
create table if not exists public.visitor_logs (
    id uuid primary key default gen_random_uuid(),
    tracker_id uuid references public.client_trackers(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    company_name varchar(255) not null,
    company_domain varchar(255) not null,
    page_path varchar(255),
    referrer varchar(255),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.client_trackers enable row level security;
alter table public.visitor_logs enable row level security;

-- Create RLS Policies
create policy "Users can perform all actions on their own client_trackers"
on public.client_trackers for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can view their own visitor logs"
on public.visitor_logs for select
using (auth.uid() = user_id);
