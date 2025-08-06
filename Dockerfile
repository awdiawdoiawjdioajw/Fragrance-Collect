# Use the official Nginx image as base
FROM nginx:alpine

# Create logs directory
RUN mkdir -p /var/log/nginx

# Copy the custom Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy the website files to the Nginx html directory
COPY . /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"] 