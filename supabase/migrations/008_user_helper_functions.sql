-- =====================================================
-- Helper Functions for User Profile Management
-- These functions bypass Supabase schema cache issues
-- =====================================================

-- Function to get user by ID
CREATE OR REPLACE FUNCTION get_user_by_id(user_id UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    email VARCHAR,
    role user_role,
    employee_type employee_type,
    department VARCHAR,
    position VARCHAR,
    phone VARCHAR,
    avatar_url TEXT,
    presence_status presence_status,
    is_active BOOLEAN,
    is_approved BOOLEAN,
    organization_id UUID,
    created_at BIGINT,
    updated_at BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.employee_type,
        u.department,
        u.position,
        u.phone,
        u.avatar_url,
        u.presence_status,
        u.is_active,
        u.is_approved,
        u.organization_id,
        u.created_at,
        u.updated_at
    FROM users u
    WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user by email
CREATE OR REPLACE FUNCTION get_user_by_email(user_email VARCHAR)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    email VARCHAR,
    role user_role,
    employee_type employee_type,
    department VARCHAR,
    position VARCHAR,
    phone VARCHAR,
    avatar_url TEXT,
    presence_status presence_status,
    is_active BOOLEAN,
    is_approved BOOLEAN,
    organization_id UUID,
    created_at BIGINT,
    updated_at BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.employee_type,
        u.department,
        u.position,
        u.phone,
        u.avatar_url,
        u.presence_status,
        u.is_active,
        u.is_approved,
        u.organization_id,
        u.created_at,
        u.updated_at
    FROM users u
    WHERE u.email = user_email
    ORDER BY u.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create user profile
CREATE OR REPLACE FUNCTION create_user_profile(
    p_id UUID,
    p_org_id UUID DEFAULT NULL,
    p_name VARCHAR DEFAULT 'User',
    p_email VARCHAR DEFAULT '',
    p_role user_role DEFAULT 'employee'
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    email VARCHAR,
    role user_role,
    employee_type employee_type,
    department VARCHAR,
    position VARCHAR,
    phone VARCHAR,
    avatar_url TEXT,
    presence_status presence_status,
    is_active BOOLEAN,
    is_approved BOOLEAN,
    organization_id UUID,
    created_at BIGINT,
    updated_at BIGINT
) AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Insert or update user profile
    INSERT INTO users (
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
        COALESCE(p_id, uuid_generate_v4()),
        p_org_id,
        p_name,
        p_email,
        'auth_managed',
        p_role,
        'staff',
        true,
        true,
        CASE WHEN p_role = 'superadmin' THEN 9999 ELSE 0 END,
        CASE WHEN p_role = 'superadmin' THEN 999 ELSE 0 END,
        CASE WHEN p_role = 'superadmin' THEN 999 ELSE 0 END,
        CASE WHEN p_role = 'superadmin' THEN 999 ELSE 0 END,
        EXTRACT(EPOCH FROM NOW())::BIGINT,
        EXTRACT(EPOCH FROM NOW())::BIGINT
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        is_active = true,
        is_approved = true,
        updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
    RETURNING id INTO new_user_id;

    -- Return the created/updated user
    RETURN QUERY
    SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.employee_type,
        u.department,
        u.position,
        u.phone,
        u.avatar_url,
        u.presence_status,
        u.is_active,
        u.is_approved,
        u.organization_id,
        u.created_at,
        u.updated_at
    FROM users u
    WHERE u.id = new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_by_email(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, UUID, VARCHAR, VARCHAR, user_role) TO authenticated;
