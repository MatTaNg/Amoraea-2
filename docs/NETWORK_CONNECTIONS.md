# Contacts & Networks in Amoraea

Amoraea uses **Contacts** (phone address book) as the primary way to find overlap with potential matches. Social networks are not currently used.

---

## Phone Contacts (Current Implementation)

**Status:** ✅ Implemented in ContactsScreen

**Status:** ✅ Implemented (needs backend sync)

### User flow
1. User taps **Connect** on the Phone Contacts row.
2. OS shows a permission dialog (iOS/Android).
3. If granted, the app reads contacts via `expo-contacts`.
4. You can sync those contacts to your backend.

### Technical flow
```
User taps Connect → requestPermissionsAsync() → getContactsAsync() → [TODO: upload to Supabase]
```

### What you need to do
- **Storage:** Create a `user_contacts` table in Supabase to store synced contacts.
- **Sync logic:** In `NetworkConnectionService.connectPhoneContacts()`, after `getContactsAsync()`, call your backend to save the contacts for the current user.

### Example Supabase table
```sql
CREATE TABLE user_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phone)
);
```

---

## 2. Facebook

**Status:** ⚠️ Requires OAuth setup

### User flow
1. User taps **Connect**.
2. App opens Facebook OAuth in browser or app.
3. User logs in and authorizes your app.
4. Facebook redirects to your app with an auth code.
5. Your backend exchanges the code for an access token and stores it.

### What you need
- [Facebook for Developers](https://developers.faacebook.com/) app
- App ID and App Secret
- OAuth redirect URL (e.g. `https://yourapp.com/auth/facebook/callback`)
- Backend route to exchange code for token and save to `user_connections` (or similar)

### OAuth URL format
```
https://www.facebook.com/v18.0/dialog/oauth?
  client_id={APP_ID}
  &redirect_uri={REDIRECT_URI}
  &response_type=code
  &scope=email,public_profile
```

---

## 3. Instagram

**Status:** ⚠️ Requires OAuth setup

### User flow
Same as Facebook (Instagram uses Meta/Facebook’s OAuth).

### What you need
- Facebook Developer app with Instagram Basic Display or Instagram Graph API
- OAuth redirect URL
- Backend route to exchange code for token

### OAuth URL format
```
https://api.instagram.com/oauth/authorize?
  client_id={APP_ID}
  &redirect_uri={REDIRECT_URI}
  &response_type=code
  &scope=user_profile,user_media
```

---

## 4. TikTok

**Status:** ⚠️ Requires OAuth setup

### User flow
1. User taps **Connect**.
2. App opens TikTok Login Kit in browser/app.
3. User authorizes and TikTok redirects back with a code.
4. Backend exchanges code for access token.

### What you need
- [TikTok for Developers](https://developers.tiktok.com/) app
- Client Key and Client Secret
- Redirect URI
- Backend route for token exchange

### OAuth URL format
```
https://www.tiktok.com/auth/authorize/
  ?client_key={CLIENT_KEY}
  &scope=user.info.basic
  &response_type=code
  &redirect_uri={REDIRECT_URI}
```

---

## 5. Snapchat

**Status:** ⚠️ Requires OAuth setup

### User flow
Same pattern: OAuth → redirect → backend token exchange.

### What you need
- [Snap Kit](https://kit.snapchat.com/) app
- OAuth redirect URL
- Backend route for token exchange

### OAuth URL format
```
https://accounts.snapchat.com/accounts/oauth2/auth?
  client_id={CLIENT_ID}
  &redirect_uri={REDIRECT_URI}
  &response_type=code
  &scope=https://auth.snapchat.com/oauth2/api/user.display_name,https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar
```

---

## 6. LinkedIn

**Status:** ⚠️ Requires OAuth setup

### User flow
Same pattern: OAuth → redirect → backend token exchange.

### What you need
- [LinkedIn Developer](https://www.linkedin.com/developers/) app
- Client ID and Client Secret
- Authorized redirect URL
- Backend route for token exchange

### OAuth URL format
```
https://www.linkedin.com/oauth/v2/authorization?
  client_id={CLIENT_ID}
  &redirect_uri={REDIRECT_URI}
  &response_type=code
  &scope=openid profile email
```

---

## Shared architecture for social networks

### 1. Supabase table for connections
```sql
CREATE TABLE user_network_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  network TEXT NOT NULL CHECK (network IN ('facebook','instagram','tiktok','snapchat','linkedin')),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  external_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, network)
);
```

### 2. Backend flow (Supabase Edge Function or external API)
1. App opens OAuth URL with `redirect_uri` pointing to your backend.
2. User completes login on the provider.
3. Provider redirects to `redirect_uri?code=...`.
4. Backend calls provider token endpoint with `code` + client secret.
5. Backend stores tokens in `user_network_connections` for the logged-in user.

### 3. App integration with `expo-auth-session` / `expo-web-browser`
Use `expo-auth-session` for in-app OAuth so the user stays in the app:

```ts
import * as AuthSession from 'expo-auth-session';

// Start OAuth, get redirect with code
const [request, response, promptAsync] = AuthSession.useAuthRequest(
  { clientId: '...', redirectUri: '...', scopes: [...] },
  { authorizationEndpoint: 'https://...' }
);
await promptAsync();
// Send response.params.code to your backend to exchange for token
```

---

## Summary

| Network        | Current behavior        | Needed for full connection        |
|----------------|-------------------------|-----------------------------------|
| Phone Contacts | Permission + read contacts | Supabase sync (table + upload)    |
| Facebook       | Opens login URL        | App + OAuth + backend token       |
| Instagram      | Opens login URL        | Meta app + OAuth + backend token  |
| TikTok         | Opens login URL        | Dev app + OAuth + backend token   |
| Snapchat       | Opens login URL        | Snap Kit + OAuth + backend token  |
| LinkedIn       | Opens login URL        | Dev app + OAuth + backend token   |

All social networks follow the same pattern: register a dev app, get a redirect URL, implement backend token exchange, and store tokens per user in Supabase.
