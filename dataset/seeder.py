import os
import time
import mimetypes
import requests

# ==========================================
# CẤU HÌNH HỆ THỐNG
# ==========================================
API_URL = os.getenv("SEED_UPLOAD_URL", "http://backend:8000/v1/admin/upload")
BACKEND_HEALTH_URL = os.getenv("BACKEND_HEALTH_URL", "http://backend:8000/")

# Danh sách 4 file nguồn đại diện cho 4 định dạng khác nhau
# Lưu ý: phải đúng chính xác tên file trong thư mục seed_data
SEED_FILES = [
    "docker.txt",
    "knowledge1.md",
    "knowledge2.txt",        
    "docker_compose.yml",
]

EXPECTED_TOPIC_HINT = {
    "docker.txt": "DevOps Deployment Guides",
    "docker_compose.yml": "Infrastructure as Code",
    "knowledge1.md": "Low-Level & Assembly",
    "knowledge2.txt": "General Python Programming",
}


def wait_for_backend() -> bool:
    """Chờ backend khởi động xong."""
    print("⏳ Đang đợi Backend khởi động và sẵn sàng nhận request...")

    max_retries = 30

    for i in range(max_retries):
        try:
            response = requests.get(BACKEND_HEALTH_URL, timeout=5)

            # Chỉ cần backend trả response là coi như sống
            if response.status_code < 500:
                print("✅ Backend đã online!")
                return True

            print(
                f"[{i + 1}/{max_retries}] Backend trả {response.status_code}, chờ thêm 3s..."
            )

        except requests.exceptions.RequestException:
            print(f"[{i + 1}/{max_retries}] Backend chưa sẵn sàng, chờ thêm 3s...")

        time.sleep(3)

    print("❌ Quá thời gian chờ Backend. Hủy quá trình Seeding.")
    return False


def validate_seed_files(current_dir: str) -> list[str]:
    """Kiểm tra đủ file trước khi upload."""
    existing_files: list[str] = []
    missing_files: list[str] = []

    for filename in SEED_FILES:
        filepath = os.path.join(current_dir, filename)

        if os.path.exists(filepath):
            existing_files.append(filename)
        else:
            missing_files.append(filename)

    if missing_files:
        print("⚠️ Một số file seed không tồn tại:")
        for filename in missing_files:
            print(f"   - {filename}")

    print(f"📦 Số file hợp lệ sẽ upload: {len(existing_files)}/{len(SEED_FILES)}")

    return existing_files


def upload_one_file(filename: str, current_dir: str, cookies: dict[str, str]) -> bool:
    filepath = os.path.join(current_dir, filename)
    content_type = mimetypes.guess_type(filepath)[0] or "application/octet-stream"

    print("--------------------------------------------------")
    print(f"🚀 Đang tải lên: {filename}")
    print(f"   Expected topic hint: {EXPECTED_TOPIC_HINT.get(filename, 'N/A')}")

    try:
        with open(filepath, "rb") as f:
            files = {
                "file": (
                    filename,
                    f,
                    content_type,
                )
            }

            # Không gửi topic.
            # Backend + LLM sẽ tự phân loại topic theo nội dung file.
            response = requests.post(
                API_URL,
                files=files,
                cookies=cookies,
                timeout=120,
            )

        if response.status_code in (200, 201, 202):
            print(f"✅ Upload thành công: {filename}")
            print(f"   HTTP {response.status_code}: {response.text[:300]}")
            return True

        print(f"❌ Upload thất bại: {filename}")
        print(f"   HTTP {response.status_code}: {response.text}")
        return False

    except requests.exceptions.RequestException as exc:
        print(f"🔥 Lỗi request khi upload {filename}: {exc}")
        return False

    except Exception as exc:
        print(f"🔥 Lỗi không xác định khi upload {filename}: {exc}")
        return False


def upload_seed_data() -> None:
    """Giả lập admin gọi API upload seed data."""
    cookies = {
        "userId": "admin_seeder",
    }

    current_dir = os.path.dirname(os.path.abspath(__file__))

    valid_files = validate_seed_files(current_dir)

    if not valid_files:
        print("❌ Không có file seed hợp lệ để upload.")
        return

    success_count = 0
    failed_count = 0

    for filename in valid_files:
        ok = upload_one_file(filename, current_dir, cookies)

        if ok:
            success_count += 1
        else:
            failed_count += 1

        # Nghỉ nhẹ để tránh nhiều worker/task tạo collection cùng lúc
        time.sleep(2)

    print("--------------------------------------------------")
    print("📊 Kết quả seeding:")
    print(f"   ✅ Thành công: {success_count}")
    print(f"   ❌ Thất bại: {failed_count}")
    print(f"   📦 Tổng file hợp lệ: {len(valid_files)}")


if __name__ == "__main__":
    print("========================================")
    print("🌱 BẮT ĐẦU QUÁ TRÌNH SEED DỮ LIỆU TỰ ĐỘNG")
    print("========================================")

    if wait_for_backend():
        # Đợi thêm một chút cho database/vector db sẵn sàng
        time.sleep(5)
        upload_seed_data()

    print("========================================")
    print("🎉 KẾT THÚC SEEDING!")
    print("========================================")