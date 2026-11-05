ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS variant_selection jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_selection jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.product_variant_selection_is_valid(
  p_variants jsonb,
  p_selection jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    jsonb_typeof(COALESCE(p_variants, '{}'::jsonb)) = 'object'
    AND jsonb_typeof(COALESCE(p_selection, '{}'::jsonb)) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_each(
        CASE
          WHEN jsonb_typeof(COALESCE(p_variants, '{}'::jsonb)) = 'object'
            THEN COALESCE(p_variants, '{}'::jsonb)
          ELSE '{}'::jsonb
        END
      ) AS configured(key, options)
      WHERE configured.key NOT IN ('size', 'color', 'style')
        OR CASE
          WHEN jsonb_typeof(configured.options) = 'array' THEN
            jsonb_array_length(configured.options) = 0
            OR NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(configured.options) AS available_option(value)
              WHERE available_option.value = (COALESCE(p_selection, '{}'::jsonb) ->> configured.key)
            )
          ELSE true
        END
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_object_keys(
        CASE
          WHEN jsonb_typeof(COALESCE(p_selection, '{}'::jsonb)) = 'object'
            THEN COALESCE(p_selection, '{}'::jsonb)
          ELSE '{}'::jsonb
        END
      ) AS selected(key)
      WHERE NOT ((
        CASE
          WHEN jsonb_typeof(COALESCE(p_variants, '{}'::jsonb)) = 'object'
            THEN COALESCE(p_variants, '{}'::jsonb)
          ELSE '{}'::jsonb
        END
      ) ? selected.key)
    );
$$;

DROP FUNCTION IF EXISTS public.add_cart_item(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.add_cart_item(
  p_user_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_variant_selection jsonb
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

  IF NOT public.product_variant_selection_is_valid(product.variants, p_variant_selection) THEN
    RAISE EXCEPTION 'Select a valid option for every product variant'
      USING ERRCODE = 'P1004';
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

  INSERT INTO public.cart_items (user_id, product_id, quantity, variant_selection)
  VALUES (p_user_id, p_product_id, 1, COALESCE(p_variant_selection, '{}'::jsonb))
  RETURNING * INTO cart_item;

  RETURN to_jsonb(cart_item);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_cart_item(
  p_user_id uuid,
  p_product_id uuid,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.add_cart_item(
    p_user_id,
    p_product_id,
    p_quantity,
    '{}'::jsonb
  );
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
  SET stock = 0
  FROM public.cart_items AS item
  WHERE item.user_id = p_user_id
    AND item.product_id = product.id;

  DELETE FROM public.cart_items
  WHERE user_id = p_user_id;

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.product_variant_selection_is_valid(jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_cart_item(uuid, uuid, integer, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_cart_item(uuid, uuid, integer, jsonb)
  TO service_role;
REVOKE ALL ON FUNCTION public.add_cart_item(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_cart_item(uuid, uuid, integer)
  TO service_role;
REVOKE ALL ON FUNCTION public.place_single_item_order(uuid, text, double precision, double precision, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_single_item_order(uuid, text, double precision, double precision, text)
  TO service_role;
