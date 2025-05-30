const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Thêm module fs để kiểm tra và tạo thư mục

// --- Cấu hình Multer ---

// Xác định thư mục lưu trữ và tên file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', 'assets', 'images'); // Đường dẫn tới assets/images từ thư mục routes

        // Kiểm tra xem thư mục assets/images có tồn tại không, nếu không thì tạo nó
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true }); // recursive: true để tạo cả thư mục cha nếu chưa có
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Tạo tên file duy nhất để tránh ghi đè
        // Ví dụ: fieldname-timestamp.extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        // Hoặc giữ tên file gốc (cẩn thận với việc trùng tên):
        // cb(null, file.originalname);
    }
});

// (Tùy chọn) Bộ lọc file để chỉ chấp nhận các định dạng ảnh nhất định
const imageFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) { // Kiểm tra xem có phải là kiểu 'image/*' không
        cb(null, true);
    } else {
        cb(new Error('Chỉ cho phép tải lên tệp ảnh!'), false);
    }
};

// Khởi tạo middleware upload của Multer
const upload = multer({
    storage: storage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: 1024 * 1024 * 5 // Giới hạn kích thước file là 5MB (ví dụ)
    }
});

// --- Route xử lý upload ảnh ---
// Giả sử field name trong form-data gửi lên là 'avatar'
router.post('/upload-avatar', upload.single('avatar'), (req, res) => {
    // upload.single('avatar') sẽ tìm file có field name là 'avatar' trong request
    // Thông tin file đã upload sẽ có trong req.file

    if (!req.file) {
        return res.status(400).json({ message: 'Không có tệp nào được tải lên hoặc tệp không hợp lệ.' });
    }

    // Tại đây, req.file chứa thông tin về file đã được lưu
    // Ví dụ: req.file.path (đường dẫn đầy đủ tới file trên server)
    //        req.file.filename (tên file đã được lưu trong assets/images)

    // Tạo đường dẫn URL để truy cập ảnh (nếu bạn đã cấu hình static serving cho 'assets')
    // Giả sử bạn không dùng tiền tố ảo '/static' cho thư mục 'assets'
    const imageUrl = `/images/${req.file.filename}`;
    // Nếu bạn dùng tiền tố ảo '/static' (app.use('/static', express.static('assets'))), thì:
    // const imageUrl = `/static/images/${req.file.filename}`;

    // Bạn có thể lưu imageUrl này vào database của user, v.v.
    res.status(200).json({
        message: 'Tải ảnh lên thành công!',
        filePath: req.file.path, // Đường dẫn vật lý trên server
        imageUrl: imageUrl       // URL để truy cập ảnh qua web
    });
}, (error, req, res, next) => {
    // Middleware xử lý lỗi từ Multer (ví dụ: file quá lớn, sai định dạng)
    if (error instanceof multer.MulterError) {
        // Một lỗi từ Multer đã xảy ra khi upload.
        return res.status(400).json({ message: error.message });
    } else if (error) {
        // Một lỗi không xác định đã xảy ra.
        return res.status(500).json({ message: error.message });
    }
    // Mọi thứ diễn ra bình thường, chuyển sang middleware tiếp theo nếu có
    next();
});

// Các routes khác của user...
// Ví dụ:
// router.get('/', (req, res) => { ... });

module.exports = router;