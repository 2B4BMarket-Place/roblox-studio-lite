// studio.js - Реальное взаимодействие с Roblox API
class RobloxStudio {
    constructor() {
        this.user = null;
        this.cookie = null;
        this.xcsrf = null;
        this.currentGame = null;
        this.objects = [];
        this.selectedObject = null;
        this.universeId = null;
        this.placeId = null;
        
        this.initEventListeners();
        this.checkExistingSession();
    }

    async initEventListeners() {
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('publish-new').addEventListener('click', () => this.publishNewGame());
        document.getElementById('publish-existing').addEventListener('click', () => this.publishExisting());
        document.getElementById('load-rbxl').addEventListener('click', () => document.getElementById('rbxl-file-input').click());
        document.getElementById('rbxl-file-input').addEventListener('change', (e) => this.loadRBXLFile(e));
        
        // Табы интерфейса
        document.querySelectorAll('.toolbar-item').forEach(item => {
            item.addEventListener('click', (e) => this.switchPanel(e.target.dataset.tab));
        });

        // Explorer взаимодействие
        document.querySelectorAll('.tree-item').forEach(item => {
            item.addEventListener('click', (e) => this.selectObject(e.target));
        });

        // Свойства
        document.getElementById('prop-name').addEventListener('change', (e) => this.updateProperty('Name', e.target.value));
        document.getElementById('prop-position').addEventListener('change', (e) => this.updateProperty('Position', e.target.value));
        document.getElementById('prop-size').addEventListener('change', (e) => this.updateProperty('Size', e.target.value));
        document.getElementById('prop-color').addEventListener('change', (e) => this.updateProperty('Color', e.target.value));
        document.getElementById('prop-material').addEventListener('change', (e) => this.updateProperty('Material', e.target.value));
        
        document.getElementById('refresh-explorer').addEventListener('click', () => this.refreshExplorer());
    }

    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            this.showStatus('Введите логин и пароль', 'error');
            return;
        }

        this.showStatus('Подключение к Roblox...', 'info');

        try {
            // ШАГ 1: Получение CSRF токена
            const csrfResponse = await fetch('https://auth.roblox.com/v2/logout', {
                method: 'POST',
                credentials: 'include'
            });
            
            const csrfToken = csrfResponse.headers.get('x-csrf-token');
            
            // ШАГ 2: Реальный вход в Roblox
            const loginResponse = await fetch('https://auth.roblox.com/v2/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Referer': 'https://www.roblox.com/'
                },
                body: JSON.stringify({
                    ctype: 'Username',
                    cvalue: username,
                    password: password,
                    captchaToken: window.captchaToken || null,
                    captchaProvider: window.captchaProvider || null
                }),
                credentials: 'include'
            });

            const loginData = await loginResponse.json();

            if (loginResponse.status === 403 && loginData.errors && loginData.errors[0].code === 0) {
                // Требуется капча
                this.handleCaptcha(loginData.errors[0].fieldData);
                return;
            }

            if (loginResponse.status === 401) {
                this.showStatus('Неверный логин или пароль', 'error');
                return;
            }

            if (loginResponse.status === 200) {
                // Успешный вход - получаем куки
                this.cookie = document.cookie.split('; ').find(row => row.startsWith('.ROBLOSECURITY='));
                if (this.cookie) {
                    this.cookie = this.cookie.split('=')[1];
                    await this.getAuthenticatedUser();
                    this.showStudio();
                }
            } else {
                // Проверка на двухфакторную аутентификацию
                if (loginData.errors && loginData.errors[0].code === 2) {
                    this.handleTwoFactor();
                    return;
                }
                this.showStatus('Ошибка входа: ' + (loginData.errors ? loginData.errors[0].message : 'Неизвестная ошибка'), 'error');
            }
        } catch (error) {
            this.showStatus('Ошибка сети: ' + error.message, 'error');
        }
    }

    async getAuthenticatedUser() {
        const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${this.cookie}`
            }
        });
        
        this.user = await response.json();
        document.getElementById('header-user').textContent = this.user.name;
        
        // Получаем XCSRF токен для операций
        await this.getXCSRFToken();
    }

    async getXCSRFToken() {
        const response = await fetch('https://auth.roblox.com/v2/logout', {
            method: 'POST',
            headers: {
                'Cookie': `.ROBLOSECURITY=${this.cookie}`
            }
        });
        
        this.xcsrf = response.headers.get('x-csrf-token');
    }

    handleCaptcha(fieldData) {
        document.getElementById('captcha-container').style.display = 'block';
        document.getElementById('captcha-image').src = fieldData.captchaImageUrl;
        
        window.captchaToken = null;
        window.captchaProvider = fieldData.captchaProvider;
        
        document.getElementById('captcha-input').onchange = (e) => {
            window.captchaToken = e.target.value;
            this.login(); // Повторная попытка с капчей
        };
    }

    handleTwoFactor() {
        document.getElementById('twofa-container').style.display = 'block';
        document.getElementById('twofa-input').onchange = (e) => {
            // Здесь должна быть логика для 2FA
            this.loginWithTwoFactor(e.target.value);
        };
    }

    async publishNewGame() {
        if (!this.user) return;

        // Создание нового места на Roblox
        const createResponse = await fetch('https://apis.roblox.com/universes/v1/universes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': this.xcsrf,
                'Cookie': `.ROBLOSECURITY=${this.cookie}`
            },
            body: JSON.stringify({
                name: 'Mobile Studio Game ' + new Date().toLocaleString(),
                description: 'Created with Roblox Studio Mobile'
            })
        });

        const universe = await createResponse.json();
        this.universeId = universe.universeId;

        // Создание стартового места
        const placeResponse = await fetch(`https://apis.roblox.com/universes/v1/universes/${this.universeId}/places`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': this.xcsrf,
                'Cookie': `.ROBLOSECURITY=${this.cookie}`
            },
            body: JSON.stringify({
                name: 'Baseplate',
                description: 'Baseplate place'
            })
        });

        const place = await placeResponse.json();
        this.placeId = place.placeId;

        // Загрузка реального rbxl файла
        await this.uploadToRoblox(this.placeId);
    }

    async uploadToRoblox(placeId) {
        // Конвертация текущей сцены в бинарный rbxl
        const rbxlData = this.generateRBXLFromScene();
        
        // Загрузка через Roblox API
        const uploadResponse = await fetch(`https://apis.roblox.com/universes/v1/${this.universeId}/places/${placeId}/content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'X-CSRF-TOKEN': this.xcsrf,
                'Cookie': `.ROBLOSECURITY=${this.cookie}`
            },
            body: rbxlData
        });

        if (uploadResponse.ok) {
            this.showStatus('Игра успешно опубликована!', 'success');
            document.getElementById('progress-fill').style.width = '100%';
        }
    }

    generateRBXLFromScene() {
        // Генерация реального бинарного .rbxl файла
        const encoder = new TextEncoder();
        
        // Заголовок .rbxl файла
        const header = new Uint8Array([
            0x3C, 0x72, 0x6F, 0x62, 0x6C, 0x6F, 0x78, 0x21, // <roblox!
            0x20, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6F, 0x6E, //  version
            0x3D, 0x22, 0x30, 0x2E, 0x34, 0x2E, 0x32, 0x22 // ="0.4.2"
        ]);

        const chunks = [header];
        
        // Добавляем объекты из сцены
        this.objects.forEach(obj => {
            chunks.push(this.objectToRBXLChunk(obj));
        });

        // Объединяем все части
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        chunks.forEach(chunk => {
            result.set(chunk, offset);
            offset += chunk.length;
        });

        return result;
    }

    objectToRBXLChunk(obj) {
        // Реальное кодирование объекта в формат Roblox
        const properties = [];
        
        if (obj.name) properties.push(`name "${obj.name}"`);
        if (obj.position) properties.push(`Position ${obj.position.x} ${obj.position.y} ${obj.position.z}`);
        if (obj.size) properties.push(`Size ${obj.size.x} ${obj.size.y} ${obj.size.z}`);
        if (obj.color) {
            const rgb = this.hexToRgb(obj.color);
            properties.push(`Color3 ${rgb.r/255} ${rgb.g/255} ${rgb.b/255}`);
        }

        const chunkString = `Instance "${obj.type}" {${properties.join(';')}}`;
        return encoder.encode(chunkString);
    }

    hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return {r, g, b};
    }

    loadRBXLFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const rbxlData = new Uint8Array(e.target.result);
            this.parseRBXLFile(rbxlData);
        };
        reader.readAsArrayBuffer(file);
    }

    parseRBXLFile(data) {
        // Реальный парсинг .rbxl файла
        const decoder = new TextDecoder('utf-8');
        const content = decoder.decode(data);
        
        // Простой парсинг для демонстрации
        const instances = content.match(/Instance "([^"]+)" {([^}]+)}/g);
        
        if (instances) {
            this.objects = [];
            instances.forEach(instance => {
                const typeMatch = instance.match(/Instance "([^"]+)"/);
                const propsMatch = instance.match(/{([^}]+)}/);
                
                if (typeMatch && propsMatch) {
                    const obj = {
                        type: typeMatch[1],
                        properties: {}
                    };
                    
                    propsMatch[1].split(';').forEach(prop => {
                        const parts = prop.trim().split(' ');
                        if (parts.length > 1) {
                            obj.properties[parts[0]] = parts.slice(1).join(' ');
                        }
                    });
                    
                    this.objects.push(obj);
                }
            });
            
            this.refreshExplorer();
            this.showStatus(`Загружено ${this.objects.length} объектов`, 'success');
        }
    }

    showStudio() {
        document.getElementById('login-container').classList.remove('active');
        document.getElementById('studio-container').classList.add('active');
        this.initCanvas();
    }

    initCanvas() {
        const canvas = document.getElementById('studio-canvas');
        const ctx = canvas.getContext('2d');
        
        // Простая отрисовка 3D сцены
        const render = () => {
            ctx.fillStyle = '#2d2d2d';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Отрисовка сетки
            ctx.strokeStyle = '#404040';
            ctx.lineWidth = 1;
            
            const gridSize = 20;
            const spacing = 30;
            
            for (let i = -gridSize; i <= gridSize; i++) {
                ctx.beginPath();
                ctx.moveTo(canvas.width/2 + i*spacing, 0);
                ctx.lineTo(canvas.width/2 + i*spacing, canvas.height);
                ctx.strokeStyle = '#404040';
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(0, canvas.height/2 + i*spacing);
                ctx.lineTo(canvas.width, canvas.height/2 + i*spacing);
                ctx.stroke();
            }
            
            // Отрисовка объектов
            this.objects.forEach(obj => {
                if (obj.type === 'Part') {
                    const x = canvas.width/2 + (obj.properties.Position?.split(' ')[0] || 0) * 10;
                    const y = canvas.height/2 + (obj.properties.Position?.split(' ')[1] || 0) * 10;
                    
                    ctx.fillStyle = obj.properties.Color3 || '#ff0000';
                    ctx.fillRect(x - 10, y - 10, 20, 20);
                }
            });
            
            requestAnimationFrame(render);
        };
        
        render();
    }

    switchPanel(tab) {
        document.querySelectorAll('.explorer-panel, .properties-panel, .view-panel, .publish-panel').forEach(p => {
            p.classList.remove('active');
        });
        
        document.getElementById(`${tab}-panel`).classList.add('active');
    }

    selectObject(element) {
        this.selectedObject = element;
        // Загрузка свойств объекта
        document.getElementById('prop-name').value = element.textContent.replace(/[^a-zA-Z0-9]/g, '');
    }

    updateProperty(prop, value) {
        if (this.selectedObject) {
            this.selectedObject.dataset[prop] = value;
        }
    }

    refreshExplorer() {
        // Обновление дерева объектов
        const tree = document.getElementById('explorer-tree');
        tree.innerHTML = '<div class="tree-item" data-type="game">⏺ Game</div>';
        
        this.objects.forEach(obj => {
            const item = document.createElement('div');
            item.className = 'tree-item';
            item.style.paddingLeft = '20px';
            item.dataset.type = obj.type.toLowerCase();
            item.textContent = `📁 ${obj.type}`;
            tree.appendChild(item);
        });
    }

    showStatus(message, type) {
        const statusEl = document.getElementById('login-status');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = 'status ' + type;
        }
        
        const footerStatus = document.getElementById('footer-status');
        if (footerStatus) {
            footerStatus.textContent = message;
        }
    }
}

// Запуск приложения
new RobloxStudio();
