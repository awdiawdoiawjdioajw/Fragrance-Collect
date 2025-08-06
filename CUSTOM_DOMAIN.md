# Custom Domain Setup Guide

You can absolutely use your own domain name with any of the free hosting platforms! Here's how to set it up for each platform.

## 🌐 **GitHub Pages + Custom Domain**

### Step 1: Add Custom Domain to Repository

1. Go to your GitHub repository
2. Click **Settings** → **Pages** (left sidebar)
3. Under **"Custom domain"**, enter your domain (e.g., `www.yourdomain.com`)
4. Click **Save**
5. Check the box for **"Enforce HTTPS"** (recommended)

### Step 2: Create CNAME File

1. In your repository, click **"Add file"** → **"Create new file"**
2. Name it: `CNAME` (no file extension)
3. Add your domain name: `www.yourdomain.com`
4. Click **"Commit new file"**

### Step 3: Configure DNS with Your Domain Provider

**For most domain providers (GoDaddy, Namecheap, etc.):**

Add these DNS records:

```
Type: CNAME
Name: www
Value: YOUR_USERNAME.github.io
TTL: 3600 (or default)

Type: A
Name: @ (or leave blank)
Value: 185.199.108.153
TTL: 3600

Type: A
Name: @ (or leave blank)
Value: 185.199.109.153
TTL: 3600

Type: A
Name: @ (or leave blank)
Value: 185.199.110.153
TTL: 3600

Type: A
Name: @ (or leave blank)
Value: 185.199.111.153
TTL: 3600
```

## 🚀 **Netlify + Custom Domain**

### Step 1: Add Custom Domain

1. Go to your Netlify dashboard
2. Click on your site
3. Go to **"Site settings"** → **"Domain management"**
4. Click **"Add custom domain"**
5. Enter your domain: `www.yourdomain.com`
6. Click **"Verify"**

### Step 2: Configure DNS

Netlify will show you the exact DNS records to add:

```
Type: CNAME
Name: www
Value: your-site-name.netlify.app
TTL: 3600

Type: A
Name: @ (or leave blank)
Value: 75.2.60.5
TTL: 3600
```

## ⚡ **Vercel + Custom Domain**

### Step 1: Add Custom Domain

1. Go to your Vercel dashboard
2. Click on your project
3. Go to **"Settings"** → **"Domains"**
4. Click **"Add Domain"**
5. Enter your domain: `www.yourdomain.com`
6. Click **"Add"**

### Step 2: Configure DNS

Vercel will provide the exact DNS records:

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600

Type: A
Name: @ (or leave blank)
Value: 76.76.19.76
TTL: 3600
```

## 🔥 **Firebase + Custom Domain**

### Step 1: Add Custom Domain

1. Go to Firebase Console
2. Select your project
3. Go to **"Hosting"** → **"Custom domains"**
4. Click **"Add custom domain"**
5. Enter your domain: `www.yourdomain.com`
6. Follow the verification steps

### Step 2: Configure DNS

Firebase will show you the exact records:

```
Type: A
Name: @ (or leave blank)
Value: 151.101.1.195
TTL: 3600

Type: A
Name: @ (or leave blank)
Value: 151.101.65.195
TTL: 3600
```

## ⏱️ **DNS Propagation Time**

- **Usually takes 24-48 hours** for DNS changes to fully propagate
- **Can be as quick as 15 minutes** for some providers
- **Check propagation** at: [whatsmydns.net](https://whatsmydns.net)

## 🔍 **Testing Your Domain**

1. **Wait 24-48 hours** after DNS changes
2. **Test your domain**: `https://www.yourdomain.com`
3. **Check HTTPS**: Should automatically redirect to secure version
4. **Test all pages**: Make sure navigation works

## 🛠️ **Common Domain Providers Setup**

### **GoDaddy**
1. Login to GoDaddy
2. Go to **"My Products"** → **"DNS"**
3. Click **"Manage DNS"**
4. Add the records shown above

### **Namecheap**
1. Login to Namecheap
2. Go to **"Domain List"** → **"Manage"**
3. Click **"Advanced DNS"**
4. Add the records shown above

### **Google Domains**
1. Go to Google Domains
2. Click on your domain
3. Go to **"DNS"** → **"Manage custom records"**
4. Add the records shown above

## ✅ **Verification Checklist**

- [ ] Custom domain added to hosting platform
- [ ] CNAME/A records added to DNS
- [ ] SSL certificate enabled (automatic)
- [ ] Domain redirects to HTTPS
- [ ] All pages working correctly
- [ ] Mobile responsiveness tested

## 🆘 **Troubleshooting**

### **Domain Not Working?**
1. **Check DNS propagation**: [whatsmydns.net](https://whatsmydns.net)
2. **Verify DNS records** are correct
3. **Wait 24-48 hours** for full propagation
4. **Contact your domain provider** if issues persist

### **HTTPS Not Working?**
- Most platforms automatically provide SSL certificates
- May take up to 24 hours to activate
- Check platform-specific SSL settings

### **www vs non-www?**
- **www.yourdomain.com** is recommended
- Most platforms automatically redirect non-www to www
- Configure redirects in your hosting platform settings

## 🎯 **Benefits of Custom Domain**

- ✅ **Professional branding**: `www.fragrancecollect.com`
- ✅ **Better SEO**: Custom domains rank better
- ✅ **Brand recognition**: Easier to remember
- ✅ **Trust factor**: Looks more professional
- ✅ **Email addresses**: Can use `info@yourdomain.com`

Your website will look completely professional with your own domain name! 