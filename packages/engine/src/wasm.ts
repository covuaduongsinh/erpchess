/**
 * Transport cho bản Arasan biên dịch bằng Emscripten (packages/engine/wasm/build.sh).
 * Dùng được trong Web Worker và Node: nạp module, ghi file NNUE vào FS ảo, chạy main()
 * trên pthread riêng, rồi đẩy lệnh qua erp_send (hàng đợi trong input_queue.cpp).
 */
import type { UciTransport } from './engine';

/** Phần của module Emscripten mà transport cần (MODULARIZE + EXPORTED_RUNTIME_METHODS). */
export type ArasanModule = {
  FS: { writeFile(path: string, data: Uint8Array): void };
  callMain(args: string[]): void;
  ccall(name: string, returnType: null, argTypes: ['string'], args: [string]): void;
};

export type ArasanFactory = (options: {
  print: (line: string) => void;
  printErr: (line: string) => void;
  locateFile?: (path: string, prefix: string) => string;
}) => Promise<ArasanModule>;

export type WasmTransportOptions = {
  factory: ArasanFactory;
  /** Nội dung file NNUE. */
  network: Uint8Array;
  /** Tên file NNUE; ghi vào thư mục gốc FS ảo, nơi Arasan tìm theo tên mặc định. */
  networkName: string;
  /** Cho Web Worker biết URL file .wasm/.worker (mặc định cạnh file .mjs). */
  locateFile?: (path: string, prefix: string) => string;
  onError?: (line: string) => void;
};

export async function createWasmTransport({
  factory,
  network,
  networkName,
  locateFile,
  onError,
}: WasmTransportOptions): Promise<UciTransport> {
  const listeners = new Set<(line: string) => void>();
  const module = await factory({
    print: (line) => {
      for (const l of listeners) l(line);
    },
    printErr: (line) => onError?.(line),
    locateFile,
  });
  module.FS.writeFile(`/${networkName}`, network);
  module.callMain([]);

  let closed = false;
  return {
    send: (command) => {
      if (!closed) module.ccall('erp_send', null, ['string'], [command]);
    },
    onLine: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => {
      closed = true;
      listeners.clear();
    },
  };
}
