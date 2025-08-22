@echo off
echo Adding files to Git...
git add main.html
git add script.js
git add styles.css
git add weathered-mud-6ed5/src/worker.js
git add test-revenue-optimization.js

echo.
echo Committing changes...
git commit -m "🚀 Revenue Optimization Implementation - Multi-store search, TikTok integration, commission optimization, smart caching"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo Done! Check GitHub for your updates.
pause
