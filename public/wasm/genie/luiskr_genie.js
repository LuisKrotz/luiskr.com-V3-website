/* @ts-self-types="./luiskr_genie.d.ts" */
export class Genie {
  __destroy_into_raw() {
    const e = this.__wbg_ptr
    return ((this.__wbg_ptr = 0), f.unregister(this), e)
  }
  free() {
    const e = this.__destroy_into_raw()
    W.__wbg_genie_free(e, 0)
  }
  frame(e) {
    return 0 !== W.genie_frame(this.__wbg_ptr, e)
  }
  init(e, t) {
    try {
      const r = W.__wbindgen_add_to_stack_pointer(-16)
      W.genie_init(r, this.__wbg_ptr, b(e), b(t))
      var n = m().getInt32(r + 0, !0)
      if (m().getInt32(r + 4, !0)) throw S(n)
    } finally {
      W.__wbindgen_add_to_stack_pointer(16)
    }
  }
  constructor() {
    const e = W.genie_new()
    return ((this.__wbg_ptr = e), f.register(this, this.__wbg_ptr, this), this)
  }
  resize(e, t) {
    W.genie_resize(this.__wbg_ptr, e, t)
  }
  set_flags(e, t) {
    W.genie_set_flags(this.__wbg_ptr, e, t)
  }
  set_progress(e) {
    W.genie_set_progress(this.__wbg_ptr, e)
  }
  set_rects(e, t, n, r, _, o, c, i) {
    W.genie_set_rects(this.__wbg_ptr, e, t, n, r, _, o, c, i)
  }
  set_size(e, t) {
    W.genie_set_size(this.__wbg_ptr, e, t)
  }
  set_tint(e, t, n, r) {
    W.genie_set_tint(this.__wbg_ptr, e, t, n, r)
  }
  upload_bitmap(e, t, n) {
    W.genie_upload_bitmap(this.__wbg_ptr, b(e), t, n)
  }
}
function e() {
  const e = {
    __proto__: null,
    __wbg___wbindgen_debug_string_4687d8d8c2017d52: function (e, t) {
      const n = (function (e, t, n) {
          if (void 0 === n) {
            const n = R.encode(e),
              r = t(n.length, 1) >>> 0
            return (
              y()
                .subarray(r, r + n.length)
                .set(n),
              (z = n.length),
              r
            )
          }
          let r = e.length,
            _ = t(r, 1) >>> 0
          const o = y()
          let c = 0
          for (; c < r; c++) {
            const t = e.charCodeAt(c)
            if (t > 127) break
            o[_ + c] = t
          }
          if (c !== r) {
            ;(0 !== c && (e = e.slice(c)), (_ = n(_, r, (r = c + 3 * e.length), 1) >>> 0))
            const t = y().subarray(_ + c, _ + r)
            ;((c += R.encodeInto(e, t).written), (_ = n(_, r, c, 1) >>> 0))
          }
          return ((z = c), _)
        })(g(x(t)), W.__wbindgen_export, W.__wbindgen_export2),
        r = z
      ;(m().setInt32(e + 4, r, !0), m().setInt32(e + 0, n, !0))
    },
    __wbg___wbindgen_is_null_e343b7d08827ba72: function (e) {
      return null === x(e)
    },
    __wbg___wbindgen_is_undefined_8865fb403f8fe9d8: function (e) {
      return void 0 === x(e)
    },
    __wbg___wbindgen_throw_41e9ee4f547fc59a: function (e, t) {
      throw new Error(p(e, t))
    },
    __wbg_beginRenderPass_46bc75d13eaf7381: function () {
      return v(function (e, t) {
        return b(x(e).beginRenderPass(x(t)))
      }, arguments)
    },
    __wbg_configure_a4e26031ba2da6a2: function () {
      return v(function (e, t) {
        x(e).configure(x(t))
      }, arguments)
    },
    __wbg_copyExternalImageToTexture_91a2b84d7d19190c: function () {
      return v(function (e, t, n, r) {
        x(e).copyExternalImageToTexture(x(t), x(n), x(r))
      }, arguments)
    },
    __wbg_createBindGroupLayout_dd6a685e68699be9: function () {
      return v(function (e, t) {
        return b(x(e).createBindGroupLayout(x(t)))
      }, arguments)
    },
    __wbg_createBindGroup_297f726263493b7a: function (e, t) {
      return b(x(e).createBindGroup(x(t)))
    },
    __wbg_createBuffer_7d58b37b7042f31f: function () {
      return v(function (e, t) {
        return b(x(e).createBuffer(x(t)))
      }, arguments)
    },
    __wbg_createCommandEncoder_d26cb1fdb68219f7: function (e, t) {
      return b(x(e).createCommandEncoder(x(t)))
    },
    __wbg_createPipelineLayout_39a9a7f694e28389: function (e, t) {
      return b(x(e).createPipelineLayout(x(t)))
    },
    __wbg_createRenderPipeline_e7c57f75917917e4: function () {
      return v(function (e, t) {
        return b(x(e).createRenderPipeline(x(t)))
      }, arguments)
    },
    __wbg_createSampler_1271407d57de5444: function (e, t) {
      return b(x(e).createSampler(x(t)))
    },
    __wbg_createShaderModule_274373c4cacce3a0: function (e, t) {
      return b(x(e).createShaderModule(x(t)))
    },
    __wbg_createTexture_272b1f1151792884: function () {
      return v(function (e, t) {
        return b(x(e).createTexture(x(t)))
      }, arguments)
    },
    __wbg_createView_7520397d720e9d7d: function () {
      return v(function (e) {
        return b(x(e).createView())
      }, arguments)
    },
    __wbg_draw_b3ff1fa9ff891153: function (e, t) {
      x(e).draw(t >>> 0)
    },
    __wbg_end_a97f51ac1f092bfe: function (e) {
      x(e).end()
    },
    __wbg_finish_489db1750712613c: function (e) {
      return b(x(e).finish())
    },
    __wbg_getContext_635e36719cad2623: function () {
      return v(function (e, t, n) {
        const r = x(e).getContext(p(t, n))
        return T(r) ? 0 : b(r)
      }, arguments)
    },
    __wbg_getCurrentTexture_f9b3ddbfb8575837: function () {
      return v(function (e) {
        return b(x(e).getCurrentTexture())
      }, arguments)
    },
    __wbg_getPreferredCanvasFormat_4d28b652aa67cc74: function (e) {
      const t = x(e).getPreferredCanvasFormat()
      return (u.indexOf(t) + 1 || 102) - 1
    },
    __wbg_get_31af05bd4842a84f: function () {
      return v(function (e, t) {
        return b(Reflect.get(x(e), x(t)))
      }, arguments)
    },
    __wbg_new_617a8cdb8bb1130e: function () {
      return b(new Object())
    },
    __wbg_queue_17ba8833afbd540b: function (e) {
      return b(x(e).queue)
    },
    __wbg_setBindGroup_4af09961dd6fd6d4: function (e, t, n) {
      x(e).setBindGroup(t >>> 0, x(n))
    },
    __wbg_setPipeline_9870f87d9e0a49ab: function (e, t) {
      x(e).setPipeline(x(t))
    },
    __wbg_set_a_d2dae9a62946ba86: function (e, t) {
      x(e).a = t
    },
    __wbg_set_address_mode_u_38bbe83e7cb70867: function (e, n) {
      x(e).addressModeU = t[n]
    },
    __wbg_set_address_mode_v_e4dc81ae95d4e2d1: function (e, n) {
      x(e).addressModeV = t[n]
    },
    __wbg_set_alpha_b14827cf8b4ac26a: function (e, t) {
      x(e).alpha = x(t)
    },
    __wbg_set_alpha_mode_16c3966c224ad4a9: function (e, t) {
      x(e).alphaMode = o[t]
    },
    __wbg_set_b_670dfc0631dcb9c1: function (e, t) {
      x(e).b = t
    },
    __wbg_set_bind_group_layouts_60a4869809302d79: function (e, t, n) {
      x(e).bindGroupLayouts = d(t, n)
    },
    __wbg_set_binding_1d51e1a2d1c0cdaf: function (e, t) {
      x(e).binding = t >>> 0
    },
    __wbg_set_binding_348f002e688081ac: function (e, t) {
      x(e).binding = t >>> 0
    },
    __wbg_set_blend_3f83603fc878c51d: function (e, t) {
      x(e).blend = x(t)
    },
    __wbg_set_buffer_22331adbf81699d2: function (e, t) {
      x(e).buffer = x(t)
    },
    __wbg_set_buffer_b8d40a54af365605: function (e, t) {
      x(e).buffer = x(t)
    },
    __wbg_set_bytes_per_row_95041361899e65c1: function (e, t) {
      x(e).bytesPerRow = t >>> 0
    },
    __wbg_set_clear_value_gpu_color_dict_c17321221601e286: function (e, t) {
      x(e).clearValue = x(t)
    },
    __wbg_set_code_4510e93549b3066e: function (e, t, n) {
      x(e).code = p(t, n)
    },
    __wbg_set_color_14d2fdcfc7117305: function (e, t) {
      x(e).color = x(t)
    },
    __wbg_set_color_attachments_367a5baf85bca057: function (e, t, n) {
      x(e).colorAttachments = d(t, n)
    },
    __wbg_set_device_53f6c9076263d322: function (e, t) {
      x(e).device = x(t)
    },
    __wbg_set_dst_factor_cfb1cd4ae3e673d9: function (e, t) {
      x(e).dstFactor = n[t]
    },
    __wbg_set_entries_7c51a3643c761ecf: function (e, t, n) {
      x(e).entries = d(t, n)
    },
    __wbg_set_entries_cc80db0de96ea4ff: function (e, t, n) {
      x(e).entries = d(t, n)
    },
    __wbg_set_entry_point_a7593f073d0352f7: function (e, t, n) {
      x(e).entryPoint = p(t, n)
    },
    __wbg_set_entry_point_edfb9dd004493bc8: function (e, t, n) {
      x(e).entryPoint = p(t, n)
    },
    __wbg_set_format_036434fd3db220e7: function (e, t) {
      x(e).format = u[t]
    },
    __wbg_set_format_6bbbd4df6747733e: function (e, t) {
      x(e).format = u[t]
    },
    __wbg_set_format_d4c8ef73b087dab0: function (e, t) {
      x(e).format = u[t]
    },
    __wbg_set_fragment_9bc5cc98c7c59fef: function (e, t) {
      x(e).fragment = x(t)
    },
    __wbg_set_g_ac69babc4a0b2338: function (e, t) {
      x(e).g = t
    },
    __wbg_set_has_dynamic_offset_e2a0bd85eaf36f34: function (e, t) {
      x(e).hasDynamicOffset = 0 !== t
    },
    __wbg_set_height_3879aafd24f118f9: function (e, t) {
      x(e).height = t >>> 0
    },
    __wbg_set_layout_4e86f7c1671a06d0: function (e, t) {
      x(e).layout = x(t)
    },
    __wbg_set_layout_f2b50454b73e9111: function (e, t) {
      x(e).layout = x(t)
    },
    __wbg_set_load_op_18ff54287ff40151: function (e, t) {
      x(e).loadOp = i[t]
    },
    __wbg_set_mag_filter_91c348b29e1a6e57: function (e, t) {
      x(e).magFilter = c[t]
    },
    __wbg_set_min_filter_fdbe96994784b13c: function (e, t) {
      x(e).minFilter = c[t]
    },
    __wbg_set_module_168054323d22d57d: function (e, t) {
      x(e).module = x(t)
    },
    __wbg_set_module_1ad4e7343951303d: function (e, t) {
      x(e).module = x(t)
    },
    __wbg_set_operation_d8894b0f9aa3db27: function (e, t) {
      x(e).operation = r[t]
    },
    __wbg_set_r_ccf9fe3e4d993555: function (e, t) {
      x(e).r = t
    },
    __wbg_set_resource_3367d3d5c5114a05: function (e, t) {
      x(e).resource = x(t)
    },
    __wbg_set_resource_gpu_buffer_binding_c689b0dc9379a99b: function (e, t) {
      x(e).resource = x(t)
    },
    __wbg_set_resource_gpu_texture_view_2ed0c241a5831597: function (e, t) {
      x(e).resource = x(t)
    },
    __wbg_set_rows_per_image_97b4a26f53457ed3: function (e, t) {
      x(e).rowsPerImage = t >>> 0
    },
    __wbg_set_sampler_e7e837391d5b7c70: function (e, t) {
      x(e).sampler = x(t)
    },
    __wbg_set_size_4716cf40ee7a64be: function (e, t) {
      x(e).size = t >>> 0
    },
    __wbg_set_size_c2eb75980b76e0ac: function (e, t, n) {
      x(e).size = d(t, n)
    },
    __wbg_set_source_3ffc7e2ebf9b8967: function (e, t) {
      x(e).source = x(t)
    },
    __wbg_set_src_factor_b29ea819b1b5d6f6: function (e, t) {
      x(e).srcFactor = n[t]
    },
    __wbg_set_store_op_6d2fb6cc3e66341e: function (e, t) {
      x(e).storeOp = s[t]
    },
    __wbg_set_targets_0328c60fcfc0f564: function (e, t, n) {
      x(e).targets = d(t, n)
    },
    __wbg_set_texture_5e4b2303dfbef0fa: function (e, t) {
      x(e).texture = x(t)
    },
    __wbg_set_texture_9f67e0e92f7c2af3: function (e, t) {
      x(e).texture = x(t)
    },
    __wbg_set_texture_e6c25e637d8a26a4: function (e, t) {
      x(e).texture = x(t)
    },
    __wbg_set_type_8e9e3a274f528f3e: function (e, t) {
      x(e).type = a[t]
    },
    __wbg_set_type_ff9e8f3110ad0cbf: function (e, t) {
      x(e).type = _[t]
    },
    __wbg_set_usage_7177d2b5a0cb7ed1: function (e, t) {
      x(e).usage = t >>> 0
    },
    __wbg_set_usage_aad5221dc614bcd1: function (e, t) {
      x(e).usage = t >>> 0
    },
    __wbg_set_usage_e842e619c53799e7: function (e, t) {
      x(e).usage = t >>> 0
    },
    __wbg_set_vertex_5b13839ffaff5f37: function (e, t) {
      x(e).vertex = x(t)
    },
    __wbg_set_view_gpu_texture_view_9f7613e516713508: function (e, t) {
      x(e).view = x(t)
    },
    __wbg_set_visibility_78cfb96740c9deb5: function (e, t) {
      x(e).visibility = t >>> 0
    },
    __wbg_set_width_4aa921b5f44a4f8b: function (e, t) {
      x(e).width = t >>> 0
    },
    __wbg_static_accessor_GLOBAL_266715b9d96ba635: function () {
      const e = 'undefined' == typeof global ? null : global
      return T(e) ? 0 : b(e)
    },
    __wbg_static_accessor_GLOBAL_THIS_10fb7dc1ae063179: function () {
      const e = 'undefined' == typeof globalThis ? null : globalThis
      return T(e) ? 0 : b(e)
    },
    __wbg_static_accessor_SELF_0b583911f537483a: function () {
      const e = 'undefined' == typeof self ? null : self
      return T(e) ? 0 : b(e)
    },
    __wbg_static_accessor_WINDOW_d7f903d1508cbdc4: function () {
      const e = 'undefined' == typeof window ? null : window
      return T(e) ? 0 : b(e)
    },
    __wbg_submit_46ecaa46ea244579: function (e, t, n) {
      x(e).submit(d(t, n))
    },
    __wbg_writeBuffer_2c02702ce0fa25c3: function () {
      return v(function (e, t, n, r, _) {
        x(e).writeBuffer(x(t), n >>> 0, l(r, _))
      }, arguments)
    },
    __wbg_writeTexture_1fef8db24ba11cf3: function () {
      return v(function (e, t, n, r, _, o) {
        x(e).writeTexture(x(t), l(n, r), x(_), x(o))
      }, arguments)
    },
    __wbindgen_generic_0000000000000001: function (e) {
      return b(e)
    },
    __wbindgen_generic_0000000000000002: function (e, t) {
      return b(p(e, t))
    },
    __wbindgen_object_clone_ref: function (e) {
      return b(x(e))
    },
    __wbindgen_object_drop_ref: function (e) {
      S(e)
    },
  }
  return { __proto__: null, './luiskr_genie_bg.js': e }
}
Symbol.dispose && (Genie.prototype[Symbol.dispose] = Genie.prototype.free)
const t = ['clamp-to-edge', 'repeat', 'mirror-repeat'],
  n = [
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
  r = ['add', 'subtract', 'reverse-subtract', 'min', 'max'],
  _ = ['uniform', 'storage', 'read-only-storage'],
  o = ['opaque', 'premultiplied'],
  c = ['nearest', 'linear'],
  i = ['load', 'clear'],
  a = ['filtering', 'non-filtering', 'comparison'],
  s = ['store', 'discard'],
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
  f =
    'undefined' == typeof FinalizationRegistry
      ? { register: () => {}, unregister: () => {} }
      : new FinalizationRegistry((e) => W.__wbg_genie_free(e, 1))
function b(e) {
  A === O.length && O.push(O.length + 1)
  const t = A
  return ((A = O[t]), (O[t] = e), t)
}
function g(e) {
  const t = typeof e
  if ('number' == t || 'boolean' == t || null == e) return `${e}`
  if ('string' == t) return `"${e}"`
  if ('symbol' == t) {
    const t = e.description
    return null == t ? 'Symbol' : `Symbol(${t})`
  }
  if ('function' == t) {
    const t = e.name
    return 'string' == typeof t && t.length > 0 ? `Function(${t})` : 'Function'
  }
  if (Array.isArray(e)) {
    const t = e.length
    let n = '['
    t > 0 && (n += g(e[0]))
    for (let r = 1; r < t; r++) n += ', ' + g(e[r])
    return ((n += ']'), n)
  }
  const n = /\[object ([^\]]+)\]/.exec(toString.call(e))
  let r
  if (!(n && n.length > 1)) return toString.call(e)
  if (((r = n[1]), 'Object' == r))
    try {
      return 'Object(' + JSON.stringify(e) + ')'
    } catch (e) {
      return 'Object'
    }
  return e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : r
}
function d(e, t) {
  e >>>= 0
  const n = m(),
    r = []
  for (let _ = e; _ < e + 4 * t; _ += 4) r.push(x(n.getUint32(_, !0)))
  return r
}
function l(e, t) {
  return ((e >>>= 0), y().subarray(e / 1, e / 1 + t))
}
let w = null
function m() {
  return (
    (null === w ||
      !0 === w.buffer.detached ||
      (void 0 === w.buffer.detached && w.buffer !== W.memory.buffer)) &&
      (w = new DataView(W.memory.buffer)),
    w
  )
}
function p(e, t) {
  return (function (e, t) {
    return (
      (I += t),
      I >= B && ((P = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), P.decode(), (I = t)),
      P.decode(y().subarray(e, e + t))
    )
  })(e >>> 0, t)
}
let h = null
function y() {
  return ((null !== h && 0 !== h.byteLength) || (h = new Uint8Array(W.memory.buffer)), h)
}
function x(e) {
  return O[e]
}
function v(e, t) {
  try {
    return e.apply(this, t)
  } catch (e) {
    W.__wbindgen_export3(b(e))
  }
}
let O = new Array(1024).fill(void 0)
O.push(void 0, null, !0, !1)
let A = O.length
function T(e) {
  return null == e
}
function S(e) {
  const t = x(e)
  return (
    (function (e) {
      e < 1028 || ((O[e] = A), (A = e))
    })(e),
    t
  )
}
let P = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })
P.decode()
const B = 2146435072
let I = 0
const R = new TextEncoder()
'encodeInto' in R ||
  (R.encodeInto = function (e, t) {
    const n = R.encode(e)
    return (t.set(n), { read: e.length, written: n.length })
  })
let j,
  L,
  W,
  z = 0
function F(e, t) {
  return ((L = e), (W = e.exports), (j = t), (w = null), (h = null), W)
}
function G(t) {
  if (void 0 !== W) return W
  void 0 !== t &&
    (Object.getPrototypeOf(t) === Object.prototype
      ? ({ module: t } = t)
      : console.warn('using deprecated parameters for `initSync()`; pass a single object instead'))
  const n = e()
  return (
    t instanceof WebAssembly.Module || (t = new WebAssembly.Module(t)),
    F(new WebAssembly.Instance(t, n), t)
  )
}
async function M(t) {
  if (void 0 !== W) return W
  ;(void 0 !== t &&
    (Object.getPrototypeOf(t) === Object.prototype
      ? ({ module_or_path: t } = t)
      : console.warn(
          'using deprecated parameters for the initialization function; pass a single object instead'
        )),
    void 0 === t && (t = new URL('luiskr_genie_bg.wasm', import.meta.url)))
  const n = e()
  ;('string' == typeof t ||
    ('function' == typeof Request && t instanceof Request) ||
    ('function' == typeof URL && t instanceof URL)) &&
    (t = fetch(t))
  const { instance: r, module: _ } = await (async function (e, t) {
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
  return F(r, _)
}
export { G as initSync, M as default }
