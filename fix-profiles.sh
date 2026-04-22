#!/bin/bash

# ===================================================================
# Fix User Profile Creation Issue - Quick Start Script
# ===================================================================
# This script helps you fix the "Failed to create user profile" error
# ===================================================================

echo "🔧 Fixing User Profile Creation Issue..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found"
    exit 1
fi

# Extract Supabase URL
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d'=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$SUPABASE_URL" ]; then
    echo "❌ Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local"
    exit 1
fi

echo "✅ Found Supabase URL: $SUPABASE_URL"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Please use the web interface instead."
    echo ""
    echo "📋 Manual Steps:"
    echo "1. Go to: https://supabase.com/dashboard"
    echo "2. Select your project"
    echo "3. Go to SQL Editor"
    echo "4. Run the contents of: fix_user_profiles.sql"
    echo ""
    exit 1
fi

echo "🚀 Running database migration..."
echo ""

# Run the migration
supabase db push --db-url "$SUPABASE_URL"

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
else
    echo "❌ Migration failed. Please run the SQL manually in Supabase Dashboard."
    echo ""
    echo "📋 Alternative: Run fix_user_profiles.sql in Supabase SQL Editor"
fi

echo ""
echo "📝 Next steps:"
echo "1. Test email registration with a new account"
echo "2. Test email login with existing account"
echo "3. Test Google OAuth login"
echo ""
echo "If issues persist, check:"
echo "- Supabase Logs → Auth"
echo "- Supabase Logs → Postgres"
echo "- Browser console for errors"
