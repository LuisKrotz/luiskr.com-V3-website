/* @ts-self-types="./luiskr_close_button.d.ts" */
export class CloseButton {
  __destroy_into_raw() {
    const t = this.__wbg_ptr
    return ((this.__wbg_ptr = 0), i.unregister(this), t)
  }
  free() {
    const t = this.__destroy_into_raw()
    L.__wbg_closebutton_free(t, 0)
  }
  click(t) {
    L.closebutton_click(this.__wbg_ptr, t)
  }
  frame(t) {
    L.closebutton_frame(this.__wbg_ptr, t)
  }
  init(t, n) {
    try {
      const r = L.__wbindgen_add_to_stack_pointer(-16)
      L.closebutton_init(r, this.__wbg_ptr, u(t), u(n))
      var e = g().getInt32(r + 0, !0)
      if (g().getInt32(r + 4, !0)) throw v(e)
    } finally {
      L.__wbindgen_add_to_stack_pointer(16)
    }
  }
  constructor() {
    const t = L.closebutton_new()
    return ((this.__wbg_ptr = t), i.register(this, this.__wbg_ptr, this), this)
  }
  resize(t, n) {
    L.closebutton_resize(this.__wbg_ptr, t, n)
  }
  set_size(t, n) {
    L.closebutton_set_size(this.__wbg_ptr, t, n)
  }
  set_state(t, n, e) {
    L.closebutton_set_state(this.__wbg_ptr, t, n, e)
  }
}
function t() {
  const t = {
    __proto__: null,
    __wbg___wbindgen_debug_string_4687d8d8c2017d52: function (t, n) {
      const e = (function (t, n, e) {
          if (void 0 === e) {
            const e = S.encode(t),
              r = n(e.length, 1) >>> 0
            return (
              w()
                .subarray(r, r + e.length)
                .set(e),
              (P = e.length),
              r
            )
          }
          let r = t.length,
            o = n(r, 1) >>> 0
          const _ = w()
          let c = 0
          for (; c < r; c++) {
            const n = t.charCodeAt(c)
            if (n > 127) break
            _[o + c] = n
          }
          if (c !== r) {
            ;(0 !== c && (t = t.slice(c)), (o = e(o, r, (r = c + 3 * t.length), 1) >>> 0))
            const n = w().subarray(o + c, o + r)
            ;((c += S.encodeInto(t, n).written), (o = e(o, r, c, 1) >>> 0))
          }
          return ((P = c), o)
        })(a(m(n)), L.__wbindgen_export, L.__wbindgen_export2),
        r = P
      ;(g().setInt32(t + 4, r, !0), g().setInt32(t + 0, e, !0))
    },
    __wbg___wbindgen_is_null_e343b7d08827ba72: function (t) {
      return null === m(t)
    },
    __wbg___wbindgen_is_undefined_8865fb403f8fe9d8: function (t) {
      return void 0 === m(t)
    },
    __wbg___wbindgen_throw_41e9ee4f547fc59a: function (t, n) {
      throw new Error(d(t, n))
    },
    __wbg_beginRenderPass_46bc75d13eaf7381: function () {
      return p(function (t, n) {
        return u(m(t).beginRenderPass(m(n)))
      }, arguments)
    },
    __wbg_configure_a4e26031ba2da6a2: function () {
      return p(function (t, n) {
        m(t).configure(m(n))
      }, arguments)
    },
    __wbg_createBindGroupLayout_dd6a685e68699be9: function () {
      return p(function (t, n) {
        return u(m(t).createBindGroupLayout(m(n)))
      }, arguments)
    },
    __wbg_createBindGroup_297f726263493b7a: function (t, n) {
      return u(m(t).createBindGroup(m(n)))
    },
    __wbg_createBuffer_7d58b37b7042f31f: function () {
      return p(function (t, n) {
        return u(m(t).createBuffer(m(n)))
      }, arguments)
    },
    __wbg_createCommandEncoder_d26cb1fdb68219f7: function (t, n) {
      return u(m(t).createCommandEncoder(m(n)))
    },
    __wbg_createPipelineLayout_39a9a7f694e28389: function (t, n) {
      return u(m(t).createPipelineLayout(m(n)))
    },
    __wbg_createRenderPipeline_e7c57f75917917e4: function () {
      return p(function (t, n) {
        return u(m(t).createRenderPipeline(m(n)))
      }, arguments)
    },
    __wbg_createShaderModule_274373c4cacce3a0: function (t, n) {
      return u(m(t).createShaderModule(m(n)))
    },
    __wbg_createView_7520397d720e9d7d: function () {
      return p(function (t) {
        return u(m(t).createView())
      }, arguments)
    },
    __wbg_draw_b3ff1fa9ff891153: function (t, n) {
      m(t).draw(n >>> 0)
    },
    __wbg_end_a97f51ac1f092bfe: function (t) {
      m(t).end()
    },
    __wbg_finish_489db1750712613c: function (t) {
      return u(m(t).finish())
    },
    __wbg_getContext_635e36719cad2623: function () {
      return p(function (t, n, e) {
        const r = m(t).getContext(d(n, e))
        return x(r) ? 0 : u(r)
      }, arguments)
    },
    __wbg_getCurrentTexture_f9b3ddbfb8575837: function () {
      return p(function (t) {
        return u(m(t).getCurrentTexture())
      }, arguments)
    },
    __wbg_getPreferredCanvasFormat_4d28b652aa67cc74: function (t) {
      const n = m(t).getPreferredCanvasFormat()
      return (s.indexOf(n) + 1 || 102) - 1
    },
    __wbg_get_31af05bd4842a84f: function () {
      return p(function (t, n) {
        return u(Reflect.get(m(t), m(n)))
      }, arguments)
    },
    __wbg_new_617a8cdb8bb1130e: function () {
      return u(new Object())
    },
    __wbg_queue_17ba8833afbd540b: function (t) {
      return u(m(t).queue)
    },
    __wbg_setBindGroup_4af09961dd6fd6d4: function (t, n, e) {
      m(t).setBindGroup(n >>> 0, m(e))
    },
    __wbg_setPipeline_9870f87d9e0a49ab: function (t, n) {
      m(t).setPipeline(m(n))
    },
    __wbg_setScissorRect_78603d18fd6477a3: function (t, n, e, r, o) {
      m(t).setScissorRect(n >>> 0, e >>> 0, r >>> 0, o >>> 0)
    },
    __wbg_set_a_d2dae9a62946ba86: function (t, n) {
      m(t).a = n
    },
    __wbg_set_alpha_b14827cf8b4ac26a: function (t, n) {
      m(t).alpha = m(n)
    },
    __wbg_set_alpha_mode_16c3966c224ad4a9: function (t, n) {
      m(t).alphaMode = o[n]
    },
    __wbg_set_b_670dfc0631dcb9c1: function (t, n) {
      m(t).b = n
    },
    __wbg_set_bind_group_layouts_60a4869809302d79: function (t, n, e) {
      m(t).bindGroupLayouts = b(n, e)
    },
    __wbg_set_binding_1d51e1a2d1c0cdaf: function (t, n) {
      m(t).binding = n >>> 0
    },
    __wbg_set_binding_348f002e688081ac: function (t, n) {
      m(t).binding = n >>> 0
    },
    __wbg_set_blend_3f83603fc878c51d: function (t, n) {
      m(t).blend = m(n)
    },
    __wbg_set_buffer_22331adbf81699d2: function (t, n) {
      m(t).buffer = m(n)
    },
    __wbg_set_buffer_b8d40a54af365605: function (t, n) {
      m(t).buffer = m(n)
    },
    __wbg_set_clear_value_gpu_color_dict_c17321221601e286: function (t, n) {
      m(t).clearValue = m(n)
    },
    __wbg_set_code_4510e93549b3066e: function (t, n, e) {
      m(t).code = d(n, e)
    },
    __wbg_set_color_14d2fdcfc7117305: function (t, n) {
      m(t).color = m(n)
    },
    __wbg_set_color_attachments_367a5baf85bca057: function (t, n, e) {
      m(t).colorAttachments = b(n, e)
    },
    __wbg_set_device_53f6c9076263d322: function (t, n) {
      m(t).device = m(n)
    },
    __wbg_set_dst_factor_cfb1cd4ae3e673d9: function (t, e) {
      m(t).dstFactor = n[e]
    },
    __wbg_set_entries_7c51a3643c761ecf: function (t, n, e) {
      m(t).entries = b(n, e)
    },
    __wbg_set_entries_cc80db0de96ea4ff: function (t, n, e) {
      m(t).entries = b(n, e)
    },
    __wbg_set_entry_point_a7593f073d0352f7: function (t, n, e) {
      m(t).entryPoint = d(n, e)
    },
    __wbg_set_entry_point_edfb9dd004493bc8: function (t, n, e) {
      m(t).entryPoint = d(n, e)
    },
    __wbg_set_format_036434fd3db220e7: function (t, n) {
      m(t).format = s[n]
    },
    __wbg_set_format_d4c8ef73b087dab0: function (t, n) {
      m(t).format = s[n]
    },
    __wbg_set_fragment_9bc5cc98c7c59fef: function (t, n) {
      m(t).fragment = m(n)
    },
    __wbg_set_g_ac69babc4a0b2338: function (t, n) {
      m(t).g = n
    },
    __wbg_set_has_dynamic_offset_e2a0bd85eaf36f34: function (t, n) {
      m(t).hasDynamicOffset = 0 !== n
    },
    __wbg_set_layout_4e86f7c1671a06d0: function (t, n) {
      m(t).layout = m(n)
    },
    __wbg_set_layout_f2b50454b73e9111: function (t, n) {
      m(t).layout = m(n)
    },
    __wbg_set_load_op_18ff54287ff40151: function (t, n) {
      m(t).loadOp = _[n]
    },
    __wbg_set_module_168054323d22d57d: function (t, n) {
      m(t).module = m(n)
    },
    __wbg_set_module_1ad4e7343951303d: function (t, n) {
      m(t).module = m(n)
    },
    __wbg_set_operation_d8894b0f9aa3db27: function (t, n) {
      m(t).operation = e[n]
    },
    __wbg_set_r_ccf9fe3e4d993555: function (t, n) {
      m(t).r = n
    },
    __wbg_set_resource_gpu_buffer_binding_c689b0dc9379a99b: function (t, n) {
      m(t).resource = m(n)
    },
    __wbg_set_size_4716cf40ee7a64be: function (t, n) {
      m(t).size = n >>> 0
    },
    __wbg_set_src_factor_b29ea819b1b5d6f6: function (t, e) {
      m(t).srcFactor = n[e]
    },
    __wbg_set_store_op_6d2fb6cc3e66341e: function (t, n) {
      m(t).storeOp = c[n]
    },
    __wbg_set_targets_0328c60fcfc0f564: function (t, n, e) {
      m(t).targets = b(n, e)
    },
    __wbg_set_type_ff9e8f3110ad0cbf: function (t, n) {
      m(t).type = r[n]
    },
    __wbg_set_usage_7177d2b5a0cb7ed1: function (t, n) {
      m(t).usage = n >>> 0
    },
    __wbg_set_usage_e842e619c53799e7: function (t, n) {
      m(t).usage = n >>> 0
    },
    __wbg_set_vertex_5b13839ffaff5f37: function (t, n) {
      m(t).vertex = m(n)
    },
    __wbg_set_view_gpu_texture_view_9f7613e516713508: function (t, n) {
      m(t).view = m(n)
    },
    __wbg_set_visibility_78cfb96740c9deb5: function (t, n) {
      m(t).visibility = n >>> 0
    },
    __wbg_static_accessor_GLOBAL_266715b9d96ba635: function () {
      const t = 'undefined' == typeof global ? null : global
      return x(t) ? 0 : u(t)
    },
    __wbg_static_accessor_GLOBAL_THIS_10fb7dc1ae063179: function () {
      const t = 'undefined' == typeof globalThis ? null : globalThis
      return x(t) ? 0 : u(t)
    },
    __wbg_static_accessor_SELF_0b583911f537483a: function () {
      const t = 'undefined' == typeof self ? null : self
      return x(t) ? 0 : u(t)
    },
    __wbg_static_accessor_WINDOW_d7f903d1508cbdc4: function () {
      const t = 'undefined' == typeof window ? null : window
      return x(t) ? 0 : u(t)
    },
    __wbg_submit_46ecaa46ea244579: function (t, n, e) {
      m(t).submit(b(n, e))
    },
    __wbg_writeBuffer_2c02702ce0fa25c3: function () {
      return p(function (t, n, e, r, o) {
        var _, c
        m(t).writeBuffer(
          m(n),
          e >>> 0,
          ((_ = r), (c = o), (_ >>>= 0), w().subarray(_ / 1, _ / 1 + c))
        )
      }, arguments)
    },
    __wbindgen_generic_0000000000000001: function (t, n) {
      return u(d(t, n))
    },
    __wbindgen_object_clone_ref: function (t) {
      return u(m(t))
    },
    __wbindgen_object_drop_ref: function (t) {
      v(t)
    },
  }
  return { __proto__: null, './luiskr_close_button_bg.js': t }
}
Symbol.dispose && (CloseButton.prototype[Symbol.dispose] = CloseButton.prototype.free)
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
  e = ['add', 'subtract', 'reverse-subtract', 'min', 'max'],
  r = ['uniform', 'storage', 'read-only-storage'],
  o = ['opaque', 'premultiplied'],
  _ = ['load', 'clear'],
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
  i =
    'undefined' == typeof FinalizationRegistry
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry((t) => L.__wbg_closebutton_free(t, 1))
function u(t) {
  h === y.length && y.push(y.length + 1)
  const n = h
  return ((h = y[n]), (y[n] = t), n)
}
function a(t) {
  const n = typeof t
  if ('number' == n || 'boolean' == n || null == t) return `${t}`
  if ('string' == n) return `"${t}"`
  if ('symbol' == n) {
    const n = t.description
    return null == n ? 'Symbol' : `Symbol(${n})`
  }
  if ('function' == n) {
    const n = t.name
    return 'string' == typeof n && n.length > 0 ? `Function(${n})` : 'Function'
  }
  if (Array.isArray(t)) {
    const n = t.length
    let e = '['
    n > 0 && (e += a(t[0]))
    for (let r = 1; r < n; r++) e += ', ' + a(t[r])
    return ((e += ']'), e)
  }
  const e = /\[object ([^\]]+)\]/.exec(toString.call(t))
  let r
  if (!(e && e.length > 1)) return toString.call(t)
  if (((r = e[1]), 'Object' == r))
    try {
      return 'Object(' + JSON.stringify(t) + ')'
    } catch (t) {
      return 'Object'
    }
  return t instanceof Error ? `${t.name}: ${t.message}\n${t.stack}` : r
}
function b(t, n) {
  t >>>= 0
  const e = g(),
    r = []
  for (let o = t; o < t + 4 * n; o += 4) r.push(m(e.getUint32(o, !0)))
  return r
}
let f = null
function g() {
  return (
    (null === f ||
      !0 === f.buffer.detached ||
      (void 0 === f.buffer.detached && f.buffer !== L.memory.buffer)) &&
      (f = new DataView(L.memory.buffer)),
    f
  )
}
function d(t, n) {
  return (function (t, n) {
    return (
      (B += n),
      B >= A && ((O = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), O.decode(), (B = n)),
      O.decode(w().subarray(t, t + n))
    )
  })(t >>> 0, n)
}
let l = null
function w() {
  return ((null !== l && 0 !== l.byteLength) || (l = new Uint8Array(L.memory.buffer)), l)
}
function m(t) {
  return y[t]
}
function p(t, n) {
  try {
    return t.apply(this, n)
  } catch (t) {
    L.__wbindgen_export3(u(t))
  }
}
let y = new Array(1024).fill(void 0)
y.push(void 0, null, !0, !1)
let h = y.length
function x(t) {
  return null == t
}
function v(t) {
  const n = m(t)
  return (
    (function (t) {
      t < 1028 || ((y[t] = h), (h = t))
    })(t),
    n
  )
}
let O = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })
O.decode()
const A = 2146435072
let B = 0
const S = new TextEncoder()
'encodeInto' in S ||
  (S.encodeInto = function (t, n) {
    const e = S.encode(t)
    return (n.set(e), { read: t.length, written: e.length })
  })
let R,
  j,
  L,
  P = 0
function W(t, n) {
  return ((j = t), (L = t.exports), (R = n), (f = null), (l = null), L)
}
function C(n) {
  if (void 0 !== L) return L
  void 0 !== n &&
    (Object.getPrototypeOf(n) === Object.prototype
      ? ({ module: n } = n)
      : console.warn('using deprecated parameters for `initSync()`; pass a single object instead'))
  const e = t()
  return (
    n instanceof WebAssembly.Module || (n = new WebAssembly.Module(n)),
    W(new WebAssembly.Instance(n, e), n)
  )
}
async function I(n) {
  if (void 0 !== L) return L
  ;(void 0 !== n &&
    (Object.getPrototypeOf(n) === Object.prototype
      ? ({ module_or_path: n } = n)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    void 0 === n && (n = new URL('luiskr_close_button_bg.wasm', import.meta.url)))
  const e = t()
  ;('string' == typeof n ||
    ('function' == typeof Request && n instanceof Request) ||
    ('function' == typeof URL && n instanceof URL)) &&
    (n = fetch(n))
  const { instance: r, module: o } = await (async function (t, n) {
    if ('function' == typeof Response && t instanceof Response) {
      if (!t.ok)
        throw new Error(`failed to fetch Wasm: ${t.status} ${t.statusText} fetching '${t.url}'`)
      if ('function' == typeof WebAssembly.instantiateStreaming)
        try {
          return await WebAssembly.instantiateStreaming(t, n)
        } catch (n) {
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
            throw n
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            n
          )
        }
      const e = await t.arrayBuffer()
      return await WebAssembly.instantiate(e, n)
    }
    {
      const e = await WebAssembly.instantiate(t, n)
      return e instanceof WebAssembly.Instance ? { instance: e, module: t } : e
    }
  })(await n, e)
  return W(r, o)
}
export { C as initSync, I as default }
