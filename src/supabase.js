
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wzethhepoxpyyuyllyas.supabase.co";

// यहाँ अपनी Supabase Publishable Key डालें।
const SUPABASE_PUBLISHABLE_KEY = "PASTE_YOUR_PUBLISHABLE_KEY_HERE";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
