const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://fprtklhpngvtpuozypdj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcnRrbGhwbmd2dHB1b3p5cGRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU1MDIzNywiZXhwIjoyMDkyMTI2MjM3fQ.AX8-I6IHQods8Q_xgThfcTZH2nf_RAvvREgrL33pj0U';

const supabase = createClient(supabaseUrl, supabaseKey);

const migrationFiles = [
  '001_core_schema.sql',
  '002_chat_module.sql',
  '003_employees_drivers_tasks.sql',
  '004_init_superadmin.sql',
];

async function runMigrations() {
  for (const file of migrationFiles) {
    const filePath = path.join(__dirname, 'supabase', 'migrations', file);
    console.log(`\n📦 Running migration: ${file}...`);
    
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error(`❌ Error in statement: ${statement.substring(0, 100)}...`);
          console.error(`   ${error.message}`);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Exception: ${err.message}`);
        errorCount++;
      }
    }
    
    console.log(`✅ ${file} completed: ${successCount} succeeded, ${errorCount} failed`);
  }
  
  console.log('\n🎉 All migrations completed!');
}

runMigrations().catch(console.error);
