-- =====================================================
-- HR Platform - Auth Trigger for Auto-Creating User Profiles
-- This ensures that when a user signs up via Supabase Auth,
-- a corresponding record is created in the users table
-- =====================================================

-- Function to handle new user signups from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role_val user_role := 'employee';
    org_id_val UUID := NULL;
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

    -- Insert into public.users table
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
        true, -- Auto-approve for now
        CASE WHEN user_role_val = 'superadmin' THEN 9999 ELSE 0 END,
        CASE WHEN user_role_val = 'superadmin' THEN 999 ELSE 0 END,
        CASE WHEN user_role_val = 'superadmin' THEN 999 ELSE 0 END,
        CASE WHEN user_role_val = 'superadmin' THEN 999 ELSE 0 END,
        EXTRACT(EPOCH FROM NOW())::BIGINT,
        EXTRACT(EPOCH FROM NOW())::BIGINT
    )
    ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(NEW.raw_user_meta_data->>'name', split_part(EXCLUDED.email, '@', 1)),
        role = user_role_val,
        is_active = true,
        is_approved = true,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to auto-create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Also handle updates to ensure role is correct
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
