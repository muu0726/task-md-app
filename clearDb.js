const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function clear() {
  const { error } = await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Database cleared successfully.');
  }
}
clear();
