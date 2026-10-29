ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS lalamove_status TEXT,
  ADD COLUMN IF NOT EXISTS lalamove_share_link TEXT;
