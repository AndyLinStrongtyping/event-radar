const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const YAML = require('yaml');

const spec = YAML.parse(readFileSync(join(__dirname, '../docs/openapi.yaml'), 'utf8'), {
  uniqueKeys: true,
});

function resolveRef(ref) {
  assert.match(ref, /^#\//, `只支援同檔引用：${ref}`);
  return ref.slice(2).split('/').reduce((value, token) => {
    const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
    assert.ok(value && Object.hasOwn(value, key), `找不到 OpenAPI 引用 ${ref}`);
    return value[key];
  }, spec);
}

function assertFormat(value, format, location) {
  if (format === 'date') {
    assert.match(value, /^\d{4}-\d{2}-\d{2}$/, `${location} 應為 ISO 日期`);
    const date = new Date(`${value}T00:00:00Z`);
    assert.ok(Number.isFinite(date.getTime()), `${location} 應為有效日期`);
    assert.equal(date.toISOString().slice(0, 10), value, `${location} 應為有效日期`);
  } else if (format === 'date-time') {
    assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
      `${location} 應為 RFC 3339 時間`);
    assert.ok(Number.isFinite(Date.parse(value)), `${location} 應為有效時間`);
    assertFormat(value.slice(0, 10), 'date', location);
  } else if (format === 'uuid') {
    assert.match(value, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
      `${location} 應為 UUID`);
  } else if (format === 'uri') {
    assert.doesNotThrow(() => new URL(value), `${location} 應為絕對網址`);
  } else if (format) {
    assert.fail(`${location} 出現未支援的 OpenAPI format：${format}`);
  }
}

function assertSchema(schema, value, location) {
  if (schema.$ref) return assertSchema(resolveRef(schema.$ref), value, location);
  for (const keyword of ['oneOf', 'anyOf', 'not']) {
    assert.ok(!Object.hasOwn(schema, keyword), `${location} 出現未支援的 OpenAPI ${keyword}`);
  }
  if (value === null) {
    assert.equal(schema.nullable, true, `${location} 不允許 null`);
    return;
  }
  if (schema.allOf) schema.allOf.forEach((part) => assertSchema(part, value, location));
  if (schema.enum) {
    assert.ok(schema.enum.some((item) => isDeepStrictEqual(item, value)),
      `${location} 的值 ${JSON.stringify(value)} 不在文件 enum 中`);
  }
  if (!schema.type) return;
  if (schema.type === 'object') {
    assert.ok(typeof value === 'object' && !Array.isArray(value), `${location} 應為 object`);
    for (const field of schema.required ?? []) {
      assert.ok(Object.hasOwn(value, field), `${location}.${field} 是文件的必填欄位`);
    }
    for (const [field, property] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, field)) assertSchema(property, value[field], `${location}.${field}`);
    }
  } else if (schema.type === 'array') {
    assert.ok(Array.isArray(value), `${location} 應為 array`);
    assert.ok(schema.items, `${location} 的 array 缺少 items schema`);
    value.forEach((item, index) => assertSchema(schema.items, item, `${location}[${index}]`));
  } else if (schema.type === 'string') {
    assert.equal(typeof value, 'string', `${location} 應為 string`);
    if (schema.maxLength !== undefined) assert.ok(value.length <= schema.maxLength,
      `${location} 超過文件允許長度`);
    assertFormat(value, schema.format, location);
  } else if (schema.type === 'integer' || schema.type === 'number') {
    assert.ok(schema.type === 'integer' ? Number.isInteger(value) : typeof value === 'number',
      `${location} 應為 ${schema.type}`);
    if (schema.minimum !== undefined) assert.ok(value >= schema.minimum, `${location} 小於 minimum`);
    if (schema.maximum !== undefined) assert.ok(value <= schema.maximum, `${location} 大於 maximum`);
  } else if (schema.type === 'boolean') {
    assert.equal(typeof value, 'boolean', `${location} 應為 boolean`);
  } else {
    assert.fail(`${location} 出現未支援的 OpenAPI type：${schema.type}`);
  }
}

function routeTemplate(path) {
  const pathname = new URL(path, 'http://127.0.0.1').pathname;
  if (spec.paths[pathname]) return pathname;
  if (/^\/exhibitions\/[^/]+\/changes$/.test(pathname)) return '/exhibitions/{id}/changes';
  if (/^\/exhibitions\/[^/]+$/.test(pathname)) return '/exhibitions/{id}';
  assert.fail(`OpenAPI 沒有宣告 ${pathname}`);
}

function assertOpenApiResponse(path, status, body) {
  const template = routeTemplate(path);
  const declared = spec.paths[template].get.responses[String(status)];
  assert.ok(declared, `OpenAPI 未宣告 GET ${template} 的 ${status} 回應`);
  const response = declared.$ref ? resolveRef(declared.$ref) : declared;
  const schema = response.content?.['application/json']?.schema;
  assert.ok(schema, `OpenAPI 未宣告 GET ${template} 的 ${status} JSON schema`);
  assertSchema(schema, body, `GET ${template} ${status}`);
  return template;
}

module.exports = { assertOpenApiResponse, documentedGetPaths: Object.keys(spec.paths) };
