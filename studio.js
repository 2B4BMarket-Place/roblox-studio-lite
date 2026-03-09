// studio.js v3.0 - Мега-функциональная версия

class RobloxStudio {
    constructor() {
        this.version = '3.0.0';
        this.user = null;
        this.cookie = null;
        this.xcsrf = null;
        this.currentGame = null;
        this.objects = [];
        this.selectedObject = null;
        this.universeId = null;
        this.placeId = null;
        this.teamCreate = false;
        this.autoSave = true;
        this.plugins = [];
        this.theme = 'dark';
        this.recentFiles = [];
        this.templates = [];
        this.assets = [];
        this.scripts = {};
        this.terrain = {};
        this.animations = [];
        this.sounds = [];
        this.lighting = {};
        this.camera = { mode: 'perspective' };
        this.grid = { size: 4, opacity: 0.5 };
        
        this.initEventListeners();
        this.loadPlugins();
        this.initAutoSave();
    }

    // ============== НОВЫЕ ФУНКЦИИ ==============

    // 1. ИМПОРТ ИГР ПОЛЬЗОВАТЕЛЯ
    async importUserGames() {
        try {
            const response = await fetch('/api/users/v1/users/authenticated/games', {
                headers: { 'Cookie': `.ROBLOSECURITY=${this.cookie}` }
            });
            const games = await response.json();
            
            games.data.forEach(game => {
                this.addToLibrary(game);
            });
            
            this.showNotification(`Загружено ${games.data.length} игр`, 'success');
        } catch (error) {
            this.showError('Ошибка загрузки игр: ' + error.message);
        }
    }

    // 2. РЕДАКТИРОВАНИЕ СУЩЕСТВУЮЩЕЙ ИГРЫ
    async editExistingGame(universeId, placeId) {
        try {
            const response = await fetch(`/api/assetdelivery/v1/asset?id=${placeId}`, {
                headers: { 'Cookie': `.ROBLOSECURITY=${this.cookie}` }
            });
            
            const rbxlData = await response.arrayBuffer();
            this.parseRBXLFile(rbxlData);
            this.currentUniverseId = universeId;
            this.currentPlaceId = placeId;
            
            this.showNotification('Игра загружена для редактирования', 'success');
        } catch (error) {
            this.showError('Ошибка загрузки игры: ' + error.message);
        }
    }

    // 3. КЛОНИРОВАНИЕ ИГРЫ
    async cloneGame(universeId, newName) {
        try {
            const response = await fetch('/api/apis/universes/v1/universes/' + universeId + '/clone', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': this.xcsrf,
                    'Cookie': `.ROBLOSECURITY=${this.cookie}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newName })
            });
            
            const clone = await response.json();
            this.showNotification('Игра склонирована', 'success');
            return clone;
        } catch (error) {
            this.showError('Ошибка клонирования: ' + error.message);
        }
    }

    // 4. ЭКСПОРТ В .RBXL
    exportToRBXL() {
        const rbxlData = this.generateRBXLFromScene();
        const blob = new Blob([rbxlData], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'game.rbxl';
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Файл сохранен', 'success');
    }

    // 5. ЗАГРУЗКА RBXL ИЗ URL
    async loadRBXLFromUrl(url) {
        try {
            const response = await fetch(url);
            const data = await response.arrayBuffer();
            this.parseRBXLFile(data);
            this.showNotification('Файл загружен из URL', 'success');
        } catch (error) {
            this.showError('Ошибка загрузки: ' + error.message);
        }
    }

    // 6. TEAM CREATE (СОВМЕСТНОЕ РЕДАКТИРОВАНИЕ)
    enableTeamCreate() {
        this.teamCreate = true;
        this.ws = new WebSocket('wss://apis.roblox.com/team-create/v1/universes/' + this.universeId);
        
        this.ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            this.handleTeamCreateUpdate(data);
        };
        
        this.showNotification('Team Create включен', 'info');
    }

    // 7. РЕДАКТОР ТЕРРЕЙНА
    openTerrainEditor() {
        const editor = document.createElement('div');
        editor.className = 'terrain-editor';
        editor.innerHTML = `
            <div class="terrain-toolbar">
                <button onclick="studio.terrainTool('add')">➕ Добавить</button>
                <button onclick="studio.terrainTool('remove')">➖ Удалить</button>
                <button onclick="studio.terrainTool('smooth')">🌀 Сгладить</button>
                <select onchange="studio.terrainMaterial(this.value)">
                    <option value="Grass">Трава</option>
                    <option value="Sand">Песок</option>
                    <option value="Rock">Камень</option>
                    <option value="Snow">Снег</option>
                    <option value="Water">Вода</option>
                </select>
                <input type="range" min="1" max="10" value="3" onchange="studio.terrainBrushSize(this.value)">
            </div>
            <div class="terrain-canvas-container">
                <canvas id="terrain-canvas"></canvas>
            </div>
        `;
        document.body.appendChild(editor);
    }

    // 8. ГЕНЕРАЦИЯ ПРОЦЕДУРНОГО ЛАНДШАФТА
    generateProceduralTerrain(width = 100, height = 100) {
        for (let x = 0; x < width; x++) {
            for (let z = 0; z < height; z++) {
                const y = Math.floor(
                    Math.sin(x * 0.1) * Math.cos(z * 0.1) * 10 +
                    Math.sin(x * 0.05) * 5 +
                    Math.random() * 2
                );
                
                this.setVoxel(x - width/2, y, z - height/2, 'Grass');
            }
        }
        
        this.renderScene();
        this.showNotification('Ландшафт сгенерирован', 'success');
    }

    // 9. РЕДАКТОР СКРИПТОВ С ПОДСВЕТКОЙ
    openScriptEditor(scriptPath, content) {
        const editor = document.createElement('div');
        editor.className = 'script-editor';
        editor.innerHTML = `
            <div class="script-header">
                <span>📝 ${scriptPath}</span>
                <div>
                    <button onclick="studio.saveScript()">💾 Сохранить</button>
                    <button onclick="studio.runScript()">▶ Запустить</button>
                    <button onclick="studio.testScript()">🧪 Тест</button>
                    <button onclick="studio.closeEditor()">✖</button>
                </div>
            </div>
            <div class="script-editor-container">
                <textarea id="lua-editor" spellcheck="false">${content || ''}</textarea>
                <div class="script-output" id="script-output"></div>
            </div>
        `;
        
        document.body.appendChild(editor);
        
        // Добавляем подсветку синтаксиса
        this.initSyntaxHighlighting();
    }

    // 10. ЗАПУСК СКРИПТА НА СЕРВЕРЕ
    async runScript(scriptContent) {
        try {
            const response = await fetch('/api/apis/cloud/v2/scripts/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': this.xcsrf,
                    'Cookie': `.ROBLOSECURITY=${this.cookie}`
                },
                body: JSON.stringify({
                    script: scriptContent,
                    placeId: this.currentPlaceId
                })
            });
            
            const result = await response.json();
            document.getElementById('script-output').innerHTML = result.output || 'Выполнено';
        } catch (error) {
            this.showError('Ошибка выполнения: ' + error.message);
        }
    }

    // 11. АНИМАТОР
    openAnimator() {
        const animator = document.createElement('div');
        animator.className = 'animator';
        animator.innerHTML = `
            <div class="animator-timeline">
                <div class="timeline-controls">
                    <button onclick="studio.playAnimation()">▶</button>
                    <button onclick="studio.stopAnimation()">⏹</button>
                    <button onclick="studio.recordAnimation()">⚫</button>
                    <input type="range" min="0" max="100" value="0" id="timeline-slider">
                </div>
                <div class="keyframes" id="keyframes"></div>
            </div>
            <div class="animator-properties">
                <select onchange="studio.animationProperty('easing', this.value)">
                    <option>Linear</option>
                    <option>EaseIn</option>
                    <option>EaseOut</option>
                    <option>Bounce</option>
                </select>
                <input type="number" placeholder="Длительность (сек)" onchange="studio.animationDuration(this.value)">
            </div>
        `;
        document.body.appendChild(animator);
    }

    // 12. ЗАПИСЬ АНИМАЦИИ
    recordAnimation() {
        this.recording = true;
        this.keyframes = [];
        this.recordStartTime = Date.now();
        
        const recordFrame = () => {
            if (!this.recording) return;
            
            this.keyframes.push({
                time: Date.now() - this.recordStartTime,
                objects: JSON.parse(JSON.stringify(this.objects))
            });
            
            requestAnimationFrame(recordFrame);
        };
        
        recordFrame();
    }

    // 13. ЭКСПОРТ АНИМАЦИИ
    exportAnimation() {
        const animationData = {
            keyframes: this.keyframes,
            duration: this.keyframes[this.keyframes.length - 1].time,
            objects: this.objects.map(obj => obj.type)
        };
        
        const blob = new Blob([JSON.stringify(animationData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'animation.rbxm';
        a.click();
    }

    // 14. ЗВУКОВОЙ РЕДАКТОР
    openSoundEditor() {
        const editor = document.createElement('div');
        editor.className = 'sound-editor';
        editor.innerHTML = `
            <div class="sound-list">
                ${this.sounds.map((sound, i) => `
                    <div class="sound-item" onclick="studio.playSound(${i})">
                        🔊 ${sound.name}
                        <button onclick="studio.editSound(${i})">✎</button>
                        <button onclick="studio.deleteSound(${i})">✖</button>
                    </div>
                `).join('')}
            </div>
            <div class="sound-controls">
                <input type="file" accept="audio/*" onchange="studio.importSound(this)">
                <button onclick="studio.recordSound()">🎤 Записать</button>
            </div>
        `;
        document.body.appendChild(editor);
    }

    // 15. ЗАПИСЬ ЗВУКА
    async recordSound() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];
        
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            this.importSoundFromBlob(blob, 'recorded_sound.webm');
        };
        
        mediaRecorder.start();
        
        setTimeout(() => mediaRecorder.stop(), 5000); // 5 секунд записи
    }

    // 16. БИБЛИОТЕКА АССЕТОВ
    async openAssetLibrary() {
        try {
            const response = await fetch('/api/catalog/v1/search/items?category=All&limit=30', {
                headers: { 'Cookie': `.ROBLOSECURITY=${this.cookie}` }
            });
            
            const assets = await response.json();
            
            const library = document.createElement('div');
            library.className = 'asset-library';
            library.innerHTML = `
                <div class="asset-grid">
                    ${assets.data.map(asset => `
                        <div class="asset-item" onclick="studio.importAsset('${asset.id}')">
                            <img src="https://www.roblox.com/asset-thumbnail/image?assetId=${asset.id}&width=150&height=150">
                            <span>${asset.name}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            
            document.body.appendChild(library);
        } catch (error) {
            this.showError('Ошибка загрузки библиотеки: ' + error.message);
        }
    }

    // 17. ИМПОРТ АССЕТА
    async importAsset(assetId) {
        try {
            const response = await fetch(`/api/assetdelivery/v1/asset?id=${assetId}`, {
                headers: { 'Cookie': `.ROBLOSECURITY=${this.cookie}` }
            });
            
            const data = await response.arrayBuffer();
            
            if (assetId.includes('rbxm')) {
                this.importModel(data);
            } else if (assetId.includes('rbxl')) {
                this.importPlace(data);
            } else {
                this.importMesh(data);
            }
            
            this.showNotification('Ассет импортирован', 'success');
        } catch (error) {
            this.showError('Ошибка импорта: ' + error.message);
        }
    }

    // 18. ТЕСТИРОВАНИЕ ИГРЫ
    async testGame() {
        // Создаем iframe с Roblox Player
        const testWindow = document.createElement('div');
        testWindow.className = 'test-window';
        testWindow.innerHTML = `
            <div class="test-header">
                <span>Тестирование игры</span>
                <button onclick="studio.stopTest()">✖</button>
            </div>
            <iframe id="roblox-player" src="https://www.roblox.com/games/start?placeId=${this.currentPlaceId}"></iframe>
        `;
        
        document.body.appendChild(testWindow);
    }

    // 19. ПУБЛИКАЦИЯ ОБНОВЛЕНИЙ
    async publishUpdate() {
        try {
            const rbxlData = this.generateRBXLFromScene();
            
            const response = await fetch(`/api/apis/universes/v1/${this.universeId}/places/${this.placeId}/content`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-CSRF-TOKEN': this.xcsrf,
                    'Cookie': `.ROBLOSECURITY=${this.cookie}`
                },
                body: rbxlData
            });
            
            if (response.ok) {
                this.showNotification('Обновление опубликовано!', 'success');
            }
        } catch (error) {
            this.showError('Ошибка публикации: ' + error.message);
        }
    }

    // 20. СОЗДАНИЕ ШАБЛОНА
    saveAsTemplate(name) {
        const template = {
            name: name,
            objects: this.objects,
            lighting: this.lighting,
            date: new Date().toISOString()
        };
        
        this.templates.push(template);
        localStorage.setItem('studio_templates', JSON.stringify(this.templates));
        this.showNotification('Шаблон сохранен', 'success');
    }

    // 21. ЗАГРУЗКА ШАБЛОНА
    loadTemplate(templateName) {
        const template = this.templates.find(t => t.name === templateName);
        if (template) {
            this.objects = template.objects;
            this.lighting = template.lighting;
            this.renderScene();
            this.showNotification('Шаблон загружен', 'success');
        }
    }

    // 22. ЭКСПОРТ В ДРУГИЕ ФОРМАТЫ
    exportToFormat(format) {
        switch(format) {
            case 'obj':
                return this.exportToOBJ();
            case 'fbx':
                return this.exportToFBX();
            case 'gltf':
                return this.exportToGLTF();
            case 'stl':
                return this.exportToSTL();
        }
    }

    // 23. ЭКСПОРТ В OBJ
    exportToOBJ() {
        let objData = '# Roblox Studio Mobile Export\n';
        
        this.objects.forEach((obj, i) => {
            objData += `o Object_${i}\n`;
            
            // Вершины
            const vertices = this.getObjectVertices(obj);
            vertices.forEach(v => {
                objData += `v ${v.x} ${v.y} ${v.z}\n`;
            });
            
            // Грани
            objData += 'f 1 2 3 4\n';
            objData += 'f 5 6 7 8\n';
        });
        
        const blob = new Blob([objData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'model.obj';
        a.click();
    }

    // 24. НАСТРОЙКИ ОСВЕЩЕНИЯ
    setLighting(properties) {
        this.lighting = { ...this.lighting, ...properties };
        
        // Применяем настройки
        Object.entries(properties).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--lighting-${key}`, value);
        });
        
        this.renderScene();
    }

    // 25. ФИЗИЧЕСКИЕ СВОЙСТВА
    setPhysicsProperties(objectId, properties) {
        const obj = this.objects.find(o => o.id === objectId);
        if (obj) {
            obj.physics = {
                mass: properties.mass || 1,
                friction: properties.friction || 0.3,
                elasticity: properties.elasticity || 0.5,
                anchored: properties.anchored || false,
                canCollide: properties.canCollide || true
            };
            
            this.updatePropertyPanel();
        }
    }

    // 26. СИМУЛЯЦИЯ ФИЗИКИ
    startPhysicsSimulation() {
        this.physicsInterval = setInterval(() => {
            this.objects.forEach(obj => {
                if (obj.physics && !obj.physics.anchored) {
                    // Простая гравитация
                    obj.position.y -= 0.1 * obj.physics.mass;
                    
                    // Столкновения с землей
                    if (obj.position.y < 0) {
                        obj.position.y = 0;
                    }
                }
            });
            
            this.renderScene();
        }, 50);
    }

    // 27. СОЗДАНИЕ GUI
    createGUI() {
        const gui = {
            type: 'ScreenGui',
            elements: []
        };
        
        const editor = document.createElement('div');
        editor.className = 'gui-editor';
        editor.innerHTML = `
            <div class="gui-toolbar">
                <button onclick="studio.addGUIElement('Frame')">📦 Frame</button>
                <button onclick="studio.addGUIElement('Button')">🔘 Button</button>
                <button onclick="studio.addGUIElement('TextLabel')">📝 Text</button>
                <button onclick="studio.addGUIElement('ImageLabel')">🖼️ Image</button>
                <button onclick="studio.addGUIElement('TextBox')">⌨️ TextBox</button>
            </div>
            <div class="gui-canvas" id="gui-canvas"></div>
            <div class="gui-properties" id="gui-properties"></div>
        `;
        
        document.body.appendChild(editor);
        this.currentGUI = gui;
    }

    // 28. ПРЕВЬЮ GUI
    previewGUI() {
        const preview = document.createElement('div');
        preview.className = 'gui-preview';
        preview.style.position = 'fixed';
        preview.style.top = '0';
        preview.style.left = '0';
        preview.style.width = '100%';
        preview.style.height = '100%';
        preview.style.pointerEvents = 'none';
        preview.style.zIndex = '9999';
        
        this.currentGUI.elements.forEach(element => {
            const el = document.createElement('div');
            el.className = 'gui-element gui-' + element.type;
            el.style.position = 'absolute';
            el.style.left = element.position?.x + 'px';
            el.style.top = element.position?.y + 'px';
            el.style.width = element.size?.x + 'px';
            el.style.height = element.size?.y + 'px';
            el.style.backgroundColor = element.backgroundColor;
            el.style.color = element.textColor;
            el.textContent = element.text;
            
            preview.appendChild(el);
        });
        
        document.body.appendChild(preview);
    }

    // 29. ПЛАГИНЫ
    loadPlugins() {
        const plugins = localStorage.getItem('studio_plugins');
        if (plugins) {
            this.plugins = JSON.parse(plugins);
            
            this.plugins.forEach(plugin => {
                try {
                    eval(plugin.code);
                } catch (e) {
                    console.error('Plugin error:', e);
                }
            });
        }
    }

    // 30. УСТАНОВКА ПЛАГИНА
    installPlugin(url) {
        fetch(url)
            .then(response => response.text())
            .then(code => {
                this.plugins.push({
                    name: 'Plugin ' + (this.plugins.length + 1),
                    code: code,
                    installed: new Date().toISOString()
                });
                
                localStorage.setItem('studio_plugins', JSON.stringify(this.plugins));
                eval(code);
                this.showNotification('Плагин установлен', 'success');
            });
    }

    // 31. МАРКЕТПЛЕЙС ПЛАГИНОВ
    openPluginMarketplace() {
        const marketplace = document.createElement('div');
        marketplace.className = 'plugin-marketplace';
        marketplace.innerHTML = `
            <h3>Магазин плагинов</h3>
            <div class="plugin-list">
                <div class="plugin-item">
                    <h4>Build Tools</h4>
                    <p>Продвинутые инструменты для строительства</p>
                    <button onclick="studio.installPlugin('https://example.com/plugins/build-tools.js')">Установить</button>
                </div>
                <div class="plugin-item">
                    <h4>Terrain Generator Pro</h4>
                    <p>Процедурная генерация ландшафта</p>
                    <button onclick="studio.installPlugin('https://example.com/plugins/terrain-pro.js')">Установить</button>
                </div>
            </
