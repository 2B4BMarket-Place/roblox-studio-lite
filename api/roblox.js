// api/roblox.js - Обновлен для Node.js 24
import fetch from 'node-fetch';

// Конфигурация API эндпоинтов Roblox
const ROBLOX_ENDPOINTS = {
    auth: 'auth.roblox.com',
    users: 'users.roblox.com',
    games: 'games.roblox.com',
    apis: 'apis.roblox.com',
    economy: 'economy.roblox.com',
    inventory: 'inventory.roblox.com',
    assetdelivery: 'assetdelivery.roblox.com',
    thumbnails: 'thumbnails.roblox.com',
    chat: 'chat.roblox.com',
    friends: 'friends.roblox.com',
    groups: 'groups.roblox.com',
    avatar: 'avatar.roblox.com',
    catalog: 'catalog.roblox.com',
    develop: 'develop.roblox.com',
    itemconfiguration: 'itemconfiguration.roblox.com'
};

export default async function handler(req, res) {
    // Настройка CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, X-CSRF-TOKEN, Cookie, Authorization, Accept, Origin, Roblox-Id, Roblox-Game-Id');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Обработка OPTIONS запросов
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    try {
        // Получаем путь из URL
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathParts = url.pathname.split('/').filter(p => p);
        
        // Формат: /api/[endpoint]/[path]
        if (pathParts.length < 2 || pathParts[0] !== 'api') {
            return res.status(400).json({ 
                error: 'Invalid API path',
                format: '/api/[endpoint]/[path]',
                endpoints: Object.keys(ROBLOX_ENDPOINTS)
            });
        }

        const endpoint = pathParts[1];
        const apiPath = pathParts.slice(2).join('/');
        
        // Получаем базовый URL
        const baseUrl = ROBLOX_ENDPOINTS[endpoint];
        if (!baseUrl) {
            return res.status(400).json({ 
                error: 'Unknown endpoint',
                endpoint: endpoint,
                available: Object.keys(ROBLOX_ENDPOINTS)
            });
        }

        // Формируем полный URL
        const robloxUrl = `https://${baseUrl}/${apiPath}${url.search}`;
        
        console.log(`[${new Date().toISOString()}] Proxying: ${req.method} ${robloxUrl}`);

        // Подготовка заголовков
        const requestHeaders = {
            'User-Agent': 'RobloxStudioMobile/3.0 (Mobile; ARM; Android 14)',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Origin': 'https://www.roblox.com',
            'Referer': 'https://www.roblox.com/'
        };

        // Копируем заголовки из запроса
        const headerMappings = {
            'x-csrf-token': 'X-CSRF-TOKEN',
            'cookie': 'Cookie',
            'authorization': 'Authorization',
            'content-type': 'Content-Type'
        };

        Object.entries(headerMappings).forEach(([source, target]) => {
            if (req.headers[source]) {
                requestHeaders[target] = req.headers[source];
            }
        });

        // Подготовка тела запроса
        let body = undefined;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            body = Buffer.concat(chunks);
        }

        // Выполняем запрос к Roblox
        const response = await fetch(robloxUrl, {
            method: req.method,
            headers: requestHeaders,
            body: body,
            redirect: 'follow'
        });

        // Получаем данные ответа
        const contentType = response.headers.get('content-type') || '';
        let responseData;

        if (contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.buffer();
        }

        // Копируем заголовки ответа
        const responseHeaders = {
            'Content-Type': contentType
        };

        // CSRF токен
        const csrfToken = response.headers.get('x-csrf-token');
        if (csrfToken) {
            responseHeaders['X-CSRF-TOKEN'] = csrfToken;
        }

        // Куки
        const cookies = response.headers.raw()['set-cookie'];
        if (cookies) {
            responseHeaders['Set-Cookie'] = cookies;
        }

        // Отправляем ответ
        res.writeHead(response.status, responseHeaders);
        
        if (Buffer.isBuffer(responseData)) {
            res.end(responseData);
        } else {
            res.end(JSON.stringify(responseData));
        }

        console.log(`[${new Date().toISOString()}] Response: ${response.status}`);

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ 
            error: 'Proxy error', 
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
