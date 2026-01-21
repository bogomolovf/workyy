# Референсы для: Голосовые сообщения на доске (Telegram-style)

## Описание фичи

Добавить возможность создавать и оставлять голосовые сообщения на доске. Голосовые сообщения должны выглядеть как в Telegram:

- Визуализация волны (waveform)
- Play/Pause кнопка
- Индикатор прогресса
- Отображение длительности
- Изменение скорости воспроизведения (1x, 1.5x, 2x)

## Референсы

### Библиотеки для записи голоса

#### react-audio-voice-recorder

- **URL**: https://www.npmjs.com/package/react-audio-voice-recorder
- **Тип**: library
- **Описание**: Предоставляет компонент `AudioRecorder` и хук `useAudioRecorder` для кастомных UI
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Поддержка noise suppression и echo cancellation
  - Сохраняет в WebM по умолчанию
  - Хук предоставляет: start, stop, toggle pause/resume, recordingBlob
  - TypeScript поддержка

#### react-voice-visualizer

- **URL**: https://github.com/YZarytskyi/react-voice-visualizer
- **Тип**: library
- **Описание**: Библиотека для записи и визуализации аудио через Web Audio API
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Real-time визуализация во время записи
  - Кастомизируемый UI
  - React 18/19 совместимость

#### react-voice-recorder-kit

- **URL**: https://github.com/mohamad-fallah/react-voice-recorder-kit
- **Тип**: library
- **Описание**: Легковесная библиотека с анимированной waveform визуализацией (40 bars)
- **Релевантность**: средняя
- **Ключевые моменты**:
  - Нет внешних UI зависимостей
  - React 18+ совместимость
  - Требует `'use client'` для Next.js

### Библиотеки для воспроизведения и waveform

#### @wavesurfer/react (официальный React wrapper)

- **URL**: https://www.npmjs.com/package/@wavesurfer/react
- **Тип**: library
- **Описание**: Официальный React wrapper для wavesurfer.js с хуком `useWavesurfer`
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Хук возвращает: wavesurfer, isReady, isPlaying, currentTime
  - Поддержка plugins (Timeline, Regions)
  - Events через props: onReady, onPlay, onPause
  - Кастомизация: barWidth, barGap, colors, height

#### react-voicemail-player

- **URL**: https://github.com/vadimavdeev/react-voicemail-player
- **Тип**: library
- **Описание**: Компонент вдохновленный Telegram messenger
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Специально для голосовых сообщений
  - Отображает amplitude peaks
  - Оптимизирован для маленьких файлов

#### ElevenLabs UI Waveform

- **URL**: https://ui.elevenlabs.io/docs/components/waveform
- **Тип**: library
- **Описание**: Canvas-based компоненты включая AudioScrubber и ScrollingWaveform
- **Релевантность**: средняя
- **Ключевые моменты**:
  - Интерактивный playback
  - Real-time визуализация
  - Современный дизайн

### MediaRecorder API (нативный браузерный API)

#### MDN Web Docs - MediaRecorder

- **URL**: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- **Тип**: documentation
- **Описание**: Официальная документация по MediaRecorder API
- **Релевантность**: высокая
- **Ключевые моменты**:
  - `navigator.mediaDevices.getUserMedia()` для получения потока
  - `ondataavailable` event для сбора chunks
  - `onstop` для финализации Blob
  - MIME types: `audio/webm` (Chrome), `audio/ogg` (Firefox)
  - `MediaRecorder.isTypeSupported()` для проверки поддержки

### Хранение аудио в базе данных

#### PostgreSQL Best Practices

- **URL**: https://wiki.postgresql.org/wiki/BinaryFilesInDB
- **Тип**: documentation
- **Описание**: Рекомендации по хранению бинарных файлов в PostgreSQL
- **Релевантность**: высокая
- **Ключевые моменты**:
  - **Рекомендуется `bytea`** вместо Base64 (Base64 увеличивает размер на 33%)
  - `bytea` поддерживает до 1GB на запись
  - Для больших файлов (4TB+) - Large Objects (LO/OID)
  - **Альтернатива**: хранить путь в БД, файл на S3/filesystem

### Контроль скорости воспроизведения

#### HTMLMediaElement.playbackRate

- **URL**: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate
- **Тип**: documentation
- **Описание**: Свойство для управления скоростью воспроизведения
- **Релевантность**: высокая
- **Ключевые моменты**:
  - `1.0` = нормальная скорость
  - Диапазон: 0.5 - 4.0
  - `preservesPitch` сохраняет тональность
  - Event: `ratechange`

### ReactFlow интеграция

#### ReactFlow Custom Nodes + Web Audio

- **URL**: https://reactflow.dev/learn/tutorials/react-flow-and-the-web-audio-api
- **Тип**: tutorial
- **Описание**: Официальный туториал по интеграции Web Audio с ReactFlow
- **Релевантность**: высокая
- **Ключевые моменты**:
  - Custom node компонент с `<Handle />` для соединений
  - `useRef` для доступа к audio элементу
  - Регистрация в `nodeTypes` объекте
  - State management через Zustand

## Конфигурация Telegram-style waveform

Для достижения визуального стиля Telegram:

- **barWidth**: 3-4px
- **barGap**: 2px
- **height**: 40-80px
- **primaryColor**: цвет прогресса (проигранная часть)
- **backgroundColor**: светлый цвет (оставшаяся часть)

## Структура существующего кода

### Типы узлов (NodeType enum в schema.prisma)

```
sql, python, table, plot, note, text, shape, image, draw, pen, database
```

Нужно добавить: `voice`

### Регистрация узлов (BoardCanvas.tsx)

```typescript
const nodeTypes = {
  sqlNode: SqlNodeComponent,
  pythonNode: PythonNodeComponent,
  pen: PenNode,
  textNode: TextNode,
  databaseNode: DatabaseNode,
  plotNode: PlotNode,
  shapeNode: ShapeNode,
};
```

### Создание узлов (useAddNode.ts)

- `createTextNode()`, `createNoteNode()`, etc.
- Нужно добавить: `createVoiceNode()`

## Рекомендации

### Рекомендуемые библиотеки

1. **@wavesurfer/react** - для воспроизведения и визуализации waveform
2. **react-audio-voice-recorder** (useAudioRecorder hook) - для записи
3. Нативный **MediaRecorder API** как альтернатива

### Архитектурные решения

1. **Хранение**: Base64 в поле `audioData` в payload узла (для небольших голосовых < 1MB)
2. **Формат**: WebM (лучшая поддержка браузерами)
3. **UI**: Telegram-style с waveform bars, play/pause, duration, speed control

### Потенциальные проблемы

1. **Safari/iOS**: WebM не поддерживается - нужен fallback на audio/mp4
2. **Размер файлов**: Ограничить длительность записи (например, 5 минут)
3. **Синхронизация**: Аудио данные синхронизируются через Yjs как часть node payload

## Следующие шаги

1. Добавить `voice` в NodeType enum (schema.prisma)
2. Создать VoiceNode компонент с:
   - Кнопка записи (при отсутствии аудио)
   - Waveform player (при наличии аудио)
   - Telegram-style UI
3. Добавить `createVoiceNode()` в useAddNode.ts
4. Зарегистрировать voiceNode в nodeTypes (BoardCanvas.tsx)
5. Добавить UI для создания voice node (toolbar/palette)
