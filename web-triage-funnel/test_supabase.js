const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const now = new Date().toISOString();
  console.log('Current time (ISO):', now);

  const { data: allUsers } = await supabase.from('email_nurture').select('*');
  console.log('\n--- ALL USERS ---');
  console.log(allUsers);

  const { data: dueUsers, error } = await supabase
    .from('email_nurture')
    .select('*')
    .eq('status', 'active')
    .lte('next_send_at', now);
    
  console.log('\n--- DUE USERS (status=active, next_send_at <= now) ---');
  console.log(dueUsers);
  if (error) console.error(error);
}
run();
