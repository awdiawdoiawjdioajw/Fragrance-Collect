@echo off
echo 🚀 Fragrance Collect - GitHub Pages Deployment
echo ================================================

REM Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git is not installed. Please install Git first:
    echo    https://git-scm.com/download/win
    pause
    exit /b 1
)
echo ✅ Git is installed

REM Get GitHub username
set /p githubUsername="Enter your GitHub username: "
set /p repoName="Enter repository name (default: fragrance-collect): "
if "%repoName%"=="" set repoName=fragrance-collect

echo.
echo 📁 Setting up repository...

REM Initialize git repository
if not exist ".git" (
    echo Initializing git repository...
    git init
    echo ✅ Git repository initialized
)

REM Add all files
echo Adding files to git...
git add .
echo ✅ Files added

REM Create initial commit
echo Creating initial commit...
git commit -m "Initial commit: Fragrance Collect website"
echo ✅ Initial commit created

REM Rename branch to main
echo Setting up main branch...
git branch -M main
echo ✅ Main branch set

REM Add remote origin
echo Adding remote origin...
git remote add origin https://github.com/%githubUsername%/%repoName%.git
echo ✅ Remote origin added

REM Push to GitHub
echo Pushing to GitHub...
git push -u origin main
echo ✅ Code pushed to GitHub

echo.
echo 🎉 Deployment Setup Complete!
echo ================================================
echo Next steps:
echo 1. Go to: https://github.com/%githubUsername%/%repoName%
echo 2. Click 'Settings' tab
echo 3. Scroll down to 'Pages' section
echo 4. Select 'Deploy from a branch'
echo 5. Choose 'main' branch and '/ (root)' folder
echo 6. Click 'Save'
echo.
echo Your website will be available at:
echo https://%githubUsername%.github.io/%repoName%
echo.
echo ⏱️  Deployment usually takes 2-5 minutes

REM Optional: Rename main.html to index.html
set /p renameToIndex="Do you want to rename main.html to index.html for better compatibility? (y/n): "
if /i "%renameToIndex%"=="y" (
    echo Renaming main.html to index.html...
    git mv main.html index.html
    git commit -m "Rename main.html to index.html for better GitHub Pages compatibility"
    git push
    echo ✅ main.html renamed to index.html
)

echo.
echo 🎯 Setup complete! Check your GitHub repository for deployment status.
pause 