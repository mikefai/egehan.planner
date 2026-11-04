# SAT Planner & Tracker — Supabase setup (free tier)

## 1. Create a free Supabase project
1. Go to https://supabase.com and sign up (free, no credit card).
2. "New project" → pick a name/region/password → wait ~1 min.

## 2. Run the schema
1. In the Supabase dashboard → **SQL Editor** → **New query**.
2. Paste the contents of `supabase/schema.sql` and click **Run**.
3. You should see "Success. No rows returned."

## 3. Get your API keys
Dashboard → **Project Settings** → **API**:
- `Project URL` (e.g. https://xxxxx.supabase.co)
- `anon` public key

## 4. Configure the page
Open `index.html`, find this block near the top of the `<script>`:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

Replace with your values. Save.

## 5. Create accounts
1. Open the page → **Sign up** with your (teacher) email + password.
   - The very first signup automatically becomes **admin**.
2. Have Egahan open the page on his device → **Sign up** with his email.
   - He becomes **student** automatically.

## 6. (Optional) Promote a specific email to admin manually
If you already created accounts and need to fix roles, run in SQL Editor:
```sql
update public.profiles set role='admin' where email='you@example.com';
```

## 7. (Optional) File uploads
The page supports pasting any URL (PDF/Drive/Dropbox/YouTube/etc.) by default — no setup.
To enable direct file uploads (free 1GB Storage), the schema already creates the `homework-files` bucket and policies. Nothing else needed.

## Free-tier limits (plenty for 2 users)
- 50,000 monthly active users
- 500 MB database
- 2 GB bandwidth
- 1 GB file storage
- Real-time included

This project uses < 1 MB. No payment ever required.
