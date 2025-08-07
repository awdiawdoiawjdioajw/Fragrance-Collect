#!/bin/bash

# Fragrance Collect - Docker Run Script

echo "🚀 Starting Fragrance Collect Website with Docker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t fragrance-collect .

if [ $? -ne 0 ]; then
    echo "❌ Failed to build Docker image."
    exit 1
fi

# Run the container
echo "🏃‍♂️ Starting container..."
docker run -d \
    --name fragrance-collect-website \
    -p 8080:80 \
    --restart unless-stopped \
    fragrance-collect

if [ $? -eq 0 ]; then
    echo "✅ Fragrance Collect website is now running!"
    echo "🌐 Open your browser and go to: http://localhost:8080"
    echo ""
    echo "📋 Useful commands:"
    echo "  - Stop the container: docker stop fragrance-collect-website"
    echo "  - Start the container: docker start fragrance-collect-website"
    echo "  - View logs: docker logs fragrance-collect-website"
    echo "  - Remove container: docker rm -f fragrance-collect-website"
else
    echo "❌ Failed to start the container."
    exit 1
fi 