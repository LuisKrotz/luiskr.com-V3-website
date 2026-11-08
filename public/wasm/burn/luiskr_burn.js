/* @ts-self-types="./luiskr_burn.d.ts" */
export class Burn {
  __destroy_into_raw() {
    const t = this.__wbg_ptr
    return ((this.__wbg_ptr = 0), s.unregister(this), t)
  }
  free() {
    const t = this.__destroy_into_raw()
    W.__wbg_burn_free(t, 0)
  }
  begin(t, n, e, r) {
    W.burn_begin(this.__wbg_ptr, t, n, e, r)
  }
  frame(t) {
    W.burn_frame(this.__wbg_ptr, t)
  }
  init(t, n) {
    try {
      const r = W.__wbindgen_add_to_stack_pointer(-16)
      W.burn_init(r, this.__wbg_ptr, u(t), u(n))
      var e = g().getInt32(r + 0, !0)
      if (g().getInt32(r + 4, !0)) throw A(e)
    } finally {
      W.__wbindgen_add_to_stack_pointer(16)
    }
  }
  live_particles() {
    return W.burn_live_particles(this.__wbg_ptr) >>> 0
  }
  constructor() {
    const t = W.burn_new()
    return ((this.__wbg_ptr = t), s.register(this, this.__wbg_ptr, this), this)
  }
  resize(t, n) {
    W.burn_resize(this.__wbg_ptr, t, n)
  }
  set_colors(t) {
    const n = O(t, W.__wbindgen_export),
      e = I
    W.burn_set_colors(this.__wbg_ptr, n, e)
  }
  set_dir(t) {
    W.burn_set_dir(this.__wbg_ptr, t)
  }
  set_ink(t) {
    const n = (function (t) {
        const n = (0, W.__wbindgen_export)(1 * t.length, 1) >>> 0
        return (m().set(t, n / 1), (I = t.length), n)
      })(t),
      e = I
    W.burn_set_ink(this.__wbg_ptr, n, e)
  }
  set_letters(t) {
    const n = O(t, W.__wbindgen_export),
      e = I
    W.burn_set_letters(this.__wbg_ptr, n, e)
  }
  set_origin(t, n) {
    W.burn_set_origin(this.__wbg_ptr, t, n)
  }
  set_size(t, n) {
    W.burn_set_size(this.__wbg_ptr, t, n)
  }
  set_stage(t, n) {
    W.burn_set_stage(this.__wbg_ptr, t, n)
  }
}
function t() {
  const t = {
    __proto__: null,
    __wbg___wbindgen_debug_string_4687d8d8c2017d52: function (t, n) {
      const e = (function (t, n, e) {
          if (void 0 === e) {
            const e = j.encode(t),
              r = n(e.length, 1) >>> 0
            return (
              m()
                .subarray(r, r + e.length)
                .set(e),
              (I = e.length),
              r
            )
          }
          let r = t.length,
            _ = n(r, 1) >>> 0
          const o = m()
          let c = 0
          for (; c < r; c++) {
            const n = t.charCodeAt(c)
            if (n > 127) break
            o[_ + c] = n
          }
          if (c !== r) {
            ;(0 !== c && (t = t.slice(c)), (_ = e(_, r, (r = c + 3 * t.length), 1) >>> 0))
            const n = m().subarray(_ + c, _ + r)
            ;((c += j.encodeInto(t, n).written), (_ = e(_, r, c, 1) >>> 0))
          }
          return ((I = c), _)
        })(a(p(n)), W.__wbindgen_export, W.__wbindgen_export2),
        r = I
      ;(g().setInt32(t + 4, r, !0), g().setInt32(t + 0, e, !0))
    },
    __wbg___wbindgen_is_null_e343b7d08827ba72: function (t) {
      return null === p(t)
    },
    __wbg___wbindgen_is_undefined_8865fb403f8fe9d8: function (t) {
      return void 0 === p(t)
    },
    __wbg___wbindgen_throw_41e9ee4f547fc59a: function (t, n) {
      throw new Error(l(t, n))
    },
    __wbg_beginRenderPass_46bc75d13eaf7381: function () {
      return h(function (t, n) {
        return u(p(t).beginRenderPass(p(n)))
      }, arguments)
    },
    __wbg_configure_a4e26031ba2da6a2: function () {
      return h(function (t, n) {
        p(t).configure(p(n))
      }, arguments)
    },
    __wbg_createBindGroupLayout_dd6a685e68699be9: function () {
      return h(function (t, n) {
        return u(p(t).createBindGroupLayout(p(n)))
      }, arguments)
    },
    __wbg_createBindGroup_297f726263493b7a: function (t, n) {
      return u(p(t).createBindGroup(p(n)))
    },
    __wbg_createBuffer_7d58b37b7042f31f: function () {
      return h(function (t, n) {
        return u(p(t).createBuffer(p(n)))
      }, arguments)
    },
    __wbg_createCommandEncoder_d26cb1fdb68219f7: function (t, n) {
      return u(p(t).createCommandEncoder(p(n)))
    },
    __wbg_createPipelineLayout_39a9a7f694e28389: function (t, n) {
      return u(p(t).createPipelineLayout(p(n)))
    },
    __wbg_createRenderPipeline_e7c57f75917917e4: function () {
      return h(function (t, n) {
        return u(p(t).createRenderPipeline(p(n)))
      }, arguments)
    },
    __wbg_createShaderModule_274373c4cacce3a0: function (t, n) {
      return u(p(t).createShaderModule(p(n)))
    },
    __wbg_createView_7520397d720e9d7d: function () {
      return h(function (t) {
        return u(p(t).createView())
      }, arguments)
    },
    __wbg_draw_889697bdf4cad1b7: function (t, n, e) {
      p(t).draw(n >>> 0, e >>> 0)
    },
    __wbg_end_a97f51ac1f092bfe: function (t) {
      p(t).end()
    },
    __wbg_finish_489db1750712613c: function (t) {
      return u(p(t).finish())
    },
    __wbg_getContext_635e36719cad2623: function () {
      return h(function (t, n, e) {
        const r = p(t).getContext(l(n, e))
        return v(r) ? 0 : u(r)
      }, arguments)
    },
    __wbg_getCurrentTexture_f9b3ddbfb8575837: function () {
      return h(function (t) {
        return u(p(t).getCurrentTexture())
      }, arguments)
    },
    __wbg_getPreferredCanvasFormat_4d28b652aa67cc74: function (t) {
      const n = p(t).getPreferredCanvasFormat()
      return (i.indexOf(n) + 1 || 102) - 1
    },
    __wbg_get_31af05bd4842a84f: function () {
      return h(function (t, n) {
        return u(Reflect.get(p(t), p(n)))
      }, arguments)
    },
    __wbg_new_617a8cdb8bb1130e: function () {
      return u(new Object())
    },
    __wbg_queue_17ba8833afbd540b: function (t) {
      return u(p(t).queue)
    },
    __wbg_setBindGroup_4af09961dd6fd6d4: function (t, n, e) {
      p(t).setBindGroup(n >>> 0, p(e))
    },
    __wbg_setPipeline_9870f87d9e0a49ab: function (t, n) {
      p(t).setPipeline(p(n))
    },
    __wbg_set_a_d2dae9a62946ba86: function (t, n) {
      p(t).a = n
    },
    __wbg_set_alpha_b14827cf8b4ac26a: function (t, n) {
      p(t).alpha = p(n)
    },
    __wbg_set_alpha_mode_16c3966c224ad4a9: function (t, n) {
      p(t).alphaMode = _[n]
    },
    __wbg_set_b_670dfc0631dcb9c1: function (t, n) {
      p(t).b = n
    },
    __wbg_set_bind_group_layouts_60a4869809302d79: function (t, n, e) {
      p(t).bindGroupLayouts = b(n, e)
    },
    __wbg_set_binding_1d51e1a2d1c0cdaf: function (t, n) {
      p(t).binding = n >>> 0
    },
    __wbg_set_binding_348f002e688081ac: function (t, n) {
      p(t).binding = n >>> 0
    },
    __wbg_set_blend_3f83603fc878c51d: function (t, n) {
      p(t).blend = p(n)
    },
    __wbg_set_buffer_22331adbf81699d2: function (t, n) {
      p(t).buffer = p(n)
    },
    __wbg_set_buffer_b8d40a54af365605: function (t, n) {
      p(t).buffer = p(n)
    },
    __wbg_set_clear_value_gpu_color_dict_c17321221601e286: function (t, n) {
      p(t).clearValue = p(n)
    },
    __wbg_set_code_4510e93549b3066e: function (t, n, e) {
      p(t).code = l(n, e)
    },
    __wbg_set_color_14d2fdcfc7117305: function (t, n) {
      p(t).color = p(n)
    },
    __wbg_set_color_attachments_367a5baf85bca057: function (t, n, e) {
      p(t).colorAttachments = b(n, e)
    },
    __wbg_set_device_53f6c9076263d322: function (t, n) {
      p(t).device = p(n)
    },
    __wbg_set_dst_factor_cfb1cd4ae3e673d9: function (t, e) {
      p(t).dstFactor = n[e]
    },
    __wbg_set_entries_7c51a3643c761ecf: function (t, n, e) {
      p(t).entries = b(n, e)
    },
    __wbg_set_entries_cc80db0de96ea4ff: function (t, n, e) {
      p(t).entries = b(n, e)
    },
    __wbg_set_entry_point_a7593f073d0352f7: function (t, n, e) {
      p(t).entryPoint = l(n, e)
    },
    __wbg_set_entry_point_edfb9dd004493bc8: function (t, n, e) {
      p(t).entryPoint = l(n, e)
    },
    __wbg_set_format_036434fd3db220e7: function (t, n) {
      p(t).format = i[n]
    },
    __wbg_set_format_d4c8ef73b087dab0: function (t, n) {
      p(t).format = i[n]
    },
    __wbg_set_fragment_9bc5cc98c7c59fef: function (t, n) {
      p(t).fragment = p(n)
    },
    __wbg_set_g_ac69babc4a0b2338: function (t, n) {
      p(t).g = n
    },
    __wbg_set_has_dynamic_offset_e2a0bd85eaf36f34: function (t, n) {
      p(t).hasDynamicOffset = 0 !== n
    },
    __wbg_set_layout_4e86f7c1671a06d0: function (t, n) {
      p(t).layout = p(n)
    },
    __wbg_set_layout_f2b50454b73e9111: function (t, n) {
      p(t).layout = p(n)
    },
    __wbg_set_load_op_18ff54287ff40151: function (t, n) {
      p(t).loadOp = o[n]
    },
    __wbg_set_module_168054323d22d57d: function (t, n) {
      p(t).module = p(n)
    },
    __wbg_set_module_1ad4e7343951303d: function (t, n) {
      p(t).module = p(n)
    },
    __wbg_set_operation_d8894b0f9aa3db27: function (t, n) {
      p(t).operation = e[n]
    },
    __wbg_set_r_ccf9fe3e4d993555: function (t, n) {
      p(t).r = n
    },
    __wbg_set_resource_gpu_buffer_binding_c689b0dc9379a99b: function (t, n) {
      p(t).resource = p(n)
    },
    __wbg_set_size_4716cf40ee7a64be: function (t, n) {
      p(t).size = n >>> 0
    },
    __wbg_set_src_factor_b29ea819b1b5d6f6: function (t, e) {
      p(t).srcFactor = n[e]
    },
    __wbg_set_store_op_6d2fb6cc3e66341e: function (t, n) {
      p(t).storeOp = c[n]
    },
    __wbg_set_targets_0328c60fcfc0f564: function (t, n, e) {
      p(t).targets = b(n, e)
    },
    __wbg_set_type_ff9e8f3110ad0cbf: function (t, n) {
      p(t).type = r[n]
    },
    __wbg_set_usage_7177d2b5a0cb7ed1: function (t, n) {
      p(t).usage = n >>> 0
    },
    __wbg_set_usage_e842e619c53799e7: function (t, n) {
      p(t).usage = n >>> 0
    },
    __wbg_set_vertex_5b13839ffaff5f37: function (t, n) {
      p(t).vertex = p(n)
    },
    __wbg_set_view_gpu_texture_view_9f7613e516713508: function (t, n) {
      p(t).view = p(n)
    },
    __wbg_set_visibility_78cfb96740c9deb5: function (t, n) {
      p(t).visibility = n >>> 0
    },
    __wbg_static_accessor_GLOBAL_266715b9d96ba635: function () {
      const t = 'undefined' == typeof global ? null : global
      return v(t) ? 0 : u(t)
    },
    __wbg_static_accessor_GLOBAL_THIS_10fb7dc1ae063179: function () {
      const t = 'undefined' == typeof globalThis ? null : globalThis
      return v(t) ? 0 : u(t)
    },
    __wbg_static_accessor_SELF_0b583911f537483a: function () {
      const t = 'undefined' == typeof self ? null : self
      return v(t) ? 0 : u(t)
    },
    __wbg_static_accessor_WINDOW_d7f903d1508cbdc4: function () {
      const t = 'undefined' == typeof window ? null : window
      return v(t) ? 0 : u(t)
    },
    __wbg_submit_46ecaa46ea244579: function (t, n, e) {
      p(t).submit(b(n, e))
    },
    __wbg_writeBuffer_2c02702ce0fa25c3: function () {
      return h(function (t, n, e, r, _) {
        var o, c
        p(t).writeBuffer(
          p(n),
          e >>> 0,
          ((o = r), (c = _), (o >>>= 0), m().subarray(o / 1, o / 1 + c))
        )
      }, arguments)
    },
    __wbindgen_generic_0000000000000001: function (t, n) {
      return u(l(t, n))
    },
    __wbindgen_object_clone_ref: function (t) {
      return u(p(t))
    },
    __wbindgen_object_drop_ref: function (t) {
      A(t)
    },
  }
  return { __proto__: null, './luiskr_burn_bg.js': t }
}
Symbol.dispose && (Burn.prototype[Symbol.dispose] = Burn.prototype.free)
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
      : new FinalizationRegistry((t) => W.__wbg_burn_free(t, 1))
function u(t) {
  x === y.length && y.push(y.length + 1)
  const n = x
  return ((x = y[n]), (y[n] = t), n)
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
  for (let _ = t; _ < t + 4 * n; _ += 4) r.push(p(e.getUint32(_, !0)))
  return r
}
let f = null
function g() {
  return (
    (null === f ||
      !0 === f.buffer.detached ||
      (void 0 === f.buffer.detached && f.buffer !== W.memory.buffer)) &&
      (f = new DataView(W.memory.buffer)),
    f
  )
}
let d = null
function l(t, n) {
  return (function (t, n) {
    return (
      (S += n),
      S >= L && ((B = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), B.decode(), (S = n)),
      B.decode(m().subarray(t, t + n))
    )
  })(t >>> 0, n)
}
let w = null
function m() {
  return ((null !== w && 0 !== w.byteLength) || (w = new Uint8Array(W.memory.buffer)), w)
}
function p(t) {
  return y[t]
}
function h(t, n) {
  try {
    return t.apply(this, n)
  } catch (t) {
    W.__wbindgen_export3(u(t))
  }
}
let y = new Array(1024).fill(void 0)
y.push(void 0, null, !0, !1)
let x = y.length
function v(t) {
  return null == t
}
function O(t, n) {
  const e = n(4 * t.length, 4) >>> 0
  return (
    ((null !== d && 0 !== d.byteLength) || (d = new Float32Array(W.memory.buffer)), d).set(
      t,
      e / 4
    ),
    (I = t.length),
    e
  )
}
function A(t) {
  const n = p(t)
  return (
    (function (t) {
      t < 1028 || ((y[t] = x), (x = t))
    })(t),
    n
  )
}
let B = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })
B.decode()
const L = 2146435072
let S = 0
const j = new TextEncoder()
'encodeInto' in j ||
  (j.encodeInto = function (t, n) {
    const e = j.encode(t)
    return (n.set(e), { read: t.length, written: e.length })
  })
let P,
  R,
  W,
  I = 0
function F(t, n) {
  return ((R = t), (W = t.exports), (P = n), (f = null), (d = null), (w = null), W)
}
function k(n) {
  if (void 0 !== W) return W
  void 0 !== n &&
    (Object.getPrototypeOf(n) === Object.prototype
      ? ({ module: n } = n)
      : console.warn('using deprecated parameters for `initSync()`; pass a single object instead'))
  const e = t()
  return (
    n instanceof WebAssembly.Module || (n = new WebAssembly.Module(n)),
    F(new WebAssembly.Instance(n, e), n)
  )
}
async function z(n) {
  if (void 0 !== W) return W
  ;(void 0 !== n &&
    (Object.getPrototypeOf(n) === Object.prototype
      ? ({ module_or_path: n } = n)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    void 0 === n && (n = new URL('luiskr_burn_bg.wasm', import.meta.url)))
  const e = t()
  ;('string' == typeof n ||
    ('function' == typeof Request && n instanceof Request) ||
    ('function' == typeof URL && n instanceof URL)) &&
    (n = fetch(n))
  const { instance: r, module: _ } = await (async function (t, n) {
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
  return F(r, _)
}
export { k as initSync, z as default }
