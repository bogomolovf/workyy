import { useCallback, useRef } from 'react';
import { NodeResizer, type NodeProps } from 'reactflow';
import { RichTextEditor, type RichTextEditorRef } from './RichTextEditor';
import { TextToolbar } from './TextToolbar';

type TextData = {
  nodeId: string;
  nodeType: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  richContentHtml?: string | null; // HTML контент от TipTap
  onChangeText: (id: string, text: string) => void;
  onChangeFormat: (
    id: string,
    patch: Partial<{
      text: string;
      fontSize: number;
      fontFamily: string;
      color: string;
      textAlign: 'left' | 'center' | 'right';
      richContent: string;
    }>,
  ) => void;
};

const DEFAULT_TEXT = '';
const DEFAULT_FONT_SIZE = 18;
const DEFAULT_FONT_FAMILY = 'Inter, sans-serif';
const DEFAULT_COLOR = '#CF4C2C'; // orange-red (первый цвет в палитре, как у стикеров)
const DEFAULT_TEXT_ALIGN: 'left' | 'center' | 'right' = 'left';

export function TextNode({ id, data, selected, width, height }: NodeProps<TextData>) {
  const nodeWidth = typeof width === 'number' ? width : Number(width ?? 240);
  const nodeHeight = typeof height === 'number' ? height : Number(height ?? 80);

  const text = data.text ?? DEFAULT_TEXT;
  const fontSize = data.fontSize ?? DEFAULT_FONT_SIZE;
  const fontFamily = data.fontFamily ?? DEFAULT_FONT_FAMILY;
  const color = data.color ?? DEFAULT_COLOR;
  const textAlign = data.textAlign ?? DEFAULT_TEXT_ALIGN;
  const richContentHtml = data.richContentHtml ?? null;

  const editorRef = useRef<RichTextEditorRef>(null);

  // Инициализируем контент: если есть richContent, используем его, иначе plain text
  const initialHtml = richContentHtml ?? (text ? `<p>${escapeHtml(text)}</p>` : '<p></p>');

  const handleChange = useCallback(
    (content: { html: string; text: string }) => {
      // Обновляем и plain text, и rich content
      data.onChangeText?.(id, content.text);
      data.onChangeFormat?.(id, {
        richContent: content.html,
        text: content.text, // подстраховка
      });
    },
    [data, id],
  );

  const handleFontSizeChange = useCallback(
    (newFontSize: number) => {
      data.onChangeFormat?.(id, { fontSize: newFontSize });
    },
    [data, id],
  );

  const handleFontFamilyChange = useCallback(
    (newFontFamily: string) => {
      data.onChangeFormat?.(id, { fontFamily: newFontFamily });
    },
    [data, id],
  );

  const handleColorChange = useCallback(
    (newColor: string) => {
      data.onChangeFormat?.(id, { color: newColor });
    },
    [data, id],
  );

  const handleTextAlignChange = useCallback(
    (newTextAlign: 'left' | 'center' | 'right') => {
      data.onChangeFormat?.(id, { textAlign: newTextAlign });
    },
    [data, id],
  );

  const handleBoldToggle = useCallback(() => {
    editorRef.current?.toggleBold();
  }, []);

  const handleItalicToggle = useCallback(() => {
    editorRef.current?.toggleItalic();
  }, []);

  return (
    <div
      className="relative rounded-md bg-transparent"
      style={{
        width: '100%',
        height: '100%',
        minWidth: 120,
        minHeight: 40,
        boxSizing: 'border-box',
      }}
    >
      {selected && (
        <TextToolbar
          fontSize={fontSize}
          fontFamily={fontFamily}
          activeColor={color}
          onFontSizeChange={handleFontSizeChange}
          onFontFamilyChange={handleFontFamilyChange}
          onColorChange={handleColorChange}
          onBoldToggle={handleBoldToggle}
          onItalicToggle={handleItalicToggle}
        />
      )}
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={40}
        lineClassName="!border-slate-300"
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 9999,
          border: '2px solid #cbd5e1',
          background: '#ffffff',
        }}
      />
      <div className="h-full w-full p-4 flex flex-col">
        <RichTextEditor
          ref={editorRef}
          value={initialHtml}
          plainTextFallback={text}
          color={color}
          fontSize={fontSize}
          fontFamily={fontFamily}
          textAlign={textAlign}
          onChange={handleChange}
          showToolbar={false}
          onFontSizeChange={handleFontSizeChange}
          onFontFamilyChange={handleFontFamilyChange}
          onColorChange={handleColorChange}
          onTextAlignChange={handleTextAlignChange}
          className="nodrag"
        />
      </div>
    </div>
  );
}

// Простая функция для экранирования HTML
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
