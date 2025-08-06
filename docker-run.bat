@echo off
REM Fragrance Collect - Docker Run Script for Windows

echo 🚀 Starting Fragrance Collect Website with Docker...

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Build the Docker image
echo 📦 Building Docker image...
docker build -t fragrance-collect .

if %errorlevel% neq 0 (
    echo ❌ Failed to build Docker image.
    pause
    exit /b 1
)

REM Stop and remove existing container if it exists
echo 🧹 Cleaning up existing container...
docker stop fragrance-collect-website >nul 2>&1
docker rm fragrance-collect-website >nul 2>&1

REM Run the container
echo 🏃‍♂️ Starting container...
docker run -d --name fragrance-collect-website -p 8080:80 --restart unless-stopped fragrance-collect

if %errorlevel% equ 0 (
    echo ✅ Fragrance Collect website is now running!
    echo 🌐 Open your browser and go to: http://localhost:8080
    echo.
    echo 📋 Useful commands:
    echo   - Stop the container: docker stop fragrance-collect-website
    echo   - Start the container: docker start fragrance-collect-website
    echo   - View logs: docker logs fragrance-collect-website
    echo   - Remove container: docker rm -f fragrance-collect-website
) else (
    echo ❌ Failed to start the container.
)

pause 