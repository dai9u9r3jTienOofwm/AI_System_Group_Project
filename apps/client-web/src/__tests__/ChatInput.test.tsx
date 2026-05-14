import { render, screen, fireEvent } from '@testing-library/react';
import ChatInput from '@/components/ChatInput';

describe('ChatInput', () => {
  const mockHandleInputChange = jest.fn();
  const mockHandleSubmit = jest.fn((e: { preventDefault(): void }) => e.preventDefault());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders textarea and submit button', () => {
    render(
      <ChatInput
        input=""
        handleInputChange={mockHandleInputChange}
        handleSubmit={mockHandleSubmit}
        isLoading={false}
      />
    );
    expect(screen.getByPlaceholderText(/Hỏi bất cứ điều gì/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gửi tin nhắn/i })).toBeInTheDocument();
  });

  it('disables submit button when input is empty', () => {
    render(
      <ChatInput
        input=""
        handleInputChange={mockHandleInputChange}
        handleSubmit={mockHandleSubmit}
        isLoading={false}
      />
    );
    expect(screen.getByRole('button', { name: /Gửi tin nhắn/i })).toBeDisabled();
  });

  it('disables submit button when isLoading is true', () => {
    render(
      <ChatInput
        input="hello"
        handleInputChange={mockHandleInputChange}
        handleSubmit={mockHandleSubmit}
        isLoading={true}
      />
    );
    expect(screen.getByRole('button', { name: /Gửi tin nhắn/i })).toBeDisabled();
  });

  it('enables submit button when input has text and not loading', () => {
    render(
      <ChatInput
        input="hello"
        handleInputChange={mockHandleInputChange}
        handleSubmit={mockHandleSubmit}
        isLoading={false}
      />
    );
    expect(screen.getByRole('button', { name: /Gửi tin nhắn/i })).not.toBeDisabled();
  });

  it('calls handleSubmit when form is submitted', () => {
    render(
      <ChatInput
        input="hello"
        handleInputChange={mockHandleInputChange}
        handleSubmit={mockHandleSubmit}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Gửi tin nhắn/i }));
    expect(mockHandleSubmit).toHaveBeenCalledTimes(1);
  });

  it('calls handleInputChange when typing', () => {
    render(
      <ChatInput
        input=""
        handleInputChange={mockHandleInputChange}
        handleSubmit={mockHandleSubmit}
        isLoading={false}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/Hỏi bất cứ điều gì/i), {
      target: { value: 'test message' },
    });
    expect(mockHandleInputChange).toHaveBeenCalledTimes(1);
  });

  it('submits on Enter key when input is not empty', () => {
    render(
      <ChatInput
        input="hello"
        handleInputChange={mockHandleInputChange}
        handleSubmit={mockHandleSubmit}
        isLoading={false}
      />
    );
    fireEvent.keyDown(screen.getByPlaceholderText(/Hỏi bất cứ điều gì/i), {
      key: 'Enter',
      shiftKey: false,
    });
    expect(mockHandleSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit on Shift+Enter', () => {
    render(
      <ChatInput
        input="hello"
        handleInputChange={mockHandleInputChange}
        handleSubmit={mockHandleSubmit}
        isLoading={false}
      />
    );
    fireEvent.keyDown(screen.getByPlaceholderText(/Hỏi bất cứ điều gì/i), {
      key: 'Enter',
      shiftKey: true,
    });
    expect(mockHandleSubmit).not.toHaveBeenCalled();
  });
});
