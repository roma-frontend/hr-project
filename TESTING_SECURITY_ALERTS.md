# 🧪 Testing Security Alerts System

## Quick Start Guide

### Prerequisites
1. You must be logged in as superadmin (`romangulanyan@gmail.com`)
2. Have at least one test user in the system
3. Access to Convex Dashboard (https://dashboard.convex.dev)

---

## Method 1: Using Convex Dashboard (Recommended)

### Step 1: Get User IDs

Open browser console (F12) on your app:
```javascript
const storage = JSON.parse(localStorage.getItem('hr-auth-storage'));
const myUserId = storage.state.user.id;
console.log('Superadmin ID:', myUserId);
```

### Step 2: Test Suspicious Activity Notification

1. Go to https://dashboard.convex.dev
2. Select your project
3. Go to **Functions** tab
4. Find `security:notifySuperadminSuspiciousActivity`
5. Click "Run Function"
6. Use these parameters:

```json
{
  "userId": "k57abc123...",
  "email": "testuser@example.com",
  "reason": "Testing security alert system",
  "riskScore": 85,
  "riskFactors": ["New device", "Unusual hour", "Multiple failed attempts"],
  "ip": "192.168.1.100",
  "deviceInfo": "Chrome 120 on Windows 11"
}
```

**Expected Result:**
- ✅ Function returns notification ID
- ✅ Check your app notifications (bell icon 🔔)
- ✅ You should see: "🚨 Suspicious Login Activity Detected"

---

### Step 3: Test User Suspension

1. In Convex Dashboard, find `users:suspendUser`
2. Run with parameters:

```json
{
  "adminId": "YOUR_SUPERADMIN_ID",
  "userId": "TEST_USER_ID",
  "reason": "Test: Suspicious activity from unknown location",
  "duration": 1
}
```

**Expected Result:**
- ✅ Function returns `{ userId, suspendedUntil }`
- ✅ Test user receives notification "⚠️ Account Temporarily Suspended"
- ✅ Audit log created in `auditLogs` table
- ✅ User cannot login (try it!)

---

### Step 4: Verify Suspension

**Check in Convex Dashboard:**
1. Go to **Data** tab
2. Open `users` table
3. Find your test user
4. Verify fields:
   - `isSuspended`: `true`
   - `suspendedUntil`: timestamp in the future
   - `suspendedReason`: your reason text
   - `suspendedBy`: your admin ID

**Check Notifications:**
1. In `notifications` table
2. Filter by test user's ID
3. Should see suspension notification

**Check Audit Logs:**
1. In `auditLogs` table
2. Look for action: `user_suspended`
3. Should contain details about the suspension

---

### Step 5: Test Unsuspension

1. In Convex Dashboard, find `users:unsuspendUser`
2. Run with parameters:

```json
{
  "adminId": "YOUR_SUPERADMIN_ID",
  "userId": "TEST_USER_ID"
}
```

**Expected Result:**
- ✅ User's `isSuspended` becomes `false`
- ✅ User receives "✅ Account Unsuspended" notification
- ✅ Audit log created
- ✅ User can login again

---

## Method 2: Using API Endpoint

### Test via Browser Console

Open console (F12) on your app and run:

```javascript
// Get your IDs first
const storage = JSON.parse(localStorage.getItem('hr-auth-storage'));
const adminId = storage.state.user.id;
const testUserId = "k57..."; // Replace with test user ID

// Test Suspension
async function testSuspend() {
  const response = await fetch('/api/security/quick-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'suspend',
      userId: testUserId,
      adminId: adminId,
      reason: 'TEST: Multiple suspicious login attempts',
      duration: 1 // 1 hour
    })
  });
  const data = await response.json();
  console.log('Suspension result:', data);
}

// Test Unsuspension
async function testUnsuspend() {
  const response = await fetch('/api/security/quick-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'unsuspend',
      userId: testUserId,
      adminId: adminId
    })
  });
  const data = await response.json();
  console.log('Unsuspension result:', data);
}

// Run tests
testSuspend();
// Wait a bit, then:
// testUnsuspend();
```

---

## Method 3: End-to-End Flow Test

### Simulate Real Suspicious Login

This is the most realistic test:

1. **Create test user** (if don't have one)
2. **Trigger suspicious login** via Convex:
   ```json
   // Run: security.notifySuperadminSuspiciousActivity
   {
     "userId": "TEST_USER_ID",
     "email": "suspicious@test.com",
     "reason": "Login from new device at 3 AM",
     "riskScore": 90,
     "riskFactors": ["New device", "Unusual hour (3 AM)", "VPN detected"],
     "ip": "203.0.113.42",
     "deviceInfo": "Firefox 120 on Linux"
   }
   ```

3. **You receive notification** - Check bell icon 🔔
4. **Click notification** - See details
5. **Click "Suspend Temporarily"** button (when UI is ready)
6. **User gets suspended** for 24 hours
7. **Verify user can't login**
8. **After review, unsuspend** if false positive

---

## Method 4: Test Auto-Unsuspension

Test automatic expiry:

1. **Suspend user for 1 minute:**
   ```json
   {
     "adminId": "YOUR_ID",
     "userId": "TEST_USER_ID", 
     "reason": "Testing auto-unsuspend",
     "duration": 0.0167
   }
   ```
   
2. **Wait 1-2 minutes**

3. **Run auto-unsuspend function:**
   - Go to Convex Dashboard → Functions
   - Run: `users:autoUnsuspendExpired`
   - Should return: `{ unsuspended: 1 }`

4. **Verify user is unsuspended:**
   - Check `users` table: `isSuspended` = `false`
   - Check notifications: user received "✅ Suspension Expired"

---

## Verification Checklist

After each test, verify:

### ✅ Database State
- [ ] User's `isSuspended` field is correct
- [ ] `suspendedUntil` timestamp is accurate
- [ ] `suspendedReason` is saved
- [ ] `suspendedBy` points to admin

### ✅ Notifications
- [ ] Superadmin received suspicious activity alert
- [ ] User received suspension notification
- [ ] User received unsuspension notification
- [ ] All notifications have correct content

### ✅ Audit Logs
- [ ] `user_suspended` log created
- [ ] `user_unsuspended` log created  
- [ ] `superadmin_notified` log created
- [ ] All logs have correct details

### ✅ Functionality
- [ ] Suspended user cannot login
- [ ] Unsuspended user can login
- [ ] Auto-unsuspend works after expiry
- [ ] API endpoints return correct responses

---

## Common Issues & Solutions

### Issue: "User not found"
**Solution:** Make sure you're using correct user IDs from the database

### Issue: "Access denied"
**Solution:** Ensure you're using superadmin account for testing

### Issue: No notification received
**Solution:** 
- Check `notifications` table in Convex
- Verify superadmin email matches `SUPERADMIN_EMAIL` constant
- Make sure notification component is rendering

### Issue: User still can login after suspension
**Solution:**
- Check `isSuspended` field in database
- Verify login route checks suspension status
- Add suspension check to auth routes if missing

---

## Next Steps

Once basic testing works:

1. ✅ Integrate with actual login risk scoring
2. ✅ Add UI for notification actions
3. ✅ Set up email notifications (optional)
4. ✅ Schedule auto-unsuspend cron job
5. ✅ Add analytics dashboard

---

## Questions?

Check the implementation files:
- **Convex functions:** `Desktop/office/convex/users.ts` (lines 1045-1207)
- **Security functions:** `Desktop/office/convex/security.ts` (lines 410-487)
- **API endpoint:** `Desktop/office/src/app/api/security/quick-action/route.ts`


console-> fetch('/api/security/quick-action', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'suspend',
    userId: 'jn78pvsmcxec73r04qy5t3tza181qkez',
    adminId: 'jn78pvsmcxec73r04qy5t3tza181qkez',
    reason: 'TEST: Suspicious activity detection',
    duration: 0.1
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Response:', data);
  return data;
});