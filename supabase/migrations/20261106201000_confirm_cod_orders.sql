CREATE OR REPLACE FUNCTION public.track_product_payment_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND NEW.payment_method = 'COD' THEN
    UPDATE public.products AS product
    SET reserved_until = NULL
    FROM public.order_items AS item
    WHERE item.order_id = NEW.id
      AND item.product_id = product.id
      AND product.stock = 0;
    RETURN NEW;
  END IF;

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
  IF p_payment_method NOT IN ('COD', 'GCASH', 'MAYA') THEN
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
    CASE WHEN p_payment_method = 'COD' THEN 'confirmed' ELSE 'pending' END
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

UPDATE public.orders
SET status = 'confirmed'
WHERE status = 'pending'
  AND payment_method = 'COD';
