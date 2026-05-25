import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'your-service-role-key-here') {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const USERS = [
  { email: 'admin@familysync.com', password: 'Password123!', role: 'Administrator' }
];

async function seedUsers() {
  console.log('🚀 Starting admin user creation...');

  for (const user of USERS) {
    console.log(`Creating user: ${user.email}...`);
    
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { role: user.role }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log(`ℹ️  User ${user.email} already exists.`);
      } else {
        console.error(`❌ Error creating ${user.email}:`, error.message);
      }
    } else {
      console.log(`✨ User ${user.email} created successfully!`);
      console.log(`\n🔑 Login Credentials:`);
      console.log(`Email: ${user.email}`);
      console.log(`Password: ${user.password}\n`);
    }
  }

  console.log('✅ Admin creation complete.');
}

seedUsers();
