# EventHub – FEU Roosevelt

A campus event management system built with React + Vite + Supabase.

## Features
- **User side**: Browse events, register/unregister, view QR ticket
- **Admin side**: Create/edit/delete events, manage registrations, live QR check-in desk
- **Auth**: Supabase Auth with role-based access (user / admin)

## Project Structure
```
src/
├── components/
│   ├── AdminLayout.jsx       # Sidebar layout for admin pages
│   ├── AdminNavLink.jsx      # Active-aware sidebar links
│   ├── AdminRoute.jsx        # Admin-only route guard
│   ├── Card.jsx
│   ├── Footer.jsx
│   ├── Header.jsx            # Top nav with avatar dropdown
│   ├── HeaderNavLink.jsx
│   ├── Hero.jsx              # Green event hero banner
│   ├── Input.jsx
│   ├── Main.jsx
│   └── PageWrapper.jsx
├── hooks/
│   └── useProfile.js         # Auth + profile hook
├── pages/
│   ├── admin/
│   │   ├── AdminHome.jsx     # Dashboard with stats
│   │   ├── CheckInDesk.jsx   # QR scanner check-in
│   │   ├── CreateEvent.jsx   # Create + Edit event form
│   │   ├── EventDetails.jsx  # Event detail + attendees list
│   │   └── ManageEvents.jsx  # Events list for admin
│   ├── EventDetailPage.jsx   # Public event detail + register
│   ├── EventsPage.jsx        # Public events listing
│   ├── Home.jsx              # Redirects to /events
│   ├── Register.jsx
│   ├── SignIn.jsx
│   └── TicketPage.jsx        # QR code ticket
└── utils/
    └── supabase.js
```

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `supabase_schema.sql`
3. After signing up, set yourself as admin:
   ```sql
   update public.profiles set role = 'admin' where email = 'your@email.com';
   ```

### 2. Environment Variables
```bash
cp .env.example .env
```
Fill in your Supabase URL and anon key from Project Settings → API.

### 3. Install & Run
```bash
npm install
npm run dev
```

## Routes
| Path | Description |
|------|-------------|
| `/signin` | Sign in |
| `/register` | Register |
| `/events` | Events list (user) |
| `/events/:id` | Event detail (user) |
| `/ticket/:id` | QR ticket |
| `/manage-events` | Admin events list |
| `/manage-events/create` | Create event |
| `/manage-events/edit/:id` | Edit event |
| `/manage-events/:id` | Event details + attendees |
| `/check-in-desk/:id` | QR scanner check-in |
# eventhub
