// Chuyển Storage qua Storage API (không đụng bảng storage.objects bằng SQL, để tệp thật được ghi ở backend mới).
// Chính sách RLS trên storage.objects đến từ các migration (lệnh `schema`), còn bucket được tạo/cập nhật ở đây
// theo cấu hình của instance cũ (public, giới hạn dung lượng, kiểu tệp).

const enc = (path) => path.split('/').map(encodeURIComponent).join('/');

export function storageClient({ baseUrl, serviceKey, fetchImpl = fetch }) {
  const root = `${baseUrl.replace(/\/$/, '')}/storage/v1`;
  const headers = (extra = {}) => ({
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  });
  async function call(method, path, { body, extra } = {}) {
    const res = await fetchImpl(`${root}${path}`, {
      method,
      headers: headers(
        body && typeof body === 'string' ? { 'Content-Type': 'application/json', ...extra } : extra,
      ),
      body,
    });
    return res;
  }
  async function jsonOrThrow(res, what) {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${what}: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  return {
    async listBuckets() {
      return jsonOrThrow(await call('GET', '/bucket'), 'Liệt kê bucket');
    },

    /** Tạo bucket; nếu đã có (vd. do migration tạo) thì cập nhật cấu hình cho khớp. */
    async upsertBucket(b) {
      const cfg = {
        public: !!b.public,
        file_size_limit: b.file_size_limit ?? null,
        allowed_mime_types: b.allowed_mime_types ?? null,
      };
      const res = await call('POST', '/bucket', {
        body: JSON.stringify({ id: b.id, name: b.name ?? b.id, ...cfg }),
      });
      if (res.ok) return 'created';
      const text = await res.text().catch(() => '');
      if (res.status === 409 || /already exists|Duplicate/i.test(text)) {
        const up = await call('PUT', `/bucket/${encodeURIComponent(b.id)}`, {
          body: JSON.stringify(cfg),
        });
        if (!up.ok) throw new Error(`Cập nhật bucket ${b.id}: HTTP ${up.status}`);
        return 'updated';
      }
      throw new Error(`Tạo bucket ${b.id}: HTTP ${res.status} ${text.slice(0, 200)}`);
    },

    /** Mọi tệp của bucket (đi đệ quy qua thư mục): [{ path, size, mimetype }]. */
    async listFiles(bucket) {
      const out = [];
      const walk = async (prefix) => {
        const limit = 100;
        for (let offset = 0; ; offset += limit) {
          const res = await call('POST', `/object/list/${encodeURIComponent(bucket)}`, {
            body: JSON.stringify({
              prefix,
              limit,
              offset,
              sortBy: { column: 'name', order: 'asc' },
            }),
          });
          const items = await jsonOrThrow(res, `Liệt kê ${bucket}/${prefix}`);
          for (const it of items) {
            const path = prefix ? `${prefix}/${it.name}` : it.name;
            if (it.id === null || it.id === undefined) await walk(path);
            else
              out.push({
                path,
                size: Number(it.metadata?.size ?? 0),
                mimetype: it.metadata?.mimetype,
              });
          }
          if (items.length < limit) break;
        }
      };
      await walk('');
      return out;
    },

    async download(bucket, path) {
      const res = await call('GET', `/object/${encodeURIComponent(bucket)}/${enc(path)}`);
      if (!res.ok) throw new Error(`Tải ${bucket}/${path}: HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },

    async upload(bucket, path, data, contentType) {
      const res = await call('POST', `/object/${encodeURIComponent(bucket)}/${enc(path)}`, {
        body: data,
        extra: { 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true' },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Tải lên ${bucket}/${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
      }
    },
  };
}

/** Chuyển bucket và tệp. Tệp đã có ở đích với cùng dung lượng thì bỏ qua, nên chạy lại không tải trùng. */
export async function moveStorage(oldC, newC, { dryRun = false, log = () => {} } = {}) {
  const buckets = await oldC.listBuckets();
  const summary = [];
  for (const b of buckets) {
    const files = await oldC.listFiles(b.id);
    if (dryRun) {
      log(`  bucket ${b.id}: ${files.length} tệp (--dry-run, không ghi)`);
      summary.push({ bucket: b.id, files: files.length, copied: 0, skipped: 0 });
      continue;
    }
    const how = await newC.upsertBucket(b);
    const existing = new Map((await newC.listFiles(b.id)).map((f) => [f.path, f.size]));
    let copied = 0;
    let skipped = 0;
    for (const f of files) {
      if (existing.get(f.path) === f.size) {
        skipped++;
        continue;
      }
      await newC.upload(b.id, f.path, await oldC.download(b.id, f.path), f.mimetype);
      copied++;
    }
    log(`  bucket ${b.id} (${how}): ${files.length} tệp, tải lên ${copied}, bỏ qua ${skipped}`);
    summary.push({ bucket: b.id, files: files.length, copied, skipped });
  }
  return summary;
}

/** So số tệp từng bucket giữa hai instance. */
export async function compareStorage(oldC, newC) {
  const rows = [];
  for (const b of await oldC.listBuckets()) {
    const o = (await oldC.listFiles(b.id)).length;
    let n = 0;
    let present = true;
    try {
      n = (await newC.listFiles(b.id)).length;
    } catch {
      present = false;
    }
    rows.push({ bucket: b.id, old: o, new: present ? n : null, ok: present && o === n });
  }
  return rows;
}
