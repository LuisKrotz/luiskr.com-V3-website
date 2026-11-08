/* @ts-self-types="./luiskr_divider_sheen.d.ts" */
export class DividerSheen {
  __destroy_into_raw() {
    const e = this.__wbg_ptr
    return ((this.__wbg_ptr = 0), s.unregister(this), e)
  }
  free() {
    const e = this.__destroy_into_raw()
    L.__wbg_dividersheen_free(e, 0)
  }
  frame(e) {
    return 0 !== L.dividersheen_frame(this.__wbg_ptr, e)
  }
  init(e, n) {
    try {
      const r = L.__wbindgen_add_to_stack_pointer(-16)
      L.dividersheen_init(r, this.__wbg_ptr, a(e), a(n))
      var t = g().getInt32(r + 0, !0)
      if (g().getInt32(r + 4, !0)) throw v(t)
    } finally {
      L.__wbindgen_add_to_stack_pointer(16)
    }
  }
  constructor() {
    const e = L.dividersheen_new()
    return ((this.__wbg_ptr = e), s.register(this, this.__wbg_ptr, this), this)
  }
  resize(e, n) {
    L.dividersheen_resize(this.__wbg_ptr, e, n)
  }
  set_colors(e, n, t, r, _, o, c, i) {
    L.dividersheen_set_colors(this.__wbg_ptr, e, n, t, r, _, o, c, i)
  }
  set_size(e, n) {
    L.dividersheen_set_size(this.__wbg_ptr, e, n)
  }
}
function e() {
  const e = {
    __proto__: null,
    __wbg___wbindgen_debug_string_4687d8d8c2017d52: function (e, n) {
      const t = (function (e, n, t) {
          if (void 0 === t) {
            const t = R.encode(e),
              r = n(t.length, 1) >>> 0
            return (
              w()
                .subarray(r, r + t.length)
                .set(t),
              (P = t.length),
              r
            )
          }
          let r = e.length,
            _ = n(r, 1) >>> 0
          const o = w()
          let c = 0
          for (; c < r; c++) {
            const n = e.charCodeAt(c)
            if (n > 127) break
            o[_ + c] = n
          }
          if (c !== r) {
            ;(0 !== c && (e = e.slice(c)), (_ = t(_, r, (r = c + 3 * e.length), 1) >>> 0))
            const n = w().subarray(_ + c, _ + r)
            ;((c += R.encodeInto(e, n).written), (_ = t(_, r, c, 1) >>> 0))
          }
          return ((P = c), _)
        })(u(m(n)), L.__wbindgen_export, L.__wbindgen_export2),
        r = P
      ;(g().setInt32(e + 4, r, !0), g().setInt32(e + 0, t, !0))
    },
    __wbg___wbindgen_is_null_e343b7d08827ba72: function (e) {
      return null === m(e)
    },
    __wbg___wbindgen_is_undefined_8865fb403f8fe9d8: function (e) {
      return void 0 === m(e)
    },
    __wbg___wbindgen_throw_41e9ee4f547fc59a: function (e, n) {
      throw new Error(d(e, n))
    },
    __wbg_beginRenderPass_46bc75d13eaf7381: function () {
      return p(function (e, n) {
        return a(m(e).beginRenderPass(m(n)))
      }, arguments)
    },
    __wbg_configure_a4e26031ba2da6a2: function () {
      return p(function (e, n) {
        m(e).configure(m(n))
      }, arguments)
    },
    __wbg_createBindGroupLayout_dd6a685e68699be9: function () {
      return p(function (e, n) {
        return a(m(e).createBindGroupLayout(m(n)))
      }, arguments)
    },
    __wbg_createBindGroup_297f726263493b7a: function (e, n) {
      return a(m(e).createBindGroup(m(n)))
    },
    __wbg_createBuffer_7d58b37b7042f31f: function () {
      return p(function (e, n) {
        return a(m(e).createBuffer(m(n)))
      }, arguments)
    },
    __wbg_createCommandEncoder_d26cb1fdb68219f7: function (e, n) {
      return a(m(e).createCommandEncoder(m(n)))
    },
    __wbg_createPipelineLayout_39a9a7f694e28389: function (e, n) {
      return a(m(e).createPipelineLayout(m(n)))
    },
    __wbg_createRenderPipeline_e7c57f75917917e4: function () {
      return p(function (e, n) {
        return a(m(e).createRenderPipeline(m(n)))
      }, arguments)
    },
    __wbg_createShaderModule_274373c4cacce3a0: function (e, n) {
      return a(m(e).createShaderModule(m(n)))
    },
    __wbg_createView_7520397d720e9d7d: function () {
      return p(function (e) {
        return a(m(e).createView())
      }, arguments)
    },
    __wbg_draw_b3ff1fa9ff891153: function (e, n) {
      m(e).draw(n >>> 0)
    },
    __wbg_end_a97f51ac1f092bfe: function (e) {
      m(e).end()
    },
    __wbg_finish_489db1750712613c: function (e) {
      return a(m(e).finish())
    },
    __wbg_getContext_635e36719cad2623: function () {
      return p(function (e, n, t) {
        const r = m(e).getContext(d(n, t))
        return x(r) ? 0 : a(r)
      }, arguments)
    },
    __wbg_getCurrentTexture_f9b3ddbfb8575837: function () {
      return p(function (e) {
        return a(m(e).getCurrentTexture())
      }, arguments)
    },
    __wbg_getPreferredCanvasFormat_4d28b652aa67cc74: function (e) {
      const n = m(e).getPreferredCanvasFormat()
      return (i.indexOf(n) + 1 || 102) - 1
    },
    __wbg_get_31af05bd4842a84f: function () {
      return p(function (e, n) {
        return a(Reflect.get(m(e), m(n)))
      }, arguments)
    },
    __wbg_new_617a8cdb8bb1130e: function () {
      return a(new Object())
    },
    __wbg_queue_17ba8833afbd540b: function (e) {
      return a(m(e).queue)
    },
    __wbg_setBindGroup_4af09961dd6fd6d4: function (e, n, t) {
      m(e).setBindGroup(n >>> 0, m(t))
    },
    __wbg_setPipeline_9870f87d9e0a49ab: function (e, n) {
      m(e).setPipeline(m(n))
    },
    __wbg_setScissorRect_78603d18fd6477a3: function (e, n, t, r, _) {
      m(e).setScissorRect(n >>> 0, t >>> 0, r >>> 0, _ >>> 0)
    },
    __wbg_set_a_d2dae9a62946ba86: function (e, n) {
      m(e).a = n
    },
    __wbg_set_alpha_b14827cf8b4ac26a: function (e, n) {
      m(e).alpha = m(n)
    },
    __wbg_set_alpha_mode_16c3966c224ad4a9: function (e, n) {
      m(e).alphaMode = _[n]
    },
    __wbg_set_b_670dfc0631dcb9c1: function (e, n) {
      m(e).b = n
    },
    __wbg_set_bind_group_layouts_60a4869809302d79: function (e, n, t) {
      m(e).bindGroupLayouts = f(n, t)
    },
    __wbg_set_binding_1d51e1a2d1c0cdaf: function (e, n) {
      m(e).binding = n >>> 0
    },
    __wbg_set_binding_348f002e688081ac: function (e, n) {
      m(e).binding = n >>> 0
    },
    __wbg_set_blend_3f83603fc878c51d: function (e, n) {
      m(e).blend = m(n)
    },
    __wbg_set_buffer_22331adbf81699d2: function (e, n) {
      m(e).buffer = m(n)
    },
    __wbg_set_buffer_b8d40a54af365605: function (e, n) {
      m(e).buffer = m(n)
    },
    __wbg_set_clear_value_gpu_color_dict_c17321221601e286: function (e, n) {
      m(e).clearValue = m(n)
    },
    __wbg_set_code_4510e93549b3066e: function (e, n, t) {
      m(e).code = d(n, t)
    },
    __wbg_set_color_14d2fdcfc7117305: function (e, n) {
      m(e).color = m(n)
    },
    __wbg_set_color_attachments_367a5baf85bca057: function (e, n, t) {
      m(e).colorAttachments = f(n, t)
    },
    __wbg_set_device_53f6c9076263d322: function (e, n) {
      m(e).device = m(n)
    },
    __wbg_set_dst_factor_cfb1cd4ae3e673d9: function (e, t) {
      m(e).dstFactor = n[t]
    },
    __wbg_set_entries_7c51a3643c761ecf: function (e, n, t) {
      m(e).entries = f(n, t)
    },
    __wbg_set_entries_cc80db0de96ea4ff: function (e, n, t) {
      m(e).entries = f(n, t)
    },
    __wbg_set_entry_point_a7593f073d0352f7: function (e, n, t) {
      m(e).entryPoint = d(n, t)
    },
    __wbg_set_entry_point_edfb9dd004493bc8: function (e, n, t) {
      m(e).entryPoint = d(n, t)
    },
    __wbg_set_format_036434fd3db220e7: function (e, n) {
      m(e).format = i[n]
    },
    __wbg_set_format_d4c8ef73b087dab0: function (e, n) {
      m(e).format = i[n]
    },
    __wbg_set_fragment_9bc5cc98c7c59fef: function (e, n) {
      m(e).fragment = m(n)
    },
    __wbg_set_g_ac69babc4a0b2338: function (e, n) {
      m(e).g = n
    },
    __wbg_set_has_dynamic_offset_e2a0bd85eaf36f34: function (e, n) {
      m(e).hasDynamicOffset = 0 !== n
    },
    __wbg_set_layout_4e86f7c1671a06d0: function (e, n) {
      m(e).layout = m(n)
    },
    __wbg_set_layout_f2b50454b73e9111: function (e, n) {
      m(e).layout = m(n)
    },
    __wbg_set_load_op_18ff54287ff40151: function (e, n) {
      m(e).loadOp = o[n]
    },
    __wbg_set_module_168054323d22d57d: function (e, n) {
      m(e).module = m(n)
    },
    __wbg_set_module_1ad4e7343951303d: function (e, n) {
      m(e).module = m(n)
    },
    __wbg_set_operation_d8894b0f9aa3db27: function (e, n) {
      m(e).operation = t[n]
    },
    __wbg_set_r_ccf9fe3e4d993555: function (e, n) {
      m(e).r = n
    },
    __wbg_set_resource_gpu_buffer_binding_c689b0dc9379a99b: function (e, n) {
      m(e).resource = m(n)
    },
    __wbg_set_size_4716cf40ee7a64be: function (e, n) {
      m(e).size = n >>> 0
    },
    __wbg_set_src_factor_b29ea819b1b5d6f6: function (e, t) {
      m(e).srcFactor = n[t]
    },
    __wbg_set_store_op_6d2fb6cc3e66341e: function (e, n) {
      m(e).storeOp = c[n]
    },
    __wbg_set_targets_0328c60fcfc0f564: function (e, n, t) {
      m(e).targets = f(n, t)
    },
    __wbg_set_type_ff9e8f3110ad0cbf: function (e, n) {
      m(e).type = r[n]
    },
    __wbg_set_usage_7177d2b5a0cb7ed1: function (e, n) {
      m(e).usage = n >>> 0
    },
    __wbg_set_usage_e842e619c53799e7: function (e, n) {
      m(e).usage = n >>> 0
    },
    __wbg_set_vertex_5b13839ffaff5f37: function (e, n) {
      m(e).vertex = m(n)
    },
    __wbg_set_view_gpu_texture_view_9f7613e516713508: function (e, n) {
      m(e).view = m(n)
    },
    __wbg_set_visibility_78cfb96740c9deb5: function (e, n) {
      m(e).visibility = n >>> 0
    },
    __wbg_static_accessor_GLOBAL_266715b9d96ba635: function () {
      const e = 'undefined' == typeof global ? null : global
      return x(e) ? 0 : a(e)
    },
    __wbg_static_accessor_GLOBAL_THIS_10fb7dc1ae063179: function () {
      const e = 'undefined' == typeof globalThis ? null : globalThis
      return x(e) ? 0 : a(e)
    },
    __wbg_static_accessor_SELF_0b583911f537483a: function () {
      const e = 'undefined' == typeof self ? null : self
      return x(e) ? 0 : a(e)
    },
    __wbg_static_accessor_WINDOW_d7f903d1508cbdc4: function () {
      const e = 'undefined' == typeof window ? null : window
      return x(e) ? 0 : a(e)
    },
    __wbg_submit_46ecaa46ea244579: function (e, n, t) {
      m(e).submit(f(n, t))
    },
    __wbg_writeBuffer_2c02702ce0fa25c3: function () {
      return p(function (e, n, t, r, _) {
        var o, c
        m(e).writeBuffer(
          m(n),
          t >>> 0,
          ((o = r), (c = _), (o >>>= 0), w().subarray(o / 1, o / 1 + c))
        )
      }, arguments)
    },
    __wbindgen_generic_0000000000000001: function (e, n) {
      return a(d(e, n))
    },
    __wbindgen_object_clone_ref: function (e) {
      return a(m(e))
    },
    __wbindgen_object_drop_ref: function (e) {
      v(e)
    },
  }
  return { __proto__: null, './luiskr_divider_sheen_bg.js': e }
}
Symbol.dispose && (DividerSheen.prototype[Symbol.dispose] = DividerSheen.prototype.free)
const n = [
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
  t = ['add', 'subtract', 'reverse-subtract', 'min', 'max'],
  r = ['uniform', 'storage', 'read-only-storage'],
  _ = ['opaque', 'premultiplied'],
  o = ['load', 'clear'],
  c = ['store', 'discard'],
  i = [
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
  s =
    'undefined' == typeof FinalizationRegistry
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry((e) => L.__wbg_dividersheen_free(e, 1))
function a(e) {
  y === h.length && h.push(h.length + 1)
  const n = y
  return ((y = h[n]), (h[n] = e), n)
}
function u(e) {
  const n = typeof e
  if ('number' == n || 'boolean' == n || null == e) return `${e}`
  if ('string' == n) return `"${e}"`
  if ('symbol' == n) {
    const n = e.description
    return null == n ? 'Symbol' : `Symbol(${n})`
  }
  if ('function' == n) {
    const n = e.name
    return 'string' == typeof n && n.length > 0 ? `Function(${n})` : 'Function'
  }
  if (Array.isArray(e)) {
    const n = e.length
    let t = '['
    n > 0 && (t += u(e[0]))
    for (let r = 1; r < n; r++) t += ', ' + u(e[r])
    return ((t += ']'), t)
  }
  const t = /\[object ([^\]]+)\]/.exec(toString.call(e))
  let r
  if (!(t && t.length > 1)) return toString.call(e)
  if (((r = t[1]), 'Object' == r))
    try {
      return 'Object(' + JSON.stringify(e) + ')'
    } catch (e) {
      return 'Object'
    }
  return e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : r
}
function f(e, n) {
  e >>>= 0
  const t = g(),
    r = []
  for (let _ = e; _ < e + 4 * n; _ += 4) r.push(m(t.getUint32(_, !0)))
  return r
}
let b = null
function g() {
  return (
    (null === b ||
      !0 === b.buffer.detached ||
      (void 0 === b.buffer.detached && b.buffer !== L.memory.buffer)) &&
      (b = new DataView(L.memory.buffer)),
    b
  )
}
function d(e, n) {
  return (function (e, n) {
    return (
      (A += n),
      A >= S && ((O = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), O.decode(), (A = n)),
      O.decode(w().subarray(e, e + n))
    )
  })(e >>> 0, n)
}
let l = null
function w() {
  return ((null !== l && 0 !== l.byteLength) || (l = new Uint8Array(L.memory.buffer)), l)
}
function m(e) {
  return h[e]
}
function p(e, n) {
  try {
    return e.apply(this, n)
  } catch (e) {
    L.__wbindgen_export3(a(e))
  }
}
let h = new Array(1024).fill(void 0)
h.push(void 0, null, !0, !1)
let y = h.length
function x(e) {
  return null == e
}
function v(e) {
  const n = m(e)
  return (
    (function (e) {
      e < 1028 || ((h[e] = y), (y = e))
    })(e),
    n
  )
}
let O = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })
O.decode()
const S = 2146435072
let A = 0
const R = new TextEncoder()
'encodeInto' in R ||
  (R.encodeInto = function (e, n) {
    const t = R.encode(e)
    return (n.set(t), { read: e.length, written: t.length })
  })
let B,
  j,
  L,
  P = 0
function W(e, n) {
  return ((j = e), (L = e.exports), (B = n), (b = null), (l = null), L)
}
function I(n) {
  if (void 0 !== L) return L
  void 0 !== n &&
    (Object.getPrototypeOf(n) === Object.prototype
      ? ({ module: n } = n)
      : console.warn('using deprecated parameters for `initSync()`; pass a single object instead'))
  const t = e()
  return (
    n instanceof WebAssembly.Module || (n = new WebAssembly.Module(n)),
    W(new WebAssembly.Instance(n, t), n)
  )
}
async function z(n) {
  if (void 0 !== L) return L
  ;(void 0 !== n &&
    (Object.getPrototypeOf(n) === Object.prototype
      ? ({ module_or_path: n } = n)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    void 0 === n && (n = new URL('luiskr_divider_sheen_bg.wasm', import.meta.url)))
  const t = e()
  ;('string' == typeof n ||
    ('function' == typeof Request && n instanceof Request) ||
    ('function' == typeof URL && n instanceof URL)) &&
    (n = fetch(n))
  const { instance: r, module: _ } = await (async function (e, n) {
    if ('function' == typeof Response && e instanceof Response) {
      if (!e.ok)
        throw new Error(`failed to fetch Wasm: ${e.status} ${e.statusText} fetching '${e.url}'`)
      if ('function' == typeof WebAssembly.instantiateStreaming)
        try {
          return await WebAssembly.instantiateStreaming(e, n)
        } catch (n) {
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
            throw n
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            n
          )
        }
      const t = await e.arrayBuffer()
      return await WebAssembly.instantiate(t, n)
    }
    {
      const t = await WebAssembly.instantiate(e, n)
      return t instanceof WebAssembly.Instance ? { instance: t, module: e } : t
    }
  })(await n, t)
  return W(r, _)
}
export { I as initSync, z as default }
