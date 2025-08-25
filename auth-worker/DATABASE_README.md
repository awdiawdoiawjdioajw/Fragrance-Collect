# Cloudflare D1 Database Setup for Fragrance-Collect

## Overview
This project uses Cloudflare D1 (SQLite) database for user authentication and session management. The database is accessible through Cloudflare Workers and provides secure user login functionality.

## Database Details
- **Database Name**: `fragrance-collect-db`
- **Database ID**: `c4ec306a-6521-48ee-afaf-3c8871b40c24`
- **Region**: ENAM (US East)
- **Worker URL**: https://auth-worker.joshuablaszczyk.workers.dev

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,           -- Google OAuth user ID
    email TEXT UNIQUE NOT NULL,    -- User's email address
    name TEXT,                     -- User's display name
    picture TEXT,                  -- User's profile picture URL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### User Sessions Table
```sql
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY,           -- Session ID
    user_id TEXT NOT NULL,         -- References users.id
    token TEXT UNIQUE NOT NULL,    -- Session token
    expires_at DATETIME NOT NULL,  -- Session expiration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## API Endpoints

### 1. User Login (`POST /login`)
Creates or updates a user and generates a session token.

**Request Body:**
```json
{
  "id": "google_oauth_user_id",
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://example.com/avatar.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "google_oauth_user_id",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://example.com/avatar.jpg"
  },
  "session": {
    "token": "session_token_here",
    "expiresAt": "2024-01-01T12:00:00.000Z"
  }
}
```

### 2. Session Validation (`GET /session?token=token_here`)
Validates a session token and returns user information.

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "google_oauth_user_id",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://example.com/avatar.jpg"
  },
  "session": {
    "expiresAt": "2024-01-01T12:00:00.000Z"
  }
}
```

### 3. User Logout (`POST /logout`)
Invalidates a session token.

**Request Body:**
```json
{
  "token": "session_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 4. Get User (`GET /user?id=user_id`)
Retrieves user information by ID.

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "google_oauth_user_id",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://example.com/avatar.jpg",
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:00:00.000Z"
  }
}
```

### 5. Create User (`POST /user`)
Creates or updates a user (alternative to login endpoint).

**Request Body:** Same as login endpoint
**Response:** Same as login endpoint (without session)

## Usage in Frontend

### Login Flow
1. User authenticates with Google OAuth
2. Send user data to `/login` endpoint
3. Store the returned session token (e.g., in localStorage)
4. Use the token for authenticated requests

### Session Management
1. Check session validity on app startup
2. Include token in requests that require authentication
3. Clear token on logout

### Example Frontend Code
```javascript
// Login
async function login(googleUser) {
  const response = await fetch('https://auth-worker.joshuablaszczyk.workers.dev/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: googleUser.getId(),
      email: googleUser.getEmail(),
      name: googleUser.getName(),
      picture: googleUser.getImageUrl()
    })
  });
  
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('sessionToken', data.session.token);
    return data.user;
  }
}

// Check session
async function checkSession() {
  const token = localStorage.getItem('sessionToken');
  if (!token) return null;
  
  const response = await fetch(`https://auth-worker.joshuablaszczyk.workers.dev/session?token=${token}`);
  const data = await response.json();
  
  if (data.success) {
    return data.user;
  } else {
    localStorage.removeItem('sessionToken');
    return null;
  }
}

// Logout
async function logout() {
  const token = localStorage.getItem('sessionToken');
  if (token) {
    await fetch('https://auth-worker.joshuablaszczyk.workers.dev/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
  }
  localStorage.removeItem('sessionToken');
}
```

## Security Features
- Session tokens expire after 24 hours
- Tokens are cryptographically secure (UUID v4)
- Database uses prepared statements to prevent SQL injection
- CORS is properly configured for cross-origin requests

## Development

### Local Testing
```bash
cd auth-worker
wrangler dev
```

### Database Operations
```bash
# View database in local development
wrangler d1 execute fragrance-collect-db --local

# Execute SQL file locally
wrangler d1 execute fragrance-collect-db --file=schema.sql --local

# Execute SQL file on remote database
wrangler d1 execute fragrance-collect-db --file=schema.sql --remote
```

### Deployment
```bash
wrangler deploy
```

## Troubleshooting

### Common Issues
1. **Database not accessible**: Ensure the database ID in `wrangler.toml` is correct
2. **CORS errors**: Check that the frontend origin is allowed
3. **Session expired**: Sessions automatically expire after 24 hours
4. **Worker deployment failed**: Check the wrangler logs for errors

### Logs
View worker logs in the Cloudflare Dashboard or use:
```bash
wrangler tail
```

## Next Steps
- Set up your Google OAuth credentials
- Configure the `GOOGLE_CLIENT_ID` secret in Cloudflare
- Integrate the login endpoints with your frontend
- Add additional database tables as needed (fragrances, orders, etc.)
