/**
 * Utility Functions - Những hàm tiện ích được dùng lại nhiều nơi
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Hàm cn() - Kết hợp các CSS class name một cách thông minh
 * 
 * Cách dùng:
 * <div className={cn('text-red-500', isError && 'bg-red-100', undefined)}>
 * 
 * Tác dụng:
 * - clsx() loại bỏ các class nếu điều kiện là false hoặc undefined
 * - twMerge() hợp nhất các Tailwind class một cách hợp lý (VD: không để trùng lặp)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Kiểm tra xem ứng dụng đang chạy bên trong một iframe hay không
 * iframe: một trang web được nhúng bên trong trang web khác
 */
export const isIframe = typeof window !== "undefined" && window.self !== window.top;