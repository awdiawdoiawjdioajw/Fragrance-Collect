# Commission Junction (CJ) Integration Guide

This guide covers the setup, configuration, and troubleshooting of the Commission Junction API integration for the Fragrance Collect website.

## 🚀 Quick Start

### 1. Get CJ Credentials
1. Go to [CJ Publisher Dashboard](https://publisher.cj.com)
2. Sign in to your account
3. Navigate to **Tools** → **API Access**
4. Generate a new **Developer Key**
5. Note your **Website ID** (found in your publisher profile)

### 2. Configure Environment
1. Copy `config.example.js` to `config.js`
2. Fill in your actual CJ credentials:
   ```javascript
   export const config = {
     CJ_DEV_KEY: 'your_actual_developer_key_here',
     CJ_WEBSITE_ID: 'your_actual_website_id_here',
     // ... other settings
   };
   ```

### 3. Install Dependencies
```bash
cd api
npm install
```

### 4. Start the API Server
```bash
npm start
# or for development with auto-reload:
npm run dev
```

### 5. Test the Integration
```bash
# In PowerShell, run:
.\test-cj.ps1
```

## 🔧 Setup Scripts

### Automated Setup
Run the setup script to configure everything automatically:
```powershell
.\setup-cj.ps1
```

This script will:
- Check for Node.js and npm
- Create a `.env` file template
- Install API dependencies
- Guide you through the setup process

### Testing
Use the test script to verify your CJ integration:
```powershell
.\test-cj.ps1
```

## 📡 API Endpoints

### Health Check
```
GET /health
```
Returns overall system health and CJ API connectivity status.

### Product Search
```
GET /products?q={query}&limit={limit}&page={page}&scope={scope}
```
Parameters:
- `q`: Search query (default: "perfume fragrance cologne")
- `limit`: Results per page (default: 50, max: 100)
- `page`: Page number (default: 1)
- `scope`: Advertiser scope - "joined" or "all" (default: "joined")

### Configuration (Development Only)
```
GET /config
```
Returns current configuration (with masked credentials).

## 🐳 Docker Deployment

### Build and Run
```bash
# Build the API container
docker build -f Dockerfile.api -t fragrance-collect-api .

# Run with environment variables
docker run -d \
  -p 3000:3000 \
  -e CJ_DEV_KEY=your_key \
  -e CJ_WEBSITE_ID=your_id \
  --name fragrance-api \
  fragrance-collect-api
```

### Docker Compose
```bash
# Create .env file with your credentials
echo "CJ_DEV_KEY=your_key" > .env
echo "CJ_WEBSITE_ID=your_id" >> .env

# Start services
docker-compose up -d
```

## 🔍 Troubleshooting

### Common Issues

#### 1. "Missing CJ credentials" Error
**Symptoms**: API returns 500 error with "Missing CJ credentials"
**Solution**: 
- Check your `.env` file exists
- Verify `CJ_DEV_KEY` and `CJ_WEBSITE_ID` are set
- Restart the API server after changing environment variables

#### 2. "CJ API error (401)" Error
**Symptoms**: API returns 401 Unauthorized
**Solution**:
- Verify your Developer Key is correct and active
- Check if your CJ account has API access enabled
- Ensure your Website ID is approved and active

#### 3. "CJ API error (403)" Error
**Symptoms**: API returns 403 Forbidden
**Solution**:
- Verify your Website ID is correct
- Check if your website is approved in CJ
- Ensure your CJ account is in good standing

#### 4. No Products Returned
**Symptoms**: API works but returns empty product lists
**Solution**:
- Check if you have joined advertisers in CJ
- Try different search terms
- Verify your website is approved for the advertisers you want to promote
- Check CJ's product catalog for your target categories

#### 5. API Timeout Errors
**Symptoms**: Requests take too long or timeout
**Solution**:
- Check your internet connection
- Verify CJ's API status at their status page
- Reduce the `limit` parameter in requests
- Check if CJ is experiencing high load

### Debug Mode

Enable debug logging by setting:
```bash
export NODE_ENV=development
```

This will provide:
- Detailed API request/response logging
- Configuration endpoint access
- Enhanced error messages

### Health Check Analysis

The `/health` endpoint provides detailed status:

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "cj": {
    "status": "ok",
    "message": "CJ API connected successfully",
    "productsReturned": 5
  }
}
```

**Status Meanings**:
- `cj.status: "ok"` - CJ API is working correctly
- `cj.status: "error"` - CJ API has issues (check the message)
- `cj.productsReturned: 0` - No products found (may indicate configuration issues)

## 📊 Monitoring and Logs

### API Logs
The API provides structured logging:
- 🔍 Search requests and results
- ✅ Successful operations
- ❌ Errors with details
- ⚠️ Warnings and fallbacks

### Performance Metrics
Monitor these key metrics:
- Response times for CJ API calls
- Success/failure rates
- Product return counts
- Error frequency and types

## 🔐 Security Considerations

### Environment Variables
- Never commit `.env` files to version control
- Use strong, unique Developer Keys
- Rotate credentials regularly
- Limit API access to necessary IPs

### API Security
- The API runs on port 3000 by default
- CORS is enabled for web access
- Consider adding authentication for production use
- Monitor for unusual API usage patterns

## 📚 API Reference

### CJ Product Object
```javascript
{
  id: "unique_product_id",
  name: "Product Name",
  brand: "Brand Name",
  price: 99.99,
  image: "https://image.url",
  description: "Product description",
  cjLink: "https://cj.track.link",
  advertiser: "Advertiser Name",
  rating: 4.5,
  shippingCost: 0, // 0 for free shipping
  category: "Fragrance",
  availability: "In Stock",
  currency: "USD"
}
```

### Error Response Format
```javascript
{
  "error": "Error description",
  "details": "Detailed error information",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## 🆘 Support

### CJ Support
- [CJ Publisher Support](https://publisher.cj.com/support)
- [CJ API Documentation](https://developers.cj.com/)
- [CJ Status Page](https://status.cj.com/)

### Local Debugging
1. Check API logs for detailed error messages
2. Use the test script to isolate issues
3. Verify network connectivity to CJ APIs
4. Test with minimal search queries first

### Getting Help
If you continue to have issues:
1. Check the troubleshooting section above
2. Review API logs for specific error messages
3. Test with the provided test scripts
4. Verify your CJ account status and permissions
5. Contact CJ support for account-specific issues

## 🔄 Updates and Maintenance

### Regular Maintenance
- Monitor API performance and error rates
- Update dependencies regularly
- Review CJ API changes and updates
- Check for new CJ features and optimizations

### Version Compatibility
- Current API requires Node.js 18+
- Compatible with CJ API v2
- Tested with latest CJ product search endpoints

---

**Last Updated**: January 2025  
**Version**: 2.0.0  
**CJ API Version**: v2

