const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Route for the home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route for main page
app.get('/main', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

// Route for auth page
app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth.html'));
});

// Route for account page
app.get('/account', (req, res) => {
    res.sendFile(path.join(__dirname, 'account.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`🏠 Home page: http://localhost:${PORT}/`);
    console.log(`🔐 Auth page: http://localhost:${PORT}/auth`);
    console.log(`📄 Main page: http://localhost:${PORT}/main`);
    console.log(`👤 Account page: http://localhost:${PORT}/account`);
    console.log(`\n💡 Press Ctrl+C to stop the server`);
});
