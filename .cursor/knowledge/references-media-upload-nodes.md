# Референсы для: Загрузка медиафайлов на бесконечный холст Workyy

## Описание фичи

Пользователь может загружать изображения, видео и презентации/документы и размещать их на бесконечном холсте Workyy перетаскиванием (drag & drop). После добавления файл становится узлом на доске, который можно перемещать, масштабировать и открывать/просматривать прямо на доске.

### Основные сценарии

1. **Drag & Drop на канву (как в Miro)**:
   - Пользователь перетаскивает файл (jpg/png/webp/gif, mp4/webm, pdf/pptx) на доску
   - Появляется индикатор "drop zone"
   - После отпускания создаётся соответствующий узел (image/video/document)

2. **Upload через кнопку/меню**:
   - Выбрать файл через file picker → затем разместить на доске кликом или сразу вставить в центр viewport

3. **Просмотр на доске**:
   - **Image node**: показывает картинку, поддерживает масштабирование и "open/fullscreen"
   - **Video node**: встроенный плеер (play/pause, mute, timeline)
   - **Presentation/Document node**:
     - Быстрый превью (обложка/первая страница)
     - "Open" открывает просмотр прямо на доске (например, PDF viewer/слайды)
     - Навигация по страницам/слайдам

---

## Референсы

### 1. Drag & Drop библиотеки и реализации

#### react-dropzone

- **URL**: https://react-dropzone.js.org/
- **GitHub**: https://github.com/react-dropzone/react-dropzone
- **Тип**: library
- **Описание**: Популярная библиотека для drag & drop загрузки файлов с полной поддержкой TypeScript
- **Релевантность**: высокая
- **Ключевые моменты**:
  - `useDropzone` hook с поддержкой `acceptedFiles` и `fileRejections`
  - Валидация по MIME типу через `accept` проп
  - Ограничение размера файла через `maxSize`
  - `isDragActive` для визуальной индикации
  - Поддержка множественной загрузки

**Пример использования:**

```typescript
import { useDropzone, FileRejection } from 'react-dropzone';

const { getRootProps, getInputProps, isDragActive } = useDropzone({
  onDrop: (acceptedFiles: File[], rejections: FileRejection[]) => {
    // Process files
  },
  accept: {
    'image/*': ['.jpeg', '.png', '.webp', '.gif'],
    'video/*': ['.mp4', '.webm'],
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  },
  maxSize: 50 * 1024 * 1024, // 50MB
});
```

#### Native HTML5 Drag & Drop API

- **URL**: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
- **Тип**: documentation
- **Описание**: Нативный API браузера для drag & drop
- **Релевантность**: средняя
- **Ключевые моменты**:
  - `onDragOver` с `e.preventDefault()` обязателен для разрешения drop
  - `onDrop` для получения файлов через `e.dataTransfer.files`
  - `onDragEnter`/`onDragLeave` для визуальной индикации
  - Работает без дополнительных зависимостей

---

### 2. ReactFlow Node Resizer (масштабирование узлов)

#### NodeResizer Component

- **URL**: https://reactflow.dev/api-reference/components/node-resizer
- **Тип**: documentation
- **Описание**: Встроенный компонент ReactFlow для масштабирования узлов
- **Релевантность**: высокая
- **Ключевые моменты**:
  - `<NodeResizer isVisible={selected} minWidth={100} minHeight={100} />`
  - `keepAspectRatio` проп для сохранения пропорций изображений
  - `onResize` / `onResizeEnd` callbacks для сохранения размеров
  - Встроен в `@xyflow/react` (v12+)

**Пример узла с resizer:**

```typescript
import { NodeResizer } from '@xyflow/react';

function ImageNode({ data, selected }) {
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={100}
        minHeight={100}
        keepAspectRatio={true}
      />
      <img
        src={data.url}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </>
  );
}
```

---

### 3. PDF Viewer библиотеки

#### react-pdf (wojtekmaj)

- **URL**: https://github.com/wojtekmaj/react-pdf
- **NPM**: https://www.npmjs.com/package/react-pdf
- **Тип**: library (open-source)
- **Описание**: Самая популярная open-source библиотека для отображения PDF, обёртка над PDF.js
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Компоненты `<Document>` и `<Page>`
  - `onLoadSuccess` для получения количества страниц
  - `pageNumber` и `scale` пропы для навигации и зума
  - Требует настройки worker для PDF.js
  - Работает в Next.js с `'use client'`

**Пример реализации:**

```typescript
import { Document, Page } from 'react-pdf';

function PDFViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  return (
    <div>
      <div className="controls">
        <button onClick={() => setPageNumber(p => Math.max(1, p - 1))}>Prev</button>
        <span>{pageNumber} / {numPages}</span>
        <button onClick={() => setPageNumber(p => Math.min(numPages || 1, p + 1))}>Next</button>
        <button onClick={() => setScale(s => s + 0.1)}>Zoom In</button>
        <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))}>Zoom Out</button>
      </div>
      <Document file={url} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
        <Page pageNumber={pageNumber} scale={scale} />
      </Document>
    </div>
  );
}
```

#### @pdf-viewer/react

- **URL**: https://www.react-pdf.dev/
- **Тип**: library (commercial)
- **Описание**: Платная библиотека с готовым UI и оптимизацией для больших документов
- **Релевантность**: средняя
- **Ключевые моменты**:
  - Готовый UI с тулбаром
  - Virtual scrolling для больших документов
  - Требует лицензию для коммерческого использования

---

### 4. PowerPoint/PPTX Viewer

#### PPTXjs

- **URL**: https://pptx.js.org/
- **Тип**: library (open-source)
- **Описание**: jQuery-based библиотека для конвертации PPTX в HTML
- **Релевантность**: средняя
- **Ключевые моменты**:
  - Конвертирует PPTX в HTML на клиенте
  - Поддержка текста, форм, чартов, медиа
  - Требует jQuery

#### @cyntler/react-doc-viewer

- **URL**: https://www.npmjs.com/package/@cyntler/react-doc-viewer
- **GitHub**: https://github.com/kartikxisk/docx-xlsx-pptx-pdf-viewer-nextjs-and-reactjs
- **Тип**: library
- **Описание**: React компонент для отображения различных форматов документов
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Поддержка PPTX, DOCX, XLSX, PDF
  - Работает с Next.js и React
  - Единый API для разных форматов

#### Microsoft Office Embed (альтернатива)

- **Тип**: service
- **Описание**: Использование iframe с Microsoft Office viewer
- **Релевантность**: низкая (требует публичный URL)
- **Ключевые моменты**:
  - `<iframe src="https://view.officeapps.live.com/op/embed.aspx?src=PUBLIC_URL">`
  - Документ должен быть публично доступен
  - Не подходит для приватных файлов

---

### 5. Video Player компоненты

#### react-player

- **URL**: https://github.com/cookpete/react-player
- **NPM**: https://www.npmjs.com/package/react-player
- **Тип**: library
- **Описание**: Универсальный React видео плеер с поддержкой множества источников
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Поддержка файлов, YouTube, Vimeo, и др.
  - `controls={false}` для кастомного UI
  - Пропы: `playing`, `muted`, `volume`, `onProgress`
  - `ref` для программного управления

**Пример:**

```typescript
import ReactPlayer from 'react-player';

function VideoNode({ data }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  return (
    <div className="video-node">
      <ReactPlayer
        url={data.url}
        playing={playing}
        muted={muted}
        controls
        width="100%"
        height="100%"
      />
    </div>
  );
}
```

#### Custom HTML5 Video Player

- **URL**: https://github.com/kingjames511/VIDEO_PLAYER
- **Тип**: example
- **Описание**: Пример кастомного видео плеера на React + TypeScript + Tailwind
- **Релевантность**: средняя
- **Ключевые моменты**:
  - `useRef<HTMLVideoElement>` для доступа к API
  - `play()`, `pause()`, `currentTime`, `volume`, `muted`
  - `onTimeUpdate` для синхронизации прогресса
  - Кастомные контролы с Lucide icons

---

### 6. Fullscreen/Lightbox для изображений

#### yet-another-react-lightbox

- **URL**: https://yet-another-react-lightbox.com/
- **NPM**: https://www.npmjs.com/package/yet-another-react-lightbox
- **Тип**: library
- **Описание**: Модульный lightbox с плагинами для zoom, fullscreen, thumbnails
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Поддержка React 17, 18, 19
  - Плагины: Fullscreen, Zoom, Thumbnails, Captions, Video
  - Поддержка `srcset` для responsive images
  - Keyboard, mouse, touch навигация

**Пример:**

```typescript
import Lightbox from 'yet-another-react-lightbox';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';

<Lightbox
  open={open}
  close={() => setOpen(false)}
  slides={[{ src: imageUrl }]}
  plugins={[Fullscreen, Zoom]}
/>
```

#### FsLightbox

- **URL**: https://fslightbox.com/react
- **Тип**: library (free + pro)
- **Описание**: Fullscreen lightbox для изображений и видео
- **Релевантность**: средняя
- **Ключевые моменты**:
  - Free версия с базовым функционалом
  - Pro версия с thumbnails, zoom
  - Поддержка YouTube, HTML5 video

---

### 7. File Upload Backend (Fastify)

#### @fastify/multipart

- **URL**: https://www.npmjs.com/package/@fastify/multipart
- **Тип**: library
- **Описание**: Официальный плагин Fastify для multipart/form-data
- **Релевантность**: высокая
- **Ключевые моменты**:
  - `request.file()` для одного файла
  - `request.files()` async generator для нескольких
  - Stream-based для экономии памяти
  - `limits.fileSize` для ограничения размера

**Пример:**

```typescript
import fastifyMultipart from '@fastify/multipart';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';

fastify.register(fastifyMultipart, {
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

fastify.post('/upload', async (req, reply) => {
  const data = await req.file();
  const filePath = `./uploads/${data.filename}`;
  await pipeline(data.file, fs.createWriteStream(filePath));
  return { url: `/files/${data.filename}` };
});
```

---

### 8. File Storage Solutions

#### MinIO (S3-compatible self-hosted)

- **URL**: https://min.io/
- **GitHub**: https://github.com/minio/minio
- **Тип**: service
- **Описание**: Self-hosted S3-совместимое объектное хранилище
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Docker Compose для развёртывания
  - Порт 9000 (API), 9001 (console)
  - Presigned URLs для прямой загрузки с клиента
  - Node.js клиент: `minio` npm package

**Docker Compose:**

```yaml
services:
  minio:
    image: minio/minio
    ports:
      - '9000:9000'
      - '9001:9001'
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
```

#### Local File Storage

- **Тип**: approach
- **Описание**: Хранение файлов на локальном диске сервера
- **Релевантность**: средняя
- **Ключевые моменты**:
  - Простая реализация через fs.createWriteStream
  - Статическая раздача через Fastify static или Nginx
  - Не масштабируется для production

---

### 9. Image Compression (Client-side)

#### browser-image-compression

- **URL**: https://www.npmjs.com/package/browser-image-compression
- **Тип**: library
- **Описание**: Сжатие изображений в браузере перед загрузкой
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Web Worker для non-blocking сжатия
  - `maxSizeMB`, `maxWidthOrHeight` опции
  - `onProgress` callback
  - Поддержка JPEG, PNG, WebP, BMP

**Пример:**

```typescript
import imageCompression from 'browser-image-compression';

async function compressAndUpload(file: File) {
  const options = {
    maxSizeMB: 2,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    onProgress: (progress: number) => console.log(`${progress}%`),
  };

  const compressedFile = await imageCompression(file, options);
  // Upload compressedFile
}
```

---

### 10. Drop Zone Visual Feedback

#### CSS Техники

- **Тип**: approach
- **Описание**: Визуальная индикация drop zone при drag over
- **Релевантность**: высокая
- **Ключевые моменты**:
  - `isDragActive` state для условного стиля
  - Dashed border + background color change
  - CSS transition для плавности
  - Pulse animation для привлечения внимания

**Пример CSS:**

```css
.canvas-drop-zone {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition: all 0.2s ease;
}

.canvas-drop-zone--active {
  pointer-events: auto;
  background: rgba(59, 130, 246, 0.1);
  border: 2px dashed #3b82f6;
}

.canvas-drop-zone--active::after {
  content: 'Drop files here';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 24px;
  color: #3b82f6;
}
```

---

### 11. Open Source Projects (референсы)

#### Canvaco (Miro/Figma clone)

- **URL**: https://github.com/aurda012/canvaco
- **Тип**: example project
- **Описание**: Минималистичный клон Figma/Miro с image upload на Fabric.js
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Next.js + TypeScript + Fabric.js
  - Image upload на canvas
  - Real-time collaboration
  - Организации и доски

#### CollaboCanvas

- **URL**: https://github.com/mfgoes/CollaboCanvas
- **Тип**: example project
- **Описание**: Real-time collaboration на infinite canvas
- **Релевантность**: средняя
- **Ключевые моменты**:
  - React.js + Node.js + Socket.IO
  - Drag & drop shapes
  - Export в PDF/PNG

#### tldraw Asset Upload

- **URL**: https://tldraw.dev/features/customization/custom-asset-and-content-management
- **Тип**: documentation
- **Описание**: Документация tldraw по загрузке и управлению ассетами
- **Релевантность**: высокая (проект использует tldraw)
- **Ключевые моменты**:
  - `TLAssetStore` с `upload` и `resolve` методами
  - `acceptedImageMimeTypes`, `maxAssetSize` пропы
  - `editor.createAssets()` и `editor.createShape()` API
  - `registerExternalContentHandler` для кастомной обработки

---

## Рекомендации

### Архитектура

1. **Frontend (apps/web)**:
   - Использовать `react-dropzone` для drag & drop на уровне canvas
   - Создать три новых типа узлов: `ImageNode`, `VideoNode`, `DocumentNode`
   - Использовать `NodeResizer` из ReactFlow для масштабирования
   - Применить `browser-image-compression` для сжатия изображений перед загрузкой
   - `react-pdf` для PDF просмотра внутри узла
   - `react-player` для видео с кастомными контролами
   - `yet-another-react-lightbox` для fullscreen просмотра

2. **Backend (apps/realtime-server)**:
   - Добавить `@fastify/multipart` для обработки файлов
   - Создать route `/api/files/upload` для загрузки
   - Хранить файлы локально или в MinIO (S3-compatible)
   - Генерировать presigned URLs для больших файлов

3. **Prisma Schema**:
   - Добавить новые типы узлов в enum `NodeType`
   - Создать таблицу `File` для метаданных файлов

### Порядок реализации

1. **Фаза 1: Backend инфраструктура**
   - Настроить file storage (локальный или MinIO)
   - Создать API endpoints для upload/download
   - Добавить миграции Prisma

2. **Фаза 2: Image Node**
   - Drag & drop изображений на canvas
   - Отображение и масштабирование
   - Fullscreen просмотр
   - Сжатие перед загрузкой

3. **Фаза 3: Video Node**
   - Загрузка видео файлов
   - Встроенный плеер с контролами
   - Play/pause, mute, timeline

4. **Фаза 4: Document Node**
   - PDF viewer с навигацией
   - PPTX базовая поддержка (через конвертацию или iframe)

### Потенциальные проблемы

1. **Размер файлов**: Ограничить max size (рекомендуется 50MB), использовать presigned URLs для больших файлов
2. **Производительность**: Сжимать изображения на клиенте, использовать lazy loading
3. **CORS**: Настроить правильные заголовки для file storage
4. **Memory leaks**: Очищать `URL.createObjectURL()` после использования
5. **PPTX**: Полноценный viewer сложен, рассмотреть конвертацию в PDF на backend

---

## Следующие шаги

1. Изучить существующую структуру узлов в `apps/web/src/components/flowNodes/`
2. Проверить текущую реализацию `BoardCanvas.tsx` для понимания паттернов
3. Добавить новые типы узлов в `NodeType` enum
4. Создать базовую инфраструктуру file upload на backend
5. Реализовать `ImageNode` как первый прототип
6. Добавить drag & drop на уровне canvas
7. Итеративно добавлять Video и Document узлы

---

## Полезные ссылки

- ReactFlow Drag & Drop: https://reactflow.dev/examples/interaction/drag-and-drop
- ReactFlow Node Resizer: https://reactflow.dev/api-reference/components/node-resizer
- react-dropzone: https://react-dropzone.js.org/
- react-pdf: https://github.com/wojtekmaj/react-pdf
- react-player: https://github.com/cookpete/react-player
- yet-another-react-lightbox: https://yet-another-react-lightbox.com/
- browser-image-compression: https://www.npmjs.com/package/browser-image-compression
- @fastify/multipart: https://www.npmjs.com/package/@fastify/multipart
- tldraw Asset Management: https://tldraw.dev/features/customization/custom-asset-and-content-management
