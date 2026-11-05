UPDATE public.products
SET stock = CASE WHEN COALESCE(stock, 0) > 0 THEN 1 ELSE 0 END
WHERE stock IS DISTINCT FROM CASE WHEN COALESCE(stock, 0) > 0 THEN 1 ELSE 0 END;

ALTER TABLE public.products
  ALTER COLUMN stock SET DEFAULT 1,
  ALTER COLUMN stock SET NOT NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_stock_single_item_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_stock_single_item_check CHECK (stock IN (0, 1));

DELETE FROM public.cart_items AS item
USING public.products AS product
WHERE product.id = item.product_id
  AND product.stock = 0;

UPDATE public.cart_items
SET quantity = 1
WHERE quantity IS DISTINCT FROM 1;

ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_single_item_quantity_check;
ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_single_item_quantity_check CHECK (quantity = 1);

CREATE OR REPLACE FUNCTION public.sync_cart_items_with_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stock = 0 THEN
    DELETE FROM public.cart_items
    WHERE product_id = NEW.id;
  ELSE
    UPDATE public.cart_items
    SET quantity = 1
    WHERE product_id = NEW.id
      AND quantity <> 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_sync_cart_items_with_stock ON public.products;
CREATE TRIGGER products_sync_cart_items_with_stock
  AFTER UPDATE OF stock ON public.products
  FOR EACH ROW
  WHEN (OLD.stock IS DISTINCT FROM NEW.stock)
  EXECUTE FUNCTION public.sync_cart_items_with_product_stock();

CREATE OR REPLACE FUNCTION public.add_cart_item(
  p_user_id uuid,
  p_product_id uuid,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product public.products%ROWTYPE;
  cart_item public.cart_items%ROWTYPE;
BEGIN
  IF p_quantity IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Each unique product can only be added once'
      USING ERRCODE = 'P1003';
  END IF;

  SELECT *
  INTO product
  FROM public.products
  WHERE id = p_product_id
    AND archived_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This product is no longer available'
      USING ERRCODE = 'P1001';
  END IF;

  IF product.stock <> 1 THEN
    RAISE EXCEPTION 'This one-of-a-kind item is already sold or unavailable'
      USING ERRCODE = 'P1002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cart_items
    WHERE user_id = p_user_id
      AND product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'This one-of-a-kind item is already in your cart'
      USING ERRCODE = 'P1002';
  END IF;

  INSERT INTO public.cart_items (user_id, product_id, quantity)
  VALUES (p_user_id, p_product_id, 1)
  RETURNING * INTO cart_item;

  RETURN to_jsonb(cart_item);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_cart_item_quantity(
  p_user_id uuid,
  p_cart_item_id uuid,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  product_stock integer;
  cart_item public.cart_items%ROWTYPE;
BEGIN
  IF p_quantity IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Each unique product can only have a quantity of one'
      USING ERRCODE = 'P2003';
  END IF;

  SELECT item.product_id
  INTO v_product_id
  FROM public.cart_items AS item
  WHERE item.id = p_cart_item_id
    AND item.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cart item not found'
      USING ERRCODE = 'P2001';
  END IF;

  SELECT product.stock
  INTO product_stock
  FROM public.products AS product
  WHERE product.id = v_product_id
  FOR UPDATE;

  IF NOT FOUND OR product_stock <> 1 THEN
    RAISE EXCEPTION 'This one-of-a-kind item is sold or unavailable'
      USING ERRCODE = 'P2002';
  END IF;

  UPDATE public.cart_items AS item
  SET quantity = 1
  WHERE item.id = p_cart_item_id
    AND item.user_id = p_user_id
  RETURNING item.* INTO cart_item;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cart item not found'
      USING ERRCODE = 'P2001';
  END IF;

  RETURN to_jsonb(cart_item);
END;
$$;

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

    v_unit_price := CASE
      WHEN COALESCE(v_item.discount, 0) > 0
        THEN v_item.price * (1 - v_item.discount / 100)
      ELSE v_item.price
    END;
    v_total := v_total + v_unit_price;
  END LOOP;

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

  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
  SELECT
    v_order.id,
    item.product_id,
    1,
    CASE
      WHEN COALESCE(product.discount, 0) > 0
        THEN product.price * (1 - product.discount / 100)
      ELSE product.price
    END
  FROM public.cart_items AS item
  JOIN public.products AS product ON product.id = item.product_id
  WHERE item.user_id = p_user_id;

  UPDATE public.products AS product
  SET stock = 0
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
    SELECT product_id
    FROM public.order_items
    WHERE order_id = p_order_id
  LOOP
    PERFORM 1
    FROM public.products
    WHERE id = item.product_id
    FOR UPDATE;

    IF NOT EXISTS (
        SELECT 1
        FROM public.order_items AS other_item
        JOIN public.orders AS other_order ON other_order.id = other_item.order_id
        WHERE other_item.product_id = item.product_id
          AND other_order.id <> p_order_id
          AND other_order.status <> 'cancelled'
    ) THEN
      UPDATE public.products
      SET stock = 1
      WHERE id = item.product_id;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_single_item_order(
  p_order_id uuid,
  p_user_id uuid,
  p_is_admin boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  item record;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND (p_is_admin OR user_id = p_user_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found'
      USING ERRCODE = 'P4001';
  END IF;

  IF v_order.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Only pending or confirmed orders can be cancelled'
      USING ERRCODE = 'P4002';
  END IF;

  IF v_order.delivery_status IN ('BOOKING', 'BOOKED', 'PICKED_UP', 'DELIVERED') THEN
    RAISE EXCEPTION 'A delivery is already booked for this order. Please contact the shop.'
      USING ERRCODE = 'P4003';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  FOR item IN
    SELECT product_id
    FROM public.order_items
    WHERE order_id = p_order_id
  LOOP
    PERFORM 1
    FROM public.products
    WHERE id = item.product_id
    FOR UPDATE;

    IF NOT EXISTS (
        SELECT 1
        FROM public.order_items AS other_item
        JOIN public.orders AS other_order ON other_order.id = other_item.order_id
        WHERE other_item.product_id = item.product_id
          AND other_order.id <> p_order_id
          AND other_order.status <> 'cancelled'
    ) THEN
      UPDATE public.products
      SET stock = 1
      WHERE id = item.product_id;
    END IF;
  END LOOP;

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.add_cart_item(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_cart_item(uuid, uuid, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.update_cart_item_quantity(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_cart_item_quantity(uuid, uuid, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.place_single_item_order(uuid, text, double precision, double precision, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_single_item_order(uuid, text, double precision, double precision, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.cancel_pending_payment(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pending_payment(uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.cancel_single_item_order(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_single_item_order(uuid, uuid, boolean)
  TO service_role;
