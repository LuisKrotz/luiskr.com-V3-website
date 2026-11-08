/* @ts-self-types="./luiskr_corner_brackets.d.ts" */
export class CornerBrackets {
  __destroy_into_raw() {
    const t = this.__wbg_ptr
    return ((this.__wbg_ptr = 0), a.unregister(this), t)
  }
  free() {
    const t = this.__destroy_into_raw()
    j.__wbg_cornerbrackets_free(t, 0)
  }
  frame(t) {
    return 0 !== j.cornerbrackets_frame(this.__wbg_ptr, t)
  }
  init(t, e) {
    try {
      const r = j.__wbindgen_add_to_stack_pointer(-16)
      j.cornerbrackets_init(r, this.__wbg_ptr, i(t), i(e))
      var n = g().getInt32(r + 0, !0)
      if (g().getInt32(r + 4, !0)) throw v(n)
    } finally {
      j.__wbindgen_add_to_stack_pointer(16)
    }
  }
  constructor() {
    const t = j.cornerbrackets_new()
    return ((this.__wbg_ptr = t), a.register(this, this.__wbg_ptr, this), this)
  }
  resize(t, e) {
    j.cornerbrackets_resize(this.__wbg_ptr, t, e)
  }
  set_arms(t, e, n, r, _) {
    j.cornerbrackets_set_arms(this.__wbg_ptr, t, e, n, r, _)
  }
  set_colors(t, e, n, r, _, o, c, s) {
    j.cornerbrackets_set_colors(this.__wbg_ptr, t, e, n, r, _, o, c, s)
  }
  set_hover(t) {
    j.cornerbrackets_set_hover(this.__wbg_ptr, t)
  }
  set_size(t, e) {
    j.cornerbrackets_set_size(this.__wbg_ptr, t, e)
  }
}
function t() {
  const t = {
    __proto__: null,
    __wbg___wbindgen_debug_string_4687d8d8c2017d52: function (t, e) {
      const n = (function (t, e, n) {
          if (void 0 === n) {
            const n = B.encode(t),
              r = e(n.length, 1) >>> 0
            return (
              w()
                .subarray(r, r + n.length)
                .set(n),
              (L = n.length),
              r
            )
          }
          let r = t.length,
            _ = e(r, 1) >>> 0
          const o = w()
          let c = 0
          for (; c < r; c++) {
            const e = t.charCodeAt(c)
            if (e > 127) break
            o[_ + c] = e
          }
          if (c !== r) {
            ;(0 !== c && (t = t.slice(c)), (_ = n(_, r, (r = c + 3 * t.length), 1) >>> 0))
            const e = w().subarray(_ + c, _ + r)
            ;((c += B.encodeInto(t, e).written), (_ = n(_, r, c, 1) >>> 0))
          }
          return ((L = c), _)
        })(u(m(e)), j.__wbindgen_export, j.__wbindgen_export2),
        r = L
      ;(g().setInt32(t + 4, r, !0), g().setInt32(t + 0, n, !0))
    },
    __wbg___wbindgen_is_null_e343b7d08827ba72: function (t) {
      return null === m(t)
    },
    __wbg___wbindgen_is_undefined_8865fb403f8fe9d8: function (t) {
      return void 0 === m(t)
    },
    __wbg___wbindgen_throw_41e9ee4f547fc59a: function (t, e) {
      throw new Error(d(t, e))
    },
    __wbg_beginRenderPass_46bc75d13eaf7381: function () {
      return p(function (t, e) {
        return i(m(t).beginRenderPass(m(e)))
      }, arguments)
    },
    __wbg_configure_a4e26031ba2da6a2: function () {
      return p(function (t, e) {
        m(t).configure(m(e))
      }, arguments)
    },
    __wbg_createBindGroupLayout_dd6a685e68699be9: function () {
      return p(function (t, e) {
        return i(m(t).createBindGroupLayout(m(e)))
      }, arguments)
    },
    __wbg_createBindGroup_297f726263493b7a: function (t, e) {
      return i(m(t).createBindGroup(m(e)))
    },
    __wbg_createBuffer_7d58b37b7042f31f: function () {
      return p(function (t, e) {
        return i(m(t).createBuffer(m(e)))
      }, arguments)
    },
    __wbg_createCommandEncoder_d26cb1fdb68219f7: function (t, e) {
      return i(m(t).createCommandEncoder(m(e)))
    },
    __wbg_createPipelineLayout_39a9a7f694e28389: function (t, e) {
      return i(m(t).createPipelineLayout(m(e)))
    },
    __wbg_createRenderPipeline_e7c57f75917917e4: function () {
      return p(function (t, e) {
        return i(m(t).createRenderPipeline(m(e)))
      }, arguments)
    },
    __wbg_createShaderModule_274373c4cacce3a0: function (t, e) {
      return i(m(t).createShaderModule(m(e)))
    },
    __wbg_createView_7520397d720e9d7d: function () {
      return p(function (t) {
        return i(m(t).createView())
      }, arguments)
    },
    __wbg_draw_b3ff1fa9ff891153: function (t, e) {
      m(t).draw(e >>> 0)
    },
    __wbg_end_a97f51ac1f092bfe: function (t) {
      m(t).end()
    },
    __wbg_finish_489db1750712613c: function (t) {
      return i(m(t).finish())
    },
    __wbg_getContext_635e36719cad2623: function () {
      return p(function (t, e, n) {
        const r = m(t).getContext(d(e, n))
        return x(r) ? 0 : i(r)
      }, arguments)
    },
    __wbg_getCurrentTexture_f9b3ddbfb8575837: function () {
      return p(function (t) {
        return i(m(t).getCurrentTexture())
      }, arguments)
    },
    __wbg_getPreferredCanvasFormat_4d28b652aa67cc74: function (t) {
      const e = m(t).getPreferredCanvasFormat()
      return (s.indexOf(e) + 1 || 102) - 1
    },
    __wbg_get_31af05bd4842a84f: function () {
      return p(function (t, e) {
        return i(Reflect.get(m(t), m(e)))
      }, arguments)
    },
    __wbg_new_617a8cdb8bb1130e: function () {
      return i(new Object())
    },
    __wbg_queue_17ba8833afbd540b: function (t) {
      return i(m(t).queue)
    },
    __wbg_setBindGroup_4af09961dd6fd6d4: function (t, e, n) {
      m(t).setBindGroup(e >>> 0, m(n))
    },
    __wbg_setPipeline_9870f87d9e0a49ab: function (t, e) {
      m(t).setPipeline(m(e))
    },
    __wbg_setScissorRect_78603d18fd6477a3: function (t, e, n, r, _) {
      m(t).setScissorRect(e >>> 0, n >>> 0, r >>> 0, _ >>> 0)
    },
    __wbg_set_a_d2dae9a62946ba86: function (t, e) {
      m(t).a = e
    },
    __wbg_set_alpha_b14827cf8b4ac26a: function (t, e) {
      m(t).alpha = m(e)
    },
    __wbg_set_alpha_mode_16c3966c224ad4a9: function (t, e) {
      m(t).alphaMode = _[e]
    },
    __wbg_set_b_670dfc0631dcb9c1: function (t, e) {
      m(t).b = e
    },
    __wbg_set_bind_group_layouts_60a4869809302d79: function (t, e, n) {
      m(t).bindGroupLayouts = b(e, n)
    },
    __wbg_set_binding_1d51e1a2d1c0cdaf: function (t, e) {
      m(t).binding = e >>> 0
    },
    __wbg_set_binding_348f002e688081ac: function (t, e) {
      m(t).binding = e >>> 0
    },
    __wbg_set_blend_3f83603fc878c51d: function (t, e) {
      m(t).blend = m(e)
    },
    __wbg_set_buffer_22331adbf81699d2: function (t, e) {
      m(t).buffer = m(e)
    },
    __wbg_set_buffer_b8d40a54af365605: function (t, e) {
      m(t).buffer = m(e)
    },
    __wbg_set_clear_value_gpu_color_dict_c17321221601e286: function (t, e) {
      m(t).clearValue = m(e)
    },
    __wbg_set_code_4510e93549b3066e: function (t, e, n) {
      m(t).code = d(e, n)
    },
    __wbg_set_color_14d2fdcfc7117305: function (t, e) {
      m(t).color = m(e)
    },
    __wbg_set_color_attachments_367a5baf85bca057: function (t, e, n) {
      m(t).colorAttachments = b(e, n)
    },
    __wbg_set_device_53f6c9076263d322: function (t, e) {
      m(t).device = m(e)
    },
    __wbg_set_dst_factor_cfb1cd4ae3e673d9: function (t, n) {
      m(t).dstFactor = e[n]
    },
    __wbg_set_entries_7c51a3643c761ecf: function (t, e, n) {
      m(t).entries = b(e, n)
    },
    __wbg_set_entries_cc80db0de96ea4ff: function (t, e, n) {
      m(t).entries = b(e, n)
    },
    __wbg_set_entry_point_a7593f073d0352f7: function (t, e, n) {
      m(t).entryPoint = d(e, n)
    },
    __wbg_set_entry_point_edfb9dd004493bc8: function (t, e, n) {
      m(t).entryPoint = d(e, n)
    },
    __wbg_set_format_036434fd3db220e7: function (t, e) {
      m(t).format = s[e]
    },
    __wbg_set_format_d4c8ef73b087dab0: function (t, e) {
      m(t).format = s[e]
    },
    __wbg_set_fragment_9bc5cc98c7c59fef: function (t, e) {
      m(t).fragment = m(e)
    },
    __wbg_set_g_ac69babc4a0b2338: function (t, e) {
      m(t).g = e
    },
    __wbg_set_has_dynamic_offset_e2a0bd85eaf36f34: function (t, e) {
      m(t).hasDynamicOffset = 0 !== e
    },
    __wbg_set_layout_4e86f7c1671a06d0: function (t, e) {
      m(t).layout = m(e)
    },
    __wbg_set_layout_f2b50454b73e9111: function (t, e) {
      m(t).layout = m(e)
    },
    __wbg_set_load_op_18ff54287ff40151: function (t, e) {
      m(t).loadOp = o[e]
    },
    __wbg_set_module_168054323d22d57d: function (t, e) {
      m(t).module = m(e)
    },
    __wbg_set_module_1ad4e7343951303d: function (t, e) {
      m(t).module = m(e)
    },
    __wbg_set_operation_d8894b0f9aa3db27: function (t, e) {
      m(t).operation = n[e]
    },
    __wbg_set_r_ccf9fe3e4d993555: function (t, e) {
      m(t).r = e
    },
    __wbg_set_resource_gpu_buffer_binding_c689b0dc9379a99b: function (t, e) {
      m(t).resource = m(e)
    },
    __wbg_set_size_4716cf40ee7a64be: function (t, e) {
      m(t).size = e >>> 0
    },
    __wbg_set_src_factor_b29ea819b1b5d6f6: function (t, n) {
      m(t).srcFactor = e[n]
    },
    __wbg_set_store_op_6d2fb6cc3e66341e: function (t, e) {
      m(t).storeOp = c[e]
    },
    __wbg_set_targets_0328c60fcfc0f564: function (t, e, n) {
      m(t).targets = b(e, n)
    },
    __wbg_set_type_ff9e8f3110ad0cbf: function (t, e) {
      m(t).type = r[e]
    },
    __wbg_set_usage_7177d2b5a0cb7ed1: function (t, e) {
      m(t).usage = e >>> 0
    },
    __wbg_set_usage_e842e619c53799e7: function (t, e) {
      m(t).usage = e >>> 0
    },
    __wbg_set_vertex_5b13839ffaff5f37: function (t, e) {
      m(t).vertex = m(e)
    },
    __wbg_set_view_gpu_texture_view_9f7613e516713508: function (t, e) {
      m(t).view = m(e)
    },
    __wbg_set_visibility_78cfb96740c9deb5: function (t, e) {
      m(t).visibility = e >>> 0
    },
    __wbg_static_accessor_GLOBAL_266715b9d96ba635: function () {
      const t = 'undefined' == typeof global ? null : global
      return x(t) ? 0 : i(t)
    },
    __wbg_static_accessor_GLOBAL_THIS_10fb7dc1ae063179: function () {
      const t = 'undefined' == typeof globalThis ? null : globalThis
      return x(t) ? 0 : i(t)
    },
    __wbg_static_accessor_SELF_0b583911f537483a: function () {
      const t = 'undefined' == typeof self ? null : self
      return x(t) ? 0 : i(t)
    },
    __wbg_static_accessor_WINDOW_d7f903d1508cbdc4: function () {
      const t = 'undefined' == typeof window ? null : window
      return x(t) ? 0 : i(t)
    },
    __wbg_submit_46ecaa46ea244579: function (t, e, n) {
      m(t).submit(b(e, n))
    },
    __wbg_writeBuffer_2c02702ce0fa25c3: function () {
      return p(function (t, e, n, r, _) {
        var o, c
        m(t).writeBuffer(
          m(e),
          n >>> 0,
          ((o = r), (c = _), (o >>>= 0), w().subarray(o / 1, o / 1 + c))
        )
      }, arguments)
    },
    __wbindgen_generic_0000000000000001: function (t, e) {
      return i(d(t, e))
    },
    __wbindgen_object_clone_ref: function (t) {
      return i(m(t))
    },
    __wbindgen_object_drop_ref: function (t) {
      v(t)
    },
  }
  return { __proto__: null, './luiskr_corner_brackets_bg.js': t }
}
Symbol.dispose && (CornerBrackets.prototype[Symbol.dispose] = CornerBrackets.prototype.free)
const e = [
    'zero',
    'one',
    'src',
    'one-minus-src',
    'src-alpha',
    'one-minus-src-alpha',
    'dst',
    'one-minus-dst',
    'dst-alpha',
    'one-minus-dst-alpha',
    'src-alpha-saturated',
    'constant',
    'one-minus-constant',
    'src1',
    'one-minus-src1',
    'src1-alpha',
    'one-minus-src1-alpha',
  ],
  n = ['add', 'subtract', 'reverse-subtract', 'min', 'max'],
  r = ['uniform', 'storage', 'read-only-storage'],
  _ = ['opaque', 'premultiplied'],
  o = ['load', 'clear'],
  c = ['store', 'discard'],
  s = [
    'r8unorm',
    'r8snorm',
    'r8uint',
    'r8sint',
    'r16unorm',
    'r16snorm',
    'r16uint',
    'r16sint',
    'r16float',
    'rg8unorm',
    'rg8snorm',
    'rg8uint',
    'rg8sint',
    'r32uint',
    'r32sint',
    'r32float',
    'rg16unorm',
    'rg16snorm',
    'rg16uint',
    'rg16sint',
    'rg16float',
    'rgba8unorm',
    'rgba8unorm-srgb',
    'rgba8snorm',
    'rgba8uint',
    'rgba8sint',
    'bgra8unorm',
    'bgra8unorm-srgb',
    'rgb9e5ufloat',
    'rgb10a2uint',
    'rgb10a2unorm',
    'rg11b10ufloat',
    'rg32uint',
    'rg32sint',
    'rg32float',
    'rgba16unorm',
    'rgba16snorm',
    'rgba16uint',
    'rgba16sint',
    'rgba16float',
    'rgba32uint',
    'rgba32sint',
    'rgba32float',
    'stencil8',
    'depth16unorm',
    'depth24plus',
    'depth24plus-stencil8',
    'depth32float',
    'depth32float-stencil8',
    'bc1-rgba-unorm',
    'bc1-rgba-unorm-srgb',
    'bc2-rgba-unorm',
    'bc2-rgba-unorm-srgb',
    'bc3-rgba-unorm',
    'bc3-rgba-unorm-srgb',
    'bc4-r-unorm',
    'bc4-r-snorm',
    'bc5-rg-unorm',
    'bc5-rg-snorm',
    'bc6h-rgb-ufloat',
    'bc6h-rgb-float',
    'bc7-rgba-unorm',
    'bc7-rgba-unorm-srgb',
    'etc2-rgb8unorm',
    'etc2-rgb8unorm-srgb',
    'etc2-rgb8a1unorm',
    'etc2-rgb8a1unorm-srgb',
    'etc2-rgba8unorm',
    'etc2-rgba8unorm-srgb',
    'eac-r11unorm',
    'eac-r11snorm',
    'eac-rg11unorm',
    'eac-rg11snorm',
    'astc-4x4-unorm',
    'astc-4x4-unorm-srgb',
    'astc-5x4-unorm',
    'astc-5x4-unorm-srgb',
    'astc-5x5-unorm',
    'astc-5x5-unorm-srgb',
    'astc-6x5-unorm',
    'astc-6x5-unorm-srgb',
    'astc-6x6-unorm',
    'astc-6x6-unorm-srgb',
    'astc-8x5-unorm',
    'astc-8x5-unorm-srgb',
    'astc-8x6-unorm',
    'astc-8x6-unorm-srgb',
    'astc-8x8-unorm',
    'astc-8x8-unorm-srgb',
    'astc-10x5-unorm',
    'astc-10x5-unorm-srgb',
    'astc-10x6-unorm',
    'astc-10x6-unorm-srgb',
    'astc-10x8-unorm',
    'astc-10x8-unorm-srgb',
    'astc-10x10-unorm',
    'astc-10x10-unorm-srgb',
    'astc-12x10-unorm',
    'astc-12x10-unorm-srgb',
    'astc-12x12-unorm',
    'astc-12x12-unorm-srgb',
  ],
  a =
    'undefined' == typeof FinalizationRegistry
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry((t) => j.__wbg_cornerbrackets_free(t, 1))
function i(t) {
  y === h.length && h.push(h.length + 1)
  const e = y
  return ((y = h[e]), (h[e] = t), e)
}
function u(t) {
  const e = typeof t
  if ('number' == e || 'boolean' == e || null == t) return `${t}`
  if ('string' == e) return `"${t}"`
  if ('symbol' == e) {
    const e = t.description
    return null == e ? 'Symbol' : `Symbol(${e})`
  }
  if ('function' == e) {
    const e = t.name
    return 'string' == typeof e && e.length > 0 ? `Function(${e})` : 'Function'
  }
  if (Array.isArray(t)) {
    const e = t.length
    let n = '['
    e > 0 && (n += u(t[0]))
    for (let r = 1; r < e; r++) n += ', ' + u(t[r])
    return ((n += ']'), n)
  }
  const n = /\[object ([^\]]+)\]/.exec(toString.call(t))
  let r
  if (!(n && n.length > 1)) return toString.call(t)
  if (((r = n[1]), 'Object' == r))
    try {
      return 'Object(' + JSON.stringify(t) + ')'
    } catch (t) {
      return 'Object'
    }
  return t instanceof Error ? `${t.name}: ${t.message}\n${t.stack}` : r
}
function b(t, e) {
  t >>>= 0
  const n = g(),
    r = []
  for (let _ = t; _ < t + 4 * e; _ += 4) r.push(m(n.getUint32(_, !0)))
  return r
}
let f = null
function g() {
  return (
    (null === f ||
      !0 === f.buffer.detached ||
      (void 0 === f.buffer.detached && f.buffer !== j.memory.buffer)) &&
      (f = new DataView(j.memory.buffer)),
    f
  )
}
function d(t, e) {
  return (function (t, e) {
    return (
      (A += e),
      A >= O && ((k = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), k.decode(), (A = e)),
      k.decode(w().subarray(t, t + e))
    )
  })(t >>> 0, e)
}
let l = null
function w() {
  return ((null !== l && 0 !== l.byteLength) || (l = new Uint8Array(j.memory.buffer)), l)
}
function m(t) {
  return h[t]
}
function p(t, e) {
  try {
    return t.apply(this, e)
  } catch (t) {
    j.__wbindgen_export3(i(t))
  }
}
let h = new Array(1024).fill(void 0)
h.push(void 0, null, !0, !1)
let y = h.length
function x(t) {
  return null == t
}
function v(t) {
  const e = m(t)
  return (
    (function (t) {
      t < 1028 || ((h[t] = y), (y = t))
    })(t),
    e
  )
}
let k = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })
k.decode()
const O = 2146435072
let A = 0
const B = new TextEncoder()
'encodeInto' in B ||
  (B.encodeInto = function (t, e) {
    const n = B.encode(t)
    return (e.set(n), { read: t.length, written: n.length })
  })
let S,
  R,
  j,
  L = 0
function P(t, e) {
  return ((R = t), (j = t.exports), (S = e), (f = null), (l = null), j)
}
function W(e) {
  if (void 0 !== j) return j
  void 0 !== e &&
    (Object.getPrototypeOf(e) === Object.prototype
      ? ({ module: e } = e)
      : console.warn('using deprecated parameters for `initSync()`; pass a single object instead'))
  const n = t()
  return (
    e instanceof WebAssembly.Module || (e = new WebAssembly.Module(e)),
    P(new WebAssembly.Instance(e, n), e)
  )
}
async function C(e) {
  if (void 0 !== j) return j
  ;(void 0 !== e &&
    (Object.getPrototypeOf(e) === Object.prototype
      ? ({ module_or_path: e } = e)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    void 0 === e && (e = new URL('luiskr_corner_brackets_bg.wasm', import.meta.url)))
  const n = t()
  ;('string' == typeof e ||
    ('function' == typeof Request && e instanceof Request) ||
    ('function' == typeof URL && e instanceof URL)) &&
    (e = fetch(e))
  const { instance: r, module: _ } = await (async function (t, e) {
    if ('function' == typeof Response && t instanceof Response) {
      if (!t.ok)
        throw new Error(`failed to fetch Wasm: ${t.status} ${t.statusText} fetching '${t.url}'`)
      if ('function' == typeof WebAssembly.instantiateStreaming)
        try {
          return await WebAssembly.instantiateStreaming(t, e)
        } catch (e) {
          if (
            !(function (t) {
              switch (t) {
                case 'basic':
                case 'cors':
                case 'default':
                  return !0
              }
              return !1
            })(t.type) ||
            'application/wasm' === t.headers.get('Content-Type')
          )
            throw e
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            e
          )
        }
      const n = await t.arrayBuffer()
      return await WebAssembly.instantiate(n, e)
    }
    {
      const n = await WebAssembly.instantiate(t, e)
      return n instanceof WebAssembly.Instance ? { instance: n, module: t } : n
    }
  })(await e, n)
  return P(r, _)
}
export { W as initSync, C as default }
