-- The application server uses service_role for database access. The browser
-- only needs to read its own profile and update non-privileged profile fields.
-- Restrictive policies also constrain any older permissive policies.

DO $$
DECLARE
  table_name text;
  protected_tables text[] := ARRAY[
    'profiles',
    'products',
    'cart_items',
    'orders',
    'order_items',
    'categories',
    'activity_logs'
  ];
BEGIN
  FOREACH table_name IN ARRAY protected_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE EXCEPTION 'Required table public.% is missing; refusing to apply data access restrictions', table_name;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END
$$;

-- Only the signed-in user's profile row can be read. Existing permissive
-- policies cannot expand that access because these policies are restrictive.
DROP POLICY IF EXISTS profiles_api_select_own ON public.profiles;
CREATE POLICY profiles_api_select_own
  ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_api_update_own ON public.profiles;
CREATE POLICY profiles_api_update_own
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_client_select_own ON public.profiles;
CREATE POLICY profiles_client_select_own
  ON public.profiles AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_client_deny_anon_select ON public.profiles;
CREATE POLICY profiles_client_deny_anon_select
  ON public.profiles AS RESTRICTIVE
  FOR SELECT TO anon
  USING (false);

DROP POLICY IF EXISTS profiles_client_update_own ON public.profiles;
CREATE POLICY profiles_client_update_own
  ON public.profiles AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_client_deny_insert ON public.profiles;
CREATE POLICY profiles_client_deny_insert
  ON public.profiles AS RESTRICTIVE
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS profiles_client_deny_delete ON public.profiles;
CREATE POLICY profiles_client_deny_delete
  ON public.profiles AS RESTRICTIVE
  FOR DELETE TO anon, authenticated
  USING (false);

-- Profile updates remain available in the browser only for ordinary contact
-- fields. Role, status, and other privileged columns require the backend.
REVOKE UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
DO $$
DECLARE
  column_name text;
BEGIN
  FOR column_name IN
    SELECT attname
    FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass
      AND attnum > 0
      AND NOT attisdropped
  LOOP
    EXECUTE format(
      'REVOKE UPDATE (%I) ON TABLE public.profiles FROM PUBLIC, anon, authenticated',
      column_name
    );
  END LOOP;
END
$$;
GRANT UPDATE (fullname, phone, address) ON TABLE public.profiles TO authenticated;

-- All other business data is accessed through authenticated server routes.
-- The service_role backend bypasses RLS; direct anon/authenticated Data API
-- reads and writes are denied even if older permissive policies exist.
DO $$
DECLARE
  table_name text;
  protected_tables text[] := ARRAY[
    'products',
    'cart_items',
    'orders',
    'order_items',
    'categories',
    'activity_logs'
  ];
BEGIN
  FOREACH table_name IN ARRAY protected_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS client_api_only ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY client_api_only ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      table_name
    );
  END LOOP;
END
$$;

-- Payment-proof files are uploaded and signed by the backend. Prevent direct
-- browser access to that bucket without affecting policies for other buckets.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    BEGIN
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS payment_proofs_api_only ON storage.objects;
      CREATE POLICY payment_proofs_api_only
        ON storage.objects AS RESTRICTIVE
        FOR ALL TO anon, authenticated
        USING (bucket_id <> 'payment-proofs')
        WITH CHECK (bucket_id <> 'payment-proofs');
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping storage.objects direct-bucket restriction because % is not the table owner; bucket access remains controlled by the storage admin role.', current_user;
    END;
  END IF;
END
$$;
