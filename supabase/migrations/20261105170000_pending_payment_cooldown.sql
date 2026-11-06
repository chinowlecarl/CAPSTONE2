CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reserved_until timestamptz;

WITH current_reservations AS (
  SELECT DISTINCT ON (item.product_id)
    item.product_id,
    orders.created_at + interval '2 minutes' AS expires_at
  FROM public.order_items AS item
  JOIN public.orders ON orders.id = item.order_id
  WHERE orders.status = 'pending'
    AND orders.payment_status = 'PENDING'
    AND orders.payment_method IN ('GCASH', 'MAYA')
  ORDER BY item.product_id, orders.created_at DESC
)
UPDATE public.products AS product
SET reserved_until = current_reservations.expires_at
FROM current_reservations
WHERE current_reservations.product_id = product.id
  AND product.stock = 0;

CREATE OR REPLACE FUNCTION public.track_product_payment_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_status = 'REJECTED' THEN
    UPDATE public.products AS product
    SET stock = 1,
        reserved_until = NULL
    FROM public.order_items AS item
    WHERE item.order_id = NEW.id
      AND item.product_id = product.id
      AND product.stock = 0;
  ELSIF NEW.payment_status = 'PENDING'
    AND NEW.payment_method IN ('GCASH', 'MAYA') THEN
    UPDATE public.products AS product
    SET reserved_until = now() + interval '2 minutes'
    FROM public.order_items AS item
    WHERE item.order_id = NEW.id
      AND item.product_id = product.id
      AND product.stock = 0;
  ELSIF NEW.payment_status <> 'PENDING'
    OR NEW.payment_method NOT IN ('GCASH', 'MAYA') THEN
    UPDATE public.products AS product
    SET reserved_until = NULL
    FROM public.order_items AS item
    WHERE item.order_id = NEW.id
      AND item.product_id = product.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_track_product_payment_reservation ON public.orders;
CREATE TRIGGER orders_track_product_payment_reservation
  AFTER UPDATE OF status, payment_status, payment_method ON public.orders
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.payment_status IS DISTINCT FROM NEW.payment_status
    OR OLD.payment_method IS DISTINCT FROM NEW.payment_method
  )
  EXECUTE FUNCTION public.track_product_payment_reservation();

CREATE OR REPLACE FUNCTION public.place_single_item_order(
  p_user_id uuid,
  p_shipping_address text,
  p_delivery_lat double precision,
  p_delivery_lng double precision,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item record;
  v_total numeric := 0;
  v_unit_price numeric;
  v_reservation_until timestamptz;
BEGIN
  IF p_payment_method NOT IN ('COD', 'GCASH', 'MAYA', 'CARD') THEN
    RAISE EXCEPTION 'Select a valid payment method'
      USING ERRCODE = 'P3002';
  END IF;

  PERFORM product.id
  FROM public.cart_items AS item
  JOIN public.products AS product ON product.id = item.product_id
  WHERE item.user_id = p_user_id
  ORDER BY product.id
  FOR UPDATE OF product;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cart is empty'
      USING ERRCODE = 'P3003';
  END IF;

  PERFORM item.id
  FROM public.cart_items AS item
  WHERE item.user_id = p_user_id
  ORDER BY item.product_id
  FOR UPDATE OF item;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cart is empty'
      USING ERRCODE = 'P3003';
  END IF;

  FOR v_item IN
    SELECT
      item.product_id,
      item.quantity,
      item.variant_selection,
      product.variants,
      product.title,
      product.price,
      product.discount,
      product.stock,
      product.archived_at
    FROM public.cart_items AS item
    JOIN public.products AS product ON product.id = item.product_id
    WHERE item.user_id = p_user_id
    ORDER BY product.id
  LOOP
    IF v_item.quantity <> 1 OR v_item.stock <> 1 OR v_item.archived_at IS NOT NULL THEN
      RAISE EXCEPTION '% is already sold or unavailable. Remove it from your cart and try again.',
        v_item.title
        USING ERRCODE = 'P3001';
    END IF;

    IF NOT public.product_variant_selection_is_valid(v_item.variants, v_item.variant_selection) THEN
      RAISE EXCEPTION 'The selected options for % are no longer available. Remove it from your cart and select again.',
        v_item.title
        USING ERRCODE = 'P3004';
    END IF;

    v_unit_price := CASE
      WHEN COALESCE(v_item.discount, 0) > 0
        THEN v_item.price * (1 - v_item.discount / 100)
      ELSE v_item.price
    END;
    v_total := v_total + v_unit_price;
  END LOOP;

  IF p_payment_method IN ('GCASH', 'MAYA') THEN
    v_reservation_until := now() + interval '2 minutes';
  END IF;

  INSERT INTO public.orders (
    user_id,
    total_amount,
    shipping_address,
    delivery_lat,
    delivery_lng,
    payment_method,
    status
  )
  VALUES (
    p_user_id,
    ROUND(v_total, 2),
    COALESCE(p_shipping_address, ''),
    p_delivery_lat,
    p_delivery_lng,
    p_payment_method,
    'pending'
  )
  RETURNING * INTO v_order;

  INSERT INTO public.order_items (
    order_id, product_id, quantity, unit_price, variant_selection
  )
  SELECT
    v_order.id,
    item.product_id,
    1,
    CASE
      WHEN COALESCE(product.discount, 0) > 0
        THEN product.price * (1 - product.discount / 100)
      ELSE product.price
    END,
    item.variant_selection
  FROM public.cart_items AS item
  JOIN public.products AS product ON product.id = item.product_id
  WHERE item.user_id = p_user_id;

  UPDATE public.products AS product
  SET stock = 0,
      reserved_until = v_reservation_until
  FROM public.cart_items AS item
  WHERE item.user_id = p_user_id
    AND item.product_id = product.id;

  DELETE FROM public.cart_items
  WHERE user_id = p_user_id;

  RETURN to_jsonb(v_order);
END;
$$;

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
  cancelled_order_id uuid;
BEGIN
  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = p_order_id
    AND user_id = p_user_id
    AND status = 'pending'
    AND payment_status = 'PENDING'
  RETURNING id INTO cancelled_order_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.products AS product
  SET stock = 1,
      reserved_until = NULL
  FROM public.order_items AS item
  WHERE item.order_id = cancelled_order_id
    AND item.product_id = product.id
    AND product.stock = 0;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_unpaid_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_order record;
  expired_order_id uuid;
  expired_count integer := 0;
BEGIN
  FOR pending_order IN
    SELECT order_row.id
    FROM public.orders AS order_row
    WHERE order_row.status = 'pending'
      AND (
        (
          order_row.payment_status = 'PENDING'
          AND order_row.payment_method IN ('GCASH', 'MAYA')
          AND EXISTS (
            SELECT 1
            FROM public.order_items AS item
            JOIN public.products AS product ON product.id = item.product_id
            WHERE item.order_id = order_row.id
              AND product.stock = 0
              AND product.reserved_until IS NOT NULL
              AND product.reserved_until <= now()
          )
        )
        OR (
          order_row.payment_status = 'REJECTED'
          AND EXISTS (
            SELECT 1
            FROM public.order_items AS item
            JOIN public.products AS product ON product.id = item.product_id
            WHERE item.order_id = order_row.id
              AND product.stock = 0
          )
        )
      )
    ORDER BY order_row.created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.orders AS order_row
    SET status = 'cancelled'
    WHERE order_row.id = pending_order.id
      AND order_row.status = 'pending'
      AND (
        (
          order_row.payment_status = 'PENDING'
          AND order_row.payment_method IN ('GCASH', 'MAYA')
          AND EXISTS (
            SELECT 1
            FROM public.order_items AS item
            JOIN public.products AS product ON product.id = item.product_id
            WHERE item.order_id = order_row.id
              AND product.stock = 0
              AND product.reserved_until IS NOT NULL
              AND product.reserved_until <= now()
          )
        )
        OR (
          order_row.payment_status = 'REJECTED'
          AND EXISTS (
            SELECT 1
            FROM public.order_items AS item
            JOIN public.products AS product ON product.id = item.product_id
            WHERE item.order_id = order_row.id
              AND product.stock = 0
          )
        )
      )
    RETURNING id INTO expired_order_id;

    IF FOUND THEN
      UPDATE public.products AS product
      SET stock = 1,
          reserved_until = NULL
      FROM public.order_items AS item
      WHERE item.order_id = expired_order_id
        AND item.product_id = product.id
        AND product.stock = 0;

      expired_count := expired_count + 1;
    END IF;
  END LOOP;

  RETURN expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.track_product_payment_reservation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_unpaid_orders()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_unpaid_orders() TO service_role;
REVOKE ALL ON FUNCTION public.place_single_item_order(uuid, text, double precision, double precision, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_single_item_order(uuid, text, double precision, double precision, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.cancel_pending_payment(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pending_payment(uuid, uuid)
  TO service_role;

DO $$
DECLARE
  existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname = 'expire-unpaid-orders';

  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  PERFORM cron.schedule(
    'expire-unpaid-orders',
    '* * * * *',
    'SELECT public.expire_unpaid_orders()'
  );
END
$$;
