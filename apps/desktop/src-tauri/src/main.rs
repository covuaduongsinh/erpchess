// Ẩn cửa sổ console trên Windows ở bản release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    erpchess_desktop_lib::run()
}
