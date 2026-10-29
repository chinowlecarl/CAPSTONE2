# FITCHEQUE: Project Documentation and Progress Log

Prepared October 22, 2026 · Capstone project (CAPSTONE2)

## 1. Overview

FITCHEQUE is an online fashion store with a customer storefront and an admin
dashboard. Customers browse products, manage a cart, place orders, and submit
GCash or Maya payment proof. Admins manage products, orders, payments, users,
insights, and customer activity. Paid orders can be sent to Lalamove for delivery
booking.

See [PROJECT-FLOWCHART.md](./PROJECT-FLOWCHART.md) for a high-level diagram of
the application components and customer, admin, payment, and delivery flows.

### Live setup

- Frontend: React and Vite, hosted on Vercel.
- Backend API: Express in `server.cjs`, hosted on Render.
- Database, authentication, and file storage: Supabase.
- Delivery booking: Supabase Edge Function
  `create-lalamove-order`.

Use the deployment dashboard values for live service URLs. Do not put private
service credentials in frontend configuration or documentation.

## 2. How the pieces connect

1. The browser loads the React application.
2. Supabase Auth signs in customers and admins. Authentication includes a second
   verification step; admin payment endpoints require an MFA session at AAL2.
3. The frontend calls the Express API with the signed-in user's access token.
   The API checks authentication and admin authorization before serving protected
   routes, then uses Supabase for data access.
4. Payment proof images are stored in the private `payment-proofs` bucket.
   Authorized admins view an image using a signed link that expires after five
   minutes.
5. When payment is approved, the admin screen attempts to book delivery using
   the `create-lalamove-order` Supabase Edge Function. Failed bookings can be
   retried from Payments.

### Environment variables

Frontend build/runtime configuration:

- `VITE_API_URL`: API origin only, with no trailing slash or `/api` suffix.
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`: public/anon key only.

Backend private configuration:

- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`: secret; backend only.
- `FRONTEND_URL`: exact allowed frontend origin.
- `JWT_SECRET`: long random secret.

Keep actual values in the deployment environment or an untracked local `.env`.
Use `.env.example` as a starting template and verify its public endpoint values
for the target environment; never put private service credentials in it.

### Lalamove delivery status updates

The `lalamove-webhook` Edge Function accepts Lalamove notifications, verifies
each notification against Lalamove's signed Order Details API, and saves the
provider status and tracking link. The customer order screen and admin Payments
screen refresh every 30 seconds while open.

1. Apply the schema migration with `supabase db push`.
2. Deploy the webhook with
   `supabase functions deploy lalamove-webhook --project-ref <project-ref>`.
3. Generate a long random token and save it as the Edge Function secret
   `LALAMOVE_WEBHOOK_TOKEN`. Do not commit the value.
4. In the Lalamove Partner Portal, open **Developers → Webhook**, choose the
   matching sandbox or production environment and v3 webhook format, and set
   the URL to
   `https://<project-ref>.supabase.co/functions/v1/lalamove-webhook?token=<token>`.
   Use the same token configured in Supabase.
5. Ensure the Lalamove API credentials configured for
   `create-lalamove-order` are also available to the webhook function. Use
   sandbox credentials with `https://rest.sandbox.lalamove.com`, or production
   credentials with `https://rest.lalamove.com`.
6. Confirm delivery updates appear in the Partner Portal's **Webhook Attempts**
   and in customer/admin order details. The webhook returns non-2xx errors when
   it cannot verify or save a status, so Lalamove can retry the notification.

## 3. Database (Supabase)

Core data used by the app:

- `profiles`: user name, username, phone, address, role, and account status.
- `products`: catalog, price, discount, category, image, stock, and featured
  state.
- `cart_items`: a user's selected products and quantities.
- `orders`: customer, total, shipping address, order/payment/delivery statuses,
  payment reference and proof path, and Lalamove order id.
- `order_items`: products, quantities, and prices recorded for each order.
- `categories`: admin-managed product categories.
- `activity_logs`: recorded user and admin activity.
- Storage bucket `payment-proofs`: private payment screenshots.

Account status is `active` or `suspended`. The admin Users screen can suspend or
reactivate an account. Customer names are displayed in red with a **Suspended**
tag on admin screens that show those customers.

Common status values used by the app:

- Order: `pending`, `confirmed`, `shipped`, `delivered`, `cancelled`
- Payment: `PENDING`, `PENDING_VERIFICATION`, `PAID`, `REJECTED`
- Delivery: `NOT_BOOKED`, `BOOKING`, `BOOKED`, `PICKED_UP`, `DELIVERED`,
  `CANCELLED`, `FAILED`

The deployed schema must match the SQL migrations and setup files applied to the
Supabase project.

### Direct database access and login protection

Apply `supabase/migrations/20261023000000_restrict_direct_data_access.sql` to
the Supabase project. The app's backend uses the service-role key; the browser
should use only the anon/publishable key. This migration restricts direct
Data API access to business tables, allows authenticated users to read only
their own profile, limits browser profile updates to name/phone/address, and
blocks direct access to the private `payment-proofs` bucket. It is designed to
constrain older permissive RLS policies too. Test it in staging before
production; direct client access to products, carts, orders, and categories is
intentionally denied because the app accesses them through the backend API.
With the Supabase CLI linked to the intended project, review migration history
using `supabase migration list`, then apply pending migrations using
`supabase db push`.

Login is performed directly against Supabase Auth by the browser, so the
Express API rate limiter does not protect password attempts. In the Supabase
Dashboard, configure Authentication's rate limits and enable CAPTCHA/bot
protection for sign-in and sign-up. Test with a staging account and verify
repeated invalid attempts are throttled or challenged; do not perform
high-volume tests against production.

Password recovery is handled by the frontend at `/?page=reset-password`.
Set the Supabase Auth Site URL to the production frontend origin and add the
exact recovery redirect URL to Authentication > URL Configuration > Redirect
URLs (for example, `https://your-domain.com/?page=reset-password`). Add the
local frontend URL when testing locally. The sign-in screen requests the
recovery email; the reset page accepts the recovery session and updates the
password. Keep the email template link pointed at `{{ .ConfirmationURL }}`.

After deploying the migration, test using anon and customer access tokens:

- Anonymous requests cannot read profiles or payment proofs.
- A customer can read and update their own profile's `fullname`, `phone`, and
  `address`, but cannot change `role`/`status`, read another profile, or access
  business tables directly.
- Payment-proof upload and signed-link flows still work through the backend.

## 4. Features

### Customer

- Register and sign in with a second verification step.
- Browse and search products and view product details.
- Manage a cart and submit checkout orders.
- Pay by GCash or Maya, then submit a payment reference and screenshot.
- View order history and use available cancellation actions.
- Manage profile details and authenticator-app security settings.

### Admin

- Products: create, edit, archive, restore, and manage stock.
- Orders: view orders, search/filter, and update order status.
- Payments: view payment submissions and proof, approve or reject payment, and
  book or retry Lalamove delivery.
- Users: search accounts, review status, suspend, and reactivate.
- Customer names for suspended accounts appear red with a **Suspended** tag on
  the Users, Orders, Payments, Check-In, Customer Behavior, and Activity Log
  screens.
- Check-In / User Transaction Desk: look up a customer and inspect order history.
- Sales Insights and Customer Behavior: view rule-based reports.
- Activity Log: review recorded system activity.
- Archived Products: restore archived products.

## 5. Main API groups

- Public: health check, product catalog, product details/search, and category
  listing.
- Customer (authenticated): profile, cart, orders, payment submission, and
  account actions.
- Admin (authenticated and authorized): products, orders, user management,
  statistics, insights, activity logs, categories, and payment review.
- Payment administration: `GET /api/admin/payments`,
  `GET /api/admin/orders/:id/payment-proof`, and
  `PUT /api/admin/orders/:id/verify-payment`.
- Payment proof submission: `PUT /api/orders/:id/payment`.
- Username availability: `GET /api/auth/username-available`.

Payment admin endpoints require both an admin role and a completed MFA session.
Payment approval updates the order payment status; the UI then invokes the
Lalamove Edge Function. A Lalamove failure does not undo the payment approval;
the admin can retry booking from the Ready to book list.

## 6. Security notes

- Never commit `.env`, service-role keys, JWT secrets, or other private
  credentials.
- Only the Supabase anon/public key belongs in frontend variables.
- Backend admin endpoints validate the user's role; payment review also checks
  the MFA assurance level.
- Customer payment proof files are stored in a private bucket and accessed by
  short-lived signed URLs.
- The database remains responsible for enforcing access policies and uniqueness
  constraints, even when the frontend performs early validation.
- Do not treat a displayed username-availability result as a guarantee that a
  concurrent signup cannot claim the same username.

## 7. Progress log (newest first)

### October 22, 2026: Admin payment access and suspended-account indicators

- Connected the existing Payments verification screen to the Admin dashboard
  as a top-level tab.
- The tab exposes the existing proof review, payment approval/rejection,
  Lalamove booking, and failed-booking retry actions.
- Included customer account status in the admin payments API response.
- Added a shared customer-name treatment: suspended customers are shown in red
  with a **Suspended** badge on relevant admin screens, including payment
  verification, order management, user management, customer lookup, customer
  behavior, and activity history.
- Validation: `npm run build` and `node --check` for the changed backend routes
  pass. Vite reports existing config-loader and large-chunk warnings.

### Existing implementation

- Manual GCash/Maya payment submission and private proof storage.
- Admin payment verification endpoints and Lalamove booking Edge Function.
- Admin user suspension/reactivation, customer behavior reporting, sales
  insights, and activity logging.
- Categories and Supabase schema/migrations are managed in the `supabase`
  directory.

## 8. Admin payment workflow

1. Sign in as an admin and complete the required second-factor authentication.
2. Open **Payments** in the admin tab bar.
3. In **To verify**, open the submitted proof and independently confirm the
   amount and reference with the payment provider.
4. Approve and book delivery, or reject the proof so the customer can submit a
   replacement.
5. If the payment is approved but Lalamove booking fails, open **Ready to book**
   and retry after checking the delivery details and Lalamove Records.
6. Use **Delivery** to review booking and delivery statuses, and **Rejected** to
   review rejected submissions.

Never approve a payment based only on the screenshot; verify the transaction
with the payment provider first.

## 9. Suspended-account display behavior

Suspension status comes from the profile record and is returned by the admin
user/order/payment/activity APIs. A shared customer-name component displays the
name in red and adds a **Suspended** badge when the status is `suspended`. The
marker is informational and does not replace backend authorization or
suspension enforcement.

The current customer behavior report is cached briefly by the API. A newly
changed status may take up to the report cache interval to appear in that
report; refresh the report if a recent change is not yet shown.

## 10. Local development and checks

1. Install dependencies with `npm install`.
2. Copy `.env.example` to a local `.env` and set the correct development
   Supabase/API values.
3. Start the API using `npm run dev` or `npm start`.
4. Start the Vite frontend using `npx vite`.
5. Build the frontend with `npm run build`.

Keep Supabase Edge Function secrets configured in Supabase rather than in
frontend source. Check the Supabase CLI configuration before applying
migrations or deploying functions.

## 11. Follow-up checks

- Confirm the deployed admin account has MFA enabled and can open Payments.
- Verify proof viewing, approve/reject, successful Lalamove booking, and retry
  after a simulated or real booking failure in a safe test environment.
- Confirm that a suspended customer is marked on each admin view and that
  reactivation removes the marker after data refresh.
- Confirm the production frontend points to the intended API and Supabase
  project.
- Keep this progress log current when features are deployed or their status
  changes.
