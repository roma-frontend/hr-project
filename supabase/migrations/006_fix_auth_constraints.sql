-- =====================================================
-- HR Platform - Fix User Constraints and Auth Flow
-- Fixes:
-- 1. Add unique constraint on email to prevent duplicate profiles
-- 2. Update auth trigger to handle conflicts properly
-- 3. Ensure profile creation doesn't fail on race conditions
-- =====================================================

-- Add unique constraint on email if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_email_key' 
        AND conrelid = 'users'::regclass
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
END $$;

-- Ensure created_at has a default value for new records
ALTER TABLE users 
    ALTER COLUMN created_at SET DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT;

-- Add index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email));

-- Update the auth trigger function to handle edge cases better
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role_val user_role := 'employee';
    org_id_val UUID := NULL;
    existing_user_id UUID;
BEGIN
    -- Check if this is the superadmin email
    IF NEW.email = 'romangulanyan@gmail.com' THEN
        user_role_val := 'superadmin';
    END IF;

    -- Try to get organization_id from raw_user_meta_data
    org_id_val := COALESCE(
        (NEW.raw_user_meta_data->>'organization_id')::UUID,
        NULL
    );

    -- Check if user already exists by email (race condition protection)
    SELECT id INTO existing_user_id
    FROM public.users
    WHERE email = NEW.email
    LIMIT 1;

    IF existing_user_id IS NOT NULL THEN
        -- Update existing user record
        UPDATE public.users
        SET
            name = COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
            role = user_role_val,
            is_active = true,
            is_approved = true,
            updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
        WHERE id = existing_user_id;
        
        RETURN NEW;
    END IF;

    -- Insert new user profile
    INSERT INTO public.users (
        id,
        organization_id,
        name,
        email,
        password_hash,
        role,
        employee_type,
        is_active,
        is_approved,
        travel_allowance,
        paid_leave_balance,
        sick_leave_balance,
        family_leave_balance,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        org_id_val,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        '', -- Password hash is managed by Supabase Auth
        user_role_val,
        'staff',
        true,
        true,
        CASE WHEN user_role_val = 'superadmin' THEN 9999 ELSE 0 END,
        CASE WHEN user_role_val = 'superadmin' THEN 999 ELSE 0 END,
        CASE WHEN user_role_val = 'superadmin' THEN 999 ELSE 0 END,
        CASE WHEN user_role_val = 'superadmin' THEN 999 ELSE 0 END,
        EXTRACT(EPOCH FROM NOW())::BIGINT,
        EXTRACT(EPOCH FROM NOW())::BIGINT
    )
    ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, split_part(EXCLUDED.email, '@', 1)),
        role = user_role_val,
        is_active = true,
        is_approved = true,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Also ensure the update trigger handles role changes
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Update role if email matches superadmin
    IF NEW.email = 'romangulanyan@gmail.com' THEN
        UPDATE public.users
        SET role = 'superadmin',
            is_active = true,
            is_approved = true,
            updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_update();
