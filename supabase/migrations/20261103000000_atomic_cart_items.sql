DELETE FROM public.cart_items AS item
USING public.products AS product
WHERE product.id = item.product_id
  AND COALESCE(product.stock, 0) <= 0;

WITH ranked AS (
  SELECT
    item.id,
    item.product_id,
    FIRST_VALUE(item.id) OVER (
      PARTITION BY item.user_id, item.product_id
      ORDER BY item.id
    ) AS keep_id,
    SUM(item.quantity) OVER (
      PARTITION BY item.user_id, item.product_id
    ) AS total_quantity
  FROM public.cart_items AS item
),
totals AS (
  SELECT keep_id, product_id, MAX(total_quantity) AS total_quantity
  FROM ranked
  GROUP BY keep_id, product_id
)
UPDATE public.cart_items AS item
SET quantity = LEAST(totals.total_quantity, COALESCE(product.stock, totals.total_quantity))
FROM totals
JOIN public.products AS product ON product.id = totals.product_id
WHERE item.id = totals.keep_id;

DELETE FROM public.cart_items AS item
USING (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, product_id
    ORDER BY id
  ) AS row_number
  FROM public.cart_items
) AS duplicates
WHERE duplicates.row_number > 1
  AND item.id = duplicates.id;

CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_product_unique_idx
  ON public.cart_items (user_id, product_id);

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
  current_quantity integer;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be a positive whole number'
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

  SELECT COALESCE(SUM(quantity), 0)::integer
  INTO current_quantity
  FROM public.cart_items
  WHERE user_id = p_user_id
    AND product_id = p_product_id;

  IF current_quantity + p_quantity > COALESCE(product.stock, 0) THEN
    IF COALESCE(product.stock, 0) <= 0 THEN
      RAISE EXCEPTION 'This product is out of stock'
        USING ERRCODE = 'P1002';
    END IF;
    RAISE EXCEPTION 'Only % item%s available',
      product.stock,
      CASE WHEN product.stock = 1 THEN '' ELSE 's' END
      USING ERRCODE = 'P1002';
  END IF;

  INSERT INTO public.cart_items (user_id, product_id, quantity)
  VALUES (p_user_id, p_product_id, p_quantity)
  ON CONFLICT (user_id, product_id)
  DO UPDATE SET quantity = public.cart_items.quantity + EXCLUDED.quantity
  RETURNING * INTO cart_item;

  RETURN to_jsonb(cart_item);
END;
$$;

REVOKE ALL ON FUNCTION public.add_cart_item(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_cart_item(uuid, uuid, integer) TO service_role;
