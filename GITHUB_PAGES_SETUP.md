# GitHub Pages Setup Guide

This guide will walk you through setting up your Fragrance Collect website on GitHub Pages.

## Prerequisites

- A GitHub account
- Git installed on your computer
- Your website files ready

## Step-by-Step Setup

### 1. Create a GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Name your repository: `fragrance-collect` (or your preferred name)
5. Make it **Public** (required for free GitHub Pages)
6. Don't initialize with README (since you already have one)
7. Click "Create repository"

### 2. Upload Your Files

Open your terminal/command prompt and navigate to your project folder:

```bash
# Navigate to your project directory
cd "C:\Users\heart\New folder\Fragrance-Collect"

# Initialize git repository
git init

# Add all files to git
git add .

# Create initial commit
git commit -m "Initial commit: Fragrance Collect website"

# Rename the default branch to main
git branch -M main

# Add your GitHub repository as remote
# Replace YOUR_USERNAME with your actual GitHub username
git remote add origin https://github.com/YOUR_USERNAME/fragrance-collect.git

# Push to GitHub
git push -u origin main
```

### 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on "Settings" tab
3. Scroll down to "Pages" section (in the left sidebar)
4. Under "Source", select "Deploy from a branch"
5. Choose "main" branch
6. Select "/ (root)" folder
7. Click "Save"

### 4. Configure GitHub Pages Settings

1. Still in Settings → Pages:
2. Under "Custom domain" (optional):
   - If you have a custom domain, enter it here
   - Check "Enforce HTTPS" if using custom domain
3. Under "Build and deployment":
   - Source: "Deploy from a branch"
   - Branch: "main"
   - Folder: "/ (root)"

### 5. Wait for Deployment

- GitHub will automatically build and deploy your site
- This usually takes 2-5 minutes
- You'll see a green checkmark when deployment is complete

### 6. Access Your Website

Your website will be available at:
```
https://YOUR_USERNAME.github.io/fragrance-collect
```

## Automatic Deployment

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that will automatically deploy your site whenever you push changes to the main branch.

## Custom Domain (Optional)

If you want to use a custom domain:

1. Purchase a domain from a registrar (Namecheap, GoDaddy, etc.)
2. In your repository Settings → Pages:
3. Enter your custom domain
4. Add a `CNAME` file to your repository root with your domain name
5. Configure DNS settings with your domain provider

## Troubleshooting

### Common Issues:

1. **Site not loading**: Check if the repository is public
2. **404 errors**: Ensure `main.html` is renamed to `index.html` or set as the default page
3. **Styling issues**: Check that all CSS and JS files are properly linked
4. **Images not loading**: Verify image paths are correct

### Rename main.html to index.html (Recommended)

For better compatibility, rename `main.html` to `index.html`:

```bash
git mv main.html index.html
git commit -m "Rename main.html to index.html for better GitHub Pages compatibility"
git push
```

## Updating Your Website

To update your website:

```bash
# Make your changes to the files
# Then commit and push:
git add .
git commit -m "Update website content"
git push
```

The changes will automatically deploy to GitHub Pages within a few minutes.

## Security Headers

Your website already includes security headers in the HTML files, which is great for production deployment.

## Performance Tips

1. Optimize images before uploading
2. Minify CSS and JavaScript files
3. Use CDN links for external resources (already implemented)
4. Enable compression on your web server

## Support

If you encounter issues:
1. Check GitHub Pages documentation
2. Verify your repository settings
3. Check the Actions tab for deployment logs
4. Ensure all file paths are correct 