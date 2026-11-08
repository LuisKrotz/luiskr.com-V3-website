/* @ts-self-types="./luiskr_diagram.d.ts" */
export function render_diagram(e, t) {
  let o, i
  try {
    const w = g.__wbindgen_add_to_stack_pointer(-16),
      y = c(e, g.__wbindgen_export, g.__wbindgen_export2),
      m = p,
      h = c(t, g.__wbindgen_export, g.__wbindgen_export2),
      A = p
    g.render_diagram(w, y, m, h, A)
    var u = n().getInt32(w + 0, !0),
      l = n().getInt32(w + 4, !0),
      f = n().getInt32(w + 8, !0),
      d = n().getInt32(w + 12, !0),
      b = u,
      _ = l
    if (d)
      throw (
        (b = 0),
        (_ = 0),
        (function (e) {
          const t = (function (e) {
            return a[e]
          })(e)
          return (
            (function (e) {
              e < 1028 || ((a[e] = s), (s = e))
            })(e),
            t
          )
        })(f)
      )
    return ((o = b), (i = _), r(b, _))
  } finally {
    ;(g.__wbindgen_add_to_stack_pointer(16), g.__wbindgen_export3(o, i, 1))
  }
}
function e() {
  return {
    __proto__: null,
    './luiskr_diagram_bg.js': {
      __proto__: null,
      __wbindgen_generic_0000000000000001: function (e, t) {
        return (function (e) {
          s === a.length && a.push(a.length + 1)
          const t = s
          return ((s = a[t]), (a[t] = e), t)
        })(r(e, t))
      },
    },
  }
}
let t = null
function n() {
  return (
    (null === t ||
      !0 === t.buffer.detached ||
      (void 0 === t.buffer.detached && t.buffer !== g.memory.buffer)) &&
      (t = new DataView(g.memory.buffer)),
    t
  )
}
function r(e, t) {
  return (function (e, t) {
    return (
      (f += t),
      f >= l && ((u = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), u.decode(), (f = t)),
      u.decode(i().subarray(e, e + t))
    )
  })(e >>> 0, t)
}
let o = null
function i() {
  return ((null !== o && 0 !== o.byteLength) || (o = new Uint8Array(g.memory.buffer)), o)
}
let a = new Array(1024).fill(void 0)
a.push(void 0, null, !0, !1)
let s = a.length
function c(e, t, n) {
  if (void 0 === n) {
    const n = d.encode(e),
      r = t(n.length, 1) >>> 0
    return (
      i()
        .subarray(r, r + n.length)
        .set(n),
      (p = n.length),
      r
    )
  }
  let r = e.length,
    o = t(r, 1) >>> 0
  const a = i()
  let s = 0
  for (; s < r; s++) {
    const t = e.charCodeAt(s)
    if (t > 127) break
    a[o + s] = t
  }
  if (s !== r) {
    ;(0 !== s && (e = e.slice(s)), (o = n(o, r, (r = s + 3 * e.length), 1) >>> 0))
    const t = i().subarray(o + s, o + r)
    ;((s += d.encodeInto(e, t).written), (o = n(o, r, s, 1) >>> 0))
  }
  return ((p = s), o)
}
let u = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })
u.decode()
const l = 2146435072
let f = 0
const d = new TextEncoder()
'encodeInto' in d ||
  (d.encodeInto = function (e, t) {
    const n = d.encode(e)
    return (t.set(n), { read: e.length, written: n.length })
  })
let b,
  _,
  g,
  p = 0
function w(e, n) {
  return ((_ = e), (g = e.exports), (b = n), (t = null), (o = null), g)
}
function y(t) {
  if (void 0 !== g) return g
  void 0 !== t &&
    (Object.getPrototypeOf(t) === Object.prototype
      ? ({ module: t } = t)
      : console.warn('using deprecated parameters for `initSync()`; pass a single object instead'))
  const n = e()
  return (
    t instanceof WebAssembly.Module || (t = new WebAssembly.Module(t)),
    w(new WebAssembly.Instance(t, n), t)
  )
}
async function m(t) {
  if (void 0 !== g) return g
  ;(void 0 !== t &&
    (Object.getPrototypeOf(t) === Object.prototype
      ? ({ module_or_path: t } = t)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    void 0 === t && (t = new URL('luiskr_diagram_bg.wasm', import.meta.url)))
  const n = e()
  ;('string' == typeof t ||
    ('function' == typeof Request && t instanceof Request) ||
    ('function' == typeof URL && t instanceof URL)) &&
    (t = fetch(t))
  const { instance: r, module: o } = await (async function (e, t) {
    if ('function' == typeof Response && e instanceof Response) {
      if (!e.ok)
        throw new Error(`failed to fetch Wasm: ${e.status} ${e.statusText} fetching '${e.url}'`)
      if ('function' == typeof WebAssembly.instantiateStreaming)
        try {
          return await WebAssembly.instantiateStreaming(e, t)
        } catch (t) {
          if (
            !(function (e) {
              switch (e) {
                case 'basic':
                case 'cors':
                case 'default':
                  return !0
              }
              return !1
            })(e.type) ||
            'application/wasm' === e.headers.get('Content-Type')
          )
            throw t
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            t
          )
        }
      const n = await e.arrayBuffer()
      return await WebAssembly.instantiate(n, t)
    }
    {
      const n = await WebAssembly.instantiate(e, t)
      return n instanceof WebAssembly.Instance ? { instance: n, module: e } : n
    }
  })(await t, n)
  return w(r, o)
}
export { y as initSync, m as default }
