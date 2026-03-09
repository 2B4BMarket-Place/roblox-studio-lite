// api.js - Прокси-сервер для обхода CORS
const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Настройка CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-TOKEN, Cookie');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { path } = req.query;
    const robloxUrl = `https://${path}`;

    try {
        const response = await fetch(robloxUrl, {
            method: req.method,
            headers: {
                ...req.headers,
                'host': new URL(robloxUrl).host,
                'origin': 'https://www.roblox.com',
                'referer': 'https://www.roblox.com/'
            },
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });

        const data = await response.text();
        
        // Передаем куки обратно клиенту
        const cookies = response.headers.raw()['set-cookie'];
        if (cookies) {
            res.setHeader('Set-Cookie', cookies);
        }

        res.status(response.status).send(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
