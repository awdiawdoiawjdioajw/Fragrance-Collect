# Fragrance Collect - Docker Setup

This guide will help you run the Fragrance Collect website using Docker.

## 🐳 Prerequisites

1. **Docker Desktop** installed on your system
   - [Download for Windows](https://docs.docker.com/desktop/install/windows-install/)
   - [Download for macOS](https://docs.docker.com/desktop/install/mac-install/)
   - [Download for Linux](https://docs.docker.com/desktop/install/linux-install/)

2. **Docker Compose** (usually included with Docker Desktop)

## 🚀 Quick Start

### Option 1: Using Docker Compose (Recommended)

1. **Open terminal/command prompt** in the project directory
2. **Run the following command:**
   ```bash
   docker-compose up -d
   ```
3. **Open your browser** and go to: `http://localhost:8080`

### Option 2: Using Docker Commands

1. **Build the image:**
   ```bash
   docker build -t fragrance-collect .
   ```

2. **Run the container:**
   ```bash
   docker run -d --name fragrance-collect-website -p 8080:80 --restart unless-stopped fragrance-collect
   ```

3. **Open your browser** and go to: `http://localhost:8080`

### Option 3: Using Scripts

#### Windows
```bash
docker-run.bat
```

#### Linux/macOS
```bash
chmod +x docker-run.sh
./docker-run.sh
```

## 📋 Useful Commands

### Container Management
```bash
# Stop the container
docker stop fragrance-collect-website

# Start the container
docker start fragrance-collect-website

# Restart the container
docker restart fragrance-collect-website

# Remove the container
docker rm -f fragrance-collect-website

# View container logs
docker logs fragrance-collect-website

# View container status
docker ps
```

### Docker Compose Commands
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs

# Rebuild and start
docker-compose up -d --build
```

## 🔧 Configuration

### Port Configuration
The website runs on port `8080` by default. To change this:

1. **Edit `docker-compose.yml`:**
   ```yaml
   ports:
     - "YOUR_PORT:80"  # Change YOUR_PORT to desired port
   ```

2. **Or use Docker command:**
   ```bash
   docker run -d --name fragrance-collect-website -p YOUR_PORT:80 --restart unless-stopped fragrance-collect
   ```

### Custom Nginx Configuration
The Docker setup includes a custom Nginx configuration (`nginx.conf`) with:
- Gzip compression
- Security headers
- Static asset caching
- Error page handling

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Check what's using port 8080
   netstat -ano | findstr :8080  # Windows
   lsof -i :8080                 # Linux/macOS
   
   # Use a different port
   docker run -d --name fragrance-collect-website -p 8081:80 --restart unless-stopped fragrance-collect
   ```

2. **Container won't start**
   ```bash
   # Check container logs
   docker logs fragrance-collect-website
   
   # Check if image was built correctly
   docker images | grep fragrance-collect
   ```

3. **Permission issues (Linux/macOS)**
   ```bash
   # Make script executable
   chmod +x docker-run.sh
   ```

### Docker Desktop Issues

1. **Docker Desktop not running**
   - Start Docker Desktop application
   - Wait for it to fully load
   - Try running the command again

2. **Insufficient resources**
   - Open Docker Desktop settings
   - Increase memory allocation (recommended: 4GB+)
   - Increase CPU allocation

## 📁 Project Structure

```
Fragrance-Collect/
├── Dockerfile              # Docker image configuration
├── docker-compose.yml      # Docker Compose configuration
├── nginx.conf             # Custom Nginx configuration
├── .dockerignore          # Files to exclude from Docker build
├── docker-run.sh          # Linux/macOS run script
├── docker-run.bat         # Windows run script
├── DOCKER_README.md       # This file
├── main.html              # Main website page
├── index.html             # Entry point
├── styles.css             # Main stylesheet
├── script.js              # Main JavaScript
├── emblem.png             # Website emblem
└── ...                    # Other website files
```

## 🔒 Security Features

The Docker setup includes several security features:
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Content Security Policy
- HTTPS redirect (when configured)
- Input sanitization

## 📊 Performance

The Docker setup is optimized for performance:
- Gzip compression enabled
- Static asset caching (1 year for assets, 1 hour for HTML)
- Nginx optimized configuration
- Alpine Linux base image for smaller size

## 🤝 Contributing

To contribute to the Docker setup:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with Docker
5. Submit a pull request

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Docker logs: `docker logs fragrance-collect-website`
3. Ensure Docker Desktop is running
4. Verify port 8080 is available

---

**Happy Dockerizing! 🐳** 