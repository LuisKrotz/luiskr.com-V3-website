/* @ts-self-types="./luiskr_ring_sheen.d.ts" */
export class RingSheen {
  __destroy_into_raw() {
    const n = this.__wbg_ptr
    return ((this.__wbg_ptr = 0), s.unregister(this), n)
  }
  free() {
    const n = this.__destroy_into_raw()
    P.__wbg_ringsheen_free(n, 0)
  }
  frame(n) {
    return 0 !== P.ringsheen_frame(this.__wbg_ptr, n)
  }
  init(n, e) {
    try {
      const r = P.__wbindgen_add_to_stack_pointer(-16)
      P.ringsheen_init(r, this.__wbg_ptr, a(n), a(e))
      var t = g().getInt32(r + 0, !0)
      if (g().getInt32(r + 4, !0)) throw O(t)
    } finally {
      P.__wbindgen_add_to_stack_pointer(16)
    }
  }
  constructor() {
    const n = P.ringsheen_new()
    return ((this.__wbg_ptr = n), s.register(this, this.__wbg_ptr, this), this)
  }
  resize(n, e) {
    P.ringsheen_resize(this.__wbg_ptr, n, e)
  }
  set_colors(n, e, t, r, _, o, c, i, s) {
    P.ringsheen_set_colors(this.__wbg_ptr, n, e, t, r, _, o, c, i, s)
  }
  set_size(n, e) {
    P.ringsheen_set_size(this.__wbg_ptr, n, e)
  }
  set_tiles(n) {
    const e = (function (n) {
        const e = (0, P.__wbindgen_export)(4 * n.length, 4) >>> 0
        return (
          ((null !== d && 0 !== d.byteLength) || (d = new Float32Array(P.memory.buffer)), d).set(
            n,
            e / 4
          ),
          (W = n.length),
          e
        )
      })(n),
      t = W
    return P.ringsheen_set_tiles(this.__wbg_ptr, e, t) >>> 0
  }
}
function n() {
  const n = {
    __proto__: null,
    __wbg___wbindgen_debug_string_4687d8d8c2017d52: function (n, e) {
      const t = (function (n, e, t) {
          if (void 0 === t) {
            const t = B.encode(n),
              r = e(t.length, 1) >>> 0
            return (
              m()
                .subarray(r, r + t.length)
                .set(t),
              (W = t.length),
              r
            )
          }
          let r = n.length,
            _ = e(r, 1) >>> 0
          const o = m()
          let c = 0
          for (; c < r; c++) {
            const e = n.charCodeAt(c)
            if (e > 127) break
            o[_ + c] = e
          }
          if (c !== r) {
            ;(0 !== c && (n = n.slice(c)), (_ = t(_, r, (r = c + 3 * n.length), 1) >>> 0))
            const e = m().subarray(_ + c, _ + r)
            ;((c += B.encodeInto(n, e).written), (_ = t(_, r, c, 1) >>> 0))
          }
          return ((W = c), _)
        })(u(p(e)), P.__wbindgen_export, P.__wbindgen_export2),
        r = W
      ;(g().setInt32(n + 4, r, !0), g().setInt32(n + 0, t, !0))
    },
    __wbg___wbindgen_is_null_e343b7d08827ba72: function (n) {
      return null === p(n)
    },
    __wbg___wbindgen_is_undefined_8865fb403f8fe9d8: function (n) {
      return void 0 === p(n)
    },
    __wbg___wbindgen_throw_41e9ee4f547fc59a: function (n, e) {
      throw new Error(l(n, e))
    },
    __wbg_beginRenderPass_46bc75d13eaf7381: function () {
      return h(function (n, e) {
        return a(p(n).beginRenderPass(p(e)))
      }, arguments)
    },
    __wbg_configure_a4e26031ba2da6a2: function () {
      return h(function (n, e) {
        p(n).configure(p(e))
      }, arguments)
    },
    __wbg_createBindGroupLayout_dd6a685e68699be9: function () {
      return h(function (n, e) {
        return a(p(n).createBindGroupLayout(p(e)))
      }, arguments)
    },
    __wbg_createBindGroup_297f726263493b7a: function (n, e) {
      return a(p(n).createBindGroup(p(e)))
    },
    __wbg_createBuffer_7d58b37b7042f31f: function () {
      return h(function (n, e) {
        return a(p(n).createBuffer(p(e)))
      }, arguments)
    },
    __wbg_createCommandEncoder_d26cb1fdb68219f7: function (n, e) {
      return a(p(n).createCommandEncoder(p(e)))
    },
    __wbg_createPipelineLayout_39a9a7f694e28389: function (n, e) {
      return a(p(n).createPipelineLayout(p(e)))
    },
    __wbg_createRenderPipeline_e7c57f75917917e4: function () {
      return h(function (n, e) {
        return a(p(n).createRenderPipeline(p(e)))
      }, arguments)
    },
    __wbg_createShaderModule_274373c4cacce3a0: function (n, e) {
      return a(p(n).createShaderModule(p(e)))
    },
    __wbg_createView_7520397d720e9d7d: function () {
      return h(function (n) {
        return a(p(n).createView())
      }, arguments)
    },
    __wbg_draw_889697bdf4cad1b7: function (n, e, t) {
      p(n).draw(e >>> 0, t >>> 0)
    },
    __wbg_end_a97f51ac1f092bfe: function (n) {
      p(n).end()
    },
    __wbg_finish_489db1750712613c: function (n) {
      return a(p(n).finish())
    },
    __wbg_getContext_635e36719cad2623: function () {
      return h(function (n, e, t) {
        const r = p(n).getContext(l(e, t))
        return v(r) ? 0 : a(r)
      }, arguments)
    },
    __wbg_getCurrentTexture_f9b3ddbfb8575837: function () {
      return h(function (n) {
        return a(p(n).getCurrentTexture())
      }, arguments)
    },
    __wbg_getPreferredCanvasFormat_4d28b652aa67cc74: function (n) {
      const e = p(n).getPreferredCanvasFormat()
      return (i.indexOf(e) + 1 || 102) - 1
    },
    __wbg_get_31af05bd4842a84f: function () {
      return h(function (n, e) {
        return a(Reflect.get(p(n), p(e)))
      }, arguments)
    },
    __wbg_new_617a8cdb8bb1130e: function () {
      return a(new Object())
    },
    __wbg_queue_17ba8833afbd540b: function (n) {
      return a(p(n).queue)
    },
    __wbg_setBindGroup_4af09961dd6fd6d4: function (n, e, t) {
      p(n).setBindGroup(e >>> 0, p(t))
    },
    __wbg_setPipeline_9870f87d9e0a49ab: function (n, e) {
      p(n).setPipeline(p(e))
    },
    __wbg_setScissorRect_78603d18fd6477a3: function (n, e, t, r, _) {
      p(n).setScissorRect(e >>> 0, t >>> 0, r >>> 0, _ >>> 0)
    },
    __wbg_set_a_d2dae9a62946ba86: function (n, e) {
      p(n).a = e
    },
    __wbg_set_alpha_b14827cf8b4ac26a: function (n, e) {
      p(n).alpha = p(e)
    },
    __wbg_set_alpha_mode_16c3966c224ad4a9: function (n, e) {
      p(n).alphaMode = _[e]
    },
    __wbg_set_b_670dfc0631dcb9c1: function (n, e) {
      p(n).b = e
    },
    __wbg_set_bind_group_layouts_60a4869809302d79: function (n, e, t) {
      p(n).bindGroupLayouts = f(e, t)
    },
    __wbg_set_binding_1d51e1a2d1c0cdaf: function (n, e) {
      p(n).binding = e >>> 0
    },
    __wbg_set_binding_348f002e688081ac: function (n, e) {
      p(n).binding = e >>> 0
    },
    __wbg_set_blend_3f83603fc878c51d: function (n, e) {
      p(n).blend = p(e)
    },
    __wbg_set_buffer_22331adbf81699d2: function (n, e) {
      p(n).buffer = p(e)
    },
    __wbg_set_buffer_b8d40a54af365605: function (n, e) {
      p(n).buffer = p(e)
    },
    __wbg_set_clear_value_gpu_color_dict_c17321221601e286: function (n, e) {
      p(n).clearValue = p(e)
    },
    __wbg_set_code_4510e93549b3066e: function (n, e, t) {
      p(n).code = l(e, t)
    },
    __wbg_set_color_14d2fdcfc7117305: function (n, e) {
      p(n).color = p(e)
    },
    __wbg_set_color_attachments_367a5baf85bca057: function (n, e, t) {
      p(n).colorAttachments = f(e, t)
    },
    __wbg_set_device_53f6c9076263d322: function (n, e) {
      p(n).device = p(e)
    },
    __wbg_set_dst_factor_cfb1cd4ae3e673d9: function (n, t) {
      p(n).dstFactor = e[t]
    },
    __wbg_set_entries_7c51a3643c761ecf: function (n, e, t) {
      p(n).entries = f(e, t)
    },
    __wbg_set_entries_cc80db0de96ea4ff: function (n, e, t) {
      p(n).entries = f(e, t)
    },
    __wbg_set_entry_point_a7593f073d0352f7: function (n, e, t) {
      p(n).entryPoint = l(e, t)
    },
    __wbg_set_entry_point_edfb9dd004493bc8: function (n, e, t) {
      p(n).entryPoint = l(e, t)
    },
    __wbg_set_format_036434fd3db220e7: function (n, e) {
      p(n).format = i[e]
    },
    __wbg_set_format_d4c8ef73b087dab0: function (n, e) {
      p(n).format = i[e]
    },
    __wbg_set_fragment_9bc5cc98c7c59fef: function (n, e) {
      p(n).fragment = p(e)
    },
    __wbg_set_g_ac69babc4a0b2338: function (n, e) {
      p(n).g = e
    },
    __wbg_set_has_dynamic_offset_e2a0bd85eaf36f34: function (n, e) {
      p(n).hasDynamicOffset = 0 !== e
    },
    __wbg_set_layout_4e86f7c1671a06d0: function (n, e) {
      p(n).layout = p(e)
    },
    __wbg_set_layout_f2b50454b73e9111: function (n, e) {
      p(n).layout = p(e)
    },
    __wbg_set_load_op_18ff54287ff40151: function (n, e) {
      p(n).loadOp = o[e]
    },
    __wbg_set_module_168054323d22d57d: function (n, e) {
      p(n).module = p(e)
    },
    __wbg_set_module_1ad4e7343951303d: function (n, e) {
      p(n).module = p(e)
    },
    __wbg_set_operation_d8894b0f9aa3db27: function (n, e) {
      p(n).operation = t[e]
    },
    __wbg_set_r_ccf9fe3e4d993555: function (n, e) {
      p(n).r = e
    },
    __wbg_set_resource_gpu_buffer_binding_c689b0dc9379a99b: function (n, e) {
      p(n).resource = p(e)
    },
    __wbg_set_size_4716cf40ee7a64be: function (n, e) {
      p(n).size = e >>> 0
    },
    __wbg_set_src_factor_b29ea819b1b5d6f6: function (n, t) {
      p(n).srcFactor = e[t]
    },
    __wbg_set_store_op_6d2fb6cc3e66341e: function (n, e) {
      p(n).storeOp = c[e]
    },
    __wbg_set_targets_0328c60fcfc0f564: function (n, e, t) {
      p(n).targets = f(e, t)
    },
    __wbg_set_type_ff9e8f3110ad0cbf: function (n, e) {
      p(n).type = r[e]
    },
    __wbg_set_usage_7177d2b5a0cb7ed1: function (n, e) {
      p(n).usage = e >>> 0
    },
    __wbg_set_usage_e842e619c53799e7: function (n, e) {
      p(n).usage = e >>> 0
    },
    __wbg_set_vertex_5b13839ffaff5f37: function (n, e) {
      p(n).vertex = p(e)
    },
    __wbg_set_view_gpu_texture_view_9f7613e516713508: function (n, e) {
      p(n).view = p(e)
    },
    __wbg_set_visibility_78cfb96740c9deb5: function (n, e) {
      p(n).visibility = e >>> 0
    },
    __wbg_static_accessor_GLOBAL_266715b9d96ba635: function () {
      const n = 'undefined' == typeof global ? null : global
      return v(n) ? 0 : a(n)
    },
    __wbg_static_accessor_GLOBAL_THIS_10fb7dc1ae063179: function () {
      const n = 'undefined' == typeof globalThis ? null : globalThis
      return v(n) ? 0 : a(n)
    },
    __wbg_static_accessor_SELF_0b583911f537483a: function () {
      const n = 'undefined' == typeof self ? null : self
      return v(n) ? 0 : a(n)
    },
    __wbg_static_accessor_WINDOW_d7f903d1508cbdc4: function () {
      const n = 'undefined' == typeof window ? null : window
      return v(n) ? 0 : a(n)
    },
    __wbg_submit_46ecaa46ea244579: function (n, e, t) {
      p(n).submit(f(e, t))
    },
    __wbg_writeBuffer_2c02702ce0fa25c3: function () {
      return h(function (n, e, t, r, _) {
        var o, c
        p(n).writeBuffer(
          p(e),
          t >>> 0,
          ((o = r), (c = _), (o >>>= 0), m().subarray(o / 1, o / 1 + c))
        )
      }, arguments)
    },
    __wbindgen_generic_0000000000000001: function (n, e) {
      return a(l(n, e))
    },
    __wbindgen_object_clone_ref: function (n) {
      return a(p(n))
    },
    __wbindgen_object_drop_ref: function (n) {
      O(n)
    },
  }
  return { __proto__: null, './luiskr_ring_sheen_bg.js': n }
}
Symbol.dispose && (RingSheen.prototype[Symbol.dispose] = RingSheen.prototype.free)
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
      : new FinalizationRegistry((n) => P.__wbg_ringsheen_free(n, 1))
function a(n) {
  x === y.length && y.push(y.length + 1)
  const e = x
  return ((x = y[e]), (y[e] = n), e)
}
function u(n) {
  const e = typeof n
  if ('number' == e || 'boolean' == e || null == n) return `${n}`
  if ('string' == e) return `"${n}"`
  if ('symbol' == e) {
    const e = n.description
    return null == e ? 'Symbol' : `Symbol(${e})`
  }
  if ('function' == e) {
    const e = n.name
    return 'string' == typeof e && e.length > 0 ? `Function(${e})` : 'Function'
  }
  if (Array.isArray(n)) {
    const e = n.length
    let t = '['
    e > 0 && (t += u(n[0]))
    for (let r = 1; r < e; r++) t += ', ' + u(n[r])
    return ((t += ']'), t)
  }
  const t = /\[object ([^\]]+)\]/.exec(toString.call(n))
  let r
  if (!(t && t.length > 1)) return toString.call(n)
  if (((r = t[1]), 'Object' == r))
    try {
      return 'Object(' + JSON.stringify(n) + ')'
    } catch (n) {
      return 'Object'
    }
  return n instanceof Error ? `${n.name}: ${n.message}\n${n.stack}` : r
}
function f(n, e) {
  n >>>= 0
  const t = g(),
    r = []
  for (let _ = n; _ < n + 4 * e; _ += 4) r.push(p(t.getUint32(_, !0)))
  return r
}
let b = null
function g() {
  return (
    (null === b ||
      !0 === b.buffer.detached ||
      (void 0 === b.buffer.detached && b.buffer !== P.memory.buffer)) &&
      (b = new DataView(P.memory.buffer)),
    b
  )
}
let d = null
function l(n, e) {
  return (function (n, e) {
    return (
      (R += e),
      R >= A && ((S = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), S.decode(), (R = e)),
      S.decode(m().subarray(n, n + e))
    )
  })(n >>> 0, e)
}
let w = null
function m() {
  return ((null !== w && 0 !== w.byteLength) || (w = new Uint8Array(P.memory.buffer)), w)
}
function p(n) {
  return y[n]
}
function h(n, e) {
  try {
    return n.apply(this, e)
  } catch (n) {
    P.__wbindgen_export3(a(n))
  }
}
let y = new Array(1024).fill(void 0)
y.push(void 0, null, !0, !1)
let x = y.length
function v(n) {
  return null == n
}
function O(n) {
  const e = p(n)
  return (
    (function (n) {
      n < 1028 || ((y[n] = x), (x = n))
    })(n),
    e
  )
}
let S = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })
S.decode()
const A = 2146435072
let R = 0
const B = new TextEncoder()
'encodeInto' in B ||
  (B.encodeInto = function (n, e) {
    const t = B.encode(n)
    return (e.set(t), { read: n.length, written: t.length })
  })
let L,
  j,
  P,
  W = 0
function I(n, e) {
  return ((j = n), (P = n.exports), (L = e), (b = null), (d = null), (w = null), P)
}
function F(e) {
  if (void 0 !== P) return P
  void 0 !== e &&
    (Object.getPrototypeOf(e) === Object.prototype
      ? ({ module: e } = e)
      : console.warn('using deprecated parameters for `initSync()`; pass a single object instead'))
  const t = n()
  return (
    e instanceof WebAssembly.Module || (e = new WebAssembly.Module(e)),
    I(new WebAssembly.Instance(e, t), e)
  )
}
async function z(e) {
  if (void 0 !== P) return P
  ;(void 0 !== e &&
    (Object.getPrototypeOf(e) === Object.prototype
      ? ({ module_or_path: e } = e)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    void 0 === e && (e = new URL('luiskr_ring_sheen_bg.wasm', import.meta.url)))
  const t = n()
  ;('string' == typeof e ||
    ('function' == typeof Request && e instanceof Request) ||
    ('function' == typeof URL && e instanceof URL)) &&
    (e = fetch(e))
  const { instance: r, module: _ } = await (async function (n, e) {
    if ('function' == typeof Response && n instanceof Response) {
      if (!n.ok)
        throw new Error(`failed to fetch Wasm: ${n.status} ${n.statusText} fetching '${n.url}'`)
      if ('function' == typeof WebAssembly.instantiateStreaming)
        try {
          return await WebAssembly.instantiateStreaming(n, e)
        } catch (e) {
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
            throw e
          console.warn(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            e
          )
        }
      const t = await n.arrayBuffer()
      return await WebAssembly.instantiate(t, e)
    }
    {
      const t = await WebAssembly.instantiate(n, e)
      return t instanceof WebAssembly.Instance ? { instance: t, module: n } : t
    }
  })(await e, t)
  return I(r, _)
}
export { F as initSync, z as default }
