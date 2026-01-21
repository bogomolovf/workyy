import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RichTextEditorRef } from '../RichTextEditor';
import { TextToolbar } from '../TextToolbar';

// Мокируем @phosphor-icons/react
vi.mock('@phosphor-icons/react', () => ({
  CaretUp: () => <span data-testid="caret-up">↑</span>,
  CaretDown: () => <span data-testid="caret-down">↓</span>,
  ListBullets: ({ weight }: { weight?: string }) => (
    <span data-testid="list-bullets" data-weight={weight}>
      •
    </span>
  ),
  Link: ({ weight }: { weight?: string }) => (
    <span data-testid="link-icon" data-weight={weight}>
      🔗
    </span>
  ),
}));

describe('TextToolbar', () => {
  let mockEditorRef: React.RefObject<RichTextEditorRef>;
  let mockOnFontSizeChange: ReturnType<typeof vi.fn>;
  let mockOnFontFamilyChange: ReturnType<typeof vi.fn>;
  let mockOnColorChange: ReturnType<typeof vi.fn>;
  let mockOnTextAlignChange: ReturnType<typeof vi.fn>;
  let mockOnInteractionStart: ReturnType<typeof vi.fn>;
  let mockOnInteractionEnd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnFontSizeChange = vi.fn();
    mockOnFontFamilyChange = vi.fn();
    mockOnColorChange = vi.fn();
    mockOnTextAlignChange = vi.fn();
    mockOnInteractionStart = vi.fn();
    mockOnInteractionEnd = vi.fn();

    mockEditorRef = {
      current: {
        isBold: () => false,
        isItalic: () => false,
        isUnderline: () => false,
        isBulletList: () => false,
        isOrderedList: () => false,
        isLink: () => false,
        isHighlight: () => false,
        toggleBold: vi.fn(),
        toggleItalic: vi.fn(),
        toggleUnderline: vi.fn(),
        toggleBulletList: vi.fn(),
        toggleOrderedList: vi.fn(),
        toggleLink: vi.fn(),
        toggleHighlight: vi.fn(),
        saveSelection: vi.fn(),
        restoreSelection: vi.fn(),
        focus: vi.fn(),
        getEditor: () => null,
      },
    } as React.RefObject<RichTextEditorRef>;
  });

  it('renders all toolbar elements', () => {
    render(
      <ReactFlowProvider>
        <TextToolbar
          fontSize={18}
          fontFamily="Noto Sans, sans-serif"
          activeColor="#CF4C2C"
          textAlign="left"
          editorRef={mockEditorRef}
          onFontSizeChange={mockOnFontSizeChange}
          onFontFamilyChange={mockOnFontFamilyChange}
          onColorChange={mockOnColorChange}
          onTextAlignChange={mockOnTextAlignChange}
          onInteractionStart={mockOnInteractionStart}
          onInteractionEnd={mockOnInteractionEnd}
        />
      </ReactFlowProvider>,
    );

    // Проверяем наличие основных элементов
    expect(screen.getByTitle('Text mode')).toBeInTheDocument();
    expect(screen.getByTitle('Bold')).toBeInTheDocument();
    expect(screen.getByTitle('Italic')).toBeInTheDocument();
    expect(screen.getByTitle('Underline')).toBeInTheDocument();
    expect(screen.getByTitle('Align left')).toBeInTheDocument();
    expect(screen.getByTitle('Align center')).toBeInTheDocument();
    expect(screen.getByTitle('Align right')).toBeInTheDocument();
    expect(screen.getByTitle('Bullet list')).toBeInTheDocument();
    expect(screen.getByTitle('Insert link')).toBeInTheDocument();
    expect(screen.getByTitle('Text color')).toBeInTheDocument();
    expect(screen.getByTitle('Highlight text')).toBeInTheDocument();
  });

  it('calls onFontSizeChange when font size is increased', () => {
    render(
      <ReactFlowProvider>
        <TextToolbar
          fontSize={18}
          fontFamily="Noto Sans, sans-serif"
          activeColor="#CF4C2C"
          textAlign="left"
          editorRef={mockEditorRef}
          onFontSizeChange={mockOnFontSizeChange}
          onFontFamilyChange={mockOnFontFamilyChange}
          onColorChange={mockOnColorChange}
          onTextAlignChange={mockOnTextAlignChange}
          onInteractionStart={mockOnInteractionStart}
          onInteractionEnd={mockOnInteractionEnd}
        />
      </ReactFlowProvider>,
    );

    const increaseButton = screen.getByTitle('Increase font size');
    fireEvent.click(increaseButton);

    expect(mockOnFontSizeChange).toHaveBeenCalledWith(20);
    expect(mockOnInteractionEnd).toHaveBeenCalled();
  });

  it('calls onFontSizeChange when font size is decreased', () => {
    render(
      <ReactFlowProvider>
        <TextToolbar
          fontSize={18}
          fontFamily="Noto Sans, sans-serif"
          activeColor="#CF4C2C"
          textAlign="left"
          editorRef={mockEditorRef}
          onFontSizeChange={mockOnFontSizeChange}
          onFontFamilyChange={mockOnFontFamilyChange}
          onColorChange={mockOnColorChange}
          onTextAlignChange={mockOnTextAlignChange}
          onInteractionStart={mockOnInteractionStart}
          onInteractionEnd={mockOnInteractionEnd}
        />
      </ReactFlowProvider>,
    );

    const decreaseButton = screen.getByTitle('Decrease font size');
    fireEvent.click(decreaseButton);

    expect(mockOnFontSizeChange).toHaveBeenCalledWith(16);
    expect(mockOnInteractionEnd).toHaveBeenCalled();
  });

  it('calls onFontFamilyChange when font family is changed', () => {
    render(
      <ReactFlowProvider>
        <TextToolbar
          fontSize={18}
          fontFamily="Noto Sans, sans-serif"
          activeColor="#CF4C2C"
          textAlign="left"
          editorRef={mockEditorRef}
          onFontSizeChange={mockOnFontSizeChange}
          onFontFamilyChange={mockOnFontFamilyChange}
          onColorChange={mockOnColorChange}
          onTextAlignChange={mockOnTextAlignChange}
          onInteractionStart={mockOnInteractionStart}
          onInteractionEnd={mockOnInteractionEnd}
        />
      </ReactFlowProvider>,
    );

    const fontSelect = screen.getByDisplayValue('Noto Sans');
    fireEvent.change(fontSelect, { target: { value: 'Inter, sans-serif' } });

    expect(mockOnFontFamilyChange).toHaveBeenCalledWith('Inter, sans-serif');
    expect(mockOnInteractionEnd).toHaveBeenCalled();
  });

  it('calls toggleBold when bold button is clicked', () => {
    render(
      <ReactFlowProvider>
        <TextToolbar
          fontSize={18}
          fontFamily="Noto Sans, sans-serif"
          activeColor="#CF4C2C"
          textAlign="left"
          editorRef={mockEditorRef}
          onFontSizeChange={mockOnFontSizeChange}
          onFontFamilyChange={mockOnFontFamilyChange}
          onColorChange={mockOnColorChange}
          onTextAlignChange={mockOnTextAlignChange}
          onInteractionStart={mockOnInteractionStart}
          onInteractionEnd={mockOnInteractionEnd}
        />
      </ReactFlowProvider>,
    );

    const boldButton = screen.getByTitle('Bold');
    fireEvent.click(boldButton);

    expect(mockEditorRef.current?.toggleBold).toHaveBeenCalled();
    expect(mockOnInteractionEnd).toHaveBeenCalled();
  });

  it('calls onTextAlignChange when alignment button is clicked', () => {
    render(
      <ReactFlowProvider>
        <TextToolbar
          fontSize={18}
          fontFamily="Noto Sans, sans-serif"
          activeColor="#CF4C2C"
          textAlign="left"
          editorRef={mockEditorRef}
          onFontSizeChange={mockOnFontSizeChange}
          onFontFamilyChange={mockOnFontFamilyChange}
          onColorChange={mockOnColorChange}
          onTextAlignChange={mockOnTextAlignChange}
          onInteractionStart={mockOnInteractionStart}
          onInteractionEnd={mockOnInteractionEnd}
        />
      </ReactFlowProvider>,
    );

    const centerButton = screen.getByTitle('Align center');
    fireEvent.click(centerButton);

    expect(mockOnTextAlignChange).toHaveBeenCalledWith('center');
    expect(mockOnInteractionEnd).toHaveBeenCalled();
  });

  it('calls onInteractionStart when mouse enters toolbar', () => {
    render(
      <ReactFlowProvider>
        <TextToolbar
          fontSize={18}
          fontFamily="Noto Sans, sans-serif"
          activeColor="#CF4C2C"
          textAlign="left"
          editorRef={mockEditorRef}
          onFontSizeChange={mockOnFontSizeChange}
          onFontFamilyChange={mockOnFontFamilyChange}
          onColorChange={mockOnColorChange}
          onTextAlignChange={mockOnTextAlignChange}
          onInteractionStart={mockOnInteractionStart}
          onInteractionEnd={mockOnInteractionEnd}
        />
      </ReactFlowProvider>,
    );

    const toolbar = screen.getByTitle('Text mode').closest('div');
    if (toolbar) {
      fireEvent.mouseEnter(toolbar);
      expect(mockOnInteractionStart).toHaveBeenCalled();
    }
  });
});
