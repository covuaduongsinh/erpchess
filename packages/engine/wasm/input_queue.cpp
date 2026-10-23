// Thay thế vendor/arasan/src/input.cpp cho bản WebAssembly (và module mobile):
// engine đọc lệnh từ một hàng đợi trong bộ nhớ thay vì stdin. JS (hoặc native host) đẩy lệnh
// qua erp_send(). Giữ nguyên interface Input trong input.h nên không phải sửa protocol.cpp.
//
// Ngữ nghĩa giống bản gốc:
//  - readInput: chặn tới khi có ít nhất một lệnh (gọi từ vòng lặp Protocol::poll).
//  - checkInput: không chặn, gọi trong lúc tìm kiếm để nhận "stop"/"quit"...
// Engine chạy trên pthread riêng (-sPROXY_TO_PTHREAD) nên được phép chặn.

#include "input.h"

#include <condition_variable>
#include <deque>
#include <mutex>
#include <string>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define ERP_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define ERP_EXPORT
#endif

namespace {

std::mutex queueMtx;
std::condition_variable queueCv;
std::deque<std::string> queue;

// Tách chuỗi theo CR/LF, bỏ dòng rỗng (như processCmdChars của bản gốc).
void enqueueLines(const char *text) {
    std::string line;
    std::unique_lock<std::mutex> lock(queueMtx);
    for (const char *p = text; *p; ++p) {
        if (*p == '\r' || *p == '\n') {
            if (!line.empty()) queue.push_back(std::move(line));
            line.clear();
        } else {
            line += *p;
        }
    }
    if (!line.empty()) queue.push_back(std::move(line));
    lock.unlock();
    queueCv.notify_all();
}

// Chuyển toàn bộ lệnh đang chờ sang danh sách của Protocol. Gọi khi đang giữ queueMtx.
void drainTo(std::vector<std::string> &cmds, std::mutex &mtx) {
    std::unique_lock<std::mutex> lock(mtx);
    while (!queue.empty()) {
        cmds.push_back(std::move(queue.front()));
        queue.pop_front();
    }
}

} // namespace

extern "C" ERP_EXPORT void erp_send(const char *text) {
    if (text) enqueueLines(text);
}

Input::Input() : buf_index(0) {}

bool Input::checkInput(std::vector<std::string> &cmds, std::mutex &mtx) {
    std::unique_lock<std::mutex> lock(queueMtx);
    if (queue.empty()) return false;
    drainTo(cmds, mtx);
    return true;
}

bool Input::readInput(std::vector<std::string> &cmds, std::mutex &mtx) {
    std::unique_lock<std::mutex> lock(queueMtx);
    queueCv.wait(lock, [] { return !queue.empty(); });
    drainTo(cmds, mtx);
    return true;
}
