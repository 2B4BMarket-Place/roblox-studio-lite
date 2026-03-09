// api/roblox.js - Универсальный прокси для всех Roblox API
const fetch = require('node-fetch');

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

module.exports = async (req, res) => {
    // Настройка CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, X-CSRF-TOKEN, Cookie, Authorization, Accept, Origin, Roblox-Id, Roblox-Game-Id',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
    };

    // Устанавливаем заголовки
    Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    // Обработка OPTIONS запросов (preflight)
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    try {
        // Парсим URL для определения эндпоинта
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathParts = url.pathname.split('/').filter(p => p);
        
        // Формат: /api/[endpoint]/[path]
        // Пример: /api/auth/v2/login
        if (pathParts.length < 2 || pathParts[0] !== 'api') {
            return res.status(400).json({ 
                error: 'Invalid API path',
                format: '/api/[endpoint]/[path]',
                endpoints: Object.keys(ROBLOX_ENDPOINTS)
            });
        }

        const endpoint = pathParts[1];
        const apiPath = pathParts.slice(2).join('/');
        
        // Получаем базовый URL для эндпоинта
        const baseUrl = ROBLOX_ENDPOINTS[endpoint];
        if (!baseUrl) {
            return res.status(400).json({ 
                error: 'Unknown endpoint',
                endpoint: endpoint,
                available: Object.keys(ROBLOX_ENDPOINTS)
            });
        }

        // Формируем полный URL к Roblox API
        const robloxUrl = `https://${baseUrl}/${apiPath}${url.search}`;
        
        console.log(`[${new Date().toISOString()}] Proxying: ${req.method} ${robloxUrl}`);

        // Подготовка заголовков для Roblox
        const requestHeaders = {
            'User-Agent': 'RobloxStudioMobile/2.0 (Mobile; ARM; Android 13)',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Origin': 'https://www.roblox.com',
            'Referer': 'https://www.roblox.com/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site'
        };

        // Копируем важные заголовки из оригинального запроса
        const headerMappings = {
            'x-csrf-token': 'X-CSRF-TOKEN',
            'cookie': 'Cookie',
            'authorization': 'Authorization',
            'roblox-id': 'Roblox-Id',
            'roblox-game-id': 'Roblox-Game-Id',
            'content-type': 'Content-Type'
        };

        Object.entries(headerMappings).forEach(([source, target]) => {
            if (req.headers[source]) {
                requestHeaders[target] = req.headers[source];
            }
        });

        // Логирование для отладки
        console.log('Request headers:', JSON.stringify(requestHeaders, null, 2));

        // Выполняем запрос к Roblox
        const fetchOptions = {
            method: req.method,
            headers: requestHeaders,
            redirect: 'follow',
            follow: 20
        };

        // Добавляем тело запроса для методов кроме GET/HEAD
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            if (req.headers['content-type']?.includes('application/json')) {
                // Для JSON запросов
                let body = '';
                await new Promise((resolve) => {
                    req.on('data', chunk => { body += chunk; });
                    req.on('end', resolve);
                });
                
                if (body) {
                    try {
                        // Парсим и сразу же строкифицируем для валидации JSON
                        JSON.parse(body);
                        fetchOptions.body = body;
                    } catch (e) {
                        console.error('Invalid JSON in request body:', e);
                    }
                }
            } else {
                // Для других типов контента (бинарные данные .rbxl)
                const chunks = [];
                await new Promise((resolve) => {
                    req.on('data', chunk => chunks.push(chunk));
                    req.on('end', resolve);
                });
                
                if (chunks.length > 0) {
                    fetchOptions.body = Buffer.concat(chunks);
                }
            }
        }

        // Выполняем запрос
        const response = await fetch(robloxUrl, fetchOptions);
        
        // Получаем данные ответа
        let responseData;
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
            responseData = await response.json();
        } else if (contentType.includes('application/octet-stream') || 
                   contentType.includes('application/xml') ||
                   contentType.includes('text/plain')) {
            responseData = await response.buffer();
        } else {
            responseData = await response.text();
        }

        // Копируем важные заголовки из ответа Roblox
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
            responseHeaders['Set-Cookie'] = cookies.map(cookie => {
                // Добавляем SameSite=None для кросс-доменных запросов
                if (!cookie.includes('SameSite')) {
                    cookie += '; SameSite=None';
                }
                if (!cookie.includes('Secure')) {
                    cookie += '; Secure';
                }
                return cookie;
            });
        }

        // Rate limiting информация
        ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'].forEach(header => {
            const value = response.headers.get(header);
            if (value) {
                responseHeaders[header] = value;
            }
        });

        res.writeHead(response.status, responseHeaders);
        
        // Отправляем ответ
        if (Buffer.isBuffer(responseData)) {
            res.end(responseData);
        } else if (typeof responseData === 'object') {
            res.end(JSON.stringify(responseData));
        } else {
            res.end(responseData);
        }

        console.log(`[${new Date().toISOString()}] Response: ${response.status} ${response.statusText}`);

    } catch (error) {
        console.error('Proxy error:', error);
        
        res.status(500).json({ 
            error: 'Proxy error', 
            message: error.message,
            code: error.code,
            timestamp: new Date().toISOString()
        });
    }
};
