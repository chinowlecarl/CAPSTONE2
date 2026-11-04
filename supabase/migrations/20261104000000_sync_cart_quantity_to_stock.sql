DELETE FROM public.cart_items AS item
USING public.products AS product
WHERE product.id = item.product_id
  AND COALESCE(product.stock, 0) <= 0;

UPDATE public.cart_items AS item
SET quantity = LEAST(item.quantity, product.stock)
FROM public.products AS product
WHERE product.id = item.product_id
  AND product.stock > 0
  AND item.quantity > product.stock;

CREATE OR REPLACE FUNCTION public.sync_cart_items_with_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.stock, 0) <= 0 THEN
    DELETE FROM public.cart_items
    WHERE product_id = NEW.id;
  ELSE
    UPDATE public.cart_items
    SET quantity = LEAST(quantity, NEW.stock)
    WHERE product_id = NEW.id
      AND quantity > NEW.stock;
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
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be a positive whole number'
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

  IF NOT FOUND OR COALESCE(product_stock, 0) <= 0 THEN
    RAISE EXCEPTION 'This product is out of stock'
      USING ERRCODE = 'P2002';
  END IF;

  IF p_quantity > product_stock THEN
    RAISE EXCEPTION 'Only % item%s available',
      product_stock,
      CASE WHEN product_stock = 1 THEN '' ELSE 's' END
      USING ERRCODE = 'P2002';
  END IF;

  UPDATE public.cart_items AS item
  SET quantity = p_quantity
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

REVOKE ALL ON FUNCTION public.update_cart_item_quantity(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_cart_item_quantity(uuid, uuid, integer)
  TO service_role;
