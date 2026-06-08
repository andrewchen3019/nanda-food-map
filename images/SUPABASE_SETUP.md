# Supabase Setup

## 1. Create a Supabase project

Create a project in Supabase, then copy:

- Project URL
- Project anon key

Paste both into [supabase-config.js](/Users/andrewchen/Desktop/skibidi/supabase-config.js).

## 2. Create the database tables and storage bucket

In the Supabase SQL editor, run:

- [supabase-schema.sql](/Users/andrewchen/Desktop/skibidi/supabase-schema.sql)

This creates:

- `restaurants`
- `restaurant_photos`
- public read policies for the map
- authenticated write policies for the admin page
- a public storage bucket named `restaurant-photos`

## 3. Create an admin user

In the Supabase dashboard:

1. Open `Authentication`
2. Create a user with email and password

That user can sign in from the admin page.

## 4. Start a local server

Because the pages use JavaScript modules, JSON fetches, and Supabase calls, serve the folder over HTTP instead of opening the HTML files directly.

Example:

```bash
cd /Users/andrewchen/Desktop/skibidi
python3 -m http.server 8765
```

Then open:

- Map: [http://127.0.0.1:8765/nanda_campus_food_map_v3.html](http://127.0.0.1:8765/nanda_campus_food_map_v3.html)
- Admin: [http://127.0.0.1:8765/nanda_food_admin.html](http://127.0.0.1:8765/nanda_food_admin.html)

## 5. Import the current restaurant data

After signing into the admin page:

1. Click `Import current restaurants.json`
2. Wait for the success banner
3. Reload the map page

That imports the current local restaurant snapshot into Supabase.

## 6. Use it from your phone

You have two options:

- Host these files somewhere public, then open the hosted admin page on your phone
- Or run the server on your computer and open the computer's local network IP from your phone while both are on the same Wi-Fi network

If you want, the next step can be making the app easy to deploy to Vercel, Netlify, or Cloudflare Pages.
