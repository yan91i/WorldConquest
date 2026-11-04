// 将 Natural Earth 原始 GeoJSON 精简为游戏内嵌数据 assets/data/countries.js
// 用法: node tools/build-data.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'assets/data/_raw_countries.geojson');
const OUT = path.join(ROOT, 'assets/data/countries.js');

const PRECISION = 2; // 坐标保留 2 位小数（约 1km），地图足够

function round(n) {
  const p = 10 ** PRECISION;
  return Math.round(n * p) / p;
}

function ring(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const c = arr[i];
    if (!Array.isArray(c) || c.length < 2) continue;
    const lon = round(c[0]);
    const lat = round(c[1]);
    if (out.length >= 2 && out[out.length - 2] === lon && out[out.length - 1] === lat) continue;
    out.push(lon, lat);
  }
  // 需要至少 3 个点构成面
  if (out.length < 6) return null;
  return out;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Natural Earth 的 NAME_ZH 多为正式国名，游戏中改用简称
const ZH_SHORT = {
  '中华人民共和国': '中国', '美利坚合众国': '美国', '大韩民国': '韩国',
  '朝鲜民主主义人民共和国': '朝鲜', '俄罗斯联邦': '俄罗斯', '日本国': '日本',
  '德意志联邦共和国': '德国', '法兰西共和国': '法国', '意大利共和国': '意大利',
  '大不列颠及北爱尔兰联合王国': '英国', '西班牙王国': '西班牙', '葡萄牙共和国': '葡萄牙',
  '加拿大': '加拿大', '澳大利亚联邦': '澳大利亚', '印度共和国': '印度',
  '巴西联邦共和国': '巴西', '墨西哥合众国': '墨西哥', '阿根廷共和国': '阿根廷',
  '南非共和国': '南非', '埃及阿拉伯共和国': '埃及', '土耳其共和国': '土耳其',
  '伊朗伊斯兰共和国': '伊朗', '沙特阿拉伯王国': '沙特阿拉伯', '阿拉伯联合酋长国': '阿联酋',
  '印度尼西亚共和国': '印度尼西亚', '越南社会主义共和国': '越南', '泰王国': '泰国',
  '波兰共和国': '波兰', '乌克兰': '乌克兰', '荷兰王国': '荷兰', '比利时王国': '比利时',
  '瑞士联邦': '瑞士', '瑞典王国': '瑞典', '挪威王国': '挪威', '芬兰共和国': '芬兰',
  '丹麦王国': '丹麦', '希腊共和国': '希腊', '奥地利共和国': '奥地利', '捷克共和国': '捷克',
  '匈牙利': '匈牙利', '罗马尼亚': '罗马尼亚', '保加利亚共和国': '保加利亚',
  '以色列国': '以色列', '伊拉克共和国': '伊拉克', '巴基斯坦伊斯兰共和国': '巴基斯坦',
  '孟加拉人民共和国': '孟加拉国', '缅甸联邦共和国': '缅甸', '菲律宾共和国': '菲律宾',
  '马来西亚': '马来西亚', '新西兰': '新西兰', '智利共和国': '智利', '秘鲁共和国': '秘鲁',
  '哥伦比亚共和国': '哥伦比亚', '委内瑞拉玻利瓦尔共和国': '委内瑞拉',
  '尼日利亚联邦共和国': '尼日利亚', '埃塞俄比亚联邦民主共和国': '埃塞俄比亚',
  '肯尼亚共和国': '肯尼亚', '摩洛哥王国': '摩洛哥', '阿尔及利亚人民民主共和国': '阿尔及利亚',
  '白俄罗斯共和国': '白俄罗斯', '哈萨克斯坦共和国': '哈萨克斯坦', '蒙古国': '蒙古',
  '古巴共和国': '古巴', '爱尔兰': '爱尔兰', '新加坡共和国': '新加坡',
  '斯里兰卡民主社会主义共和国': '斯里兰卡', '尼泊尔联邦民主共和国': '尼泊尔',
};

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const list = [];
const used = new Set();

for (const f of raw.features) {
  const p = f.properties || {};
  const name = p.NAME_EN || p.NAME || p.ADMIN;
  if (!name) continue;
  if (name === 'Antarctica') continue; // 排除南极洲，无游戏意义
  if (p.ISO_A3 === 'ATA') continue;

  let iso3 = p.ISO_A3_EH && p.ISO_A3_EH !== '-99' ? p.ISO_A3_EH : p.ISO_A3;
  if (!iso3 || iso3 === '-99') iso3 = p.ADM0_A3 && p.ADM0_A3 !== '-99' ? p.ADM0_A3 : null;
  let id = (iso3 || slug(name)).toLowerCase();
  while (used.has(id)) id += '_';
  used.add(id);

  // 提取多边形环
  const rings = [];
  const g = f.geometry;
  if (!g) continue;
  const pushPoly = (poly) => {
    if (!Array.isArray(poly) || !poly.length) return;
    // 只取外环（第 0 个），忽略内环孔洞，简化渲染
    const r = ring(poly[0]);
    if (r) rings.push(r);
  };
  if (g.type === 'Polygon') pushPoly(g.coordinates);
  else if (g.type === 'MultiPolygon') g.coordinates.forEach(pushPoly);
  if (!rings.length) continue;

  // 面积（球面近似，单位 km^2），用于排序与实力评估
  let area = 0;
  for (const r of rings) {
    let s = 0;
    for (let i = 0; i < r.length; i += 2) {
      const x1 = (r[i] * Math.PI) / 180;
      const y1 = (r[(i + 1) % r.length] * Math.PI) / 180;
      const x2 = (r[(i + 2) % r.length] * Math.PI) / 180;
      const y2 = (r[(i + 3) % r.length] * Math.PI) / 180;
      s += x1 * y2 - x2 * y1;
    }
    area += Math.abs(s / 2) * 6371 * 6371;
  }

  const iso2 = p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : (p.ISO_A2 !== '-99' ? p.ISO_A2 : null);

  list.push({
    id,
    name,
    zh: ZH_SHORT[p.NAME_ZH] || p.NAME_ZH || name,
    iso2: iso2 || null,
    continent: p.CONTINENT || '',
    subregion: p.SUBREGION || '',
    pop: Math.max(10000, Math.round(p.POP_EST || 0)),
    gdp: Math.max(50, Math.round(p.GDP_MD || 0)), // 单位：百万美元
    area: Math.round(area),
    label: [round(p.LABEL_X ?? 0), round(p.LABEL_Y ?? 0)],
    bbox: [round(g.type ? f.bbox?.[0] ?? -180 : -180), round(f.bbox?.[1] ?? -90), round(f.bbox?.[2] ?? 180), round(f.bbox?.[3] ?? 90)],
    rings,
  });
}

list.sort((a, b) => b.gdp - a.gdp);

const out = 'window.WC=window.WC||{};window.WC.COUNTRIES=' + JSON.stringify(list) + ';\n';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out, 'utf8');

console.log('countries:', list.length);
console.log('size:', (Buffer.byteLength(out) / 1024).toFixed(0) + ' KB');
console.log('rings total:', list.reduce((s, c) => s + c.rings.length, 0));
console.log('sample:', list.slice(0, 3).map((c) => `${c.zh}(${c.id}) pop=${c.pop} gdp=${c.gdp}`).join(' | '));
