# GitHub Pages Setup for fragrancecollect.com

This guide will help you deploy your Fragrance Collect website to GitHub Pages with your custom domain `fragrancecollect.com`.

## 🚀 **Step-by-Step Setup**

### **Step 1: Create GitHub Repository**

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Repository name: `fragrancecollect-website`
4. Make it **Public** (required for free hosting)
5. Click **"Create repository"**

### **Step 2: Upload Your Website Files**

**Option A: Using GitHub Desktop (Recommended)**
1. Download [GitHub Desktop](https://desktop.github.com/)
2. Install and sign in with your GitHub account
3. Click **"Clone a repository"** → Select your new `fragrancecollect-website` repository
4. Copy **ALL** your website files into the cloned folder:
   - `index.html`
   - `contact.html`
   - `auth.html`
   - `customer-service.html`
   - `size-guide.html`
   - `faq.html`
   - `styles.css`
   - `script.js`
   - All other CSS and JS files
   - `CNAME` file (already created)
5. In GitHub Desktop: **Commit** → **Push origin**

**Option B: Using Command Line**
```bash
# Navigate to your website folder
cd "C:\Users\heart\Roman Website"

# Initialize git repository
git init
git add .
git commit -m "Initial website commit for fragrancecollect.com"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fragrancecollect-website.git
git push -u origin main
```

### **Step 3: Enable GitHub Pages**

1. Go to your repository on GitHub: `https://github.com/YOUR_USERNAME/fragrancecollect-website`
2. Click **"Settings"** tab
3. Scroll down to **"Pages"** section (left sidebar)
4. Under **"Source"**, select **"Deploy from a branch"**
5. Choose **"main"** branch
6. Click **"Save"**

### **Step 4: Add Custom Domain**

1. In the same **"Pages"** section
2. Under **"Custom domain"**, enter: `fragrancecollect.com`
3. Click **"Save"**
4. Check the box for **"Enforce HTTPS"** (recommended)

### **Step 5: Configure DNS with Your Domain Provider**

You need to add these DNS records to your domain provider (GoDaddy, Namecheap, etc.):

#### **For fragrancecollect.com:**

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

**Replace `YOUR_USERNAME` with your actual GitHub username.**

## 🔧 **DNS Configuration by Provider**

### **GoDaddy**
1. Login to GoDaddy
2. Go to **"My Products"** → **"DNS"**
3. Click **"Manage DNS"** for `fragrancecollect.com`
4. Add the records above

### **Namecheap**
1. Login to Namecheap
2. Go to **"Domain List"** → **"Manage"** for `fragrancecollect.com`
3. Click **"Advanced DNS"**
4. Add the records above

### **Google Domains**
1. Go to Google Domains
2. Click on `fragrancecollect.com`
3. Go to **"DNS"** → **"Manage custom records"**
4. Add the records above

## ⏱️ **Timeline**

- **Repository setup**: 5 minutes
- **File upload**: 10-15 minutes
- **GitHub Pages activation**: 2-5 minutes
- **DNS configuration**: 10-15 minutes
- **DNS propagation**: 24-48 hours (usually much faster)

## 🎯 **Your Website URLs**

After setup, your website will be available at:
- **Primary**: `https://fragrancecollect.com`
- **www version**: `https://www.fragrancecollect.com` (automatic redirect)
- **GitHub Pages**: `https://YOUR_USERNAME.github.io/fragrancecollect-website`

## ✅ **Verification Checklist**

- [ ] GitHub repository created
- [ ] All website files uploaded
- [ ] GitHub Pages enabled
- [ ] Custom domain added: `fragrancecollect.com`
- [ ] HTTPS enforced
- [ ] CNAME file in repository
- [ ] DNS records configured
- [ ] Domain propagation complete (24-48 hours)

## 🆘 **Troubleshooting**

### **Domain Not Working?**
1. **Check DNS propagation**: [whatsmydns.net](https://whatsmydns.net)
2. **Verify DNS records** are correct
3. **Wait 24-48 hours** for full propagation
4. **Check GitHub Pages status** in repository settings

### **HTTPS Not Working?**
- GitHub Pages automatically provides SSL certificates
- May take up to 24 hours to activate
- Make sure "Enforce HTTPS" is checked in repository settings

### **Files Not Showing?**
- Make sure all files are in the main branch
- Check that `index.html` is in the root directory
- Verify file paths are relative (not absolute)

## 🎉 **Success!**

Once everything is set up, your Fragrance Collect website will be live at:
**`https://fragrancecollect.com`**

Your website will have:
- ✅ Professional custom domain
- ✅ Automatic HTTPS/SSL
- ✅ Fast global CDN
- ✅ Unlimited bandwidth
- ✅ 24/7 uptime
- ✅ Mobile-responsive design

**Congratulations! Your luxury fragrance website is now live on the internet!** 