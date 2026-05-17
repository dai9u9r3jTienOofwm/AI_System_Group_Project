# Technical RepoRAG: Hệ thống hỗ trợ tra cứu Tài liệu Kỹ thuật & Lab

## Tổng quan dự án
Dự án này hướng đến việc xây dựng một hệ thống Retrieval-Augmented Generation (RAG) chuyên sâu cho lĩnh vực kỹ thuật và công nghệ. Hệ thống tập trung vào một tập dữ liệu có độ chính xác cao và giàu tính chuyên môn, chẳng hạn như tài liệu chính thức về Docker, Kubernetes, hoặc các học phần khó trong kiến trúc máy tính và hệ điều hành.

Mục tiêu chính của dự án là hỗ trợ người học và lập trình viên tra cứu, phân tích và giải quyết các vấn đề kỹ thuật phức tạp trong khi thực hiện dự án. Hệ thống có thể được sử dụng để giải thích lỗi cấu hình hệ thống, hướng dẫn xử lý sự cố khi làm việc với container hoặc cluster, cũng như phân tích các đoạn mã Assembly, C, hoặc các ví dụ kỹ thuật khó hiểu.

## Nguồn dữ liệu

Dữ liệu đầu vào của hệ thống bao gồm:

Documentation chính thức từ các công nghệ hoặc môn học được chọn
Các bài Lab thực hành
Mã nguồn mẫu
Code snippets và ví dụ cấu hình
Tài liệu Markdown có cấu trúc

Việc sử dụng nguồn dữ liệu chính thống giúp hệ thống đưa ra câu trả lời có độ tin cậy cao, giảm tình trạng trả lời sai hoặc suy diễn không có căn cứ.
## Thiết lập và cài đặt
Sau khi pull dự án về:
### Bước 1: Thiết lập .env qua khung mẫu được cho sẵn 
```bash
cp .env_example .env
```

### Bước 2: Khởi động dự án bằng Docker
```bash
docker compose up --build
```

### Bước 3: Truy cập các dịch vụ và ứng dụng

Sau khi toàn bộ hệ thống container khởi động thành công và log hiển thị trạng thái kết nối Database báo xanh, bạn có thể truy cập các thành phần của hệ thống Technical RAG thông qua các đường dẫn local dưới đây:

#### 1. Các ứng dụng giao diện (Frontend)
* **Trang dành cho Người dùng cuối (`client-web`)**:
    * **Đường dẫn:** `http://localhost:3000`
    * **Chức năng:** Giao diện tối giản, tập trung phục vụ người dùng thường tra cứu, tải lên tài liệu RAG cá nhân và tham gia các phiên chat hỏi đáp thông minh với AI.
* **Trang dành cho Quản trị viên (`admin-dashboard`)**:
    * **Đường dẫn:** `http://localhost:3001`
    * **Chức năng:** Giao diện tối cao độc quyền dành cho Admin. Hỗ trợ giám sát toàn bộ danh bạ thành viên, theo dõi tiến độ xử lý tác vụ nền (`ingestion pipeline`) và quản lý kho tri thức chung của hệ thống.

#### 2. Hệ thống kiểm soát và Cơ sở dữ liệu (Backend & DB Infrastructure)
* **Tài liệu tương tác API (`FastAPI Swagger UI`)**:
    * **Đường dẫn:** `http://localhost:8000/docs`
    * **Chức năng:** Bản đồ endpoint của hệ thống, cho phép các thành viên trong nhóm test nhanh các API đăng nhập, upload hoặc CRUD tài khoản trực tiếp qua giao diện UI trực quan.
* **Trình quản lý tệp tin tập trung (`MinIO Object Storage Console`)**:
    * **Đường dẫn:** `http://localhost:9001`
    * **Chức năng:** Quản lý kho lưu trữ tệp tin thô. Sử dụng tài khoản đăng nhập cấu hình trong file `.env` (`MINIO_ACCESS_KEY` & `MINIO_SECRET_KEY`) để kiểm tra các file tài liệu đã được nạp thành công vào bucket `rag-documents` hay chưa.
* **Bảng điều khiển cơ sở dữ liệu vector (`Qdrant Dashboard`)**:
    * **Đường dẫn:** `http://localhost:6333/dashboard`
    * **Chức năng:** Giám sát không gian lưu trữ các `collections` vector. Giúp kiểm tra số lượng các điểm vector embeddings mà Celery Worker đã băm nhỏ và index thành công từ file tài liệu gốc.

---

### Lưu ý quan trọng cho các thành viên phát triển:
1. Tuyệt đối không thay đổi trực tiếp cấu hình cổng (`ports`) trong file `docker-compose.yml` để tránh làm lệch pha kết nối mạng nội bộ giữa Next.js và FastAPI Backend.
2. Khi thực hiện đăng xuất trên bất kỳ cổng giao diện nào (3000 hoặc 3001), hệ thống sẽ tự động quét sạch cookie và phiên đăng nhập, hãy đảm bảo bạn quay lại đúng trang đăng nhập phù hợp với quyền hạn tài khoản của mình.

## Kiến trúc hệ thống

```mermaid
graph TD
    User((Người dùng)) -->|Hỏi| LB[Nginx Load Balancer]
    Admin((Quản trị)) -->|Upload| LB
    LB -->|Routing| FE[Next.js Frontend]
    FE -->|API Call| BE[FastAPI Backend]
    BE -->|Lưu file| S3[MinIO Object Storage]
    BE -->|Truy xuất| VDB[Qdrant Vector DB]
    BE -->|Hàng đợi| RD[Redis Queue]
    RD -->|Xử lý| WK[Celery Worker]
    WK -->|Embedding| LLM((AI Model))
``` 
## Đánh giá hệ thống

## Công nghệ được sử dụng

| Thành phần       | Công nghệ                                     |
| ---------------- | --------------------------------------------- |
| Language         | Python 3.13                                   |
| Framework        | FastAPI (Backend), Next.js (Frontend)         |
| AI Orchestration | LangChain                                     |
| Vector DB        | Qdrant |
| Storage          | MinIO (Object Storage), PostgreSQL (Metadata) |
| Infrastructure   | Docker, Nginx, Redis                          |

## Cấu trúc thư mục
- apps/api-server: Backend xử lý logic RAG.

- apps/client-web: Giao diện người dùng kiểu Gemini.

- services/ingestion: Worker xử lý file ngầm.

- infra/: Cấu hình Docker, Nginx và scripts khởi tạo DB.

## Thành viên thực hiện