const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.static(__dirname));

// SPA fallback for unknown frontend routes
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
    console.log(`Frontend running on http://localhost:${PORT}`);
});