/* @ts-self-types="./luiskr_menu_background.d.ts" */
export class MenuBackground {
  __destroy_into_raw() {
    const n = this.__wbg_ptr
    return ((this.__wbg_ptr = 0), a.unregister(this), n)
  }
  free() {
    const n = this.__destroy_into_raw()
    j.__wbg_menubackground_free(n, 0)
  }
  frame(n) {
    j.menubackground_frame(this.__wbg_ptr, n)
  }
  init(n, t) {
    try {
      const r = j.__wbindgen_add_to_stack_pointer(-16)
      j.menubackground_init(r, this.__wbg_ptr, i(n), i(t))
      var e = g().getInt32(r + 0, !0)
      if (g().getInt32(r + 4, !0)) throw v(e)
    } finally {
      j.__wbindgen_add_to_stack_pointer(16)
    }
  }
  constructor() {
    const n = j.menubackground_new()
    return ((this.__wbg_ptr = n), a.register(this, this.__wbg_ptr, this), this)
  }
  resize(n, t) {
    j.menubackground_resize(this.__wbg_ptr, n, t)
  }
  set_size(n, t) {
    j.menubackground_set_size(this.__wbg_ptr, n, t)
  }
  set_state(n, t, e, r, _, o, c, u) {
    j.menubackground_set_state(this.__wbg_ptr, n, t, e, r, _, o, c, u)
  }
}
function n() {
  const n = {
    __proto__: null,
    __wbg___wbindgen_debug_string_4687d8d8c2017d52: function (n, t) {
      const e = (function (n, t, e) {
          if (void 0 === e) {
            const e = B.encode(n),
              r = t(e.length, 1) >>> 0
            return (
              m()
                .subarray(r, r + e.length)
                .set(e),
              (L = e.length),
              r
            )
          }
          let r = n.length,
            _ = t(r, 1) >>> 0
          const o = m()
          let c = 0
          for (; c < r; c++) {
            const t = n.charCodeAt(c)
            if (t > 127) break
            o[_ + c] = t
          }
          if (c !== r) {
            ;(0 !== c && (n = n.slice(c)), (_ = e(_, r, (r = c + 3 * n.length), 1) >>> 0))
            const t = m().subarray(_ + c, _ + r)
            ;((c += B.encodeInto(n, t).written), (_ = e(_, r, c, 1) >>> 0))
          }
          return ((L = c), _)
        })(s(w(t)), j.__wbindgen_export, j.__wbindgen_export2),
        r = L
      ;(g().setInt32(n + 4, r, !0), g().setInt32(n + 0, e, !0))
    },
    __wbg___wbindgen_is_null_e343b7d08827ba72: function (n) {
      return null === w(n)
    },
    __wbg___wbindgen_is_undefined_8865fb403f8fe9d8: function (n) {
      return void 0 === w(n)
    },
    __wbg___wbindgen_throw_41e9ee4f547fc59a: function (n, t) {
      throw new Error(d(n, t))
    },
    __wbg_beginRenderPass_46bc75d13eaf7381: function () {
      return p(function (n, t) {
        return i(w(n).beginRenderPass(w(t)))
      }, arguments)
    },
    __wbg_configure_a4e26031ba2da6a2: function () {
      return p(function (n, t) {
        w(n).configure(w(t))
      }, arguments)
    },
    __wbg_createBindGroupLayout_dd6a685e68699be9: function () {
      return p(function (n, t) {
        return i(w(n).createBindGroupLayout(w(t)))
      }, arguments)
    },
    __wbg_createBindGroup_297f726263493b7a: function (n, t) {
      return i(w(n).createBindGroup(w(t)))
    },
    __wbg_createBuffer_7d58b37b7042f31f: function () {
      return p(function (n, t) {
        return i(w(n).createBuffer(w(t)))
      }, arguments)
    },
    __wbg_createCommandEncoder_d26cb1fdb68219f7: function (n, t) {
      return i(w(n).createCommandEncoder(w(t)))
    },
    __wbg_createPipelineLayout_39a9a7f694e28389: function (n, t) {
      return i(w(n).createPipelineLayout(w(t)))
    },
    __wbg_createRenderPipeline_e7c57f75917917e4: function () {
      return p(function (n, t) {
        return i(w(n).createRenderPipeline(w(t)))
      }, arguments)
    },
    __wbg_createShaderModule_274373c4cacce3a0: function (n, t) {
      return i(w(n).createShaderModule(w(t)))
    },
    __wbg_createView_7520397d720e9d7d: function () {
      return p(function (n) {
        return i(w(n).createView())
      }, arguments)
    },
    __wbg_draw_b3ff1fa9ff891153: function (n, t) {
      w(n).draw(t >>> 0)
    },
    __wbg_end_a97f51ac1f092bfe: function (n) {
      w(n).end()
    },
    __wbg_finish_489db1750712613c: function (n) {
      return i(w(n).finish())
    },
    __wbg_getContext_635e36719cad2623: function () {
      return p(function (n, t, e) {
        const r = w(n).getContext(d(t, e))
        return x(r) ? 0 : i(r)
      }, arguments)
    },
    __wbg_getCurrentTexture_f9b3ddbfb8575837: function () {
      return p(function (n) {
        return i(w(n).getCurrentTexture())
      }, arguments)
    },
    __wbg_getPreferredCanvasFormat_4d28b652aa67cc74: function (n) {
      const t = w(n).getPreferredCanvasFormat()
      return (u.indexOf(t) + 1 || 102) - 1
    },
    __wbg_get_31af05bd4842a84f: function () {
      return p(function (n, t) {
        return i(Reflect.get(w(n), w(t)))
      }, arguments)
    },
    __wbg_new_617a8cdb8bb1130e: function () {
      return i(new Object())
    },
    __wbg_queue_17ba8833afbd540b: function (n) {
      return i(w(n).queue)
    },
    __wbg_setBindGroup_4af09961dd6fd6d4: function (n, t, e) {
      w(n).setBindGroup(t >>> 0, w(e))
    },
    __wbg_setPipeline_9870f87d9e0a49ab: function (n, t) {
      w(n).setPipeline(w(t))
    },
    __wbg_setScissorRect_78603d18fd6477a3: function (n, t, e, r, _) {
      w(n).setScissorRect(t >>> 0, e >>> 0, r >>> 0, _ >>> 0)
    },
    __wbg_set_a_d2dae9a62946ba86: function (n, t) {
      w(n).a = t
    },
    __wbg_set_alpha_b14827cf8b4ac26a: function (n, t) {
      w(n).alpha = w(t)
    },
    __wbg_set_alpha_mode_16c3966c224ad4a9: function (n, t) {
      w(n).alphaMode = _[t]
    },
    __wbg_set_b_670dfc0631dcb9c1: function (n, t) {
      w(n).b = t
    },
    __wbg_set_bind_group_layouts_60a4869809302d79: function (n, t, e) {
      w(n).bindGroupLayouts = f(t, e)
    },
    __wbg_set_binding_1d51e1a2d1c0cdaf: function (n, t) {
      w(n).binding = t >>> 0
    },
    __wbg_set_binding_348f002e688081ac: function (n, t) {
      w(n).binding = t >>> 0
    },
    __wbg_set_blend_3f83603fc878c51d: function (n, t) {
      w(n).blend = w(t)
    },
    __wbg_set_buffer_22331adbf81699d2: function (n, t) {
      w(n).buffer = w(t)
    },
    __wbg_set_buffer_b8d40a54af365605: function (n, t) {
      w(n).buffer = w(t)
    },
    __wbg_set_clear_value_gpu_color_dict_c17321221601e286: function (n, t) {
      w(n).clearValue = w(t)
    },
    __wbg_set_code_4510e93549b3066e: function (n, t, e) {
      w(n).code = d(t, e)
    },
    __wbg_set_color_14d2fdcfc7117305: function (n, t) {
      w(n).color = w(t)
    },
    __wbg_set_color_attachments_367a5baf85bca057: function (n, t, e) {
      w(n).colorAttachments = f(t, e)
    },
    __wbg_set_device_53f6c9076263d322: function (n, t) {
      w(n).device = w(t)
    },
    __wbg_set_dst_factor_cfb1cd4ae3e673d9: function (n, e) {
      w(n).dstFactor = t[e]
    },
    __wbg_set_entries_7c51a3643c761ecf: function (n, t, e) {
      w(n).entries = f(t, e)
    },
    __wbg_set_entries_cc80db0de96ea4ff: function (n, t, e) {
      w(n).entries = f(t, e)
    },
    __wbg_set_entry_point_a7593f073d0352f7: function (n, t, e) {
      w(n).entryPoint = d(t, e)
    },
    __wbg_set_entry_point_edfb9dd004493bc8: function (n, t, e) {
      w(n).entryPoint = d(t, e)
    },
    __wbg_set_format_036434fd3db220e7: function (n, t) {
      w(n).format = u[t]
    },
    __wbg_set_format_d4c8ef73b087dab0: function (n, t) {
      w(n).format = u[t]
    },
    __wbg_set_fragment_9bc5cc98c7c59fef: function (n, t) {
      w(n).fragment = w(t)
    },
    __wbg_set_g_ac69babc4a0b2338: function (n, t) {
      w(n).g = t
    },
    __wbg_set_has_dynamic_offset_e2a0bd85eaf36f34: function (n, t) {
      w(n).hasDynamicOffset = 0 !== t
    },
    __wbg_set_layout_4e86f7c1671a06d0: function (n, t) {
      w(n).layout = w(t)
    },
    __wbg_set_layout_f2b50454b73e9111: function (n, t) {
      w(n).layout = w(t)
    },
    __wbg_set_load_op_18ff54287ff40151: function (n, t) {
      w(n).loadOp = o[t]
    },
    __wbg_set_module_168054323d22d57d: function (n, t) {
      w(n).module = w(t)
    },
    __wbg_set_module_1ad4e7343951303d: function (n, t) {
      w(n).module = w(t)
    },
    __wbg_set_operation_d8894b0f9aa3db27: function (n, t) {
      w(n).operation = e[t]
    },
    __wbg_set_r_ccf9fe3e4d993555: function (n, t) {
      w(n).r = t
    },
    __wbg_set_resource_gpu_buffer_binding_c689b0dc9379a99b: function (n, t) {
      w(n).resource = w(t)
    },
    __wbg_set_size_4716cf40ee7a64be: function (n, t) {
      w(n).size = t >>> 0
    },
    __wbg_set_src_factor_b29ea819b1b5d6f6: function (n, e) {
      w(n).srcFactor = t[e]
    },
    __wbg_set_store_op_6d2fb6cc3e66341e: function (n, t) {
      w(n).storeOp = c[t]
    },
    __wbg_set_targets_0328c60fcfc0f564: function (n, t, e) {
      w(n).targets = f(t, e)
    },
    __wbg_set_type_ff9e8f3110ad0cbf: function (n, t) {
      w(n).type = r[t]
    },
    __wbg_set_usage_7177d2b5a0cb7ed1: function (n, t) {
      w(n).usage = t >>> 0
    },
    __wbg_set_usage_e842e619c53799e7: function (n, t) {
      w(n).usage = t >>> 0
    },
    __wbg_set_vertex_5b13839ffaff5f37: function (n, t) {
      w(n).vertex = w(t)
    },
    __wbg_set_view_gpu_texture_view_9f7613e516713508: function (n, t) {
      w(n).view = w(t)
    },
    __wbg_set_visibility_78cfb96740c9deb5: function (n, t) {
      w(n).visibility = t >>> 0
    },
    __wbg_static_accessor_GLOBAL_266715b9d96ba635: function () {
      const n = 'undefined' == typeof global ? null : global
      return x(n) ? 0 : i(n)
    },
    __wbg_static_accessor_GLOBAL_THIS_10fb7dc1ae063179: function () {
      const n = 'undefined' == typeof globalThis ? null : globalThis
      return x(n) ? 0 : i(n)
    },
    __wbg_static_accessor_SELF_0b583911f537483a: function () {
      const n = 'undefined' == typeof self ? null : self
      return x(n) ? 0 : i(n)
    },
    __wbg_static_accessor_WINDOW_d7f903d1508cbdc4: function () {
      const n = 'undefined' == typeof window ? null : window
      return x(n) ? 0 : i(n)
    },
    __wbg_submit_46ecaa46ea244579: function (n, t, e) {
      w(n).submit(f(t, e))
    },
    __wbg_writeBuffer_2c02702ce0fa25c3: function () {
      return p(function (n, t, e, r, _) {
        var o, c
        w(n).writeBuffer(
          w(t),
          e >>> 0,
          ((o = r), (c = _), (o >>>= 0), m().subarray(o / 1, o / 1 + c))
        )
      }, arguments)
    },
    __wbindgen_generic_0000000000000001: function (n, t) {
      return i(d(n, t))
    },
    __wbindgen_object_clone_ref: function (n) {
      return i(w(n))
    },
    __wbindgen_object_drop_ref: function (n) {
      v(n)
    },
  }
  return { __proto__: null, './luiskr_menu_background_bg.js': n }
}
Symbol.dispose && (MenuBackground.prototype[Symbol.dispose] = MenuBackground.prototype.free)
const t = [
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
  u = [
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
      : new FinalizationRegistry((n) => j.__wbg_menubackground_free(n, 1))
function i(n) {
  h === y.length && y.push(y.length + 1)
  const t = h
  return ((h = y[t]), (y[t] = n), t)
}
function s(n) {
  const t = typeof n
  if ('number' == t || 'boolean' == t || null == n) return `${n}`
  if ('string' == t) return `"${n}"`
  if ('symbol' == t) {
    const t = n.description
    return null == t ? 'Symbol' : `Symbol(${t})`
  }
  if ('function' == t) {
    const t = n.name
    return 'string' == typeof t && t.length > 0 ? `Function(${t})` : 'Function'
  }
  if (Array.isArray(n)) {
    const t = n.length
    let e = '['
    t > 0 && (e += s(n[0]))
    for (let r = 1; r < t; r++) e += ', ' + s(n[r])
    return ((e += ']'), e)
  }
  const e = /\[object ([^\]]+)\]/.exec(toString.call(n))
  let r
  if (!(e && e.length > 1)) return toString.call(n)
  if (((r = e[1]), 'Object' == r))
    try {
      return 'Object(' + JSON.stringify(n) + ')'
    } catch (n) {
      return 'Object'
    }
  return n instanceof Error ? `${n.name}: ${n.message}\n${n.stack}` : r
}
function f(n, t) {
  n >>>= 0
  const e = g(),
    r = []
  for (let _ = n; _ < n + 4 * t; _ += 4) r.push(w(e.getUint32(_, !0)))
  return r
}
let b = null
function g() {
  return (
    (null === b ||
      !0 === b.buffer.detached ||
      (void 0 === b.buffer.detached && b.buffer !== j.memory.buffer)) &&
      (b = new DataView(j.memory.buffer)),
    b
  )
}
function d(n, t) {
  return (function (n, t) {
    return (
      (A += t),
      A >= O && ((k = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), k.decode(), (A = t)),
      k.decode(m().subarray(n, n + t))
    )
  })(n >>> 0, t)
}
let l = null
function m() {
  return ((null !== l && 0 !== l.byteLength) || (l = new Uint8Array(j.memory.buffer)), l)
}
function w(n) {
  return y[n]
}
function p(n, t) {
  try {
    return n.apply(this, t)
  } catch (n) {
    j.__wbindgen_export3(i(n))
  }
}
let y = new Array(1024).fill(void 0)
y.push(void 0, null, !0, !1)
let h = y.length
function x(n) {
  return null == n
}
function v(n) {
  const t = w(n)
  return (
    (function (n) {
      n < 1028 || ((y[n] = h), (h = n))
    })(n),
    t
  )
}
let k = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })
k.decode()
const O = 2146435072
let A = 0
const B = new TextEncoder()
'encodeInto' in B ||
  (B.encodeInto = function (n, t) {
    const e = B.encode(n)
    return (t.set(e), { read: n.length, written: e.length })
  })
let S,
  R,
  j,
  L = 0
function P(n, t) {
  return ((R = n), (j = n.exports), (S = t), (b = null), (l = null), j)
}
function W(t) {
  if (void 0 !== j) return j
  void 0 !== t &&
    (Object.getPrototypeOf(t) === Object.prototype
      ? ({ module: t } = t)
      : console.warn('using deprecated parameters for `initSync()`; pass a single object instead'))
  const e = n()
  return (
    t instanceof WebAssembly.Module || (t = new WebAssembly.Module(t)),
    P(new WebAssembly.Instance(t, e), t)
  )
}
async function I(t) {
  if (void 0 !== j) return j
  ;(void 0 !== t &&
    (Object.getPrototypeOf(t) === Object.prototype
      ? ({ module_or_path: t } = t)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    void 0 === t && (t = new URL('luiskr_menu_background_bg.wasm', import.meta.url)))
  const e = n()
  ;('string' == typeof t ||
    ('function' == typeof Request && t instanceof Request) ||
    ('function' == typeof URL && t instanceof URL)) &&
    (t = fetch(t))
  const { instance: r, module: _ } = await (async function (n, t) {
    if ('function' == typeof Response && n instanceof Response) {
      if (!n.ok)
        throw new Error(`failed to fetch Wasm: ${n.status} ${n.statusText} fetching '${n.url}'`)
      if ('function' == typeof WebAssembly.instantiateStreaming)
        try {
          return await WebAssembly.instantiateStreaming(n, t)
        } catch (t) {
          if (
            !(function (n) {
              switch (n) {
                case 'basic':
                case 'cors':
                case 'default':
                  return !0
              }
              return !1
            })(n.type) ||
            'application/wasm' === n.headers.get('Content-Type')
          )
            throw t
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            t
          )
        }
      const e = await n.arrayBuffer()
      return await WebAssembly.instantiate(e, t)
    }
    {
      const e = await WebAssembly.instantiate(n, t)
      return e instanceof WebAssembly.Instance ? { instance: e, module: n } : e
    }
  })(await t, e)
  return P(r, _)
}
export { W as initSync, I as default }
