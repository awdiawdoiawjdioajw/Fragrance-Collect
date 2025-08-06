# Website Deployment Guide

This guide will help you deploy your Fragrance Collect website to various hosting platforms.

## 🚀 Quick Start - GitHub Pages (Recommended)

### Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right → "New repository"
3. Name it: `fragrance-collect-website`
4. Make it **Public** (required for free hosting)
5. Click "Create repository"

### Step 2: Upload Your Files

**Option A: Using GitHub Desktop (Easiest)**
1. Download [GitHub Desktop](https://desktop.github.com/)
2. Install and sign in
3. Click "Clone a repository" → Select your new repository
4. Copy all your website files into the cloned folder
5. In GitHub Desktop: Commit → Push origin

**Option B: Using Command Line**
```bash
# Navigate to your website folder
cd "C:\Users\heart\Roman Website"

# Initialize git repository
git init
git add .
git commit -m "Initial website commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fragrance-collect-website.git
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings" tab
3. Scroll down to "Pages" section (left sidebar)
4. Under "Source", select "Deploy from a branch"
5. Choose "main" branch
6. Click "Save"

### Step 4: Your Website is Live!

Your website will be available at:
`https://YOUR_USERNAME.github.io/fragrance-collect-website`

## 🌐 Alternative Hosting Options

### Netlify (Drag & Drop - Super Easy)

1. Go to [Netlify.com](https://netlify.com)
2. Sign up for free account
3. Drag your entire website folder to the deploy area
4. Wait for upload to complete
5. Your site is live! (You'll get a random URL like `https://amazing-site-123.netlify.app`)
6. Click "Site settings" → "Change site name" to customize the URL

### Vercel (Great Performance)

1. Go to [Vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "New Project"
4. Import your GitHub repository
5. Click "Deploy"
6. Your site is live instantly!

### Firebase Hosting (Google's Platform)

1. Install Node.js from [nodejs.org](https://nodejs.org)
2. Open command prompt and run:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting
   ```
3. Follow the prompts:
   - Select your project
   - Use `main.html` as public directory
   - Configure as single-page app: No
4. Deploy:
   ```bash
   firebase deploy
   ```

## 🔧 Custom Domain (Optional)

### For GitHub Pages:
1. Go to repository Settings → Pages
2. Under "Custom domain", enter your domain
3. Add a `CNAME` file to your repository with your domain name
4. Configure DNS with your domain provider

### For Netlify:
1. Go to Site settings → Domain management
2. Click "Add custom domain"
3. Follow the DNS configuration instructions

## 📝 Important Notes

- **All hosting options above are FREE** for basic usage
- **GitHub Pages** is best for beginners
- **Netlify** is fastest to set up
- **Vercel** has the best performance
- **Firebase** is good for future backend integration

## 🆘 Troubleshooting

### Common Issues:

1. **Images not loading**: Make sure all file paths are relative (not absolute)
2. **CSS not working**: Check that all CSS files are in the same directory
3. **JavaScript errors**: Open browser console (F12) to check for errors
4. **Mobile not working**: Test responsive design on different screen sizes

### Need Help?

- GitHub Pages: [GitHub Pages Documentation](https://pages.github.com/)
- Netlify: [Netlify Documentation](https://docs.netlify.com/)
- Vercel: [Vercel Documentation](https://vercel.com/docs)
- Firebase: [Firebase Documentation](https://firebase.google.com/docs/hosting)

## 🎯 Next Steps

After deployment:
1. Test all pages and functionality
2. Update contact information with real details
3. Add Google Analytics (optional)
4. Set up a custom domain (optional)
5. Configure SEO meta tags
6. Test on mobile devices

Your website will be live and accessible to anyone on the internet! 