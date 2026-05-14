import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MessageItem from '@/components/MessageItem';

jest.mock('react-markdown', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>);
jest.mock('remark-gfm', () => () => {});
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: React.ReactNode }) => <pre>{children}</pre>,
}));
jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}));

describe('MessageItem', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      writable: true,
    });
  });

  it('renders user message content', () => {
    render(<MessageItem role="user" content="Câu hỏi của tôi" />);
    expect(screen.getByText('Câu hỏi của tôi')).toBeInTheDocument();
  });

  it('renders assistant message content', () => {
    render(<MessageItem role="assistant" content="Câu trả lời của AI" />);
    expect(screen.getByText('Câu trả lời của AI')).toBeInTheDocument();
  });

  it('shows copy button only for assistant messages', () => {
    const { rerender } = render(<MessageItem role="assistant" content="AI response" />);
    expect(screen.getByTitle('Copy nội dung')).toBeInTheDocument();

    rerender(<MessageItem role="user" content="User message" />);
    expect(screen.queryByTitle('Copy nội dung')).not.toBeInTheDocument();
  });

  it('calls clipboard.writeText with message content when copy is clicked', async () => {
    render(<MessageItem role="assistant" content="Copy this text" />);
    fireEvent.click(screen.getByTitle('Copy nội dung'));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Copy this text');
    });
  });

  it('renders source citations when sources are provided', () => {
    const sources = [
      { fileName: 'document.pdf', pageNumber: 3, snippet: 'Đoạn trích từ tài liệu' },
    ];
    render(<MessageItem role="assistant" content="Answer" sources={sources} />);
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('(Trang 3)')).toBeInTheDocument();
  });

  it('renders multiple sources', () => {
    const sources = [
      { fileName: 'doc1.pdf', pageNumber: 1 },
      { fileName: 'doc2.pdf', pageNumber: 5 },
    ];
    render(<MessageItem role="assistant" content="Answer" sources={sources} />);
    expect(screen.getByText('doc1.pdf')).toBeInTheDocument();
    expect(screen.getByText('doc2.pdf')).toBeInTheDocument();
    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(screen.getByText('[2]')).toBeInTheDocument();
  });

  it('does not render sources section when sources array is empty', () => {
    render(<MessageItem role="assistant" content="Answer" sources={[]} />);
    expect(screen.queryByText('Nguồn tài liệu:')).not.toBeInTheDocument();
  });

  it('does not render sources section for user messages even if sources provided', () => {
    const sources = [{ fileName: 'doc.pdf' }];
    render(<MessageItem role="user" content="Question" sources={sources} />);
    expect(screen.queryByText('Nguồn tài liệu:')).not.toBeInTheDocument();
  });
});
