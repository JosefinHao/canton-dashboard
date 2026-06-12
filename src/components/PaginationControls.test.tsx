import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaginationControls } from './PaginationControls';

describe('PaginationControls', () => {
  const defaultProps = {
    currentPage: 1,
    totalItems: 100,
    pageSize: 10,
    onPageChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders previous and next buttons', () => {
    const { container } = render(<PaginationControls {...defaultProps} />);
    expect(container.textContent).toContain('Previous');
    expect(container.textContent).toContain('Next');
  });

  it('displays correct page count', () => {
    const { container } = render(<PaginationControls {...defaultProps} />);
    expect(container.textContent).toContain('1 / 10');
  });

  it('displays showing range', () => {
    const { container } = render(<PaginationControls {...defaultProps} />);
    expect(container.textContent).toContain('Showing 1–10 of 100');
  });

  it('returns null when only 1 page', () => {
    const { container } = render(<PaginationControls {...defaultProps} totalItems={5} />);
    expect(container.innerHTML).toBe('');
  });

  it('disables Previous button on first page', () => {
    const { container } = render(<PaginationControls {...defaultProps} currentPage={1} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].disabled).toBe(true);
  });

  it('disables Next button on last page', () => {
    const { container } = render(<PaginationControls {...defaultProps} currentPage={10} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons[1].disabled).toBe(true);
  });

  it('calls onPageChange with previous page when clicking Previous', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { container } = render(
      <PaginationControls {...defaultProps} currentPage={5} onPageChange={onPageChange} />
    );
    const buttons = container.querySelectorAll('button');
    await user.click(buttons[0]);
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('calls onPageChange with next page when clicking Next', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { container } = render(
      <PaginationControls {...defaultProps} currentPage={5} onPageChange={onPageChange} />
    );
    const buttons = container.querySelectorAll('button');
    await user.click(buttons[1]);
    expect(onPageChange).toHaveBeenCalledWith(6);
  });
});
