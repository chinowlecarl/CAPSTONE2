ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_archived_after_sale boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.track_product_sold_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stock <= 0 THEN
      NEW.sold_at := COALESCE(NEW.sold_at, now());
    ELSE
      NEW.sold_at := NULL;
    END IF;
  ELSIF NEW.stock > 0 THEN
    NEW.sold_at := NULL;
    IF OLD.auto_archived_after_sale THEN
      NEW.archived_at := NULL;
      NEW.archived_by := NULL;
      NEW.auto_archived_after_sale := false;
    END IF;
  ELSIF OLD.stock > 0 THEN
    NEW.sold_at := now();
  ELSE
    NEW.sold_at := OLD.sold_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_track_sold_at ON public.products;
CREATE TRIGGER products_track_sold_at
  BEFORE INSERT OR UPDATE OF stock ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.track_product_sold_at();

CREATE OR REPLACE FUNCTION public.archive_sold_products()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_count integer;
BEGIN
  WITH archived AS (
    UPDATE public.products
    SET archived_at = sold_at + interval '72 hours',
        archived_by = NULL,
        auto_archived_after_sale = true
    WHERE stock <= 0
      AND sold_at IS NOT NULL
      AND sold_at <= now() - interval '72 hours'
      AND archived_at IS NULL
    RETURNING id
  ),
  removed_cart_items AS (
    DELETE FROM public.cart_items AS cart
    USING archived
    WHERE cart.product_id = archived.id
    RETURNING cart.id
  )
  SELECT count(*) INTO archived_count FROM archived;

  RETURN archived_count;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_sold_products() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_sold_products() TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_pending_payment(
  p_order_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
BEGIN
  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = p_order_id
    AND user_id = p_user_id
    AND status = 'pending'
    AND payment_status = 'PENDING';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  FOR item IN
    SELECT product_id, quantity
    FROM public.order_items
    WHERE order_id = p_order_id
  LOOP
    UPDATE public.products
    SET stock = COALESCE(stock, 0) + item.quantity
    WHERE id = item.product_id;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_pending_payment(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_pending_payment(uuid, uuid) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname = 'archive-sold-products';

  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  PERFORM cron.schedule(
    'archive-sold-products',
    '*/5 * * * *',
    'SELECT public.archive_sold_products()'
  );
END
$$;
