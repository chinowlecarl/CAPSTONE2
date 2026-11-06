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

UPDATE public.products AS product
SET stock = 1,
    reserved_until = NULL
FROM public.order_items AS item
JOIN public.orders AS order_row ON order_row.id = item.order_id
WHERE item.product_id = product.id
  AND order_row.status = 'pending'
  AND order_row.payment_status = 'REJECTED'
  AND product.stock = 0;
