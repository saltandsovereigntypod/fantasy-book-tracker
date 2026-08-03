# The Empyrean Tracker

A private, immersive reading and theory tracker hosted on GitHub Pages and synchronized through Supabase.

## Finish the Supabase setup

1. Open the Supabase project with reference `udxatwvbxpefbdhnsycf`.
2. Open **SQL Editor**, create a new query, paste the complete contents of `supabase-setup.sql`, and run it once.
3. Create a private invitation code by running:

```sql
insert into public.invite_codes (code, max_uses)
values ('REPLACE-WITH-YOUR-PRIVATE-CODE', 20);
```

4. Under **Authentication > URL Configuration**, set:
   - Site URL: `https://saltandsovereigntypod.github.io/the-empyrean-book-tracker/`
   - Redirect URL: `https://saltandsovereigntypod.github.io/the-empyrean-book-tracker/**`
5. Keep Email authentication and Confirm Email enabled.

## Included cloud features

- Email and password signup, login, logout, confirmation, and password reset
- Invitation-code-only account creation
- One private cloud archive per authenticated user
- Automatic cloud saves after tracker changes
- Import prompt for existing browser data on first login
- Row Level Security so users can only read and edit their own archive

## Important security note

The repository contains only the Supabase publishable key, which is intended for browser applications. Never add the service-role key or database password to GitHub.

## Email delivery

No service beyond GitHub and Supabase is required for the basic setup. Supabase's built-in email delivery can be rate-limited, so custom SMTP may be added later if confirmation or reset emails become unreliable
