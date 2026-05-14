/**
 * Providers - Bọc toàn bộ ứng dụng để cung cấp các thư viện global
 * 
 * Tác dụng:
 * - React Query (tanstack/react-query): Quản lý việc lấy dữ liệu từ API
 *   giúp cache data, revalidate, loading states, error handling tự động
 * 
 * 'use client' bắt buộc: Thành phần này chạy ở phía trình duyệt (client-side)
 */

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Thành phần Providers:
 * - Bọc quanh toàn bộ ứng dụng (children)
 * - Cung cấp QueryClient để các component con có thể dùng React Query hooks
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  /**
   * Tạo QueryClient chỉ MỘT LẦN khi component mount
   * useState đảm bảo instance được giữ nguyên qua các lần re-render
   * Nếu không dùng useState, mỗi lần render sẽ tạo QueryClient mới → mất data
   */
  const [queryClient] = useState(() => new QueryClient());

  return (
    // QueryClientProvider cung cấp queryClient cho tất cả component con
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}