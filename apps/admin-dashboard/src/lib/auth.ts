/**
 * Auth Helper - Quản lý việc xác thực và lưu trữ token (JWT)
 * 
 * Tác dụng:
 * - Tạo và xác thực JWT token (mã token dùng để xác nhận danh tính người dùng)
 * - Lưu/lấy token từ Cookie (đây là nơi an toàn để lưu token)
 * - Giải mã token để lấy thông tin người dùng
 */

import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

// Chìa khóa bí mật dùng để tạo/xác thực token (tuyệt đối không công khai!)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
// Token sẽ hết hạn sau 24 giờ
const TOKEN_EXPIRY = '24h';

/**
 * Interface (cấu trúc) của dữ liệu bên trong token JWT
 * Chứa thông tin cơ bản về người dùng
 */
export interface AuthPayload {
  userId: string;   // ID duy nhất của người dùng
  email: string;    // Email của người dùng
  role: string;     // Vai trò (admin, user, etc.)
}

/**
 * Tạo token JWT từ thông tin người dùng
 * Token này được gửi lại cho client và dùng để xác thực các request tiếp theo
 */
export const generateToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
};

/**
 * Xác thực token JWT - kiểm tra xem token có hợp lệ không
 * Trả về thông tin người dùng nếu hợp lệ, hoặc null nếu không
 */
export const verifyToken = (token: string): AuthPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);  // Giải mã token bằng chìa khóa bí mật
    return decoded as AuthPayload;  // Trả về dữ liệu bên trong token
  } catch {
    return null;  // Nếu có lỗi, token không hợp lệ
  }
};

/**
 * Lấy token từ Cookie của trình duyệt
 * Dùng khi cần kiểm tra người dùng đã đăng nhập chưa
 */
export const getToken = async (): Promise<string | null> => {
  const cookieStore = await cookies();  // Lấy đối tượng quản lý cookie
  return cookieStore.get('authToken')?.value || null;  // Trả về token hoặc null nếu không có
};

/**
 * Lưu token vào Cookie của trình duyệt
 * Dùng sau khi người dùng đăng nhập thành công
 */
export const setToken = async (token: string) => {
  const cookieStore = await cookies();
  cookieStore.set('authToken', token, {
    httpOnly: true,  // Chỉ server có thể đọc cookie này (bảo mật)
    secure: process.env.NODE_ENV === 'production',  // Chỉ gửi qua HTTPS ở production
    sameSite: 'lax',  // Chống tấn công CSRF
    maxAge: 24 * 60 * 60,  // Token hết hạn sau 24 giờ (tính theo giây)
  });
};