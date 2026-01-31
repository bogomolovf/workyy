import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TextNode } from '../TextNode';

// Мокируем RichTextEditor с ref для тестирования автофокуса
const mockFocus = vi.fn();
const mockSaveSelection = vi.fn();
const mockRestoreSelection = vi.fn();
const mockEditorRef = {
  focus: mockFocus,
  saveSelection: mockSaveSelection,
  restoreSelection: mockRestoreSelection,
  toggleBold: vi.fn(),
  toggleItalic: vi.fn(),
  toggleUnderline: vi.fn(),
  toggleBulletList: vi.fn(),
  toggleOrderedList: vi.fn(),
  toggleLink: vi.fn(),
  toggleHighlight: vi.fn(),
  isBold: vi.fn(() => false),
  isItalic: vi.fn(() => false),
  isUnderline: vi.fn(() => false),
  isBulletList: vi.fn(() => false),
  isOrderedList: vi.fn(() => false),
  isLink: vi.fn(() => false),
  isHighlight: vi.fn(() => false),
  getEditor: vi.fn(),
};

vi.mock('../RichTextEditor', () => ({
  RichTextEditor: vi.fn().mockImplementation(({ value, onChange, ref }) => {
    // Передаем ref в mockEditorRef
    if (ref && typeof ref === 'object' && 'current' in ref) {
      ref.current = mockEditorRef;
    }
    return (
      <div data-testid="rich-text-editor">
        <textarea
          data-testid="editor-textarea"
          value={value}
          onChange={(e) => onChange?.({ html: e.target.value, text: e.target.value })}
        />
      </div>
    );
  }),
}));

// Мокируем TextToolbar
vi.mock('../TextToolbar', () => ({
  TextToolbar: vi.fn(() => <div data-testid="text-toolbar">Toolbar</div>),
}));

describe('TextNode', () => {
  let mockData: NodeProps<{
    nodeId: string;
    nodeType: 'text';
    text: string;
    fontSize: number;
    fontFamily: string;
    color: string;
    textAlign: 'left' | 'center' | 'right';
    richContentHtml?: string | null;
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
  }>['data'];

  let mockOnChangeText: ReturnType<typeof vi.fn>;
  let mockOnChangeFormat: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChangeText = vi.fn();
    mockOnChangeFormat = vi.fn();
    // Сбрасываем моки перед каждым тестом
    mockFocus.mockClear();
    mockSaveSelection.mockClear();
    mockRestoreSelection.mockClear();

    mockData = {
      nodeId: 'test-node-1',
      nodeType: 'text' as const,
      text: 'Test text',
      fontSize: 18,
      fontFamily: 'Noto Sans, sans-serif',
      color: '#CF4C2C',
      textAlign: 'left' as const,
      richContentHtml: null,
      onChangeText: mockOnChangeText,
      onChangeFormat: mockOnChangeFormat,
    };
  });

  it('renders TextNode with default values', () => {
    render(
      <ReactFlowProvider>
        <TextNode id="test-node-1" data={mockData} selected={false} width={240} height={80} />
      </ReactFlowProvider>,
    );

    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });

  it('shows toolbar when node is selected', () => {
    render(
      <ReactFlowProvider>
        <TextNode id="test-node-1" data={mockData} selected={true} width={240} height={80} />
      </ReactFlowProvider>,
    );

    expect(screen.getByTestId('text-toolbar')).toBeInTheDocument();
  });

  it('does not show toolbar when node is not selected', () => {
    render(
      <ReactFlowProvider>
        <TextNode id="test-node-1" data={mockData} selected={false} width={240} height={80} />
      </ReactFlowProvider>,
    );

    expect(screen.queryByTestId('text-toolbar')).not.toBeInTheDocument();
  });

  it('calls onChangeText when text is changed', async () => {
    render(
      <ReactFlowProvider>
        <TextNode id="test-node-1" data={mockData} selected={false} width={240} height={80} />
      </ReactFlowProvider>,
    );

    const textarea = screen.getByTestId('editor-textarea');
    fireEvent.change(textarea, { target: { value: 'New text' } });

    await waitFor(() => {
      expect(mockOnChangeText).toHaveBeenCalledWith('test-node-1', 'New text');
    });
  });

  it('uses default font family when not provided', () => {
    const dataWithoutFont = {
      ...mockData,
      fontFamily: undefined as unknown as string,
    };

    render(
      <ReactFlowProvider>
        <TextNode
          id="test-node-1"
          data={dataWithoutFont}
          selected={false}
          width={240}
          height={80}
        />
      </ReactFlowProvider>,
    );

    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });

  it('automatically focuses editor when node is empty and selected (Miro-like behavior)', async () => {
    const emptyData = {
      ...mockData,
      text: '',
      richContentHtml: null,
    };

    render(
      <ReactFlowProvider>
        <TextNode id="test-node-1" data={emptyData} selected={true} width={240} height={80} />
      </ReactFlowProvider>,
    );

    // Ждем автофокуса через requestAnimationFrame
    await waitFor(
      () => {
        expect(mockFocus).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });

  it('does not auto-focus when node has text', async () => {
    render(
      <ReactFlowProvider>
        <TextNode id="test-node-1" data={mockData} selected={true} width={240} height={80} />
      </ReactFlowProvider>,
    );

    // Даем время на выполнение эффектов
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Фокус не должен быть вызван для узла с текстом
    expect(mockFocus).not.toHaveBeenCalled();
  });

  it('does not auto-focus when node is not selected', async () => {
    const emptyData = {
      ...mockData,
      text: '',
      richContentHtml: null,
    };

    render(
      <ReactFlowProvider>
        <TextNode id="test-node-1" data={emptyData} selected={false} width={240} height={80} />
      </ReactFlowProvider>,
    );

    // Даем время на выполнение эффектов
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Фокус не должен быть вызван для невыделенного узла
    expect(mockFocus).not.toHaveBeenCalled();
  });

  it('deletes empty node when it loses selection (Miro-like behavior)', async () => {
    const mockOnDeleteNode = vi.fn();
    const emptyData = {
      ...mockData,
      text: '',
      richContentHtml: null,
      onDeleteNode: mockOnDeleteNode,
    };

    const { rerender } = render(
      <ReactFlowProvider>
        <TextNode id="test-node-1" data={emptyData} selected={true} width={240} height={80} />
      </ReactFlowProvider>,
    );

    // Сначала узел selected
    expect(mockOnDeleteNode).not.toHaveBeenCalled();

    // Теперь узел теряет выделение (selected становится false)
    rerender(
      <ReactFlowProvider>
        <TextNode id="test-node-1" data={emptyData} selected={false} width={240} height={80} />
      </ReactFlowProvider>,
    );

    // Ждем удаления (с задержкой 100ms)
    await waitFor(
      () => {
        expect(mockOnDeleteNode).toHaveBeenCalledWith('test-node-1');
      },
      { timeout: 200 },
    );
  });

  it('does not delete node with text when it loses selection', async () => {
    const mockOnDeleteNode = vi.fn();
    const dataWithText = {
      ...mockData,
      text: 'Some text',
      onDeleteNode: mockOnDeleteNode,
    };

    const { rerender } = render(
      <ReactFlowProvider>
        <TextNode id="test-node-1" data={dataWithText} selected={true} width={240} height={80} />
      </ReactFlowProvider>,
    );

    // Узел теряет выделение
    rerender(
      <ReactFlowProvider>
        <TextNode id="test-node-1" data={dataWithText} selected={false} width={240} height={80} />
      </ReactFlowProvider>,
    );

    // Даем время на выполнение эффектов
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Узел с текстом не должен быть удален
    expect(mockOnDeleteNode).not.toHaveBeenCalled();
  });

  it('does not delete node if onDeleteNode is not provided', async () => {
    const emptyData = {
      ...mockData,
      text: '',
      richContentHtml: null,
      // onDeleteNode не предоставлен
    };

    const { rerender } = render(
      <ReactFlowProvider>
        <TextNode id="test-node-1" data={emptyData} selected={true} width={240} height={80} />
      </ReactFlowProvider>,
    );

    // Узел теряет выделение
    rerender(
      <ReactFlowProvider>
        <TextNode id="test-node-1" data={emptyData} selected={false} width={240} height={80} />
      </ReactFlowProvider>,
    );

    // Даем время на выполнение эффектов
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Не должно быть ошибок, даже если onDeleteNode не предоставлен
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });
});
