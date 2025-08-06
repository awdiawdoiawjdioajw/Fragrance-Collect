# Namecheap DNS Setup for fragrancecollect.com

This guide will help you configure DNS records in Namecheap to connect your `fragrancecollect.com` domain to GitHub Pages.

## 🚀 **Step-by-Step Namecheap DNS Configuration**

### **Step 1: Login to Namecheap**

1. Go to [Namecheap.com](https://namecheap.com)
2. Click **"Sign In"** in the top right
3. Enter your username/email and password
4. Click **"Sign In"**

### **Step 2: Access Domain Management**

1. After logging in, click **"Domain List"** in the left sidebar
2. Find `fragrancecollect.com` in your domain list
3. Click the **"Manage"** button next to your domain

### **Step 3: Navigate to DNS Settings**

1. In the domain management page, click **"Advanced DNS"** tab
2. You'll see a section called **"Host Records"**
3. This is where you'll add the DNS records

### **Step 4: Add DNS Records**

You need to add **5 DNS records** total. Here's exactly what to add:

#### **Record 1: CNAME for www**
1. Click **"Add New Record"**
2. Set **Type** to: `CNAME Record`
3. Set **Host** to: `www`
4. Set **Value** to: `awdiawdoiawjdioajw.github.io`
5. Set **TTL** to: `Automatic`
6. Click **"Save Changes"**

#### **Record 2: A Record for root domain**
1. Click **"Add New Record"**
2. Set **Type** to: `A Record`
3. Set **Host** to: `@` (or leave blank)
4. Set **Value** to: `185.199.108.153`
5. Set **TTL** to: `Automatic`
6. Click **"Save Changes"**

#### **Record 3: A Record for root domain**
1. Click **"Add New Record"**
2. Set **Type** to: `A Record`
3. Set **Host** to: `@` (or leave blank)
4. Set **Value** to: `185.199.109.153`
5. Set **TTL** to: `Automatic`
6. Click **"Save Changes"**

#### **Record 4: A Record for root domain**
1. Click **"Add New Record"**
2. Set **Type** to: `A Record`
3. Set **Host** to: `@` (or leave blank)
4. Set **Value** to: `185.199.110.153`
5. Set **TTL** to: `Automatic`
6. Click **"Save Changes"**

#### **Record 5: A Record for root domain**
1. Click **"Add New Record"**
2. Set **Type** to: `A Record`
3. Set **Host** to: `@` (or leave blank)
4. Set **Value** to: `185.199.111.153`
5. Set **TTL** to: `Automatic`
6. Click **"Save Changes"**

## 📋 **Final DNS Records Summary**

After adding all records, your **"Host Records"** section should look like this:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| CNAME Record | www | awdiawdoiawjdioajw.github.io | Automatic |
| A Record | @ | 185.199.108.153 | Automatic |
| A Record | @ | 185.199.109.153 | Automatic |
| A Record | @ | 185.199.110.153 | Automatic |
| A Record | @ | 185.199.111.153 | Automatic |

## 🔍 **Verification Steps**

### **Step 1: Check DNS Propagation**
1. Go to [whatsmydns.net](https://whatsmydns.net)
2. Enter `fragrancecollect.com` in the search box
3. Click **"Search"**
4. Check if the DNS records are propagating worldwide

### **Step 2: Test Your Domain**
1. Wait 15-30 minutes after adding DNS records
2. Test: `https://fragrancecollect.com`
3. Test: `https://www.fragrancecollect.com`
4. Both should redirect to your GitHub Pages site

## ⏱️ **Timeline**

- **DNS record addition**: 5-10 minutes
- **Initial propagation**: 15-30 minutes
- **Full propagation**: 24-48 hours (usually much faster)
- **HTTPS activation**: Up to 24 hours

## 🆘 **Troubleshooting**

### **Common Issues:**

#### **Domain Not Working After 30 Minutes**
1. **Double-check DNS records** - Make sure all 5 records are added correctly
2. **Check for typos** - Verify `awdiawdoiawjdioajw.github.io` is spelled correctly
3. **Clear browser cache** - Try incognito/private browsing mode
4. **Check propagation** - Use [whatsmydns.net](https://whatsmydns.net)

#### **www Not Working**
- Make sure the CNAME record for `www` is added correctly
- The value should be: `awdiawdoiawjdioajw.github.io`

#### **HTTPS Not Working**
- GitHub Pages automatically provides SSL certificates
- May take up to 24 hours to activate
- Make sure "Enforce HTTPS" is checked in GitHub repository settings

### **Namecheap-Specific Issues:**

#### **"Host Records" Section Not Visible**
1. Make sure you're in the **"Advanced DNS"** tab
2. Scroll down to find the **"Host Records"** section
3. If using **"Basic DNS"**, switch to **"Advanced DNS"**

#### **Can't Add Records**
1. Make sure you're logged in with the correct account
2. Verify you own the `fragrancecollect.com` domain
3. Contact Namecheap support if issues persist

## ✅ **Success Checklist**

- [ ] All 5 DNS records added to Namecheap
- [ ] CNAME record for www pointing to `awdiawdoiawjdioajw.github.io`
- [ ] 4 A records for @ pointing to GitHub Pages IPs
- [ ] DNS propagation checked at [whatsmydns.net](https://whatsmydns.net)
- [ ] Domain `fragrancecollect.com` working
- [ ] www subdomain `www.fragrancecollect.com` working
- [ ] HTTPS redirect working (may take 24 hours)

## 🎯 **Expected Results**

After successful DNS configuration:
- ✅ `fragrancecollect.com` → Your GitHub Pages site
- ✅ `www.fragrancecollect.com` → Your GitHub Pages site
- ✅ Automatic HTTPS redirect
- ✅ Professional domain for your Fragrance Collect website

**Your website will be live at `https://fragrancecollect.com`!** 