# Integrated Authentication Solution

## Overview

This solution eliminates cross-origin authentication issues by integrating all authentication functionality directly into the main API worker (`weathered-mud-6ed5`). This approach provides several benefits:

- **No Cross-Origin Issues**: All requests go to the same domain
- **Simplified Architecture**: Single worker handles both API and authentication
- **Better Performance**: Fewer network requests and reduced latency
- **Easier Maintenance**: All functionality in one place

## Architecture Changes

### Before (Separate Workers)
```
Frontend → auth-worker.joshuablaszczyk.workers.dev (Authentication)
Frontend → weathered-mud-6ed5.joshuablaszczyk.workers.dev (API)
```

### After (Integrated Worker)
```
Frontend → weathered-mud-6ed5.joshuablaszczyk.workers.dev (Everything)
```

## Files Modified

### New Files Created
- `weathered-mud-6ed5/src/integrated-worker.js` - Combined API and authentication worker
- `deploy-integrated.ps1` - Deployment script for the integrated worker
- `INTEGRATED_AUTH_README.md` - This documentation

### Files Updated
- `weathered-mud-6ed5/wrangler.toml` - Added database binding and auth variables
- `shared-auth.js` - Updated to use integrated worker endpoints
- `auth-script.js` - Updated to use integrated worker endpoints

## Available Endpoints

The integrated worker now provides all functionality:

### Authentication Endpoints
- `POST /login` - Google OAuth login
- `POST /logout` - User logout
- `GET /status` - Check user authentication status
- `GET /token` - Get session token
- `POST /verify` - Verify JWT tokens
- `POST /signup/email` - Email/password signup
- `POST /login/email` - Email/password login

### User Account Endpoints
- `GET /api/user/preferences` - Get user preferences
- `POST /api/user/preferences` - Update user preferences
- `GET /api/user/favorites` - Get user favorites
- `POST /api/user/favorites` - Add to favorites
- `DELETE /api/user/favorites/{id}` - Remove from favorites

### API Endpoints
- `GET /health` - Health check
- `GET /products` - Product search
- `GET /feeds` - Product feeds
- `GET /trending` - Trending products
- `GET /analytics` - Analytics data
- `GET /test-cj` - CJ API test
- `GET /test-graphql` - GraphQL test

## Deployment

### Prerequisites
1. Install Wrangler: `npm install -g wrangler`
2. Authenticate with Cloudflare: `wrangler login`
3. Set up environment variables in `.dev.vars` file

### Deploy
```powershell
# Run the deployment script
.\deploy-integrated.ps1

# Or manually deploy
cd weathered-mud-6ed5
wrangler deploy
```

### Environment Variables Required

Create a `.dev.vars` file in the `weathered-mud-6ed5` directory:

```env
# CJ API Credentials
CJ_DEV_KEY=your_cj_dev_key_here
CJ_PERSONAL_ACCESS_TOKEN=your_cj_personal_access_token_here

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here

# Production Domain
ALLOWED_ORIGIN=https://fragrancecollect.com
```

## Database Schema

The integrated worker uses the same D1 database as the original auth-worker:

```sql
-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    picture TEXT,
    password_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    client_ip TEXT,
    user_agent TEXT,
    fingerprint TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- User preferences table
CREATE TABLE user_preferences (
    user_id TEXT PRIMARY KEY,
    scent_categories TEXT,
    intensity TEXT,
    season TEXT,
    occasion TEXT,
    budget_range TEXT,
    sensitivities TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- User favorites table
CREATE TABLE user_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    fragrance_id TEXT NOT NULL,
    name TEXT NOT NULL,
    advertiserName TEXT,
    description TEXT,
    imageUrl TEXT,
    productUrl TEXT,
    price REAL,
    currency TEXT,
    shipping_availability TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, fragrance_id)
);
```

## Security Features

The integrated worker maintains all security features from the original auth-worker:

- **JWT Verification**: Google OAuth token validation
- **Session Management**: Secure session tokens with fingerprinting
- **CORS Protection**: Origin validation and proper CORS headers
- **Rate Limiting**: Built-in rate limiting for API endpoints
- **Input Validation**: Sanitization and validation of all inputs
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Content Security Policy headers

## Testing

### Health Check
```bash
curl https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/health
```

### Authentication Test
```bash
# Check status (should return 401 if not authenticated)
curl https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/status
```

### API Test
```bash
# Test product search
curl "https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/products?q=perfume&limit=5"
```

## Migration from Separate Workers

1. **Deploy the integrated worker** using the deployment script
2. **Update frontend code** to use the new endpoints (already done)
3. **Test all functionality** to ensure everything works
4. **Optionally remove the old auth-worker** once confirmed working

## Benefits Achieved

✅ **Eliminated Cross-Origin Issues**: All requests now go to the same domain  
✅ **Simplified Architecture**: Single worker handles everything  
✅ **Better Performance**: Reduced network requests and latency  
✅ **Easier Maintenance**: All code in one place  
✅ **Consistent Security**: Unified security policies  
✅ **Better User Experience**: Faster authentication flows  

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure the D1 database binding is correct in `wrangler.toml`
   - Check that the database exists and has the correct schema

2. **Authentication Failures**
   - Verify `GOOGLE_CLIENT_ID` is set correctly
   - Check that the Google OAuth configuration matches

3. **CORS Errors**
   - Ensure `ALLOWED_ORIGIN` is set correctly
   - Check that the frontend domain is in the allowed origins list

4. **API Errors**
   - Verify CJ API credentials are set correctly
   - Check the worker logs for detailed error messages

### Debugging

Enable detailed logging by checking the worker logs:
```bash
wrangler tail weathered-mud-6ed5
```

## Future Enhancements

- **Enhanced Analytics**: Track authentication and API usage
- **Advanced Caching**: Implement more sophisticated caching strategies
- **Rate Limiting**: Add per-user rate limiting for authenticated requests
- **Monitoring**: Add comprehensive monitoring and alerting
- **Performance Optimization**: Further optimize response times
