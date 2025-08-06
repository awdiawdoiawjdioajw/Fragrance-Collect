# Fragrance Collect Website

A luxury fragrance e-commerce website showcasing premium fragrances and collections.

## Features

- Responsive design with modern UI
- Interactive product filtering and search
- Contact forms and customer service pages
- FAQ and size guide sections
- Authentication system
- Mobile-friendly navigation

## Hosting Options

### Option 1: GitHub Pages (Recommended - FREE)

1. **Create a GitHub repository:**
   - Go to [GitHub](https://github.com) and create a new repository
   - Name it `fragrance-collect-website` or similar

2. **Upload your files:**
   ```bash
   # Initialize git repository
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/fragrance-collect-website.git
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click "Settings" → "Pages"
   - Select "Deploy from a branch" → "main" branch
   - Click "Save"

4. **Your website will be available at:**
   `https://YOUR_USERNAME.github.io/fragrance-collect-website`

### Option 2: Netlify (FREE - Drag & Drop)

1. Go to [Netlify](https://netlify.com)
2. Sign up for a free account
3. Drag and drop your entire website folder to the deploy area
4. Your site will be live instantly with a random URL
5. You can customize the URL in settings

### Option 3: Vercel (FREE - Great performance)

1. Go to [Vercel](https://vercel.com)
2. Sign up with GitHub
3. Import your repository
4. Deploy automatically

### Option 4: Firebase Hosting (FREE - Google's platform)

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init hosting`
4. Deploy: `firebase deploy`

## File Structure

```
Roman Website/
├── main.html              # Main homepage
├── contact.html            # Contact page
├── auth.html              # Authentication page
├── customer-service.html   # Customer service page
├── size-guide.html        # Size guide page
├── faq.html              # FAQ page
├── styles.css            # Main stylesheet
├── script.js             # Main JavaScript
├── contact-styles.css    # Contact page styles
├── contact-script.js     # Contact page scripts
├── auth-styles.css       # Auth page styles
├── auth-script.js        # Auth page scripts
├── customer-service-styles.css
├── customer-service-script.js
├── size-guide-styles.css
├── size-guide-script.js
├── faq.css
├── faq.js
└── README.md
```

## Local Development

To run the website locally:

1. Clone or download the repository
2. Open `main.html` in your web browser
3. Or use a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   ```

## Customization

- Update contact information in `contact.html`
- Modify colors and styles in `styles.css`
- Add new products in `script.js`
- Update social media links throughout the site

## Support

For hosting support or questions, refer to the hosting platform's documentation or contact the development team. 