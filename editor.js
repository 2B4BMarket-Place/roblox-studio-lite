// editor.js - 3D редактор для мобильных устройств
class Mobile3DEditor {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.objects = [];
        this.camera = {
            position: { x: 0, y: 0, z: -50 },
            rotation: { x: 0, y: 0, z: 0 }
        };
        
        this.initTouchControls();
        this.setupCanvas();
    }

    setupCanvas() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.render();
    }

    initTouchControls() {
        let lastTouch = null;

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            lastTouch = { x: touch.clientX, y: touch.clientY };
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!lastTouch) return;

            const touch = e.touches[0];
            const deltaX = touch.clientX - lastTouch.x;
            const deltaY = touch.clientY - lastTouch.y;

            // Вращение камеры
            this.camera.rotation.x += deltaY * 0.01;
            this.camera.rotation.y += deltaX * 0.01;

            lastTouch = { x: touch.clientX, y: touch.clientY };
            this.render();
        });

        this.canvas.addEventListener('touchend', () => {
            lastTouch = null;
        });

        // Масштабирование
        this.canvas.addEventListener('gesturestart', (e) => e.preventDefault());
        this.canvas.addEventListener('gesturechange', (e) => {
            e.preventDefault();
            this.camera.position.z += e.scale * 2;
            this.render();
        });
    }

    addObject(type, position = { x: 0, y: 0, z: 0 }) {
        const obj = {
            type: type,
            position: position,
            size: { x: 4, y: 4, z: 4 },
            color: '#ff0000',
            material: 'Plastic'
        };
        
        this.objects.push(obj);
        this.render();
        return obj;
    }

    project3DTo2D(point) {
        // Проекция 3D точки на 2D экран
        const dx = point.x - this.camera.position.x;
        const dy = point.y - this.camera.position.y;
        const dz = point.z - this.camera.position.z;

        // Поворот камеры
        const cosX = Math.cos(this.camera.rotation.x);
        const sinX = Math.sin(this.camera.rotation.x);
        const cosY = Math.cos(this.camera.rotation.y);
        const sinY = Math.sin(this.camera.rotation.y);

        const x = dy * cosY - dx * sinY;
        const y = dz * cosX - (dx * cosY + dy * sinY) * sinX;
        const z = dz * sinX + (dx * cosY + dy * sinY) * cosX;

        if (z <= 0) return null;

        const scale = 300 / z;
        return {
            x: this.canvas.width / 2 + x * scale,
            y: this.canvas.height / 2 - y * scale
        };
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем сетку
        this.drawGrid();
        
        // Рисуем объекты
        this.objects.forEach(obj => {
            this.drawObject(obj);
        });
    }

    drawGrid() {
        const gridSize = 20;
        const spacing = 5;

        this.ctx.strokeStyle = '#404040';
        this.ctx.lineWidth = 1;

        for (let i = -gridSize; i <= gridSize; i++) {
            for (let j = -gridSize; j <= gridSize; j++) {
                const point1 = this.project3DTo2D({ x: i * spacing, y: j * spacing, z: 0 });
                const point2 = this.project3DTo2D({ x: (i+1) * spacing, y: j * spacing, z: 0 });
                const point3 = this.project3DTo2D({ x: i * spacing, y: (j+1) * spacing, z: 0 });

                if (point1 && point2) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(point1.x, point1.y);
                    this.ctx.lineTo(point2.x, point2.y);
                    this.ctx.stroke();
                }

                if (point1 && point3) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(point1.x, point1.y);
                    this.ctx.lineTo(point3.x, point3.y);
                    this.ctx.stroke();
                }
            }
        }
    }

    drawObject(obj) {
        const vertices = this.getObjectVertices(obj);
        const projected = vertices.map(v => this.project3DTo2D(v)).filter(p => p !== null);

        if (projected.length < 3) return;

        // Рисуем грани
        this.ctx.fillStyle = obj.color;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;

        const faces = this.getFaces(projected);
        faces.forEach(face => {
            this.ctx.beginPath();
            this.ctx.moveTo(face[0].x, face[0].y);
            face.slice(1).forEach(point => {
                this.ctx.lineTo(point.x, point.y);
            });
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
        });
    }

    getObjectVertices(obj) {
        const { x, y, z } = obj.position;
        const { x: sx, y: sy, z: sz } = obj.size;

        return [
            { x: x - sx/2, y: y - sy/2, z: z - sz/2 },
            { x: x + sx/2, y: y - sy/2, z: z - sz/2 },
            { x: x + sx/2, y: y + sy/2, z: z - sz/2 },
            { x: x - sx/2, y: y + sy/2, z: z - sz/2 },
            { x: x - sx/2, y: y - sy/2, z: z + sz/2 },
            { x: x + sx/2, y: y - sy/2, z: z + sz/2 },
            { x: x + sx/2, y: y + sy/2, z: z + sz/2 },
            { x: x - sx/2, y: y + sy/2, z: z + sz/2 }
        ];
    }

    getFaces(projected) {
        if (projected.length < 4) return [];

        return [
            [projected[0], projected[1], projected[2], projected[3]], // Front
            [projected[4], projected[5], projected[6], projected[7]], // Back
            [projected[0], projected[1], projected[5], projected[4]], // Bottom
            [projected[2], projected[3], projected[7], projected[6]], // Top
            [projected[1], projected[2], projected[6], projected[5]], // Right
            [projected[0], projected[3], projected[7], projected[4]]  // Left
        ];
    }
}
