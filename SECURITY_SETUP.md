# Security Setup for fragrancecollect.com

This guide will help you secure your Fragrance Collect website and resolve the "not secure" warning.

## 🔒 **Immediate Security Fixes**

### **Step 1: Enable HTTPS in GitHub Pages**

1. Go to your GitHub repository: [https://github.com/awdiawdoiawjdioajw/Fragrance-Collect](https://github.com/awdiawdoiawjdioajw/Fragrance-Collect)
2. Click **"Settings"** tab
3. Scroll down to **"Pages"** section (left sidebar)
4. Under **"Custom domain"**, make sure `fragrancecollect.com` is entered
5. **IMPORTANT**: Check the box for **"Enforce HTTPS"**
6. Click **"Save"**

### **Step 2: Update CNAME File**

Your CNAME file should contain:
```
fragrancecollect.com
www.fragrancecollect.com
```

### **Step 3: Force HTTPS Redirects**

I've already added HTTPS enforcement to your `main.html`. The script will automatically redirect HTTP to HTTPS.

## 🛡️ **Security Headers Added**

I've added these security headers to your website:

### **Content Security Policy (CSP)**
- Prevents XSS attacks
- Controls which resources can be loaded
- Allows HTTPS resources and inline scripts/styles

### **Strict Transport Security (HSTS)**
- Forces HTTPS connections
- Prevents protocol downgrade attacks
- Valid for 1 year

### **X-Frame-Options**
- Prevents clickjacking attacks
- Blocks embedding in iframes

### **X-Content-Type-Options**
- Prevents MIME type sniffing
- Reduces security risks

### **X-XSS-Protection**
- Enables browser XSS protection
- Blocks reflected XSS attacks

### **Referrer Policy**
- Controls referrer information
- Protects user privacy

## 🔧 **Additional Security Measures**

### **Step 4: Update All Internal Links**

Make sure all internal links use HTTPS:

```html
<!-- Good -->
<a href="https://fragrancecollect.com/contact.html">Contact</a>

<!-- Also Good (relative links) -->
<a href="contact.html">Contact</a>
```

### **Step 5: Secure External Resources**

All external resources should use HTTPS:

```html
<!-- Good -->
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Lato:wght@300;400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
```

### **Step 6: Add Security.txt**

Create a `security.txt` file in your repository:

```
Contact: mailto:security@fragrancecollect.com
Expires: 2025-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: https://fragrancecollect.com/.well-known/security.txt
```

## 🔍 **Verification Steps**

### **Check HTTPS Status**
1. Visit `https://fragrancecollect.com`
2. Look for the padlock icon in the address bar
3. Click the padlock to verify certificate details

### **Test Security Headers**
1. Open browser developer tools (F12)
2. Go to **Network** tab
3. Refresh the page
4. Click on the main request
5. Check **Response Headers** for security headers

### **SSL Labs Test**
1. Go to [SSL Labs](https://www.ssllabs.com/ssltest/)
2. Enter `fragrancecollect.com`
3. Check for A+ rating

## ⏱️ **Timeline for Security**

- **HTTPS enforcement**: 15-30 minutes
- **SSL certificate**: Up to 24 hours
- **Security headers**: Immediate
- **Full security**: 24-48 hours

## 🆘 **Troubleshooting**

### **Still Showing "Not Secure"**

1. **Clear browser cache** - Try incognito/private browsing
2. **Check DNS propagation** - Use [whatsmydns.net](https://whatsmydns.net)
3. **Verify GitHub Pages settings** - Make sure HTTPS is enforced
4. **Wait 24 hours** - SSL certificates can take time to activate

### **Mixed Content Warnings**

1. **Check for HTTP resources** - All resources must use HTTPS
2. **Update external links** - Ensure all external links use HTTPS
3. **Check images and scripts** - Verify all assets use secure URLs

### **Security Headers Not Working**

1. **Check GitHub Pages** - Headers should be applied automatically
2. **Verify file changes** - Make sure changes are pushed to GitHub
3. **Clear cache** - Browser cache might show old headers

## ✅ **Security Checklist**

- [ ] HTTPS enforced in GitHub Pages
- [ ] SSL certificate active
- [ ] Security headers added
- [ ] HTTPS redirect script added
- [ ] All external resources use HTTPS
- [ ] CNAME file updated
- [ ] DNS records configured
- [ ] Security.txt file created
- [ ] Mixed content resolved
- [ ] Browser shows padlock icon

## 🎯 **Expected Results**

After implementing these security measures:

- ✅ **Secure padlock** in browser address bar
- ✅ **HTTPS://** in URL
- ✅ **No security warnings**
- ✅ **A+ SSL rating**
- ✅ **Protected against common attacks**
- ✅ **User data encrypted in transit**

## 🔐 **Additional Recommendations**

### **For Production**
1. **Regular security audits** - Check for vulnerabilities monthly
2. **Keep dependencies updated** - Update external libraries
3. **Monitor security headers** - Use security scanning tools
4. **Backup regularly** - Keep website backups
5. **Monitor logs** - Check for suspicious activity

### **For Future Development**
1. **Use HTTPS everywhere** - Always use secure protocols
2. **Implement CSP properly** - Configure content security policy
3. **Add rate limiting** - Protect against abuse
4. **Use secure cookies** - Set secure and httpOnly flags
5. **Implement CSRF protection** - For forms and APIs

**Your website will be fully secured and show the green padlock!** 