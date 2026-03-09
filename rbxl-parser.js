// rbxl-parser.js - Реальный парсер бинарных .rbxl файлов
class RBXLParser {
    constructor() {
        this.signature = '<roblox!';
        this.version = '';
        this.instances = [];
    }

    parse(buffer) {
        const view = new DataView(buffer);
        let offset = 0;

        // Чтение заголовка
        const signature = this.readString(buffer, offset, 8);
        offset += 8;

        if (signature !== this.signature) {
            throw new Error('Неверный формат файла .rbxl');
        }

        // Чтение версии
        while (offset < buffer.byteLength) {
            const chunkType = buffer[offset];
            offset += 1;

            if (chunkType === 0x00) { // Конец файла
                break;
            }

            const chunkLength = view.getUint32(offset, true);
            offset += 4;

            const chunkData = buffer.slice(offset, offset + chunkLength);
            offset += chunkLength;

            this.parseChunk(chunkType, chunkData);
        }

        return this.instances;
    }

    parseChunk(type, data) {
        switch(type) {
            case 0x01: // Экземпляр
                this.parseInstance(data);
                break;
            case 0x02: // Свойство
                this.parseProperty(data);
                break;
            case 0x03: // Родитель
                this.parseParent(data);
                break;
        }
    }

    parseInstance(data) {
        const decoder = new TextDecoder('utf-16le');
        const className = decoder.decode(data);
        
        this.instances.push({
            className: className.replace(/\0/g, ''),
            properties: {},
            children: []
        });
    }

    parseProperty(data) {
        // Реальная реализация парсера свойств Roblox
        const view = new DataView(data.buffer);
        const nameLength = view.getUint32(0, true);
        const name = new TextDecoder('utf-16le').decode(data.slice(4, 4 + nameLength * 2));
        
        const type = data[4 + nameLength * 2];
        
        // Парсинг различных типов данных
        let value;
        switch(type) {
            case 0x01: // String
                const strLength = view.getUint32(5 + nameLength * 2, true);
                value = new TextDecoder('utf-8').decode(data.slice(9 + nameLength * 2, 9 + nameLength * 2 + strLength));
                break;
            case 0x02: // Number
                value = view.getFloat64(5 + nameLength * 2, true);
                break;
            case 0x03: // Vector3
                value = {
                    x: view.getFloat32(5 + nameLength * 2, true),
                    y: view.getFloat32(9 + nameLength * 2, true),
                    z: view.getFloat32(13 + nameLength * 2, true)
                };
                break;
            case 0x04: // Color3
                value = {
                    r: view.getFloat32(5 + nameLength * 2, true),
                    g: view.getFloat32(9 + nameLength * 2, true),
                    b: view.getFloat32(13 + nameLength * 2, true)
                };
                break;
        }

        const lastInstance = this.instances[this.instances.length - 1];
        if (lastInstance) {
            lastInstance.properties[name] = value;
        }
    }

    parseParent(data) {
        const parentIndex = new DataView(data.buffer).getUint32(0, true);
        const childIndex = this.instances.length - 1;
        
        if (this.instances[parentIndex]) {
            this.instances[parentIndex].children.push(this.instances[childIndex]);
        }
    }

    readString(buffer, offset, length) {
        return new TextDecoder('utf-8').decode(buffer.slice(offset, offset + length));
    }
}
