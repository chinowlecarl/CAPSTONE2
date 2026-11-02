# FITCHEQUE Project Flowchart

This is a high-level skeleton of the current application and its main data
flows. It omits individual screens and API endpoints so the diagram stays
readable as the project evolves.

```mermaid
flowchart TD
    Person["Visitor / Customer / Admin"] --> Web["React + Vite web app"]
    Web --> State["App state: session, profile, cart, notifications"]

    Person --> Auth["Supabase Auth<br/>Register / sign in / password recovery"]
    Auth --> Verify{"Second-factor step?"}
    Verify -->|"Customer: email OTP"| CustomerSession["Customer session"]
    Verify -->|"Admin: TOTP when enrolled"| AdminSession["Admin session (AAL2 for protected APIs)"]
    Verify -->|"Not required"| Session["Authenticated session"]
    Session --> State
    CustomerSession --> State
    AdminSession --> State

    State --> Pages{"App area"}
    Pages --> Public["Storefront<br/>Home / products / about"]
    Pages --> Customer["Customer area<br/>Cart / checkout / orders / profile"]
    Pages --> Admin["Admin dashboard<br/>Catalog / orders / payments / users"]
    Pages --> Reports["Admin tools<br/>Events & check-in / insights / activity / archive"]

    Public --> Api["Express API"]
    Customer --> Api
    Admin --> Api
    Reports --> Api
    Web -. "Auth session and own-profile access" .-> SupabaseAuth["Supabase Auth + profiles"]

    Api --> Gate{"Validate access"}
    Gate -->|"Public catalog endpoints"| Data["Supabase database"]
    Gate -->|"Customer token: own data"| Data
    Gate -->|"Admin role + MFA where required"| Data
    Gate -->|"Invalid / unauthorized"| Denied["Return access error to app"]

    Customer --> Checkout{"Checkout requested"}
    Checkout -->|"Signed out"| Auth
    Checkout -->|"Signed in"| Order["Create order and order items"]
    Order --> Api
    Data --> OrderSaved["Order saved; payment pending"]
    OrderSaved --> Payment["Customer submits GCash / Maya reference and proof"]
    Payment --> Api
    Api --> Proofs["Private Supabase payment-proofs storage"]
    Api --> Data

    Admin --> Review["Review payment and proof"]
    Review --> Api
    Api --> SignedLink["Short-lived signed proof link"]
    SignedLink --> Review
    Review --> Decision{"Payment decision"}
    Decision -->|"Reject"| Rejected["Mark rejected; customer may resubmit"]
    Rejected --> Data
    Decision -->|"Approve"| Approved["Mark paid"]
    Approved --> Data
    Approved --> Delivery["Invoke Supabase Edge Function"]
    Delivery --> Lalamove["Lalamove delivery booking"]
    Lalamove --> DeliveryResult{"Booking result"}
    DeliveryResult -->|"Booked"| Data
    DeliveryResult -->|"Failed"| Retry["Admin can retry booking"]
    Retry --> Delivery

    Api --> Audit["Activity, sales, behavior, and admin operations"]
    Audit --> Data

    subgraph Hosting["Application and service boundaries"]
        Web
        Api
        SupabaseAuth
        Data
        Proofs
        Delivery
        Lalamove
    end
```

## Key boundaries

- The browser uses Supabase Auth and the public/anon key. Business data flows
  through the Express API.
- The Express API validates the user's token and role, then accesses Supabase
  using its server-side service-role key.
- Payment proof files stay in a private storage bucket; admins receive
  short-lived signed links for review.
- Payment approval and delivery booking are separate steps. A failed delivery
  booking does not undo payment approval and can be retried by an admin.
