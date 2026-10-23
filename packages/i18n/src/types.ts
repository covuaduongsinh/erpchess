import type { vi } from './locales/vi';

type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };

/** Cấu trúc từ điển: lấy tiếng Việt làm chuẩn, mọi ngôn ngữ khác phải đủ khoá. */
export type Resource = DeepString<typeof vi>;

type Join<K extends string, P extends string> = `${K}.${P}`;

/** Mọi khoá dịch dạng "nhom.khoa". */
export type TranslationKey = {
  [K in keyof Resource & string]: Resource[K] extends string
    ? K
    : Join<K, keyof Resource[K] & string>;
}[keyof Resource & string];
