ALTER TABLE public.orders
  ADD COLUMN delivery_lat numeric(10, 7),
  ADD COLUMN delivery_lng numeric(10, 7),
  ADD CONSTRAINT orders_delivery_coordinates_pair
    CHECK ((delivery_lat IS NULL) = (delivery_lng IS NULL)),
  ADD CONSTRAINT orders_delivery_lat_range
    CHECK (delivery_lat IS NULL OR delivery_lat BETWEEN -90 AND 90),
  ADD CONSTRAINT orders_delivery_lng_range
    CHECK (delivery_lng IS NULL OR delivery_lng BETWEEN -180 AND 180);
